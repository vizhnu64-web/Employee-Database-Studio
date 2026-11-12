import { Router } from 'express';
import nodemailer from 'nodemailer';
import { query } from '../db/pool';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

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
  message: { success: false, error: 'Email rate limit reached. Please wait a few minutes before sending more payslips.' }
});

// In-memory deduplication cache: key -> timestamp (expires in 60s)
const sentCache = new Map<string, number>();

function isDuplicateSend(key: string): boolean {
  const now = Date.now();
  const lastSent = sentCache.get(key);
  if (lastSent && now - lastSent < 60000) {
    return true;
  }
  sentCache.set(key, now);
  // Cleanup entries older than 2 minutes
  if (sentCache.size > 500) {
    for (const [k, time] of sentCache.entries()) {
      if (now - time > 120000) sentCache.delete(k);
    }
  }
  return false;
}

// Helper: load server-side SMTP config for a company
async function getServerSmtpConfig(companyId: number) {
  const res = await query('SELECT * FROM company_smtp_settings WHERE company_id = $1', [companyId]);
  const row = res.rows[0];

  const smtpHost = row?.smtp_host || (process.env.SMTP_HOST?.trim() ? process.env.SMTP_HOST.trim() : '');
  const smtpPort = Number(row?.smtp_port || process.env.SMTP_PORT) || 587;
  const smtpUser = row?.smtp_user || (process.env.SMTP_USER?.trim() ? process.env.SMTP_USER.trim() : '');
  const smtpPass = row?.smtp_pass || (process.env.SMTP_PASS?.trim() ? process.env.SMTP_PASS.trim() : '');
  const senderEmail = row?.sender_email || (process.env.SMTP_SENDER_EMAIL?.trim() ? process.env.SMTP_SENDER_EMAIL.trim() : '');
  const senderName = row?.sender_name || (process.env.SMTP_SENDER_NAME?.trim() ? process.env.SMTP_SENDER_NAME.trim() : '');
  const isVerified = Boolean(row?.is_verified);
  const lastVerifiedAt = row?.last_verified_at || null;
  const lastError = row?.last_error || null;

  // A valid configuration requires at least host and senderEmail
  const isConfigured = Boolean(smtpHost && senderEmail);

  return {
    row,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    senderEmail,
    senderName,
    isConfigured,
    isVerified,
    lastVerifiedAt,
    lastError
  };
}

// GET /api/email/settings - Get current SMTP configuration status (NEVER returns passwords)
router.get('/settings', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const config = await getServerSmtpConfig(companyId);

    if (!config.isConfigured) {
      return res.json({
        success: true,
        isConfigured: false,
        isVerified: false,
        message: 'Email service not configured',
        settings: {
          smtpHost: '',
          smtpPort: 587,
          smtpUser: '',
          senderEmail: '',
          senderName: '',
          hasPassword: false,
          isVerified: false,
          lastVerifiedAt: null,
          lastError: null
        }
      });
    }

    res.json({
      success: true,
      isConfigured: true,
      isVerified: config.isVerified,
      message: config.isVerified ? 'Email service active and verified' : 'Email service configured but not verified',
      settings: {
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        senderEmail: config.senderEmail,
        senderName: config.senderName,
        hasPassword: Boolean(config.smtpPass),
        isVerified: config.isVerified,
        lastVerifiedAt: config.lastVerifiedAt,
        lastError: config.lastError
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/email/settings - Configure server-side SMTP settings (Admin only)
router.put('/settings', authenticateToken, requireRole(['admin', 'super_admin']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { smtpHost, smtpPort, smtpUser, smtpPass, senderEmail, senderName } = req.body;

    if (!smtpHost || typeof smtpHost !== 'string' || !smtpHost.trim()) {
      return res.status(400).json({ success: false, error: 'SMTP Host is required.' });
    }

    const portNum = Number(smtpPort) || 587;
    if (portNum < 1 || portNum > 65535) {
      return res.status(400).json({ success: false, error: 'SMTP Port must be a valid port number between 1 and 65535.' });
    }

    if (!senderEmail || typeof senderEmail !== 'string' || !senderEmail.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid Sender Email address is required.' });
    }

    // Check existing record to preserve password if not provided
    const existing = await getServerSmtpConfig(companyId);
    let finalPassword = existing.smtpPass;
    if (smtpPass !== undefined && smtpPass !== null && smtpPass !== '') {
      finalPassword = String(smtpPass).trim();
    }

    // Check if host or credentials changed, resetting verification state
    const changed = existing.smtpHost !== smtpHost.trim() ||
                    existing.smtpPort !== portNum ||
                    existing.smtpUser !== (smtpUser?.trim() || '') ||
                    (smtpPass && smtpPass !== existing.smtpPass);

    const isVerified = changed ? false : existing.isVerified;

    await query(`
      INSERT INTO company_smtp_settings (
        company_id, smtp_host, smtp_port, smtp_user, smtp_pass, sender_email, sender_name, is_verified, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (company_id) DO UPDATE SET
        smtp_host = EXCLUDED.smtp_host,
        smtp_port = EXCLUDED.smtp_port,
        smtp_user = EXCLUDED.smtp_user,
        smtp_pass = EXCLUDED.smtp_pass,
        sender_email = EXCLUDED.sender_email,
        sender_name = EXCLUDED.sender_name,
        is_verified = EXCLUDED.is_verified,
        updated_at = CURRENT_TIMESTAMP
    `, [
      companyId,
      smtpHost.trim(),
      portNum,
      smtpUser?.trim() || '',
      finalPassword || '',
      senderEmail.trim(),
      senderName?.trim() || 'PeopleDesk Studio HR',
      isVerified
    ]);

    // Audit log (without password!)
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      companyId,
      req.user?.id || null,
      'UPDATE_SMTP_SETTINGS',
      'COMPANY',
      String(companyId),
      `Updated SMTP settings for host: ${smtpHost.trim()}:${portNum}, sender: ${senderEmail.trim()}`,
      req.ip || '127.0.0.1'
    ]);

    res.json({
      success: true,
      message: 'SMTP configuration saved securely on the server. Please test and verify the connection.',
      isVerified
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/email/verify - Test and validate SMTP connection
router.post('/verify', authenticateToken, requireRole(['admin', 'super_admin']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { smtpHost, smtpPort, smtpUser, smtpPass } = req.body;

    const stored = await getServerSmtpConfig(companyId);

    const host = smtpHost?.trim() || stored.smtpHost;
    const port = Number(smtpPort || stored.smtpPort) || 587;
    const user = smtpUser !== undefined ? smtpUser.trim() : stored.smtpUser;
    const pass = (smtpPass !== undefined && smtpPass !== '') ? smtpPass : stored.smtpPass;

    if (!host) {
      return res.status(400).json({
        success: false,
        error: 'Email service not configured. SMTP Host is required to test connection.'
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: (user && pass) ? {
        user,
        pass
      } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    await transporter.verify();

    // Mark as verified in database
    await query(`
      UPDATE company_smtp_settings
      SET is_verified = TRUE, last_verified_at = CURRENT_TIMESTAMP, last_error = NULL
      WHERE company_id = $1
    `, [companyId]);

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      companyId,
      req.user?.id || null,
      'VERIFY_SMTP_SUCCESS',
      'COMPANY',
      String(companyId),
      `SMTP connection verified successfully to ${host}:${port}`,
      req.ip || '127.0.0.1'
    ]);

    res.json({
      success: true,
      message: `SMTP connection to ${host}:${port} verified successfully. Email delivery is now active.`
    });
  } catch (err: any) {
    const companyId = req.user?.companyId || 1;
    const cleanError = err.message || 'Failed to connect to SMTP server. Please check your credentials and host settings.';

    await query(`
      UPDATE company_smtp_settings
      SET is_verified = FALSE, last_error = $1
      WHERE company_id = $2
    `, [cleanError, companyId]);

    console.warn('[Email Route] SMTP Verification failed:', cleanError);
    res.status(400).json({
      success: false,
      error: cleanError
    });
  }
});

// POST /api/email/send - Send payslip email with attachment (Disabled if not configured/verified)
router.post('/send', authenticateToken, emailSendLimiter, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const {
      recipientEmail,
      recipientName,
      employeeId,
      subject,
      bodyText,
      bodyHtml,
      attachmentName,
      pdfBase64
    } = req.body;

    if (!recipientEmail || !subject || !bodyText) {
      return res.status(400).json({
        success: false,
        error: 'Recipient email, subject, and email body are required.'
      });
    }

    // Check server-side SMTP configuration
    const config = await getServerSmtpConfig(companyId);

    // Disable email sending if not configured
    if (!config.isConfigured || !config.smtpHost || !config.senderEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email service not configured. Please configure and verify valid SMTP server settings in Company Settings before dispatching payslips.'
      });
    }

    // Disable email sending until verified
    if (!config.isVerified) {
      return res.status(400).json({
        success: false,
        error: 'Email service is not verified. Please test and verify your SMTP server connection in Company Settings before dispatching payslips.'
      });
    }

    // Deduplication check
    const dedupKey = `${companyId}_${employeeId || recipientEmail}_${subject}`;
    if (isDuplicateSend(dedupKey)) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate send prevented: this payslip email was recently sent within the last minute.'
      });
    }

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: (config.smtpUser && config.smtpPass) ? {
        user: config.smtpUser,
        pass: config.smtpPass
      } : undefined,
      connectionTimeout: 15000,
      socketTimeout: 15000
    });

    const attachments: any[] = [];
    if (pdfBase64 && attachmentName) {
      const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      attachments.push({
        filename: attachmentName,
        content: Buffer.from(cleanBase64, 'base64'),
        contentType: 'application/pdf'
      });
    }

    const mailOptions = {
      from: `"${config.senderName || 'PeopleDesk Studio HR'}" <${config.senderEmail}>`,
      to: recipientEmail,
      subject,
      text: bodyText,
      html: bodyHtml || bodyText.replace(/\n/g, '<br/>'),
      attachments
    };

    const info = await transporter.sendMail(mailOptions);

    // Audit logging (clean, no credentials)
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      companyId,
      req.user?.id || null,
      'SEND_PAYSLIP_EMAIL',
      'EMPLOYEE',
      employeeId || recipientEmail,
      `Sent payslip email to ${recipientEmail} (${recipientName || ''}) with subject: ${subject}`,
      req.ip || '127.0.0.1'
    ]);

    res.json({
      success: true,
      messageId: info.messageId,
      message: `Payslip email successfully sent to ${recipientEmail}.`
    });
  } catch (err: any) {
    console.error('[Email Route] Failed to send email:', err.message);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to dispatch email via SMTP server.'
    });
  }
});

export default router;
