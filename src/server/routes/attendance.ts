import { Router } from 'express';
import { query } from '../db/pool';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/attendance - List attendance records
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { month, year, employeeId } = req.query;

    let sql = 'SELECT * FROM attendance_records WHERE company_id = $1';
    const params: any[] = [companyId];

    if (employeeId) {
      params.push(employeeId);
      sql += ` AND employee_id = $${params.length}`;
    }

    sql += ' ORDER BY record_date DESC';

    const result = await query(sql, params);
    res.json({ success: true, attendance: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/attendance/sync - Sync attendance punch records
router.post('/sync', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { records } = req.body;

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

// GET /api/attendance/shifts - List company shifts
router.get('/shifts', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const result = await query('SELECT * FROM shifts WHERE company_id = $1 ORDER BY id ASC', [companyId]);
    res.json({ success: true, shifts: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/attendance/shifts - Create or update shift
router.post('/shifts', authenticateToken, requireRole(['admin', 'hr']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const {
      id, shiftName, shiftCode, startTime, endTime, breakStart, breakEnd,
      lunchStart, lunchEnd, scheduledHours, netWorkingHours, gracePeriodMins,
      lateThresholdMins, earlyDepartureMins, minHoursFullDay, minHoursHalfDay,
      isOvernight, applicableDepartments
    } = req.body;

    if (!shiftName || !shiftCode || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'Shift name, code, start time, and end time are required.' });
    }

    if (id) {
      await query(`
        UPDATE shifts SET
          shift_name = $1, shift_code = $2, start_time = $3, end_time = $4,
          break_start = $5, break_end = $6, lunch_start = $7, lunch_end = $8,
          scheduled_hours = $9, net_working_hours = $10, grace_period_mins = $11,
          late_threshold_mins = $12, early_departure_mins = $13, min_hours_full_day = $14,
          min_hours_half_day = $15, is_overnight = $16, applicable_departments = $17
        WHERE id = $18 AND company_id = $19
      `, [
        shiftName, shiftCode, startTime, endTime, breakStart || null, breakEnd || null,
        lunchStart || null, lunchEnd || null, scheduledHours || 9.0, netWorkingHours || 8.0,
        gracePeriodMins || 15, lateThresholdMins || 30, earlyDepartureMins || 30,
        minHoursFullDay || 7.5, minHoursHalfDay || 4.0, isOvernight || false,
        applicableDepartments || [], id, companyId
      ]);
      return res.json({ success: true, message: `Shift ${shiftCode} updated successfully.` });
    }

    const insertRes = await query(`
      INSERT INTO shifts (
        company_id, shift_name, shift_code, start_time, end_time, break_start, break_end,
        lunch_start, lunch_end, scheduled_hours, net_working_hours, grace_period_mins,
        late_threshold_mins, early_departure_mins, min_hours_full_day, min_hours_half_day,
        is_overnight, applicable_departments
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `, [
      companyId, shiftName, shiftCode, startTime, endTime, breakStart || null, breakEnd || null,
      lunchStart || null, lunchEnd || null, scheduledHours || 9.0, netWorkingHours || 8.0,
      gracePeriodMins || 15, lateThresholdMins || 30, earlyDepartureMins || 30,
      minHoursFullDay || 7.5, minHoursHalfDay || 4.0, isOvernight || false,
      applicableDepartments || []
    ]);

    res.json({ success: true, shift: insertRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/attendance/holidays - List holidays by year
router.get('/holidays', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const year = req.query.year ? Number(req.query.year) : 2026;
    const result = await query(
      'SELECT * FROM holiday_calendar WHERE company_id = $1 AND year = $2 ORDER BY date ASC',
      [companyId, year]
    );
    res.json({ success: true, holidays: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/attendance/holidays - Add holiday
router.post('/holidays', authenticateToken, requireRole(['admin', 'hr']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { year, date, name, category, isPaid, branchScope } = req.body;

    if (!year || !date || !name) {
      return res.status(400).json({ success: false, error: 'Year, date, and holiday name are required.' });
    }

    const insertRes = await query(`
      INSERT INTO holiday_calendar (company_id, year, date, name, category, is_paid, branch_scope)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [companyId, Number(year), date, name, category || 'Public Holiday', isPaid !== false, branchScope || 'All']);

    res.json({ success: true, holiday: insertRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/attendance/holidays/:id
router.delete('/holidays/:id', authenticateToken, requireRole(['admin', 'hr']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { id } = req.params;
    await query('DELETE FROM holiday_calendar WHERE id = $1 AND company_id = $2', [id, companyId]);
    res.json({ success: true, message: 'Holiday removed successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/attendance/calculate - Calculate monthly LOP and summary
router.post('/calculate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const {
      monthlySalaryBasis,
      totalCalendarDays,
      unpaidLeaveDays,
      unapprovedAbsenceDays,
      halfDaysCount,
      halfDayLopWeight = 0.5,
      denominatorOption = 'calendar_days'
    } = req.body;

    const denominator = denominatorOption === 'fixed_30' ? 30 : (Number(totalCalendarDays) || 30);
    const approvedLopDays = Number(unpaidLeaveDays || 0) + Number(unapprovedAbsenceDays || 0) + (Number(halfDaysCount || 0) * halfDayLopWeight);
    const dailySalaryRate = (Number(monthlySalaryBasis) || 0) / denominator;
    const lopDeduction = Math.round(dailySalaryRate * approvedLopDays * 100) / 100;

    res.json({
      success: true,
      calculation: {
        monthlySalaryBasis: Number(monthlySalaryBasis) || 0,
        denominator,
        approvedLopDays,
        dailySalaryRate: Math.round(dailySalaryRate * 100) / 100,
        lopDeduction
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
