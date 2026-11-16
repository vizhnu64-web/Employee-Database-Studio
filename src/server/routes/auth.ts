import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';
import { getJwtSecret, authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter for login attempts: max 15 attempts per 5 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    trustProxy: false,
  },
  message: { success: false, error: 'Too many login attempts. Please try again after 5 minutes.' }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const userRes = await query('SELECT * FROM users WHERE username = $1', [cleanUsername]);
    
    // Always compare or check to avoid timing attacks
    if (userRes.rows.length === 0) {
      // Fake compare to mitigate timing discrepancies
      await bcrypt.compare(password, '$2b$10$e7m07g7N0Ew29c0JjI5F4.Vl3E5kL4U1W0f6f3z3h2y7b0v5s1l0m');
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    const user = userRes.rows[0];

    // Check if account is deactivated
    if (user.is_active === false) {
      return res.status(403).json({
        success: false,
        error: 'Account has been deactivated. Please contact your system administrator.'
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    // Update last login timestamp
    await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Record audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      user.company_id || 1,
      user.id,
      'LOGIN_SUCCESS',
      'USER',
      String(user.id),
      `User ${user.username} logged in successfully`,
      req.ip || '127.0.0.1'
    ]);

    const tokenPayload = {
      id: user.id,
      companyId: user.company_id || 1,
      username: user.username,
      fullName: user.full_name,
      email: user.email || '',
      role: user.role,
      employeeId: user.employee_id || null,
      mustChangePassword: user.must_change_password || false
    };

    const secret = getJwtSecret();

    // 12-hour expiration for security
    const token = jwt.sign(tokenPayload, secret, { expiresIn: '12h' });

    res.json({
      success: true,
      token,
      user: tokenPayload
    });
  } catch (err: any) {
    console.error('[Auth Error] /login:', err?.message || err);
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.statusCode === 503 ? err.message : 'Authentication service error. Please try again.'
    });
  }
});

// GET /api/auth/admin-setup-status - Reports whether initial setup or existing-admin authorization is required
router.get('/admin-setup-status', async (req, res) => {
  try {
    const usersRes = await query('SELECT id, username, role, is_active FROM users');
    const hasAdminAccount = usersRes.rows.some(
      (u: any) => u.role === 'admin' && u.is_active !== false
    );
    const setupKeyConfigured = Boolean(process.env.ADMIN_SETUP_KEY?.trim());

    res.json({
      success: true,
      hasAdminAccount,
      requiresAuthorization: hasAdminAccount || setupKeyConfigured,
      setupKeyConfigured,
    });
  } catch (err: any) {
    console.error('[Auth Error] /admin-setup-status:', err?.message || err);
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.statusCode === 503 ? err.message : 'Unable to check administrator setup status.'
    });
  }
});

// POST /api/auth/register-admin - Provision a new Admin Control Account from login screen
router.post('/register-admin', loginLimiter, async (req, res) => {
  try {
    const {
      fullName,
      username,
      email,
      password,
      authorizingUsername,
      authorizingPassword,
      adminSetupKey
    } = req.body || {};

    const cleanFullName = String(fullName || '').trim();
    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanEmail = String(email || '').trim();
    const rawPassword = String(password || '');

    if (cleanFullName.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Full Name is required (minimum 2 characters).'
      });
    }

    if (!/^[a-z0-9._-]{3,40}$/.test(cleanUsername)) {
      return res.status(400).json({
        success: false,
        error: 'Admin username must be 3–40 characters using letters, numbers, dots, underscores, or hyphens.'
      });
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid work email address.'
      });
    }

    if (rawPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long.'
      });
    }

    const usersRes = await query('SELECT id, company_id, username, role, is_active, password_hash FROM users');
    const duplicate = usersRes.rows.find(
      (u: any) => String(u.username || '').toLowerCase() === cleanUsername
    );
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: `Username "${cleanUsername}" already exists. Please choose a different admin username.`
      });
    }

    const activeAdmins = usersRes.rows.filter(
      (u: any) => u.role === 'admin' && u.is_active !== false
    );
    const hasAdminAccount = activeAdmins.length > 0;
    const configuredSetupKey = process.env.ADMIN_SETUP_KEY?.trim() || '';
    const providedSetupKey = String(adminSetupKey || '').trim();
    const setupKeyMatches = Boolean(configuredSetupKey && providedSetupKey && providedSetupKey === configuredSetupKey);

    let authorizedBy = 'INITIAL_BOOTSTRAP';

    if (hasAdminAccount) {
      if (setupKeyMatches) {
        authorizedBy = 'ADMIN_SETUP_KEY';
      } else {
        const cleanAuthUser = String(authorizingUsername || '').trim().toLowerCase();
        const rawAuthPass = String(authorizingPassword || '');

        if (!cleanAuthUser || !rawAuthPass) {
          return res.status(403).json({
            success: false,
            error: 'Administrator authorization required. Enter an existing Administrator username and password to create a new Admin Control Account.'
          });
        }

        const authAdmin = activeAdmins.find(
          (u: any) => String(u.username || '').toLowerCase() === cleanAuthUser
        );
        if (!authAdmin) {
          await bcrypt.compare(rawAuthPass, '$2b$10$e7m07g7N0Ew29c0JjI5F4.Vl3E5kL4U1W0f6f3z3h2y7b0v5s1l0m');
          return res.status(403).json({
            success: false,
            error: 'Invalid authorizing Administrator credentials.'
          });
        }

        const authMatch = await bcrypt.compare(rawAuthPass, authAdmin.password_hash);
        if (!authMatch) {
          return res.status(403).json({
            success: false,
            error: 'Invalid authorizing Administrator credentials.'
          });
        }
        authorizedBy = authAdmin.username;
      }
    } else if (configuredSetupKey && !setupKeyMatches) {
      return res.status(403).json({
        success: false,
        error: 'Valid Admin Setup Key is required to provision the first Admin Control Account.'
      });
    } else if (setupKeyMatches) {
      authorizedBy = 'ADMIN_SETUP_KEY';
    }

    const compRes = await query('SELECT id FROM companies ORDER BY id ASC LIMIT 1');
    const companyId = compRes.rows[0]?.id || 1;
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const insertRes = await query(`
      INSERT INTO users (company_id, username, password_hash, full_name, role, email, is_active, employee_id, must_change_password)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, company_id, username, full_name, role, email, is_active, employee_id, must_change_password
    `, [companyId, cleanUsername, passwordHash, cleanFullName, 'admin', cleanEmail, true, null, false]);

    const createdUser = insertRes.rows[0];
    const newUserId = createdUser?.id || Date.now();

    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      companyId,
      newUserId,
      'CREATE_ADMIN_ACCOUNT',
      'USER',
      cleanUsername,
      `Provisioned Admin Control Account "${cleanUsername}" (authorized by: ${authorizedBy})`,
      req.ip || '127.0.0.1'
    ]);

    const tokenPayload = {
      id: newUserId,
      companyId,
      username: cleanUsername,
      fullName: cleanFullName,
      email: cleanEmail,
      role: 'admin' as const,
      employeeId: null,
      mustChangePassword: false
    };

    const secret = getJwtSecret();
    const token = jwt.sign(tokenPayload, secret, { expiresIn: '12h' });

    res.status(201).json({
      success: true,
      token,
      user: tokenPayload,
      message: `Admin Control Account "${cleanUsername}" created successfully.`
    });
  } catch (err: any) {
    console.error('[Auth Error] /register-admin:', err?.message || err);
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.statusCode === 503 ? err.message : 'Unable to create Admin Control Account. Please try again.'
    });
  }
});

// GET /api/auth/verify
router.get('/verify', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthenticated.' });
    }

    // Re-verify against database to ensure account was not deactivated or deleted
    const userRes = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0 || userRes.rows[0].is_active === false) {
      return res.status(401).json({ success: false, error: 'Account has been deactivated or removed.' });
    }

    const user = userRes.rows[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        companyId: user.company_id || 1,
        username: user.username,
        fullName: user.full_name,
        email: user.email || '',
        role: user.role,
        employeeId: user.employee_id || null,
        mustChangePassword: user.must_change_password || false
      }
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/users (Administrator only)
router.get('/users', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const usersRes = await query('SELECT * FROM users WHERE company_id = $1', [companyId]);

    const sanitizedUsers = usersRes.rows.map(u => ({
      id: u.id,
      username: u.username,
      fullName: u.full_name,
      email: u.email || '',
      role: u.role,
      status: u.is_active ? 'Active' : 'Inactive',
      isActive: u.is_active,
      employeeId: u.employee_id || '',
      mustChangePassword: u.must_change_password || false,
      lastLogin: u.last_login_at ? new Date(u.last_login_at).toISOString().replace('T', ' ').slice(0, 16) : 'Never',
      createdAt: u.created_at
    }));

    res.json({ success: true, users: sanitizedUsers });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/users (Administrator only)
router.post('/users', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { username, fullName, email, role, password, employeeId } = req.body;

    if (!username || !fullName || !role || !password) {
      return res.status(400).json({ success: false, error: 'Username, Full Name, Role, and Password are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }

    const cleanUsername = String(username).trim().toLowerCase();

    // Check duplicate username
    const existing = await query('SELECT id FROM users WHERE username = $1', [cleanUsername]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: `Username "${cleanUsername}" already exists.` });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const insertRes = await query(`
      INSERT INTO users (company_id, username, password_hash, full_name, role, email, is_active, employee_id, must_change_password)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [companyId, cleanUsername, passwordHash, fullName.trim(), role, email || '', true, employeeId || null, false]);

    // Record in audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      companyId,
      req.user?.id,
      'CREATE_USER',
      'USER',
      cleanUsername,
      `Created user ${cleanUsername} with role ${role}`,
      req.ip || '127.0.0.1'
    ]);

    res.json({
      success: true,
      message: `User ${cleanUsername} created successfully.`,
      user: {
        id: insertRes.rows[0]?.id || Date.now(),
        username: cleanUsername,
        fullName: fullName.trim(),
        email: email || '',
        role,
        status: 'Active',
        isActive: true,
        employeeId: employeeId || '',
        lastLogin: 'Never'
      }
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err.message });
  }
});

// PUT /api/auth/users/:id (Administrator only)
router.put('/users/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const userId = Number(req.params.id);
    const { fullName, email, role, isActive, employeeId } = req.body;

    const userRes = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const targetUser = userRes.rows[0];

    // Protect primary admin from deactivation or demotion
    if (targetUser.username === 'admin' && (isActive === false || role !== 'admin')) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate or change role of default system administrator.' });
    }

    await query(`
      UPDATE users SET full_name = $1, email = $2, role = $3, is_active = $4, employee_id = $5
      WHERE id = $6
    `, [
      fullName || targetUser.full_name,
      email !== undefined ? email : targetUser.email,
      role || targetUser.role,
      isActive !== undefined ? isActive : targetUser.is_active,
      employeeId !== undefined ? employeeId : targetUser.employee_id,
      userId
    ]);

    // Record in audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      companyId,
      req.user?.id,
      isActive === false ? 'DEACTIVATE_USER' : 'UPDATE_USER',
      'USER',
      targetUser.username,
      `Updated user ${targetUser.username} (Role: ${role}, Status: ${isActive ? 'Active' : 'Inactive'})`,
      req.ip || '127.0.0.1'
    ]);

    res.json({ success: true, message: `User ${targetUser.username} updated successfully.` });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err.message });
  }
});

// DELETE /api/auth/users/:id (Administrator only)
router.delete('/users/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const userId = Number(req.params.id);

    const userRes = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const targetUser = userRes.rows[0];

    if (targetUser.username === 'admin') {
      return res.status(400).json({ success: false, error: 'Cannot delete primary system administrator.' });
    }

    if (req.user?.id === userId) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own active administrator account.' });
    }

    await query('DELETE FROM users WHERE id = $1', [userId]);

    // Record in audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      companyId,
      req.user?.id,
      'DELETE_USER',
      'USER',
      targetUser.username,
      `Deleted user account ${targetUser.username}`,
      req.ip || '127.0.0.1'
    ]);

    res.json({ success: true, message: `User ${targetUser.username} deleted successfully.` });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/admin-reset-password (Administrator only)
router.post('/admin-reset-password', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
      return res.status(400).json({ success: false, error: 'User ID and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }

    const userRes = await query('SELECT * FROM users WHERE id = $1', [Number(userId)]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const targetUser = userRes.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await query(`
      UPDATE users SET password_hash = $1, must_change_password = $2 WHERE id = $3
    `, [passwordHash, true, targetUser.id]);

    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      companyId,
      req.user?.id,
      'ADMIN_RESET_PASSWORD',
      'USER',
      targetUser.username,
      `Administrator reset password for user ${targetUser.username}`,
      req.ip || '127.0.0.1'
    ]);

    res.json({
      success: true,
      message: `Password for ${targetUser.username} has been reset. User will be prompted to change password on next login.`
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/change-password (Self password change for authenticated users)
router.post('/change-password', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthenticated.' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current password and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters long.' });
    }

    const userRes = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    const user = userRes.rows[0];
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await query(`
      UPDATE users SET password_hash = $1, must_change_password = $2 WHERE id = $3
    `, [newHash, false, userId]);

    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      user.company_id || 1,
      userId,
      'CHANGE_PASSWORD',
      'USER',
      user.username,
      `User ${user.username} successfully updated their password`,
      req.ip || '127.0.0.1'
    ]);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.user) {
      await query(`
        INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        req.user.companyId || 1,
        req.user.id,
        'LOGOUT',
        'USER',
        req.user.username,
        `User ${req.user.username} logged out`,
        req.ip || '127.0.0.1'
      ]);
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/audit-logs (Administrator only)
router.get('/audit-logs', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const logsRes = await query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100');
    res.json({ success: true, logs: logsRes.rows });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err.message });
  }
});

export default router;
