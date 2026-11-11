import { Router } from 'express';
import { query } from '../db/pool';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { month, year } = req.query;

    const result = await query(
      'SELECT * FROM attendance_records WHERE company_id = $1 ORDER BY record_date DESC',
      [companyId]
    );

    res.json({ success: true, attendance: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/sync', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { records } = req.body; // Array of attendance punches/summaries

    if (!Array.isArray(records)) {
      return res.status(400).json({ success: false, error: 'Invalid attendance records payload.' });
    }

    for (const r of records) {
      await query(`
        INSERT INTO attendance_records (company_id, employee_id, record_date, check_in, check_out, status, overtime_hours, source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        companyId, r.employeeId, r.date, r.checkIn || null, r.checkOut || null,
        r.status || 'Present', r.overtimeHours || 0, r.source || 'CSV_IMPORT'
      ]);
    }

    res.json({ success: true, message: `Successfully synced ${records.length} attendance records.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
