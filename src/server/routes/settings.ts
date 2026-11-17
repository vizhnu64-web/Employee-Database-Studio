import { Router, Response } from 'express';
import multer from 'multer';
import { requireGoogleAccessToken, GoogleAuthRequest } from '../middleware/googleAuth';
import { uploadFileToDrive } from '../services/googleDrive';
import {
  getWorksheetRows,
  upsertWorksheetRowByKey,
  recordSyncLog,
} from '../services/googleSheets';

const router = Router();
router.use(requireGoogleAccessToken);

function resolveSpreadsheetId(req: GoogleAuthRequest): string {
  return String(
    req.spreadsheetId || req.body?.spreadsheetId || req.query?.spreadsheetId || ''
  ).trim();
}

function resolveFolderId(req: GoogleAuthRequest): string | null {
  const f = String(
    req.driveRootFolderId || req.body?.driveRootFolderId || req.query?.driveRootFolderId || ''
  ).trim();
  return f || null;
}

function safeJson(raw: any) {
  if (!raw || typeof raw !== 'string') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

// GET /api/settings - Load Company Settings from Google Sheets ('Company Settings' & 'Layout Settings')
router.get('/', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const sid = resolveSpreadsheetId(req);
    if (!sid) {
      return res.json({ success: true, settings: null });
    }
    const token = req.googleAccessToken!;
    const [compRows, layoutRows] = await Promise.all([
      getWorksheetRows(token, sid, 'Company Settings'),
      getWorksheetRows(token, sid, 'Layout Settings').catch(() => []),
    ]);

    const row = compRows[1];
    if (!row) {
      return res.json({ success: true, settings: null });
    }

    const designJson = safeJson(row[5]) || {};
    const emailJson = safeJson(row[6]) || {};
    const layoutJson = layoutRows[1] ? safeJson(layoutRows[1][2]) : undefined;

    const settings = {
      ...designJson,
      companyName: row[0] || designJson.companyName || '',
      phone: row[2] || designJson.phone || '',
      email: row[3] || designJson.email || '',
      logoDriveFileId: row[4] || designJson.logoDriveFileId || undefined,
      emailDisplayName: emailJson.displayName || designJson.emailDisplayName || '',
      emailSignature: emailJson.signature || designJson.emailSignature || '',
      emailFooterText: emailJson.footerText || designJson.emailFooterText || '',
      layoutSettings: layoutJson || designJson.layoutSettings,
    };

    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// PUT /api/settings - Persist Company Settings to Google Sheets (zero secrets stored)
router.put('/', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const sid = resolveSpreadsheetId(req);
    if (!sid) {
      return res.status(400).json({
        success: false,
        error: 'No Google Spreadsheet linked. Link or initialize a spreadsheet in Google Workspace Setup before saving cloud settings.',
      });
    }
    const token = req.googleAccessToken!;
    const s = req.body || {};
    const now = new Date().toISOString();
    const address = [s.addressLine1, s.addressLine2, s.cityStateZip].filter(Boolean).join(', ');

    const { smtpPass: _p, smtpPassword: _p2, ...safeSettings } = s;

    await upsertWorksheetRowByKey(
      token,
      sid,
      'Company Settings',
      s.companyName || 'Default Company',
      [
        s.companyName || 'Default Company',
        address,
        s.phone || '',
        s.email || '',
        s.logoDriveFileId || '',
        JSON.stringify(safeSettings),
        JSON.stringify({
          displayName: s.emailDisplayName || '',
          signature: s.emailSignature || '',
          footerText: s.emailFooterText || '',
        }),
        now,
        1,
      ],
      0
    );

    if (s.layoutSettings && typeof s.layoutSettings === 'object') {
      await upsertWorksheetRowByKey(
        token,
        sid,
        'Layout Settings',
        'default_payslip_layout',
        [
          'default_payslip_layout',
          s.layoutSettings.templatePreset || s.layoutSettings.templateName || 'Enterprise Standard A4',
          JSON.stringify(s.layoutSettings),
          JSON.stringify(s.layoutSettings.sectionOrder || []),
          JSON.stringify(s.layoutSettings.visibility || {}),
          JSON.stringify({
            primaryColor: s.layoutSettings.primaryColor,
            secondaryColor: s.layoutSettings.secondaryColor,
          }),
          now,
          1,
        ],
        0
      );
    }

    await recordSyncLog(token, sid, {
      worksheetName: 'Company Settings',
      recordKey: s.companyName || 'company_settings',
      action: 'UPSERT',
      status: 'Synced',
      details: 'Updated Company Settings in Google Sheets',
    });

    res.json({ success: true, message: 'Settings saved to Google Sheets.', settings: safeSettings });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// GET /api/settings/layout - Fetch persisted payslip layout settings from Google Sheets
router.get('/layout', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const sid = resolveSpreadsheetId(req);
    if (!sid) {
      return res.json({ success: true, layoutSettings: null });
    }
    const rows = await getWorksheetRows(req.googleAccessToken!, sid, 'Layout Settings');
    const row = rows[1];
    const layoutSettings = row ? safeJson(row[2]) || null : null;
    res.json({ success: true, layoutSettings });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// PUT /api/settings/layout - Persist payslip layout settings to Google Sheets
router.put('/layout', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const sid = resolveSpreadsheetId(req);
    if (!sid) {
      return res.status(400).json({
        success: false,
        error: 'No Google Spreadsheet linked. Link or initialize a spreadsheet before saving layout cloud settings.',
      });
    }
    const layoutSettings = req.body?.layoutSettings ?? req.body;
    if (!layoutSettings || typeof layoutSettings !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid layoutSettings payload.' });
    }
    const now = new Date().toISOString();
    await upsertWorksheetRowByKey(
      req.googleAccessToken!,
      sid,
      'Layout Settings',
      'default_payslip_layout',
      [
        'default_payslip_layout',
        layoutSettings.templatePreset || layoutSettings.templateName || 'Enterprise Standard A4',
        JSON.stringify(layoutSettings),
        JSON.stringify(layoutSettings.sectionOrder || []),
        JSON.stringify(layoutSettings.visibility || {}),
        JSON.stringify({
          primaryColor: layoutSettings.primaryColor,
          secondaryColor: layoutSettings.secondaryColor,
        }),
        now,
        1,
      ],
      0
    );
    res.json({ success: true, message: 'Payslip layout saved to Google Sheets.', layoutSettings });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type. Allowed: PNG, JPG, JPEG, SVG, WebP.'));
    }
  },
});

// POST /api/settings/logo - Upload company logo to Google Drive ('Company Branding')
router.post('/logo', logoUpload.single('logo'), async (req: GoogleAuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'No logo image file provided.' });
    }

    const driveRes = await uploadFileToDrive({
      accessToken: req.googleAccessToken!,
      rootFolderId: resolveFolderId(req),
      category: 'company-assets',
      fileName: `CompanyLogo_${file.originalname}`,
      mimeType: file.mimetype,
      buffer: file.buffer,
      description: 'Official company logo for payslips and branding',
    });

    const logoUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    res.json({
      success: true,
      logoUrl,
      driveFileId: driveRes.fileId,
      rootFolderId: driveRes.rootFolderId,
      storagePath: `drive:${driveRes.fileId}`,
      fileName: file.originalname,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.message || 'Failed to upload company logo to Google Drive.',
    });
  }
});

export default router;
