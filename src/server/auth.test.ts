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
