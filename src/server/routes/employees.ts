import { Router, Response } from 'express';
import { requireGoogleAccessToken, GoogleAuthRequest } from '../middleware/googleAuth';
import {
  getWorksheetRows,
  upsertWorksheetRowVersioned,
  deleteWorksheetRowByKey,
  recordSyncLog,
} from '../services/googleSheets';

const router = Router();
router.use(requireGoogleAccessToken);

function requireSpreadsheetId(req: GoogleAuthRequest): string {
  const sid = String(
    req.spreadsheetId || req.body?.spreadsheetId || req.query?.spreadsheetId || ''
  ).trim();
  if (!sid) {
    const err: any = new Error(
      'No Google Spreadsheet is linked. Open Company Settings -> Google Workspace Setup to initialize or link a spreadsheet.'
    );
    err.statusCode = 400;
    throw err;
  }
  return sid;
}

function safeJsonParse(raw: any, fallback: any = {}) {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// GET /api/employees - Read Employee Directory joined with Salary Structures from Google Sheets
router.get('/', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const token = req.googleAccessToken!;
    const sid = requireSpreadsheetId(req);

    const [empRows, salRows] = await Promise.all([
      getWorksheetRows(token, sid, 'Employees'),
      getWorksheetRows(token, sid, 'Salary Structures'),
    ]);

    const salaryMap = new Map<string, any[]>();
    for (const row of salRows.slice(1)) {
      const empId = String(row[0] || '').trim().toUpperCase();
      if (empId) salaryMap.set(empId, row);
    }

    const employees = empRows.slice(1).map((row) => {
      const empId = String(row[0] || '').trim();
      const bankMeta = safeJsonParse(row[8], {});
      const payrollMeta = safeJsonParse(row[9], {});
      const sal = salaryMap.get(empId.toUpperCase()) || [];

      const basic = Number(sal[1] || 0);
      const hra = Number(sal[2] || 0);
      const allowances = Number(sal[3] || 0);
      const ctc = Number(sal[4] || 0);
      const employerPf = Number(sal[5] || 0);
      const employerEsi = Number(sal[6] || 0);
      const employeePf = Number(sal[7] || 0);
      const employeeEsi = Number(sal[8] || 0);
      const professionalTax = Number(sal[9] || 0);

      const calculatedGross = ctc > 0 ? ctc - employerPf - employerEsi : basic + hra + allowances;
      const calculatedDeductions = employeePf + employeeEsi + professionalTax;
      const calculatedNet = calculatedGross - calculatedDeductions;

      return {
        id: empId,
        employeeId: empId,
        name: String(row[1] || ''),
        legalName: String(row[1] || ''),
        email: String(row[2] || ''),
        workEmail: String(row[2] || ''),
        phone: String(row[3] || ''),
        primaryPhone: String(row[3] || ''),
        designation: String(row[4] || ''),
        department: String(row[5] || ''),
        joiningDate: String(row[6] || ''),
        employmentStatus: String(row[7] || 'Active'),
        bankAccount: String(bankMeta.bankAccount || ''),
        accountNumber: String(bankMeta.bankAccount || ''),
        bankName: String(bankMeta.bankName || ''),
        ifscCode: String(bankMeta.ifsc || ''),
        pan: String(payrollMeta.pan || ''),
        panNumber: String(payrollMeta.pan || ''),
        uan: String(payrollMeta.uan || ''),
        uanNumber: String(payrollMeta.uan || ''),
        esiNumber: String(payrollMeta.esi || ''),
        documentFolderId: String(row[10] || ''),
        createdAt: String(row[11] || ''),
        updatedAt: String(row[12] || ''),
        version: Number(row[13] || 1),
        basic,
        hra,
        specialAllowance: allowances,
        otherAllowances: 0,
        ctc,
        employerPf,
        employerEsi,
        employeePf,
        pf: employeePf,
        employeeEsi,
        esi: employeeEsi,
        professionalTax,
        tds: 0,
        otherDeductions: 0,
        calculatedGross,
        calculatedDeductions,
        calculatedNet,
        isValid: true,
        issues: [],
      };
    });

    res.json({ success: true, employees });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// POST /api/employees - Upsert Employee + Salary Structure into Google Sheets
router.post('/', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const token = req.googleAccessToken!;
    const sid = requireSpreadsheetId(req);
    const e = req.body || {};
    const empId = String(e.employeeId || '').trim();
    if (!empId) {
      return res.status(400).json({ success: false, error: 'Employee ID is required.' });
    }

    const now = new Date().toISOString();
    const empResult = await upsertWorksheetRowVersioned(
      token,
      sid,
      'Employees',
      empId,
      [
        empId,
        e.legalName || e.name || '',
        e.workEmail || e.email || '',
        e.primaryPhone || e.phone || '',
        e.designation || '',
        e.department || '',
        e.joiningDate || '',
        e.employmentStatus || 'Active',
        JSON.stringify({
          bankAccount: e.accountNumber || e.bankAccount || '',
          bankName: e.bankName || '',
          ifsc: e.ifscCode || '',
        }),
        JSON.stringify({
          pan: e.panNumber || e.pan || '',
          uan: e.uanNumber || e.uan || '',
          esi: e.esiNumber || '',
        }),
        e.documentFolderId || '',
        e.createdAt || now,
        now,
        1,
      ],
      e.version !== undefined ? Number(e.version) : undefined,
      0
    );

    if (empResult.action === 'conflict') {
      return res.status(409).json({
        success: false,
        conflict: true,
        error: 'Conflict detected: Employee record was updated in Google Sheets. Please refresh.',
      });
    }

    await upsertWorksheetRowVersioned(
      token,
      sid,
      'Salary Structures',
      empId,
      [
        empId,
        Number(e.basic ?? e.standardBasic ?? 0),
        Number(e.hra ?? e.standardHra ?? 0),
        Number((e.specialAllowance || 0) + (e.otherAllowances || e.standardAllowances || 0)),
        Number(e.ctc ?? e.standardCtc ?? 0),
        Number(e.employerPf ?? 0),
        Number(e.employerEsi ?? e.standardEmployerEsi ?? 0),
        Number(e.employeePf ?? e.pf ?? 0),
        Number(e.employeeEsi ?? e.esi ?? 0),
        Number(e.professionalTax ?? 0),
        e.effectiveFrom || e.joiningDate || now.slice(0, 10),
        e.effectiveTo || '',
        now,
        1,
      ],
      undefined,
      0
    );

    await recordSyncLog(token, sid, {
      worksheetName: 'Employees',
      recordKey: empId,
      action: empResult.action === 'inserted' ? 'INSERT' : 'UPDATE',
      status: 'Synced',
      versionAfter: empResult.version,
      details: `${empResult.action} employee "${e.name || empId}"`,
    });

    res.json({ success: true, id: empId, version: empResult.version });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// PUT /api/employees/:id - Versioned update of Employee in Google Sheets
router.put('/:id', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const token = req.googleAccessToken!;
    const sid = requireSpreadsheetId(req);
    const empId = String(req.params.id || req.body?.employeeId || '').trim();
    const e = req.body || {};
    const now = new Date().toISOString();

    const empResult = await upsertWorksheetRowVersioned(
      token,
      sid,
      'Employees',
      empId,
      [
        e.employeeId || empId,
        e.legalName || e.name || '',
        e.workEmail || e.email || '',
        e.primaryPhone || e.phone || '',
        e.designation || '',
        e.department || '',
        e.joiningDate || '',
        e.employmentStatus || 'Active',
        JSON.stringify({
          bankAccount: e.accountNumber || e.bankAccount || '',
          bankName: e.bankName || '',
          ifsc: e.ifscCode || '',
        }),
        JSON.stringify({
          pan: e.panNumber || e.pan || '',
          uan: e.uanNumber || e.uan || '',
          esi: e.esiNumber || '',
        }),
        e.documentFolderId || '',
        e.createdAt || now,
        now,
        Number(e.version || 1),
      ],
      e.version !== undefined ? Number(e.version) : undefined,
      0
    );

    if (empResult.action === 'conflict') {
      return res.status(409).json({
        success: false,
        conflict: true,
        error: 'Conflict detected: Record was modified in Google Sheets. Please refresh.',
      });
    }

    res.json({ success: true, message: 'Employee updated in Google Sheets.', version: empResult.version });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// DELETE /api/employees/:id
router.delete('/:id', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const token = req.googleAccessToken!;
    const sid = requireSpreadsheetId(req);
    const { id } = req.params;
    await deleteWorksheetRowByKey(token, sid, 'Employees', id, 0);
    await deleteWorksheetRowByKey(token, sid, 'Salary Structures', id, 0).catch(() => false);
    res.json({ success: true, message: 'Employee deleted from Google Sheets.' });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

export default router;
