import { Router, Response } from 'express';
import { requireGoogleAccessToken, GoogleAuthRequest } from '../middleware/googleAuth';
import { uploadFileToDrive, downloadFileFromDrive } from '../services/googleDrive';
import {
  appendWorksheetRow,
  getWorksheetRows,
  upsertWorksheetRowVersioned,
  recordSyncLog,
} from '../services/googleSheets';

const router = Router();
router.use(requireGoogleAccessToken);

function resolveSpreadsheetId(req: GoogleAuthRequest): string {
  return String(
    req.spreadsheetId || req.body?.spreadsheetId || req.query?.spreadsheetId || ''
  ).trim();
}

function resolveFolderId(req: GoogleAuthRequest): string {
  return String(
    req.driveRootFolderId || req.body?.driveRootFolderId || req.query?.driveRootFolderId || ''
  ).trim();
}

// GET /api/payroll/structure/:employeeId - Read active salary structure from Google Sheets
router.get('/structure/:employeeId', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const sid = resolveSpreadsheetId(req);
    if (!sid) {
      return res.json({ success: true, structure: null });
    }
    const { employeeId } = req.params;
    const rows = await getWorksheetRows(req.googleAccessToken!, sid, 'Salary Structures');
    const match = rows.slice(1).find(
      (r) => String(r[0] || '').trim().toUpperCase() === employeeId.trim().toUpperCase()
    );
    if (!match) {
      return res.json({ success: true, structure: null });
    }
    res.json({
      success: true,
      structure: {
        employee_id: String(match[0] || ''),
        basic: Number(match[1] || 0),
        hra: Number(match[2] || 0),
        other_allowances: Number(match[3] || 0),
        monthly_ctc: Number(match[4] || 0),
        employer_pf: Number(match[5] || 0),
        employer_esi: Number(match[6] || 0),
        employee_pf: Number(match[7] || 0),
        employee_esi: Number(match[8] || 0),
        professional_tax: Number(match[9] || 0),
        effective_date: String(match[10] || ''),
        updated_at: String(match[12] || ''),
        version: Number(match[13] || 1),
      },
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// POST /api/payroll/structure/:employeeId - Upsert salary structure into Google Sheets
router.post('/structure/:employeeId', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const sid = resolveSpreadsheetId(req);
    if (!sid) {
      return res.status(400).json({
        success: false,
        error: 'No Google Spreadsheet linked. Link or initialize a spreadsheet in Company Settings first.',
      });
    }
    const { employeeId } = req.params;
    const data = req.body || {};

    const monthlyCtc = Number(data.monthlyCtc || 0);
    const employerPf = Number(data.employerPf || 0);
    const employerEsi = Number(data.employerEsi || 0);
    // Authoritative rule: Total Earnings = CTC - Employer PF - Employer ESI
    const totalEarnings = monthlyCtc - employerPf - employerEsi;

    const employeePf = Number(data.employeePf || 0);
    const employeeEsi = Number(data.employeeEsi || 0);
    const professionalTax = Number(data.professionalTax || 0);
    const totalDeductions =
      employeePf +
      employeeEsi +
      professionalTax +
      Number(data.tds || 0) +
      Number(data.loanDeduction || 0) +
      Number(data.advanceDeduction || 0) +
      Number(data.lateDeduction || 0) +
      Number(data.otherDeductions || 0);
    const netSalary = totalEarnings - totalDeductions;

    const now = new Date().toISOString();
    const effectiveDate = data.effectiveDate || now.slice(0, 10);
    const allowances =
      Number(data.conveyance || 0) +
      Number(data.medicalAllowance || 0) +
      Number(data.specialAllowance || 0) +
      Number(data.otherAllowances || 0);

    const upsert = await upsertWorksheetRowVersioned(
      req.googleAccessToken!,
      sid,
      'Salary Structures',
      employeeId,
      [
        employeeId,
        Number(data.basic || 0),
        Number(data.hra || 0),
        allowances,
        monthlyCtc,
        employerPf,
        employerEsi,
        employeePf,
        employeeEsi,
        professionalTax,
        effectiveDate,
        '',
        now,
        Number(data.version || 1),
      ],
      data.version !== undefined ? Number(data.version) : undefined,
      0
    );

    await recordSyncLog(req.googleAccessToken!, sid, {
      worksheetName: 'Salary Structures',
      recordKey: employeeId,
      action: upsert.action === 'inserted' ? 'INSERT' : 'UPDATE',
      status: 'Synced',
      versionAfter: upsert.version,
      details: `CTC ${monthlyCtc}, Gross ${totalEarnings}, Net ${netSalary}`,
    });

    res.json({
      success: true,
      structure: {
        employeeId,
        monthlyCtc,
        totalEarnings,
        totalDeductions,
        netSalary,
        version: upsert.version,
      },
      message: 'Salary structure saved directly to Google Sheets.',
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// POST /api/payroll/save-payslip-pdf - Upload generated PDF strictly to Google Drive & log to Google Sheets
router.post('/save-payslip-pdf', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const token = req.googleAccessToken!;
    const sid = resolveSpreadsheetId(req);
    const rootFolderId = resolveFolderId(req) || null;

    const {
      employeeId,
      employeeName,
      month,
      year,
      grossEarnings,
      totalDeductions,
      netSalary,
      pdfBase64,
      fileName,
      generationMethod,
      emailStatus,
    } = req.body || {};

    if (!employeeId || !month || !year || !pdfBase64) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID, month, year and PDF data are required.',
      });
    }

    const cleanBase64 = String(pdfBase64).replace(/^data:application\/pdf;base64,/, '');
    const pdfBuffer = Buffer.from(cleanBase64, 'base64');
    const safeFileName = fileName || `Payslip_${employeeId}_${month}_${year}.pdf`;
    const methodLabel = generationMethod === 'Manual Entry' ? 'Manual Entry' : 'Bulk Payroll';

    const driveRes = await uploadFileToDrive({
      accessToken: token,
      rootFolderId,
      category: methodLabel === 'Manual Entry' ? 'manual-payslips' : 'payslip-pdfs',
      fileName: safeFileName,
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
      employeeId: String(employeeId),
      year,
      month,
      description: `${methodLabel} payslip for ${employeeName || employeeId} (${month} ${year})`,
    });

    const historyId = `hist_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    if (sid) {
      await appendWorksheetRow(token, sid, 'Payslip History', [
        historyId,
        employeeId,
        employeeName || employeeId,
        `${month} ${year}`,
        methodLabel,
        driveRes.fileId,
        now,
        emailStatus || 'Pending',
        now,
        1,
      ]).catch(() => {});

      await recordSyncLog(token, sid, {
        worksheetName: 'Payslip History',
        recordKey: historyId,
        action: 'ARCHIVE_PDF',
        status: 'Synced',
        details: `Archived ${safeFileName} (${methodLabel}, Net ${netSalary || 0}, Gross ${grossEarnings || 0}, Ded ${totalDeductions || 0}) -> Drive file ${driveRes.fileId}`,
      });
    }

    res.json({
      success: true,
      historyId,
      driveFileId: driveRes.fileId,
      rootFolderId: driveRes.rootFolderId,
      storagePath: `drive:${driveRes.fileId}`,
      signedUrl: `/api/drive/download/${encodeURIComponent(driveRes.fileId)}`,
      fileName: safeFileName,
      fileSize: pdfBuffer.length,
      generationMethod: methodLabel,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.message || 'Failed to save payslip PDF to Google Drive.',
    });
  }
});

// GET /api/payroll/payslip-pdf/:historyId - Stream or return metadata for payslip PDF stored in Google Drive
router.get('/payslip-pdf/:historyId', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const token = req.googleAccessToken!;
    const sid = resolveSpreadsheetId(req);
    const { historyId } = req.params;
    const directDownload = req.query.download === '1' || req.query.download === 'true';

    let fileId = String(req.query.driveFileId || '').trim();
    let fileName = `Payslip_${historyId}.pdf`;

    if (!fileId && sid) {
      const rows = await getWorksheetRows(token, sid, 'Payslip History');
      const match = rows.slice(1).find(
        (r) => String(r[0] || '').trim() === historyId || String(r[5] || '').trim() === historyId
      );
      if (match) {
        fileId = String(match[5] || '').trim();
        fileName = `Payslip_${match[1]}_${String(match[3] || '').replace(/\s+/g, '_')}.pdf`;
      }
    }

    if (!fileId && !historyId.startsWith('hist_')) {
      fileId = historyId;
    }

    if (!fileId) {
      return res.status(404).json({
        success: false,
        error: 'Google Drive file ID not found for this payslip record.',
      });
    }

    if (directDownload) {
      const downloaded = await downloadFileFromDrive(token, fileId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(downloaded.fileName || fileName)}"`);
      return res.send(downloaded.buffer);
    }

    res.json({
      success: true,
      historyId,
      fileName,
      driveFileId: fileId,
      signedUrl: `/api/drive/download/${encodeURIComponent(fileId)}`,
      storagePath: `drive:${fileId}`,
      expiresInSeconds: 3600,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.message || 'Failed to retrieve payslip PDF from Google Drive.',
    });
  }
});

// GET /api/payroll/history - Read generated payslip history from Google Sheets
router.get('/history', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const sid = resolveSpreadsheetId(req);
    if (!sid) {
      return res.json({ success: true, history: [] });
    }
    const rows = await getWorksheetRows(req.googleAccessToken!, sid, 'Payslip History');
    const history = rows.slice(1).map((r) => ({
      id: String(r[0] || ''),
      employee_id: String(r[1] || ''),
      employee_name: String(r[2] || ''),
      payroll_period: String(r[3] || ''),
      generation_method: String(r[4] || 'Bulk Payroll'),
      drive_file_id: String(r[5] || ''),
      generated_at: String(r[6] || ''),
      email_status: String(r[7] || 'Pending'),
      updated_at: String(r[8] || ''),
      version: Number(r[9] || 1),
    }));
    res.json({ success: true, history });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

export default router;
