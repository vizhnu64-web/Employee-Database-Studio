import { Router } from 'express';
import { query } from '../db/pool';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const result = await query('SELECT * FROM directory_employees WHERE company_id = $1 ORDER BY employee_id ASC', [companyId]);
    
    const employees = result.rows.map(row => ({
      id: String(row.id),
      employeeId: row.employee_id,
      name: row.name,
      email: row.email,
      department: row.department,
      designation: row.designation,
      joiningDate: row.joining_date,
      employmentStatus: row.employment_status,
      confirmationDate: row.confirmation_date,
      resignationDate: row.resignation_date,
      resignationReason: row.resignation_reason,
      bankAccount: row.bank_account,
      pan: row.pan,
      uan: row.uan,
      esiNumber: row.esi_number,
      basic: Number(row.basic) || 0,
      hra: Number(row.hra) || 0,
      conveyance: Number(row.conveyance) || 0,
      medicalAllowance: Number(row.medical_allowance) || 0,
      specialAllowance: Number(row.special_allowance) || 0,
      otherAllowances: Number(row.other_allowances) || 0,
      pf: Number(row.pf) || 0,
      esi: Number(row.esi) || 0,
      professionalTax: Number(row.professional_tax) || 0,
      tds: Number(row.tds) || 0,
      otherDeductions: Number(row.other_deductions) || 0,
      calculatedGross: Number(row.basic) + Number(row.hra) + Number(row.special_allowance) + Number(row.other_allowances),
      calculatedDeductions: Number(row.pf) + Number(row.esi) + Number(row.professional_tax) + Number(row.tds) + Number(row.other_deductions),
      calculatedNet: (Number(row.basic) + Number(row.hra) + Number(row.special_allowance) + Number(row.other_allowances)) - (Number(row.pf) + Number(row.esi) + Number(row.professional_tax) + Number(row.tds) + Number(row.other_deductions)),
      version: row.version,
      isValid: true,
      issues: []
    }));

    res.json({ success: true, employees });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const e = req.body;

    const result = await query(`
      INSERT INTO directory_employees (
        company_id, employee_id, name, email, department, designation, joining_date,
        employment_status, confirmation_date, resignation_date, resignation_reason,
        bank_account, pan, uan, esi_number, basic, hra, conveyance, medical_allowance,
        special_allowance, other_allowances, pf, esi, professional_tax, tds, other_deductions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      RETURNING id
    `, [
      companyId, e.employeeId, e.name, e.email, e.department, e.designation, e.joiningDate,
      e.employmentStatus || 'Active', e.confirmationDate, e.resignationDate, e.resignationReason,
      e.bankAccount, e.pan, e.uan, e.esiNumber, e.basic || 0, e.hra || 0, e.conveyance || 0, e.medicalAllowance || 0,
      e.specialAllowance || 0, e.otherAllowances || 0, e.pf || 0, e.esi || 0, e.professionalTax || 0, e.tds || 0, e.otherDeductions || 0
    ]);

    res.json({ success: true, id: result.rows[0].id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { id } = req.params;
    const e = req.body;

    // Check version for conflict detection
    const curr = await query('SELECT version FROM directory_employees WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (curr.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Employee record not found.' });
    }

    if (e.version && curr.rows[0].version !== e.version) {
      return res.status(409).json({ success: false, error: 'Conflict detected: Record was modified by another user. Please refresh.' });
    }

    await query(`
      UPDATE directory_employees SET
        employee_id = $1, name = $2, email = $3, department = $4, designation = $5,
        joining_date = $6, employment_status = $7, confirmation_date = $8, resignation_date = $9,
        resignation_reason = $10, bank_account = $11, pan = $12, uan = $13, esi_number = $14,
        basic = $15, hra = $16, special_allowance = $17, other_allowances = $18,
        pf = $19, esi = $20, professional_tax = $21, tds = $22, other_deductions = $23,
        version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $24 AND company_id = $25
    `, [
      e.employeeId, e.name, e.email, e.department, e.designation,
      e.joiningDate, e.employmentStatus, e.confirmationDate, e.resignationDate,
      e.resignationReason, e.bankAccount, e.pan, e.uan, e.esiNumber,
      e.basic, e.hra, e.specialAllowance, e.otherAllowances,
      e.pf, e.esi, e.professionalTax, e.tds, e.otherDeductions,
      id, companyId
    ]);

    res.json({ success: true, message: 'Employee updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { id } = req.params;
    await query('DELETE FROM directory_employees WHERE id = $1 AND company_id = $2', [id, companyId]);
    res.json({ success: true, message: 'Employee deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
