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

// POST /api/email/verify - Test SMTP connection
router.post('/verify', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { smtpHost, smtpPort, smtpUser, smtpPass } = req.body;

    if (!smtpHost || !smtpPort) {
      return res.status(400).json({ success: false, error: 'SMTP Host and Port are required.' });
    }

    const portNum = Number(smtpPort) || 587;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: portNum,
      secure: portNum === 465,
      auth: (smtpUser && smtpPass) ? {
        user: smtpUser,
        pass: smtpPass
      } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    await transporter.verify();

    res.json({
      success: true,
      message: `SMTP connection to ${smtpHost}:${portNum} verified successfully.`
    });
  } catch (err: any) {
    console.warn('[Email Route] SMTP Verification failed:', err.message);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to connect to SMTP server. Please check your credentials and host settings.'
    });
  }
});

// POST /api/email/send - Send payslip email with attachment
router.post('/send', authenticateToken, emailSendLimiter, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const {
      smtpConfig,
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

    // Deduplication check
    const dedupKey = `${companyId}_${employeeId || recipientEmail}_${subject}`;
    if (isDuplicateSend(dedupKey)) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate send prevented: this payslip email was recently sent within the last minute.'
      });
    }

    const host = smtpConfig?.smtpHost || process.env.SMTP_HOST;
    const port = Number(smtpConfig?.smtpPort || process.env.SMTP_PORT) || 587;
    const user = smtpConfig?.smtpUser || process.env.SMTP_USER;
    const pass = smtpConfig?.smtpPass || process.env.SMTP_PASS;
    const senderName = smtpConfig?.senderName || process.env.SMTP_SENDER_NAME || 'PeopleDesk Studio HR';
    const senderEmail = smtpConfig?.senderEmail || process.env.SMTP_SENDER_EMAIL || user || 'noreply@peopledesk.com';

    if (!host) {
      return res.status(400).json({
        success: false,
        error: 'No SMTP configuration provided or found in server environment.'
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: (user && pass) ? { user, pass } : undefined,
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
      from: `"${senderName}" <${senderEmail}>`,
      to: recipientEmail,
      subject,
      text: bodyText,
      html: bodyHtml || bodyText.replace(/\n/g, '<br/>'),
      attachments
    };

    const info = await transporter.sendMail(mailOptions);

    // Audit logging
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
    console.error('[Email Route] Failed to send email:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to dispatch email via SMTP server.'
    });
  }
});

export default router;
