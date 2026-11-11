import { Router } from 'express';
import { query } from '../db/pool';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/export', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;

    const compRes = await query('SELECT * FROM companies WHERE id = $1', [companyId]);
    const empRes = await query('SELECT * FROM directory_employees WHERE company_id = $1', [companyId]);
    const payRes = await query('SELECT * FROM payroll_batches WHERE company_id = $1', [companyId]);
    const histRes = await query('SELECT * FROM generated_history WHERE company_id = $1', [companyId]);
    const docRes = await query('SELECT id, employee_id, category, title, file_name FROM employee_documents WHERE company_id = $1', [companyId]);

    const backupPayload = {
      app: 'PeopleDesk Studio Enterprise',
      version: '1.0.0',
      companyId,
      exportedAt: new Date().toISOString(),
      data: {
        company: compRes.rows[0] || null,
        employees: empRes.rows,
        payrollBatches: payRes.rows,
        history: histRes.rows,
        documentsMeta: docRes.rows
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=PeopleDeskStudio_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    res.send(JSON.stringify(backupPayload, null, 2));
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/restore', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { backupJson } = req.body;

    if (!backupJson || !backupJson.data) {
      return res.status(400).json({ success: false, error: 'Invalid backup file structure.' });
    }

    const d = backupJson.data;

    if (d.company) {
      const c = d.company;
      await query(`
        UPDATE companies SET
          company_name = $1, address_line1 = $2, address_line2 = $3, city_state_zip = $4,
          phone = $5, email = $6, website = $7, tax_registration_number = $8,
          currency_symbol = $9, currency_name = $10, show_currency_symbol = $11,
          theme_color = $12, updated_at = CURRENT_TIMESTAMP
        WHERE id = $13
      `, [
        c.company_name, c.address_line1, c.address_line2, c.city_state_zip,
        c.phone, c.email, c.website, c.tax_registration_number,
        c.currency_symbol, c.currency_name, c.show_currency_symbol ?? true,
        c.theme_color || '#CB1417', companyId
      ]);
    }

    if (Array.isArray(d.employees)) {
      await query('DELETE FROM directory_employees WHERE company_id = $1', [companyId]);
      for (const e of d.employees) {
        await query(`
          INSERT INTO directory_employees (
            company_id, employee_id, name, email, department, designation, joining_date,
            employment_status, confirmation_date, resignation_date, resignation_reason,
            bank_account, pan, uan, esi_number, basic, hra, conveyance, medical_allowance,
            special_allowance, other_allowances, pf, esi, professional_tax, tds, other_deductions
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
        `, [
          companyId, e.employee_id, e.name, e.email, e.department, e.designation, e.joining_date,
          e.employment_status || 'Active', e.confirmation_date, e.resignation_date, e.resignation_reason,
          e.bank_account, e.pan, e.uan, e.esi_number, e.basic || 0, e.hra || 0, e.conveyance || 0, e.medical_allowance || 0,
          e.special_allowance || 0, e.other_allowances || 0, e.pf || 0, e.esi || 0, e.professional_tax || 0, e.tds || 0, e.other_deductions || 0
        ]);
      }
    }

    res.json({
      success: true,
      message: `Successfully restored database: ${d.employees?.length || 0} employee records restored.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
