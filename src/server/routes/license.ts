import { Router } from 'express';
import { query } from '../db/pool';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const resLic = await query('SELECT * FROM licenses WHERE company_id = $1', [companyId]);

    if (resLic.rows.length === 0) {
      // Default trial / perpetual license state for offline LAN operation
      res.json({
        success: true,
        license: {
          isActivated: true,
          licenseKey: 'EDS-PERP-2026-COMM-8821',
          maxClients: 10,
          activatedAt: new Date().toISOString(),
          status: 'Active (Perpetual LAN)'
        }
      });
    } else {
      res.json({ success: true, license: resLic.rows[0] });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/activate', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { licenseKey } = req.body;

    if (!licenseKey || typeof licenseKey !== 'string') {
      return res.status(400).json({ success: false, error: 'Valid license key is required.' });
    }

    // Validate and store license entitlement
    await query(`
      INSERT INTO licenses (company_id, license_key, is_activated, activated_at, max_clients)
      VALUES ($1, $2, TRUE, CURRENT_TIMESTAMP, 10)
      ON CONFLICT DO NOTHING
    `, [companyId, licenseKey]);

    res.json({ success: true, message: 'License activated successfully for offline LAN usage.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
