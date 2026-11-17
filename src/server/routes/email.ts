import { Router, Response } from 'express';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import rateLimit from 'express-rate-limit';
import {
  attachOptionalGoogleContext,
  GoogleAuthRequest,
} from '../middleware/googleAuth';
import { appendWorksheetRow, getWorksheetRows } from '../services/googleSheets';

const router = Router();
router.use(attachOptionalGoogleContext);

// Rate limiter for sending emails: max 120 sends per 15 minutes per IP
const emailSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    trustProxy: false,
  },
  message: {
    success: false,
    error: 'Email rate limit reached. Please wait a few minutes before sending more payslips.',
  },
});

export interface RuntimeSmtpSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  senderEmail: string;
  senderName: string;
  isVerified: boolean;
  lastVerifiedAt: string | null;
  lastError: string | null;
}

export interface EmailLogEntry {
  id: string;
  payslipId: string;
  employeeId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  provider: 'smtp' | 'gmail';
  deliveryStatus: 'Sent' | 'Failed';
  errorMessage: string | null;
  retryCount: number;
  messageId: string | null;
  sentAt: string;
}

// Sealed server-process memory ONLY — NEVER stored in Google Sheets, PostgreSQL, or browser storage.
let runtimeSmtpOverride: RuntimeSmtpSettings | null = null;
const runtimeEmailLogs: EmailLogEntry[] = [];

export function resetRuntimeEmailStateForTesting(): void {
  runtimeSmtpOverride = null;
  runtimeEmailLogs.length = 0;
  sentCache.clear();
}

export function validateSmtpInput(input: {
  smtpHost?: string;
  smtpPort?: number;
  senderEmail?: string;
}): { valid: boolean; error?: string } {
  if (!input.smtpHost || typeof input.smtpHost !== 'string' || !input.smtpHost.trim()) {
    return { valid: false, error: 'SMTP Host is required.' };
  }
  const portNum = Number(input.smtpPort || 587);
  if (!Number.isFinite(portNum) || portNum < 1 || portNum > 65535) {
    return { valid: false, error: 'SMTP Port must be a valid port number between 1 and 65535.' };
  }
  if (!input.senderEmail || typeof input.senderEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.senderEmail.trim())) {
    return { valid: false, error: 'A valid Sender Email address is required.' };
  }
  return { valid: true };
}

export function getResolvedSmtpConfig(): {
  source: 'server_env' | 'runtime_memory' | 'unconfigured';
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  senderEmail: string;
  senderName: string;
  isConfigured: boolean;
  isVerified: boolean;
  lastVerifiedAt: string | null;
  lastError: string | null;
} {
  if (runtimeSmtpOverride) {
    return {
      source: 'runtime_memory',
      ...runtimeSmtpOverride,
      isConfigured: Boolean(runtimeSmtpOverride.smtpHost && runtimeSmtpOverride.senderEmail),
    };
  }

  const smtpHost = process.env.SMTP_HOST?.trim() || '';
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpUser = process.env.SMTP_USER?.trim() || '';
  const smtpPass = process.env.SMTP_PASS?.trim() || '';
  const senderEmail = process.env.SMTP_SENDER_EMAIL?.trim() || '';
  const senderName = process.env.SMTP_SENDER_NAME?.trim() || 'Employee Database Studio HR';
  const isConfigured = Boolean(smtpHost && senderEmail);

  return {
    source: isConfigured ? 'server_env' : 'unconfigured',
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    senderEmail,
    senderName,
    isConfigured,
    isVerified: isConfigured,
    lastVerifiedAt: null,
    lastError: null,
  };
}

// In-memory deduplication cache: key -> timestamp (expires in 60s)
const sentCache = new Map<string, number>();

function isDuplicateSend(key: string): boolean {
  const now = Date.now();
  const lastSent = sentCache.get(key);
  if (lastSent && now - lastSent < 60000) {
    return true;
  }
  sentCache.set(key, now);
  if (sentCache.size > 500) {
    for (const [k, time] of sentCache.entries()) {
      if (now - time > 120000) sentCache.delete(k);
    }
  }
  return false;
}

export function isSingleRecipientEmail(email: string): boolean {
  const trimmed = String(email || '').trim();
  if (!trimmed || trimmed.includes(',') || trimmed.includes(';')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function buildMimeRawMessage(params: {
  from: string;
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  attachmentName?: string;
  pdfBase64?: string;
}): string {
  const cleanSubject = params.subject.replace(/[\r\n]+/g, ' ').trim();
  const cleanTo = params.to.replace(/[\r\n]+/g, '').trim();
  const cleanFrom = params.from.replace(/[\r\n]+/g, '').trim();

  if (params.pdfBase64 && params.attachmentName) {
    const boundary = `eds_boundary_${Date.now().toString(36)}`;
    const cleanB64 = params.pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const safeFile = params.attachmentName.replace(/["\r\n]/g, '');

    const parts = [
      `From: ${cleanFrom}`,
      `To: ${cleanTo}`,
      `Subject: ${cleanSubject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      params.bodyHtml || params.bodyText.replace(/\n/g, '<br/>'),
      '',
      `--${boundary}`,
      `Content-Type: application/pdf; name="${safeFile}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${safeFile}"`,
      '',
      cleanB64.replace(/(.{76})/g, '$1\r\n'),
      `--${boundary}--`,
    ];
    return Buffer.from(parts.join('\r\n'), 'utf8').toString('base64url');
  }

  const parts = [
    `From: ${cleanFrom}`,
    `To: ${cleanTo}`,
    `Subject: ${cleanSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    params.bodyHtml || params.bodyText.replace(/\n/g, '<br/>'),
  ];
  return Buffer.from(parts.join('\r\n'), 'utf8').toString('base64url');
}

async function recordEmailDeliveryLog(
  req: GoogleAuthRequest,
  entry: Omit<EmailLogEntry, 'sentAt'>
): Promise<EmailLogEntry> {
  const fullEntry: EmailLogEntry = {
    ...entry,
    sentAt: new Date().toISOString(),
  };

  runtimeEmailLogs.unshift(fullEntry);
  if (runtimeEmailLogs.length > 200) {
    runtimeEmailLogs.length = 200;
  }

  if (req.googleAccessToken && req.spreadsheetId) {
    await appendWorksheetRow(req.googleAccessToken, req.spreadsheetId, 'Email Logs', [
      fullEntry.id,
      fullEntry.payslipId || '',
      fullEntry.employeeId || '',
      fullEntry.recipientEmail,
      fullEntry.provider === 'gmail' ? 'HR Gmail API' : 'Company SMTP',
      fullEntry.sentAt,
      fullEntry.deliveryStatus,
      fullEntry.errorMessage || '',
      fullEntry.retryCount ?? 0,
    ]).catch(() => {});
  }

  return fullEntry;
}

async function inspectGoogleGmailToken(accessToken?: string): Promise<{
  googleConnected: boolean;
  gmailConnected: boolean;
  gmailEmail: string | null;
}> {
  if (!accessToken) {
    return { googleConnected: false, gmailConnected: false, gmailEmail: null };
  }
  try {
    const [infoRes, userRes] = await Promise.all([
      fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(accessToken)}`),
      fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);
    if (!infoRes.ok) {
      return { googleConnected: false, gmailConnected: false, gmailEmail: null };
    }
    const info: any = await infoRes.json().catch(() => ({}));
    const user: any = userRes.ok ? await userRes.json().catch(() => ({})) : {};
    const scopesLower = String(info.scope || '').toLowerCase();
    return {
      googleConnected: true,
      gmailConnected: scopesLower.includes('gmail.send') || scopesLower.includes('mail.google'),
      gmailEmail: user.email || info.email || null,
    };
  } catch {
    return { googleConnected: false, gmailConnected: false, gmailEmail: null };
  }
}

// GET /api/email/status - Independent Company SMTP + optional HR Gmail API provider readiness
router.get('/status', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const smtp = getResolvedSmtpConfig();
    const gmailState = await inspectGoogleGmailToken(req.googleAccessToken);

    res.json({
      success: true,
      smtpConfigured: smtp.isConfigured,
      smtpVerified: smtp.isVerified,
      smtpSource: smtp.source,
      smtpSenderEmail: smtp.senderEmail || null,
      googleConnected: gmailState.googleConnected,
      gmailConnected: gmailState.gmailConnected,
      gmailScopeMissing: gmailState.googleConnected && !gmailState.gmailConnected,
      gmailEmail: gmailState.gmailEmail,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// GET /api/email/logs - Delivery logs from Google Sheets ('Email Logs') + current session logs
router.get('/logs', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const merged = new Map<string, EmailLogEntry>();
    for (const log of runtimeEmailLogs) {
      merged.set(log.id, log);
    }

    if (req.googleAccessToken && req.spreadsheetId) {
      try {
        const rows = await getWorksheetRows(req.googleAccessToken, req.spreadsheetId, 'Email Logs');
        for (const row of rows.slice(1)) {
          const id = String(row[0] || '').trim();
          if (!id || merged.has(id)) continue;
          const providerLabel = String(row[4] || '').toLowerCase();
          merged.set(id, {
            id,
            payslipId: String(row[1] || ''),
            employeeId: String(row[2] || ''),
            recipientEmail: String(row[3] || ''),
            recipientName: '',
            subject: '',
            provider: providerLabel.includes('gmail') ? 'gmail' : 'smtp',
            deliveryStatus: String(row[6] || 'Sent') === 'Failed' ? 'Failed' : 'Sent',
            errorMessage: row[7] ? String(row[7]) : null,
            retryCount: Number(row[8] || 0),
            messageId: null,
            sentAt: String(row[5] || new Date().toISOString()),
          });
        }
      } catch {
        // Return runtime logs if Sheets read fails cleanly
      }
    }

    const logs = Array.from(merged.values()).sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    );
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// GET /api/email/settings - Current SMTP status (NEVER returns smtpPass)
router.get('/settings', (_req: GoogleAuthRequest, res: Response) => {
  const config = getResolvedSmtpConfig();

  if (!config.isConfigured) {
    return res.json({
      success: true,
      isConfigured: false,
      isVerified: false,
      source: 'unconfigured',
      message: 'Company SMTP not configured (set SMTP_* env vars on the server or configure for current session).',
      settings: {
        smtpHost: '',
        smtpPort: 587,
        smtpUser: '',
        senderEmail: '',
        senderName: '',
        hasPassword: false,
        isVerified: false,
        lastVerifiedAt: null,
        lastError: null,
      },
    });
  }

  res.json({
    success: true,
    isConfigured: true,
    isVerified: config.isVerified,
    source: config.source,
    message: config.isVerified
      ? 'Company SMTP active and verified'
      : 'Company SMTP configured in server memory (verify connection before sending)',
    settings: {
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpUser: config.smtpUser,
      senderEmail: config.senderEmail,
      senderName: config.senderName,
      hasPassword: Boolean(config.smtpPass),
      isVerified: config.isVerified,
      lastVerifiedAt: config.lastVerifiedAt,
      lastError: config.lastError,
    },
  });
});

// PUT /api/email/settings - Configure server-process in-memory SMTP (NEVER persisted in Sheets or browser storage)
router.put('/settings', (req: GoogleAuthRequest, res: Response) => {
  const { smtpHost, smtpPort, smtpUser, smtpPass, senderEmail, senderName } = req.body || {};
  const portNum = Number(smtpPort) || 587;
  const check = validateSmtpInput({ smtpHost, smtpPort: portNum, senderEmail });
  if (!check.valid) {
    return res.status(400).json({ success: false, error: check.error });
  }

  const existing = getResolvedSmtpConfig();
  const finalPass =
    smtpPass !== undefined && smtpPass !== null && String(smtpPass).trim() !== ''
      ? String(smtpPass).trim()
      : existing.smtpPass;

  const changed =
    existing.smtpHost !== smtpHost.trim() ||
    existing.smtpPort !== portNum ||
    existing.smtpUser !== String(smtpUser || '').trim() ||
    Boolean(smtpPass && String(smtpPass).trim() !== existing.smtpPass);

  runtimeSmtpOverride = {
    smtpHost: smtpHost.trim(),
    smtpPort: portNum,
    smtpUser: String(smtpUser || '').trim(),
    smtpPass: finalPass,
    senderEmail: senderEmail.trim(),
    senderName: String(senderName || '').trim() || 'Employee Database Studio HR',
    isVerified: changed ? false : existing.isVerified,
    lastVerifiedAt: changed ? null : existing.lastVerifiedAt,
    lastError: null,
  };

  res.json({
    success: true,
    source: 'runtime_memory',
    message:
      'SMTP settings stored in sealed server memory for this runtime (never written to Google Sheets or browser storage). Verify connection before sending.',
    isVerified: runtimeSmtpOverride.isVerified,
  });
});

// POST /api/email/verify - Verify Company SMTP connection via Nodemailer
router.post('/verify', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const stored = getResolvedSmtpConfig();
    const host = String(req.body?.smtpHost || stored.smtpHost || '').trim();
    const port = Number(req.body?.smtpPort || stored.smtpPort) || 587;
    const user = req.body?.smtpUser !== undefined ? String(req.body.smtpUser).trim() : stored.smtpUser;
    const pass =
      req.body?.smtpPass !== undefined && req.body.smtpPass !== ''
        ? String(req.body.smtpPass)
        : stored.smtpPass;

    if (!host) {
      return res.status(400).json({
        success: false,
        error: 'SMTP Host is required to test connection.',
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    await transporter.verify();

    const now = new Date().toISOString();
    if (runtimeSmtpOverride || req.body?.smtpHost) {
      runtimeSmtpOverride = {
        smtpHost: host,
        smtpPort: port,
        smtpUser: user,
        smtpPass: pass,
        senderEmail: String(req.body?.senderEmail || stored.senderEmail || user || '').trim(),
        senderName: String(req.body?.senderName || stored.senderName || 'Employee Database Studio HR').trim(),
        isVerified: true,
        lastVerifiedAt: now,
        lastError: null,
      };
    }

    res.json({
      success: true,
      message: `SMTP connection to ${host}:${port} verified successfully.`,
      verifiedAt: now,
    });
  } catch (err: any) {
    const cleanError =
      err?.message || 'Failed to connect to SMTP server. Please check your credentials and host settings.';
    if (runtimeSmtpOverride) {
      runtimeSmtpOverride.isVerified = false;
      runtimeSmtpOverride.lastError = cleanError;
    }
    res.status(err?.statusCode || 400).json({ success: false, error: cleanError });
  }
});

// POST /api/email/test - Send an SMTP test verification email (independent of Gmail/OAuth)
router.post('/test', emailSendLimiter, async (req: GoogleAuthRequest, res: Response) => {
  try {
    const recipientEmail = String(req.body?.recipientEmail || '').trim();
    if (!isSingleRecipientEmail(recipientEmail)) {
      return res.status(400).json({
        success: false,
        error: 'A single valid recipient email address is required for SMTP test delivery.',
      });
    }

    const stored = getResolvedSmtpConfig();
    const host = String(req.body?.smtpHost || stored.smtpHost || '').trim();
    const port = Number(req.body?.smtpPort || stored.smtpPort) || 587;
    const user = req.body?.smtpUser !== undefined ? String(req.body.smtpUser).trim() : stored.smtpUser;
    const pass =
      req.body?.smtpPass !== undefined && req.body.smtpPass !== ''
        ? String(req.body.smtpPass)
        : stored.smtpPass;
    const senderEmail = String(req.body?.senderEmail || stored.senderEmail || '').trim();
    const senderName = String(
      req.body?.senderName || stored.senderName || 'Employee Database Studio HR'
    ).trim();

    if (!host || !senderEmail) {
      return res.status(400).json({
        success: false,
        error: 'SMTP Host and Sender Email are required before sending a test email.',
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    const info = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: recipientEmail,
      subject: 'Employee Database Studio — Company SMTP Test Verification',
      text: `This is a configuration verification email from Employee Database Studio via ${host}:${port}.`,
      html: `<p>This is a configuration verification email from <strong>Employee Database Studio</strong> via <code>${host}:${port}</code>.</p>`,
    });

    if (runtimeSmtpOverride) {
      runtimeSmtpOverride.isVerified = true;
      runtimeSmtpOverride.lastVerifiedAt = new Date().toISOString();
      runtimeSmtpOverride.lastError = null;
    }

    res.json({
      success: true,
      messageId: info.messageId,
      message: `Test email dispatched to ${recipientEmail} via ${host}:${port}.`,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 400).json({
      success: false,
      error: err?.message || 'Failed to send SMTP test email.',
    });
  }
});

// POST /api/email/send - Send individual single-recipient payslip email via Company SMTP or HR Gmail API
router.post('/send', emailSendLimiter, async (req: GoogleAuthRequest, res: Response) => {
  const {
    provider = 'smtp',
    payslipId = '',
    recipientEmail,
    recipientName = '',
    employeeId = '',
    subject,
    bodyText,
    bodyHtml,
    attachmentName,
    pdfBase64,
    retryCount = 0,
  } = req.body || {};

  const selectedProvider: 'smtp' | 'gmail' = provider === 'gmail' ? 'gmail' : 'smtp';
  const emailLogId = `eml_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  try {
    if (!recipientEmail || !subject || !bodyText) {
      return res.status(400).json({
        success: false,
        error: 'Recipient email, subject, and email body are required.',
      });
    }

    if (!isSingleRecipientEmail(recipientEmail)) {
      return res.status(400).json({
        success: false,
        error:
          'Individual single-recipient email dispatch is required. Multiple recipients or invalid addresses are not allowed.',
      });
    }

    const dedupKey = `${selectedProvider}_${employeeId || recipientEmail}_${subject}`;
    if (isDuplicateSend(dedupKey)) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate send prevented: this payslip email was recently dispatched.',
      });
    }

    let messageId = '';

    if (selectedProvider === 'gmail') {
      const accessToken = req.googleAccessToken;
      if (!accessToken) {
        return res.status(401).json({
          success: false,
          code: 'GOOGLE_AUTH_REQUIRED',
          error:
            'HR Google account is not signed in. Sign in with Google in Company Settings or Email Delivery to send via Gmail API.',
        });
      }

      const gmailState = await inspectGoogleGmailToken(accessToken);
      if (!gmailState.googleConnected) {
        return res.status(401).json({
          success: false,
          code: 'GOOGLE_TOKEN_EXPIRED',
          error: 'Google OAuth session expired. Please reconnect your Google account and retry.',
        });
      }
      if (!gmailState.gmailConnected || !gmailState.gmailEmail) {
        return res.status(403).json({
          success: false,
          error:
            'Gmail send permission (gmail.send) has not been granted yet. Click "Enable Gmail Permission" to authorize incrementally.',
        });
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth });

      const raw = buildMimeRawMessage({
        from: gmailState.gmailEmail,
        to: recipientEmail.trim(),
        subject,
        bodyText,
        bodyHtml,
        attachmentName,
        pdfBase64,
      });

      const sendRes = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });

      messageId = sendRes.data.id || `gmail_${Date.now()}`;
    } else {
      const config = getResolvedSmtpConfig();
      if (!config.isConfigured || !config.smtpHost || !config.senderEmail) {
        return res.status(400).json({
          success: false,
          error:
            'Company SMTP is not configured. Configure server SMTP env variables or enter verified SMTP settings in Company Settings.',
        });
      }

      if (!config.isVerified) {
        return res.status(400).json({
          success: false,
          error:
            'Company SMTP is not verified. Please test and verify your SMTP server connection in Company Settings.',
        });
      }

      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        auth: config.smtpUser && config.smtpPass ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
        connectionTimeout: 15000,
        socketTimeout: 15000,
      });

      const attachments: any[] = [];
      if (pdfBase64 && attachmentName) {
        const cleanBase64 = String(pdfBase64).replace(/^data:application\/pdf;base64,/, '');
        attachments.push({
          filename: attachmentName,
          content: Buffer.from(cleanBase64, 'base64'),
          contentType: 'application/pdf',
        });
      }

      const info = await transporter.sendMail({
        from: `"${config.senderName || 'Employee Database Studio HR'}" <${config.senderEmail}>`,
        to: recipientEmail.trim(),
        subject,
        text: bodyText,
        html: bodyHtml || String(bodyText).replace(/\n/g, '<br/>'),
        attachments,
      });
      messageId = info.messageId;
    }

    const log = await recordEmailDeliveryLog(req, {
      id: emailLogId,
      payslipId: String(payslipId || ''),
      employeeId: String(employeeId || ''),
      recipientEmail: recipientEmail.trim(),
      recipientName: String(recipientName || ''),
      subject: String(subject),
      provider: selectedProvider,
      deliveryStatus: 'Sent',
      errorMessage: null,
      retryCount: Number(retryCount || 0),
      messageId,
    });

    res.json({
      success: true,
      logId: emailLogId,
      log,
      provider: selectedProvider,
      messageId,
      message: `Payslip email successfully sent to ${recipientEmail} via ${selectedProvider === 'gmail' ? 'HR Gmail API' : 'Company SMTP'}.`,
    });
  } catch (err: any) {
    let failedLog: EmailLogEntry | undefined;
    if (recipientEmail && subject) {
      failedLog = await recordEmailDeliveryLog(req, {
        id: emailLogId,
        payslipId: String(payslipId || ''),
        employeeId: String(employeeId || ''),
        recipientEmail: String(recipientEmail),
        recipientName: String(recipientName || ''),
        subject: String(subject),
        provider: selectedProvider,
        deliveryStatus: 'Failed',
        errorMessage: err?.message || 'Unknown email dispatch failure',
        retryCount: Number(retryCount || 0),
        messageId: null,
      });
    }
    res.status(err?.statusCode || 500).json({
      success: false,
      log: failedLog,
      error: err?.message || 'Failed to dispatch payslip email.',
    });
  }
});

export default router;
