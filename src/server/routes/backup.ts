import { Router, Response } from 'express';
import { requireGoogleAccessToken, GoogleAuthRequest } from '../middleware/googleAuth';
import { uploadFileToDrive } from '../services/googleDrive';
import {
  getWorksheetRows,
  batchUpsertWorksheetRows,
  REQUIRED_WORKSHEETS,
  WorksheetName,
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

async function buildSheetsBackupPayload(accessToken: string, spreadsheetId: string) {
  const sheetsData: Record<string, any[][]> = {};
  for (const ws of REQUIRED_WORKSHEETS) {
    sheetsData[ws] = await getWorksheetRows(accessToken, spreadsheetId, ws).catch(() => []);
  }

  return {
    app: 'Employee Database Studio Enterprise',
    version: '3.0.0',
    storageProvider: 'google_sheets_and_drive',
    spreadsheetId,
    exportedAt: new Date().toISOString(),
    worksheets: sheetsData,
  };
}

// GET /api/backup/export - Export structured backup JSON directly from Google Sheets
router.get('/export', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const sid = resolveSpreadsheetId(req);
    if (!sid) {
      return res.status(400).json({
        success: false,
        error: 'No Google Spreadsheet linked for cloud export.',
      });
    }
    const backupPayload = await buildSheetsBackupPayload(req.googleAccessToken!, sid);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=EmployeeDatabaseStudio_Backup_${new Date().toISOString().slice(0, 10)}.json`
    );
    res.send(JSON.stringify(backupPayload, null, 2));
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// POST /api/backup/drive - Save full workspace JSON backup into Google Drive Application Backups folder
router.post('/drive', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const token = req.googleAccessToken!;
    const sid = resolveSpreadsheetId(req);
    const clientPayload = req.body?.backupJson;

    const backupPayload =
      clientPayload || (sid ? await buildSheetsBackupPayload(token, sid) : null);

    if (!backupPayload) {
      return res.status(400).json({
        success: false,
        error: 'Provide backup payload or link a Google Spreadsheet before creating a Drive backup.',
      });
    }

    const fileName =
      req.body?.fileName ||
      `EmployeeDatabaseStudio_Backup_${new Date().toISOString().slice(0, 10)}.json`;

    const uploaded = await uploadFileToDrive({
      accessToken: token,
      rootFolderId: resolveFolderId(req),
      category: 'backups',
      fileName,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backupPayload, null, 2), 'utf-8'),
      description: 'Full Employee Database Studio backup snapshot',
    });

    if (sid) {
      await recordSyncLog(token, sid, {
        worksheetName: 'Application Backups',
        recordKey: uploaded.fileId,
        action: 'DRIVE_BACKUP',
        status: 'Synced',
        details: `Saved backup ${uploaded.fileName} to Google Drive`,
      });
    }

    res.json({
      success: true,
      message: `Backup snapshot "${uploaded.fileName}" saved to Google Drive.`,
      file: uploaded,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// POST /api/backup/restore - Restore backup JSON safely into Google Sheets worksheets (merge upsert)
router.post('/restore', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const token = req.googleAccessToken!;
    const sid = resolveSpreadsheetId(req);
    if (!sid) {
      return res.status(400).json({
        success: false,
        error: 'No Google Spreadsheet linked. Link or initialize a spreadsheet before restoring backup.',
      });
    }

    const { backupJson } = req.body || {};
    if (!backupJson || (!backupJson.worksheets && !backupJson.data)) {
      return res.status(400).json({ success: false, error: 'Invalid backup file structure.' });
    }

    let restoredCount = 0;

    if (backupJson.worksheets && typeof backupJson.worksheets === 'object') {
      for (const ws of REQUIRED_WORKSHEETS as WorksheetName[]) {
        const rows = backupJson.worksheets[ws];
        if (!Array.isArray(rows) || rows.length <= 1) continue;
        const entries = rows
          .slice(1)
          .filter((r: any[]) => Array.isArray(r) && String(r[0] || '').trim())
          .map((r: any[]) => ({ key: String(r[0]).trim(), row: r }));
        if (entries.length > 0) {
          const result = await batchUpsertWorksheetRows(token, sid, ws, entries, 0);
          restoredCount += result.inserted + result.updated;
        }
      }
    } else if (backupJson.data?.employees && Array.isArray(backupJson.data.employees)) {
      const now = new Date().toISOString();
      const entries = backupJson.data.employees
        .filter((e: any) => e.employeeId || e.employee_id)
        .map((e: any) => {
          const empId = String(e.employeeId || e.employee_id).trim();
          return {
            key: empId,
            row: [
              empId,
              e.name || '',
              e.email || '',
              e.phone || '',
              e.designation || '',
              e.department || '',
              e.joiningDate || e.joining_date || '',
              e.employmentStatus || e.employment_status || 'Active',
              JSON.stringify({ bankAccount: e.bankAccount || e.bank_account || '', bankName: e.bankName || '', ifsc: e.ifscCode || '' }),
              JSON.stringify({ pan: e.pan || '', uan: e.uan || '', esi: e.esiNumber || e.esi_number || '' }),
              '',
              now,
              now,
              1,
            ],
          };
        });
      if (entries.length > 0) {
        const result = await batchUpsertWorksheetRows(token, sid, 'Employees', entries, 0);
        restoredCount += result.inserted + result.updated;
      }
    }

    res.json({
      success: true,
      message: `Successfully merged backup safely into Google Sheets (${restoredCount} record(s) processed).`,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

export default router;
