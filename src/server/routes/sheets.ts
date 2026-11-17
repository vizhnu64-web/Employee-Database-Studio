import { Router, Response } from 'express';
import { requireGoogleAccessToken, GoogleAuthRequest } from '../middleware/googleAuth';
import {
  createGoogleSheetsClient,
  initializeMasterSpreadsheet,
  verifySpreadsheetUrlAccess,
  ensureMissingWorksheetsSafe,
  appendWorksheetRows,
  getWorksheetRows,
  upsertWorksheetRowByKey,
  upsertWorksheetRowVersioned,
  batchUpsertWorksheetRows,
  deleteWorksheetRowByKey,
  recordSyncLog,
  WORKSHEET_SCHEMAS,
  REQUIRED_WORKSHEETS,
  WorksheetName,
} from '../services/googleSheets';

const router = Router();
router.use(requireGoogleAccessToken);

function resolveSpreadsheetId(req: GoogleAuthRequest): string {
  return String(
    req.spreadsheetId || req.body?.spreadsheetId || req.query?.spreadsheetId || ''
  ).trim();
}

// GET /api/sheets/status - Check Google Sheets master spreadsheet & 10-worksheet readiness
router.get('/status', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const token = req.googleAccessToken!;
    const spreadsheetId = resolveSpreadsheetId(req);

    if (!spreadsheetId) {
      return res.json({
        success: true,
        isConfigured: false,
        spreadsheetId: null,
        spreadsheetUrl: null,
        worksheetsReady: false,
        existingWorksheets: [],
        missingWorksheets: REQUIRED_WORKSHEETS,
        requiredWorksheets: REQUIRED_WORKSHEETS,
        message: 'No Google Spreadsheet linked yet. Initialize a new HR Spreadsheet or paste a Google Sheets URL.',
      });
    }

    const verification = await verifySpreadsheetUrlAccess(token, spreadsheetId, req.googleEmail);
    res.json({
      success: true,
      isConfigured: !verification.requiresWorksheetApproval,
      spreadsheetId: verification.spreadsheetId,
      spreadsheetUrl: verification.spreadsheetUrl,
      spreadsheetTitle: verification.title,
      worksheetsReady: !verification.requiresWorksheetApproval,
      existingWorksheets: verification.existingWorksheets,
      missingWorksheets: verification.missingWorksheets,
      requiredWorksheets: REQUIRED_WORKSHEETS,
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.message || 'Failed to check Google Sheets status.',
    });
  }
});

// POST /api/sheets/verify-url - Read-only URL/ID validation & permission check
router.post('/verify-url', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const spreadsheetUrl = String(
      req.body?.spreadsheetUrl || req.body?.url || req.body?.spreadsheetId || ''
    ).trim();
    const verification = await verifySpreadsheetUrlAccess(
      req.googleAccessToken!,
      spreadsheetUrl,
      req.googleEmail
    );
    res.json({
      success: true,
      ...verification,
      message: verification.requiresWorksheetApproval
        ? `Verified write access to "${verification.title}". ${verification.missingWorksheets.length} missing worksheet(s) require explicit HR confirmation before creation.`
        : `Verified full 10-worksheet readiness on "${verification.title}".`,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 400).json({
      success: false,
      error: err?.message || 'Spreadsheet verification failed.',
    });
  }
});

// POST /api/sheets/connect-url - Verify Google Spreadsheet URL; create missing sheets ONLY on explicit approval
router.post('/connect-url', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const token = req.googleAccessToken!;
    const spreadsheetUrl = String(
      req.body?.spreadsheetUrl || req.body?.url || req.body?.spreadsheetId || ''
    ).trim();
    const approveCreateWorksheets = Boolean(req.body?.approveCreateWorksheets);

    let verification = await verifySpreadsheetUrlAccess(token, spreadsheetUrl, req.googleEmail);
    if (approveCreateWorksheets && verification.missingWorksheets.length > 0) {
      await ensureMissingWorksheetsSafe(token, verification.spreadsheetId);
      verification = await verifySpreadsheetUrlAccess(token, verification.spreadsheetId, req.googleEmail);
    }

    await recordSyncLog(token, verification.spreadsheetId, {
      worksheetName: 'Company Settings',
      recordKey: verification.spreadsheetId,
      action: 'LINK_SPREADSHEET',
      status: verification.requiresWorksheetApproval ? 'Awaiting Worksheet Approval' : 'Ready',
      details: `Linked "${verification.title}" (${verification.spreadsheetId}). Missing worksheets: ${verification.missingWorksheets.length}.`,
    });

    res.json({
      success: true,
      ...verification,
      message: verification.requiresWorksheetApproval
        ? `Linked "${verification.title}". Approve creating ${verification.missingWorksheets.length} missing worksheet(s) without overwriting existing data.`
        : `Connected spreadsheet "${verification.title}" with all 10 worksheets verified!`,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 400).json({
      success: false,
      error: err?.message || 'Failed to link Google Spreadsheet.',
    });
  }
});

// POST /api/sheets/approve-worksheets - Explicit HR approval to create only missing worksheets
router.post('/approve-worksheets', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const token = req.googleAccessToken!;
    const spreadsheetId = resolveSpreadsheetId(req);
    if (!spreadsheetId) {
      return res.status(400).json({ success: false, error: 'Spreadsheet ID is required.' });
    }

    const resAdd = await ensureMissingWorksheetsSafe(token, spreadsheetId);
    await recordSyncLog(token, spreadsheetId, {
      worksheetName: 'Synchronization Logs',
      recordKey: resAdd.spreadsheetId,
      action: 'APPROVE_WORKSHEETS',
      status: 'Synced',
      details:
        resAdd.addedWorksheets.length > 0
          ? `Created missing worksheets: ${resAdd.addedWorksheets.join(', ')}`
          : 'All 10 worksheets already existed; preserved all data.',
    });

    res.json({
      success: true,
      spreadsheetId: resAdd.spreadsheetId,
      addedWorksheets: resAdd.addedWorksheets,
      worksheets: resAdd.worksheets,
      message:
        resAdd.addedWorksheets.length > 0
          ? `Created ${resAdd.addedWorksheets.length} missing worksheet(s) safely while preserving existing tabs.`
          : 'All 10 required worksheets are already present and verified.',
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.message || 'Failed to initialize missing worksheets.',
    });
  }
});

// POST /api/sheets/setup - Initialize Master Spreadsheet & all 10 Worksheets
router.post('/setup', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const token = req.googleAccessToken!;
    const existingId = resolveSpreadsheetId(req) || null;
    const result = await initializeMasterSpreadsheet(token, existingId);
    res.json({
      success: true,
      message: 'Master Google Spreadsheet and all 10 worksheets successfully created and verified!',
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
      worksheets: result.worksheets,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.message || 'Failed to initialize master Google Spreadsheet.',
    });
  }
});

// POST /api/sheets/migrate-preview - Inspect existing rows & duplicates without writing
router.post('/migrate-preview', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const token = req.googleAccessToken!;
    const {
      employees = [],
      salaryStructures = [],
      batches = [],
      payrollDetails = [],
      manualPayslips = [],
      history = [],
      emailLogs = [],
      companySettings = null,
      layoutSettings = null,
    } = req.body || {};

    const setup = await initializeMasterSpreadsheet(token, resolveSpreadsheetId(req) || null);
    const sid = setup.spreadsheetId;

    const existingEmp = new Set(
      (await getWorksheetRows(token, sid, 'Employees')).slice(1).map((r) => String(r[0] || '').trim().toUpperCase())
    );
    const existingSal = new Set(
      (await getWorksheetRows(token, sid, 'Salary Structures')).slice(1).map((r) => String(r[0] || '').trim().toUpperCase())
    );
    const existingBatch = new Set(
      (await getWorksheetRows(token, sid, 'Payroll Batches')).slice(1).map((r) => String(r[0] || '').trim().toLowerCase())
    );
    const existingDetails = new Set(
      (await getWorksheetRows(token, sid, 'Payroll Details')).slice(1).map((r) => String(r[0] || '').trim().toLowerCase())
    );
    const existingManual = new Set(
      (await getWorksheetRows(token, sid, 'Manual Payslips')).slice(1).map((r) => String(r[0] || '').trim().toLowerCase())
    );
    const existingHist = new Set(
      (await getWorksheetRows(token, sid, 'Payslip History')).slice(1).map((r) => String(r[0] || '').trim().toLowerCase())
    );
    const existingEmails = new Set(
      (await getWorksheetRows(token, sid, 'Email Logs')).slice(1).map((r) => String(r[0] || '').trim().toLowerCase())
    );

    const countNew = (items: any[], getKey: (x: any) => string, set: Set<string>, upper = false) => {
      let newCount = 0;
      let skipCount = 0;
      for (const item of items) {
        const raw = getKey(item);
        if (!raw) continue;
        const norm = upper ? raw.toUpperCase() : raw.toLowerCase();
        if (set.has(norm)) skipCount++;
        else newCount++;
      }
      return { total: items.length, newCount, skipCount };
    };

    res.json({
      success: true,
      spreadsheetId: sid,
      spreadsheetUrl: setup.spreadsheetUrl,
      preview: {
        Employees: countNew(employees, (e) => String(e.employeeId || '').trim(), existingEmp, true),
        'Salary Structures': countNew(salaryStructures, (s) => String(s.employeeId || '').trim(), existingSal, true),
        'Payroll Batches': countNew(batches, (b) => String(b.id || `${b.month}_${b.year}`).trim(), existingBatch),
        'Payroll Details': countNew(
          payrollDetails,
          (p) => String(p.id || `${p.employeeId}_${p.payrollMonth}_${p.payrollYear}`).trim(),
          existingDetails
        ),
        'Manual Payslips': countNew(
          manualPayslips,
          (m) => String(m.id || `${m.employeeId}_${m.month}_${m.year}`).trim(),
          existingManual
        ),
        'Payslip History': countNew(
          history,
          (h) => String(h.id || `${h.employeeId}_${h.month}_${h.year}`).trim(),
          existingHist
        ),
        'Email Logs': countNew(emailLogs, (l) => String(l.id || '').trim(), existingEmails),
        'Company Settings': { total: companySettings ? 1 : 0, newCount: companySettings ? 1 : 0, skipCount: 0 },
        'Layout Settings': { total: layoutSettings ? 1 : 0, newCount: layoutSettings ? 1 : 0, skipCount: 0 },
        'Synchronization Logs': { total: 1, newCount: 1, skipCount: 0 },
      },
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.message || 'Migration preview failed.',
    });
  }
});

// POST /api/sheets/migrate - Duplicate-safe migration across all 10 worksheets
router.post('/migrate', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const token = req.googleAccessToken!;
    const {
      employees = [],
      salaryStructures = [],
      batches = [],
      payrollDetails = [],
      manualPayslips = [],
      history = [],
      emailLogs = [],
      companySettings = null,
      layoutSettings = null,
    } = req.body || {};

    const setup = await initializeMasterSpreadsheet(token, resolveSpreadsheetId(req) || null);
    const sid = setup.spreadsheetId;
    const now = new Date().toISOString();
    const summary: Record<string, { inserted: number; skipped: number }> = {};

    // 1. Employees
    const existingEmpIds = new Set(
      (await getWorksheetRows(token, sid, 'Employees')).slice(1).map((r) => String(r[0] || '').trim().toUpperCase())
    );
    const empRows: any[][] = [];
    let empSkipped = 0;
    if (Array.isArray(employees)) {
      for (const emp of employees) {
        const empId = String(emp.employeeId || '').trim();
        if (!empId) continue;
        if (existingEmpIds.has(empId.toUpperCase())) {
          empSkipped++;
          continue;
        }
        existingEmpIds.add(empId.toUpperCase());
        empRows.push([
          empId,
          emp.legalName || emp.name || '',
          emp.workEmail || emp.email || '',
          emp.primaryPhone || emp.phone || '',
          emp.designation || '',
          emp.department || '',
          emp.joiningDate || '',
          emp.employmentStatus || 'Active',
          JSON.stringify({
            bankAccount: emp.accountNumber || emp.bankAccount || '',
            bankName: emp.bankName || '',
            ifsc: emp.ifscCode || '',
          }),
          JSON.stringify({
            pan: emp.panNumber || emp.pan || '',
            uan: emp.uanNumber || emp.uan || '',
            esi: emp.esiNumber || '',
          }),
          emp.documentFolderId || '',
          emp.createdAt || now,
          now,
          1,
        ]);
      }
    }
    const migratedEmployeesCount = await appendWorksheetRows(token, sid, 'Employees', empRows);
    summary['Employees'] = { inserted: migratedEmployeesCount, skipped: empSkipped };

    // 2. Salary Structures
    const existingSalIds = new Set(
      (await getWorksheetRows(token, sid, 'Salary Structures')).slice(1).map((r) => String(r[0] || '').trim().toUpperCase())
    );
    const salSource = Array.isArray(salaryStructures) && salaryStructures.length > 0 ? salaryStructures : employees;
    const salRows: any[][] = [];
    let salSkipped = 0;
    for (const s of salSource) {
      const empId = String(s.employeeId || '').trim();
      if (!empId) continue;
      if (existingSalIds.has(empId.toUpperCase())) {
        salSkipped++;
        continue;
      }
      existingSalIds.add(empId.toUpperCase());
      salRows.push([
        empId,
        Number(s.basic ?? s.standardBasic ?? 0),
        Number(s.hra ?? s.standardHra ?? 0),
        Number((s.specialAllowance || 0) + (s.otherAllowances || s.standardAllowances || 0)),
        Number(s.ctc ?? s.standardCtc ?? 0),
        Number(s.employerPf ?? 0),
        Number(s.employerEsi ?? s.standardEmployerEsi ?? 0),
        Number(s.employeePf ?? s.pf ?? 0),
        Number(s.employeeEsi ?? s.esi ?? 0),
        Number(s.professionalTax ?? 0),
        s.effectiveFrom || s.joiningDate || now.slice(0, 10),
        s.effectiveTo || '',
        now,
        1,
      ]);
    }
    const migratedSalaryCount = await appendWorksheetRows(token, sid, 'Salary Structures', salRows);
    summary['Salary Structures'] = { inserted: migratedSalaryCount, skipped: salSkipped };

    // 3. Payroll Batches
    const existingBatchIds = new Set(
      (await getWorksheetRows(token, sid, 'Payroll Batches')).slice(1).map((r) => String(r[0] || '').trim().toLowerCase())
    );
    const batchRows: any[][] = [];
    let batchSkipped = 0;
    if (Array.isArray(batches)) {
      for (const b of batches) {
        const batchId = String(b.id || `batch_${b.month}_${b.year}`).trim();
        if (existingBatchIds.has(batchId.toLowerCase())) {
          batchSkipped++;
          continue;
        }
        existingBatchIds.add(batchId.toLowerCase());
        batchRows.push([
          batchId,
          b.month || '',
          Number(b.year || new Date().getFullYear()),
          b.createdAt || now,
          Number(b.employeeCount || 0),
          Number(b.totalPayroll || 0),
          b.status || 'Active',
          now,
          1,
        ]);
      }
    }
    const migratedBatchesCount = await appendWorksheetRows(token, sid, 'Payroll Batches', batchRows);
    summary['Payroll Batches'] = { inserted: migratedBatchesCount, skipped: batchSkipped };

    // 4. Payroll Details
    const existingDetailIds = new Set(
      (await getWorksheetRows(token, sid, 'Payroll Details')).slice(1).map((r) => String(r[0] || '').trim().toLowerCase())
    );
    const detailRows: any[][] = [];
    let detailSkipped = 0;
    if (Array.isArray(payrollDetails)) {
      for (const p of payrollDetails) {
        const recId = String(
          p.id || `${p.employeeId}_${p.payrollMonth || 'Current'}_${p.payrollYear || new Date().getFullYear()}`
        ).trim();
        if (existingDetailIds.has(recId.toLowerCase())) {
          detailSkipped++;
          continue;
        }
        existingDetailIds.add(recId.toLowerCase());
        detailRows.push([
          recId,
          p.batchId || `${p.payrollMonth || 'Current'}_${p.payrollYear || new Date().getFullYear()}`,
          p.employeeId || '',
          Number(p.calculatedGross ?? p.totalGross ?? 0),
          Number(p.calculatedDeductions ?? p.totalDeductions ?? 0),
          Number(p.calculatedNet ?? p.netSalary ?? 0),
          Number(p.lopDays ?? p.unpaidDays ?? 0),
          Number(p.lopDeduction ?? p.lopAmount ?? 0),
          p.driveFileId || '',
          p.isValid ? 'Verified' : 'Needs Review',
          now,
          1,
        ]);
      }
    }
    const migratedDetailsCount = await appendWorksheetRows(token, sid, 'Payroll Details', detailRows);
    summary['Payroll Details'] = { inserted: migratedDetailsCount, skipped: detailSkipped };

    // 5. Manual Payslips
    const existingManualIds = new Set(
      (await getWorksheetRows(token, sid, 'Manual Payslips')).slice(1).map((r) => String(r[0] || '').trim().toLowerCase())
    );
    const manualRows: any[][] = [];
    let manualSkipped = 0;
    if (Array.isArray(manualPayslips)) {
      for (const m of manualPayslips) {
        const mId = String(m.id || `manual_${m.employeeId}_${m.month}_${m.year}`).trim();
        if (existingManualIds.has(mId.toLowerCase())) {
          manualSkipped++;
          continue;
        }
        existingManualIds.add(mId.toLowerCase());
        manualRows.push([
          mId,
          m.employeeId || '',
          m.employeeName || '',
          m.email || '',
          m.month || '',
          m.year || '',
          JSON.stringify(m.earnings || []),
          JSON.stringify(m.deductions || []),
          Number(m.totalEarnings || 0),
          Number(m.totalDeductions || 0),
          Number(m.netSalary || 0),
          m.driveFileId || '',
          m.createdAt || now,
          now,
          1,
        ]);
      }
    }
    const migratedManualCount = await appendWorksheetRows(token, sid, 'Manual Payslips', manualRows);
    summary['Manual Payslips'] = { inserted: migratedManualCount, skipped: manualSkipped };

    // 6. Payslip History
    const existingHistIds = new Set(
      (await getWorksheetRows(token, sid, 'Payslip History')).slice(1).map((r) => String(r[0] || '').trim().toLowerCase())
    );
    const histRows: any[][] = [];
    let histSkipped = 0;
    if (Array.isArray(history)) {
      for (const h of history) {
        const histId = String(h.id || `${h.employeeId}_${h.month}_${h.year}`).trim();
        if (existingHistIds.has(histId.toLowerCase())) {
          histSkipped++;
          continue;
        }
        existingHistIds.add(histId.toLowerCase());
        histRows.push([
          histId,
          h.employeeId || '',
          h.employeeName || '',
          `${h.month} ${h.year}`,
          h.generationMethod || 'Bulk Payroll',
          h.driveFileId || '',
          h.generatedAt || now,
          h.emailStatus || 'Pending',
          now,
          1,
        ]);
      }
    }
    const migratedHistoryCount = await appendWorksheetRows(token, sid, 'Payslip History', histRows);
    summary['Payslip History'] = { inserted: migratedHistoryCount, skipped: histSkipped };

    // 7. Email Logs (non-secret delivery logs only)
    const existingLogIds = new Set(
      (await getWorksheetRows(token, sid, 'Email Logs')).slice(1).map((r) => String(r[0] || '').trim().toLowerCase())
    );
    const logRows: any[][] = [];
    let logSkipped = 0;
    if (Array.isArray(emailLogs)) {
      for (const l of emailLogs) {
        const logId = String(l.id || '').trim();
        if (!logId) continue;
        if (existingLogIds.has(logId.toLowerCase())) {
          logSkipped++;
          continue;
        }
        existingLogIds.add(logId.toLowerCase());
        logRows.push([
          logId,
          l.payslipId || '',
          l.employeeId || '',
          l.recipientEmail || '',
          l.provider === 'gmail' ? 'HR Gmail API' : 'Company SMTP',
          l.sentAt || now,
          l.deliveryStatus || 'Sent',
          l.errorMessage || '',
          Number(l.retryCount ?? 0),
        ]);
      }
    }
    const migratedEmailLogsCount = await appendWorksheetRows(token, sid, 'Email Logs', logRows);
    summary['Email Logs'] = { inserted: migratedEmailLogsCount, skipped: logSkipped };

    // 8. Company Settings (no secrets ever stored)
    let migratedCompanySettings = 0;
    if (companySettings && companySettings.companyName) {
      const address = [companySettings.addressLine1, companySettings.addressLine2, companySettings.cityStateZip]
        .filter(Boolean)
        .join(', ');
      await upsertWorksheetRowByKey(
        token,
        sid,
        'Company Settings',
        companySettings.companyName,
        [
          companySettings.companyName,
          address,
          companySettings.phone || '',
          companySettings.email || '',
          companySettings.logoDriveFileId || '',
          JSON.stringify(companySettings),
          JSON.stringify({
            displayName: companySettings.emailDisplayName || '',
            signature: companySettings.emailSignature || '',
            footerText: companySettings.emailFooterText || '',
          }),
          now,
          1,
        ],
        0
      );
      migratedCompanySettings = 1;
    }
    summary['Company Settings'] = { inserted: migratedCompanySettings, skipped: 0 };

    // 9. Layout Settings
    let migratedLayoutSettings = 0;
    if (layoutSettings && typeof layoutSettings === 'object') {
      await upsertWorksheetRowByKey(
        token,
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
      migratedLayoutSettings = 1;
    }
    summary['Layout Settings'] = { inserted: migratedLayoutSettings, skipped: 0 };

    await recordSyncLog(token, sid, {
      worksheetName: 'Synchronization Logs',
      recordKey: 'bulk_migration',
      action: 'MIGRATE',
      status: 'Synced',
      versionAfter: 1,
      details: `Synchronized ${migratedEmployeesCount} employees, ${migratedSalaryCount} salary structures, ${migratedDetailsCount} payroll rows, ${migratedHistoryCount} history items, and ${migratedEmailLogsCount} email logs.`,
    });
    summary['Synchronization Logs'] = { inserted: 1, skipped: 0 };

    res.json({
      success: true,
      message: `Synchronized ${migratedEmployeesCount} employees, ${migratedSalaryCount} salary structures, ${migratedDetailsCount} payroll rows, and ${migratedHistoryCount} history items across 10 Google Sheets worksheets.`,
      spreadsheetId: sid,
      spreadsheetUrl: setup.spreadsheetUrl,
      migratedEmployeesCount,
      migratedSalaryCount,
      migratedBatchesCount,
      migratedDetailsCount,
      migratedManualCount,
      migratedHistoryCount,
      migratedEmailLogsCount,
      migratedCompanySettings,
      migratedLayoutSettings,
      summary,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.message || 'Failed to migrate data to Google Sheets.',
    });
  }
});

// GET /api/sheets/records/:worksheet - Fetch records from any of the 10 worksheets
router.get('/records/:worksheet', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const worksheet = req.params.worksheet as WorksheetName;
    if (!WORKSHEET_SCHEMAS[worksheet]) {
      return res.status(400).json({ success: false, error: 'Invalid worksheet name.' });
    }
    const spreadsheetId = resolveSpreadsheetId(req);
    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'No Google Spreadsheet linked. Initialize or link a spreadsheet in Company Settings first.',
      });
    }

    const rows = await getWorksheetRows(req.googleAccessToken!, spreadsheetId, worksheet);
    const headers = rows[0] || [];
    const dataRows = rows.slice(1) || [];
    const records = dataRows.map((row) => {
      const obj: any = {};
      headers.forEach((h, idx) => {
        obj[h] = row[idx] !== undefined ? row[idx] : '';
      });
      return obj;
    });

    res.json({ success: true, worksheet, count: records.length, records });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.message || 'Failed to fetch worksheet records.',
    });
  }
});

// POST /api/sheets/records/:worksheet - Version-aware upsert directly to Google Sheets
router.post('/records/:worksheet', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const worksheet = req.params.worksheet as WorksheetName;
    if (!WORKSHEET_SCHEMAS[worksheet]) {
      return res.status(400).json({ success: false, error: 'Invalid worksheet name.' });
    }
    const token = req.googleAccessToken!;
    const spreadsheetId = resolveSpreadsheetId(req);
    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'No Google Spreadsheet linked. Link or initialize a spreadsheet in Company Settings before saving.',
      });
    }

    const { key, row, expectedVersion } = req.body || {};
    if (!Array.isArray(row)) {
      return res.status(400).json({ success: false, error: 'Expected "row" array matching worksheet schema.' });
    }
    const recordKey = String(key ?? row[0] ?? '').trim();
    if (!recordKey) {
      return res.status(400).json({ success: false, error: 'Record primary key is required.' });
    }

    createGoogleSheetsClient(token, spreadsheetId);
    const result = await upsertWorksheetRowVersioned(
      token,
      spreadsheetId,
      worksheet,
      recordKey,
      row,
      expectedVersion !== undefined ? Number(expectedVersion) : undefined,
      0
    );

    if (result.action === 'conflict') {
      return res.status(409).json({
        success: false,
        conflict: true,
        remoteVersion: result.remoteVersion,
        remoteRow: result.remoteRow,
        error: `Version conflict on ${worksheet} ("${recordKey}"): remote Google Sheets version (${result.remoteVersion}) is newer than local version (${expectedVersion}).`,
      });
    }

    await recordSyncLog(token, spreadsheetId, {
      worksheetName: worksheet,
      recordKey,
      action: result.action === 'inserted' ? 'INSERT' : 'UPDATE',
      status: 'Synced',
      versionAfter: result.version,
      details: `${result.action} record "${recordKey}" at v${result.version}.`,
    });

    return res.json({ success: true, action: result.action, version: result.version, worksheet });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// POST /api/sheets/records/:worksheet/batch - Batch upsert into worksheet
router.post('/records/:worksheet/batch', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const worksheet = req.params.worksheet as WorksheetName;
    if (!WORKSHEET_SCHEMAS[worksheet]) {
      return res.status(400).json({ success: false, error: 'Invalid worksheet name.' });
    }
    const token = req.googleAccessToken!;
    const spreadsheetId = resolveSpreadsheetId(req);
    if (!spreadsheetId) {
      return res.status(400).json({ success: false, error: 'Google Spreadsheet ID is required.' });
    }

    const entries = req.body?.entries;
    if (!Array.isArray(entries)) {
      return res.status(400).json({ success: false, error: 'Expected "entries" array of { key, row } objects.' });
    }

    const result = await batchUpsertWorksheetRows(token, spreadsheetId, worksheet, entries, 0);
    await recordSyncLog(token, spreadsheetId, {
      worksheetName: worksheet,
      recordKey: `batch_${entries.length}`,
      action: 'BATCH_UPSERT',
      status: 'Synced',
      details: `Batch inserted ${result.inserted}, updated ${result.updated}.`,
    });
    res.json({ success: true, worksheet, ...result });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// DELETE /api/sheets/records/:worksheet/:key - Delete a row by primary key column
router.delete('/records/:worksheet/:key', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const worksheet = req.params.worksheet as WorksheetName;
    if (!WORKSHEET_SCHEMAS[worksheet]) {
      return res.status(400).json({ success: false, error: 'Invalid worksheet name.' });
    }
    const spreadsheetId = resolveSpreadsheetId(req);
    if (!spreadsheetId) {
      return res.status(400).json({ success: false, error: 'Google Spreadsheet ID is required.' });
    }
    const deleted = await deleteWorksheetRowByKey(
      req.googleAccessToken!,
      spreadsheetId,
      worksheet,
      req.params.key,
      0
    );
    res.json({ success: true, deleted, worksheet });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

export default router;
