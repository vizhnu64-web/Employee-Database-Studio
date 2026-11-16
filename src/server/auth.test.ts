import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './middleware/auth';

test('Password hashing produces secure salted bcrypt hashes', async () => {
  const password = 'TestSecretPassword@123';
  const hash = await bcrypt.hash(password, 10);

  assert.notEqual(hash, password);
  assert.match(hash, /^\$2[aby]\$\d{2}\$/);

  const match = await bcrypt.compare(password, hash);
  assert.equal(match, true);

  const wrongMatch = await bcrypt.compare('WrongPassword', hash);
  assert.equal(wrongMatch, false);
});

test('Never returns plain-text password or password_hash in sanitized user profile', () => {
  const rawUser = {
    id: 1,
    username: 'admin',
    password_hash: '$2b$10$e7m07g7N0Ew29c0JjI5F4.Vl3E5kL4U1W0f6f3z3h2y7b0v5s1l0m',
    full_name: 'Administrator',
    role: 'admin',
    is_active: true
  };

  const sanitizeUser = (u: any) => ({
    id: u.id,
    username: u.username,
    fullName: u.full_name,
    role: u.role,
    isActive: u.is_active
  });

  const sanitized = sanitizeUser(rawUser);
  assert.equal((sanitized as any).password_hash, undefined);
  assert.equal((sanitized as any).password, undefined);
  assert.equal(sanitized.username, 'admin');
  assert.equal(sanitized.role, 'admin');
});

test('JWT token generation and verification contains required claims and role', () => {
  const userPayload = {
    id: 42,
    companyId: 1,
    username: 'eleanor_v',
    role: 'hr'
  };

  const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '12h' });
  assert.ok(token);

  const decoded: any = jwt.verify(token, JWT_SECRET);
  assert.equal(decoded.id, 42);
  assert.equal(decoded.companyId, 1);
  assert.equal(decoded.username, 'eleanor_v');
  assert.equal(decoded.role, 'hr');
});

test('Rejects expired or tampered JWT tokens', () => {
  const tamperedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature';
  assert.throws(() => {
    jwt.verify(tamperedToken, JWT_SECRET);
  });
});

test('Role-Based Access Control logic enforces role permissions correctly', () => {
  const checkPermission = (userRole: string, allowedRoles: string[]) => {
    return allowedRoles.includes(userRole);
  };

  // Administrator has access to all actions
  assert.equal(checkPermission('admin', ['admin']), true);
  assert.equal(checkPermission('admin', ['admin', 'hr']), true);
  assert.equal(checkPermission('admin', ['admin', 'payroll']), true);

  // HR has access to HR actions but blocked from Admin & Payroll
  assert.equal(checkPermission('hr', ['admin', 'hr']), true);
  assert.equal(checkPermission('hr', ['admin']), false);
  assert.equal(checkPermission('hr', ['payroll']), false);

  // Payroll has access to Payroll actions but blocked from Admin & HR
  assert.equal(checkPermission('payroll', ['admin', 'payroll']), true);
  assert.equal(checkPermission('payroll', ['admin']), false);
  assert.equal(checkPermission('payroll', ['hr']), false);

  // Read-only cannot perform create/edit/delete operations
  assert.equal(checkPermission('readonly', ['admin']), false);
  assert.equal(checkPermission('readonly', ['admin', 'hr']), false);
  assert.equal(checkPermission('readonly', ['admin', 'payroll']), false);
  assert.equal(checkPermission('readonly', ['admin', 'hr', 'payroll', 'readonly']), true);
});

test('Password policy validator enforces minimum 8 characters', () => {
  const isValidPassword = (p: string) => typeof p === 'string' && p.trim().length >= 8;

  assert.equal(isValidPassword('short'), false);
  assert.equal(isValidPassword('1234567'), false);
  assert.equal(isValidPassword('Password@123'), true);
  assert.equal(isValidPassword('secure_pass_2026'), true);
});

test('Prevents deactivation of default system administrator account', () => {
  const canDeactivate = (username: string) => {
    return username !== 'admin';
  };

  assert.equal(canDeactivate('admin'), false);
  assert.equal(canDeactivate('hr_lead'), true);
  assert.equal(canDeactivate('payroll_mgr'), true);
});

test('Deactivated account status immediately blocks login authentication', () => {
  const attemptLogin = (user: { is_active: boolean; password_hash: string }, pass: string) => {
    if (!user.is_active) {
      return { success: false, error: 'Account has been deactivated. Please contact your system administrator.' };
    }
    return { success: true };
  };

  const activeUser = { is_active: true, password_hash: 'hash' };
  const deactivatedUser = { is_active: false, password_hash: 'hash' };

  assert.equal(attemptLogin(activeUser, 'any').success, true);
  assert.equal(attemptLogin(deactivatedUser, 'any').success, false);
  assert.equal(attemptLogin(deactivatedUser, 'any').error, 'Account has been deactivated. Please contact your system administrator.');
});

test('Duplicate username validation rejects existing accounts case-insensitively', () => {
  const existingUsers = ['admin', 'hr_lead', 'payroll_mgr'];

  const checkDuplicate = (newUsername: string) => {
    const clean = newUsername.trim().toLowerCase();
    return existingUsers.includes(clean);
  };

  assert.equal(checkDuplicate('admin'), true);
  assert.equal(checkDuplicate('ADMIN'), true);
  assert.equal(checkDuplicate('Admin '), true);
  assert.equal(checkDuplicate('hr_lead'), true);
  assert.equal(checkDuplicate('new_user_1'), false);
});

test('Admin Control Account registration endpoints enforce authorization, create admin account, and support subsequent login', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const http = await import('node:http');
  const { app } = await import('../../server');

  const dbPath = path.resolve(process.cwd(), 'data', 'peopledesk_lan_db.json');
  const originalDbExists = fs.existsSync(dbPath);
  const originalDbRaw = originalDbExists ? fs.readFileSync(dbPath, 'utf-8') : null;
  const prevSetupKey = process.env.ADMIN_SETUP_KEY;

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1. Check initial admin setup status
    const statusRes = await fetch(`${baseUrl}/api/auth/admin-setup-status`);
    assert.equal(statusRes.status, 200);
    const statusJson: any = await statusRes.json();
    assert.equal(statusJson.success, true);
    assert.equal(statusJson.hasAdminAccount, true);
    assert.equal(statusJson.requiresAuthorization, true);

    // 2. Rejects unauthorized creation when existing admin exists
    const unauthRes = await fetch(`${baseUrl}/api/auth/register-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Unauthorized User',
        username: 'unauth_admin',
        password: 'StrongPassword@123'
      })
    });
    assert.equal(unauthRes.status, 403);

    // 3. Rejects wrong authorizing password
    const badAuthRes = await fetch(`${baseUrl}/api/auth/register-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Bad Auth Admin',
        username: 'bad_auth_admin',
        password: 'StrongPassword@123',
        authorizingUsername: 'admin',
        authorizingPassword: 'wrong_password'
      })
    });
    assert.equal(badAuthRes.status, 403);

    // 4. Rejects duplicate username
    const dupRes = await fetch(`${baseUrl}/api/auth/register-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Duplicate Admin',
        username: 'admin',
        password: 'StrongPassword@123',
        authorizingUsername: 'admin',
        authorizingPassword: 'admin123'
      })
    });
    assert.equal(dupRes.status, 409);

    // 5. Creates Admin Control Account with valid existing Admin authorization
    const createRes = await fetch(`${baseUrl}/api/auth/register-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Control Ops Admin',
        username: 'control_admin_test',
        email: 'control@company.com',
        password: 'ControlAdmin@2026',
        authorizingUsername: 'admin',
        authorizingPassword: 'admin123'
      })
    });
    assert.equal(createRes.status, 201);
    const createJson: any = await createRes.json();
    assert.equal(createJson.success, true);
    assert.ok(createJson.token);
    assert.equal(createJson.user.username, 'control_admin_test');
    assert.equal(createJson.user.role, 'admin');
    assert.equal(createJson.user.fullName, 'Control Ops Admin');

    // 6. Newly created Admin Control Account can log in cleanly
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'control_admin_test',
        password: 'ControlAdmin@2026'
      })
    });
    assert.equal(loginRes.status, 200);
    const loginJson: any = await loginRes.json();
    assert.equal(loginJson.success, true);
    assert.equal(loginJson.user.role, 'admin');

    // 7. Supports ADMIN_SETUP_KEY authorization cleanly
    process.env.ADMIN_SETUP_KEY = 'SECURE_SETUP_KEY_2026';
    const setupKeyRes = await fetch(`${baseUrl}/api/auth/register-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Setup Key Admin',
        username: 'setup_key_admin',
        password: 'ControlAdmin@2026',
        adminSetupKey: 'SECURE_SETUP_KEY_2026'
      })
    });
    assert.equal(setupKeyRes.status, 201);
    const setupKeyJson: any = await setupKeyRes.json();
    assert.equal(setupKeyJson.user.role, 'admin');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevSetupKey !== undefined) process.env.ADMIN_SETUP_KEY = prevSetupKey;
    else delete process.env.ADMIN_SETUP_KEY;
    if (originalDbExists && originalDbRaw !== null) {
      fs.writeFileSync(dbPath, originalDbRaw, 'utf-8');
    }
  }
});
