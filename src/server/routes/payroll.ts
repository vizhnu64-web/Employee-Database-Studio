import { Router } from 'express';
import { query } from '../db/pool';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/payroll/structure/:employeeId - Get employee's active salary structure
router.get('/structure/:employeeId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { employeeId } = req.params;

    const result = await query(
      'SELECT * FROM employee_salary_structures WHERE company_id = $1 AND employee_id = $2 AND is_active = true ORDER BY effective_date DESC LIMIT 1',
      [companyId, employeeId]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, structure: null });
    }

    res.json({ success: true, structure: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payroll/structure/:employeeId - Save or revise salary structure
router.post('/structure/:employeeId', authenticateToken, requireRole(['admin', 'hr', 'payroll']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { employeeId } = req.params;
    const data = req.body;

    const monthlyCtc = Number(data.monthlyCtc || 0);
    const employerPf = Number(data.employerPf || 0);
    const employerEsi = Number(data.employerEsi || 0);
    const otherEmployerContributions = Number(data.otherEmployerContributions || 0);

    // Exact formula: Total Earnings = CTC - Employer PF - Employer ESI
    const totalEarnings = monthlyCtc - employerPf - employerEsi;

    const employeePf = Number(data.employeePf || 0);
    const employeeEsi = Number(data.employeeEsi || 0);
    const professionalTax = Number(data.professionalTax || 0);
    const tds = Number(data.tds || 0);
    const loanDeduction = Number(data.loanDeduction || 0);
    const advanceDeduction = Number(data.advanceDeduction || 0);
    const lateDeduction = Number(data.lateDeduction || 0);
    const otherDeductions = Number(data.otherDeductions || 0);

    const totalDeductions = employeePf + employeeEsi + professionalTax + tds + loanDeduction + advanceDeduction + lateDeduction + otherDeductions;
    const netSalary = totalEarnings - totalDeductions;

    // Check existing structure to log revision
    const existingRes = await query(
      'SELECT * FROM employee_salary_structures WHERE company_id = $1 AND employee_id = $2 AND is_active = true',
      [companyId, employeeId]
    );

    const previousStructure = existingRes.rows[0] || null;
    const effectiveDate = data.effectiveDate || new Date().toISOString().slice(0, 10);

    // Deactivate previous active records
    await query(
      'UPDATE employee_salary_structures SET is_active = false WHERE company_id = $1 AND employee_id = $2',
      [companyId, employeeId]
    );

    // Insert new active salary structure
    const insertRes = await query(`
      INSERT INTO employee_salary_structures (
        company_id, employee_id, salary_type, monthly_ctc, annual_ctc, effective_date,
        payment_frequency, payroll_group, calculation_basis, basic, hra, conveyance,
        medical_allowance, special_allowance, other_allowances, additional_earnings,
        custom_earnings, employer_pf, employer_esi, other_employer_contributions,
        employee_pf, employee_esi, professional_tax, tds, loan_deduction, advance_deduction,
        late_deduction, other_deductions, applicable_shift_id, lop_calculation_method,
        paid_leave_eligibility, half_day_policy, late_deduction_policy, total_earnings,
        total_deductions, net_salary, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $4 - $18 - $19, $34, ($4 - $18 - $19) - $34, true
      ) RETURNING *
    `, [
      companyId, employeeId, data.salaryType || 'Fixed Monthly', monthlyCtc, monthlyCtc * 12,
      effectiveDate, data.paymentFrequency || 'Monthly', data.payrollGroup || 'Standard',
      data.calculationBasis || '30 Days', Number(data.basic || 0), Number(data.hra || 0),
      Number(data.conveyance || 0), Number(data.medicalAllowance || 0), Number(data.specialAllowance || 0),
      Number(data.otherAllowances || 0), Number(data.additionalEarnings || 0),
      JSON.stringify(data.customEarnings || []), employerPf, employerEsi, otherEmployerContributions,
      employeePf, employeeEsi, professionalTax, tds, loanDeduction, advanceDeduction,
      lateDeduction, otherDeductions, data.applicableShiftId || null, data.lopCalculationMethod || 'Calendar Days',
      data.paidLeaveEligibility !== false, data.halfDayPolicy || '0.5 Day LOP',
      data.lateDeductionPolicy || 'Standard', totalDeductions
    ]);

    // Record revision entry
    await query(`
      INSERT INTO salary_revisions (
        company_id, employee_id, effective_date, previous_ctc, new_ctc,
        previous_structure, new_structure, changed_by, reason, approval_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      companyId, employeeId, effectiveDate,
      previousStructure ? previousStructure.monthly_ctc : 0,
      monthlyCtc,
      JSON.stringify(previousStructure || {}),
      JSON.stringify(insertRes.rows[0] || {}),
      req.user?.username || 'admin',
      data.revisionReason || 'Salary structure update / revision',
      'Approved'
    ]);

    // Record audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      companyId, req.user?.id || null, 'SALARY_STRUCTURE_UPDATED', 'EMPLOYEE',
      employeeId, `Updated salary structure for ${employeeId}. Monthly CTC: ${monthlyCtc}, Reason: ${data.revisionReason || 'Update'}`
    ]);

    res.json({
      success: true,
      structure: insertRes.rows[0],
      message: 'Salary structure updated and revision logged successfully.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/payroll/revisions/:employeeId - Get salary revision history
router.get('/revisions/:employeeId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { employeeId } = req.params;

    const revisions = await query(
      'SELECT * FROM salary_revisions WHERE company_id = $1 AND employee_id = $2 ORDER BY created_at DESC',
      [companyId, employeeId]
    );

    res.json({ success: true, revisions: revisions.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/payroll/payslip-revisions/:payslipId - Get manual revisions for a payslip
router.get('/payslip-revisions/:payslipId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { payslipId } = req.params;

    const revisions = await query(
      'SELECT * FROM payslip_revisions WHERE company_id = $1 AND payslip_id = $2 ORDER BY version_number DESC',
      [companyId, payslipId]
    );

    res.json({ success: true, revisions: revisions.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payroll/payslip-revisions - Save a manual revision for a payslip
router.post('/payslip-revisions', authenticateToken, requireRole(['admin', 'hr', 'payroll']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const {
      payslipId,
      employeeId,
      month,
      year,
      originalData,
      revisedData,
      adjustmentEarnings,
      adjustmentDeductions,
      reason,
      status
    } = req.body;

    if (!payslipId || !employeeId || !reason) {
      return res.status(400).json({ success: false, error: 'Payslip ID, employee ID, and change reason are required.' });
    }

    // Determine version number
    const countRes = await query(
      'SELECT count(*) as count FROM payslip_revisions WHERE company_id = $1 AND payslip_id = $2',
      [companyId, payslipId]
    );
    const versionNumber = Number(countRes.rows[0]?.count || 0) + 1;

    const approvalStatus = status === 'Approved' ? 'Approved' : 'Draft';
    const approvedBy = approvalStatus === 'Approved' ? req.user?.username : null;

    const insertRes = await query(`
      INSERT INTO payslip_revisions (
        company_id, payslip_id, employee_id, month, year, version_number,
        original_data, revised_data, adjustment_earnings, adjustment_deductions,
        reason, edited_by, approval_status, approved_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      companyId, payslipId, employeeId, month, year, versionNumber,
      JSON.stringify(originalData || {}), JSON.stringify(revisedData || {}),
      JSON.stringify(adjustmentEarnings || []), JSON.stringify(adjustmentDeductions || []),
      reason, req.user?.username || 'admin', approvalStatus, approvedBy
    ]);

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      companyId, req.user?.id || null, 'PAYSLIP_MANUAL_REVISION', 'PAYSLIP',
      payslipId, `Manual revision v${versionNumber} created by ${req.user?.username} for ${employeeId} (${month} ${year}). Reason: ${reason}`
    ]);

    res.json({
      success: true,
      revision: insertRes.rows[0],
      message: `Payslip revision v${versionNumber} saved successfully.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Import storage service for payslip PDFs
import { supabaseStorage, STORAGE_BUCKETS } from '../storage/supabaseStorage';

// POST /api/payroll/save-payslip-pdf - Upload and store generated PDF payslip into payslip-pdfs bucket
router.post('/save-payslip-pdf', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const {
      employeeId,
      employeeName,
      department,
      designation,
      month,
      year,
      grossEarnings,
      totalDeductions,
      netSalary,
      pdfBase64,
      fileName
    } = req.body;

    if (!employeeId || !month || !year || !pdfBase64) {
      return res.status(400).json({ success: false, error: 'Employee ID, month, year and PDF data are required.' });
    }

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const pdfBuffer = Buffer.from(cleanBase64, 'base64');
    const safeFileName = fileName || `Payslip_${employeeId}_${month}_${year}.pdf`;

    // Path structure: company_id/payslips/year/month/employee_id/unique_filename
    const storagePath = supabaseStorage.buildStructuredPath({
      companyId,
      bucket: STORAGE_BUCKETS.PAYSLIP_PDFS,
      employeeId,
      year,
      month,
      fileName: safeFileName
    });

    const uploadRes = await supabaseStorage.uploadObject(
      STORAGE_BUCKETS.PAYSLIP_PDFS,
      storagePath,
      pdfBuffer,
      'application/pdf'
    );

    const historyId = `hist_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    await query(`
      INSERT INTO generated_history (
        id, company_id, employee_id, employee_name, department, designation,
        month, year, gross_earnings, total_deductions, net_salary,
        bucket, storage_path, file_name, file_size_bytes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      historyId, companyId, employeeId, employeeName || employeeId,
      department || '', designation || '', month, Number(year),
      Number(grossEarnings || 0), Number(totalDeductions || 0), Number(netSalary || 0),
      STORAGE_BUCKETS.PAYSLIP_PDFS, uploadRes.path, safeFileName, pdfBuffer.length
    ]);

    await query(`
      INSERT INTO storage_objects (
        company_id, bucket, storage_path, file_name, mime_type, file_size_bytes,
        entity_type, entity_id, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      companyId, STORAGE_BUCKETS.PAYSLIP_PDFS, uploadRes.path, safeFileName,
      'application/pdf', pdfBuffer.length, 'payslip_pdf', employeeId,
      req.user?.username || 'HR Generator'
    ]);

    const signedUrl = await supabaseStorage.createSignedUrl(
      STORAGE_BUCKETS.PAYSLIP_PDFS,
      uploadRes.path,
      300
    );

    res.json({
      success: true,
      historyId,
      storagePath: uploadRes.path,
      signedUrl,
      fileName: safeFileName,
      fileSize: pdfBuffer.length
    });
  } catch (err: any) {
    console.error('[Save Payslip PDF Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to save payslip PDF.' });
  }
});

// GET /api/payroll/payslip-pdf/:historyId - Generate temporary signed URL to view/download payslip PDF
router.get('/payslip-pdf/:historyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { historyId } = req.params;

    const result = await query(
      'SELECT * FROM generated_history WHERE id = $1 AND company_id = $2',
      [historyId, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Payslip record not found.' });
    }

    const rec = result.rows[0];

    // Enforce role-based access: If user is an employee, verify they only access their own payslip
    if (req.user?.role === 'employee' && req.user.employeeId && req.user.employeeId !== rec.employee_id) {
      return res.status(403).json({ success: false, error: 'Access denied: You can only view your own payslips.' });
    }

    if (!rec.storage_path) {
      return res.status(404).json({ success: false, error: 'PDF file is not stored in cloud storage for this record.' });
    }

    const bucket = rec.bucket || STORAGE_BUCKETS.PAYSLIP_PDFS;
    const signedUrl = await supabaseStorage.createSignedUrl(bucket, rec.storage_path, 300);

    res.json({
      success: true,
      historyId: rec.id,
      fileName: rec.file_name || `Payslip_${rec.employee_id}.pdf`,
      signedUrl,
      storagePath: rec.storage_path,
      expiresInSeconds: 300
    });
  } catch (err: any) {
    console.error('[Get Payslip PDF Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve payslip PDF.' });
  }
});

// GET /api/payroll/history - List generated payslip history
router.get('/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    let text = 'SELECT * FROM generated_history WHERE company_id = $1 ORDER BY generated_at DESC LIMIT 500';
    let params: any[] = [companyId];

    // If logged in as employee, restrict to their own records
    if (req.user?.role === 'employee' && req.user.employeeId) {
      text = 'SELECT * FROM generated_history WHERE company_id = $1 AND employee_id = $2 ORDER BY generated_at DESC LIMIT 100';
      params = [companyId, req.user.employeeId];
    }

    const result = await query(text, params);
    res.json({ success: true, history: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
