import test from 'node:test';
import assert from 'node:assert';
import { DEFAULT_LAYOUT_SETTINGS, DEFAULT_EMAIL_SETTINGS } from '../types/payroll';

test('DEFAULT_LAYOUT_SETTINGS contains expected defaults', () => {
  assert.strictEqual(DEFAULT_LAYOUT_SETTINGS.showLogo, true);
  assert.strictEqual(DEFAULT_LAYOUT_SETTINGS.alignHeader, 'left');
  assert.strictEqual(DEFAULT_LAYOUT_SETTINGS.primaryColor, '#CB1417');
});

test('DEFAULT_EMAIL_SETTINGS contains sensible defaults without hardcoded user credentials', () => {
  assert.strictEqual(DEFAULT_EMAIL_SETTINGS.smtpPort, 587);
  assert.strictEqual(DEFAULT_EMAIL_SETTINGS.smtpHost, 'smtp.example.com');
  assert.strictEqual(DEFAULT_EMAIL_SETTINGS.smtpUser, '');
  assert.strictEqual(DEFAULT_EMAIL_SETTINGS.smtpPass, '');
  assert.ok(DEFAULT_EMAIL_SETTINGS.emailSubjectTemplate.includes('{{month}}'));
  assert.ok(DEFAULT_EMAIL_SETTINGS.emailBodyTemplate.includes('{{employeeName}}'));
});
