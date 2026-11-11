import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateYear,
  isLeapYear,
  getDaysInMonth,
  getNextPeriod,
  getPreviousPeriod,
  MONTHS,
  formatPayrollPeriod
} from './dateUtils';

test('validates standard year 2026 as valid', () => {
  const result = validateYear(2026);
  assert.equal(result.isValid, true);
  assert.equal(result.year, 2026);
  assert.equal(result.error, undefined);

  const stringResult = validateYear('2026');
  assert.equal(stringResult.isValid, true);
  assert.equal(stringResult.year, 2026);
});

test('validates far-future year 3047 as valid', () => {
  const result = validateYear(3047);
  assert.equal(result.isValid, true);
  assert.equal(result.year, 3047);
  assert.equal(result.error, undefined);

  const stringResult = validateYear('3047');
  assert.equal(stringResult.isValid, true);
  assert.equal(stringResult.year, 3047);
});

test('validates boundary valid four-digit years across centuries', () => {
  const validYears = [1000, 1999, 2000, 2024, 2100, 2400, 3000, 3048, 5000, 9999];
  for (const y of validYears) {
    const res = validateYear(y);
    assert.equal(res.isValid, true, `Year ${y} should be valid`);
    assert.equal(res.year, y);

    const strRes = validateYear(String(y));
    assert.equal(strRes.isValid, true, `String year ${y} should be valid`);
    assert.equal(strRes.year, y);
  }
});

test('rejects blank, empty, and whitespace year inputs with clear error', () => {
  const blankInputs = ['', '   ', null, undefined];
  for (const input of blankInputs) {
    const res = validateYear(input);
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /blank/i);
  }
});

test('rejects non-numeric characters and letters in year input', () => {
  const invalidLetterInputs = ['abcd', '202a', 'year', '2o26', 'abc1', '2026e'];
  for (const input of invalidLetterInputs) {
    const res = validateYear(input);
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /numeric digits|digits only/i);
  }
});

test('rejects negative numbers and negative years with clear error', () => {
  const negativeInputs = [-2026, '-2026', '-3047', -1];
  for (const input of negativeInputs) {
    const res = validateYear(input);
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /negative/i);
  }
});

test('rejects five-digit or multi-digit years beyond 4 digits', () => {
  const fiveDigitInputs = [10000, '10000', 30470, '30470', 123456];
  for (const input of fiveDigitInputs) {
    const res = validateYear(input);
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /4 digits/i);
  }
});

test('rejects two-digit and three-digit years', () => {
  const shortInputs = [26, '26', 99, 999, '999', '026'];
  for (const input of shortInputs) {
    const res = validateYear(input);
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /4 digits/i);
  }
});

test('rejects floating point decimal years', () => {
  const decimalInputs = [2026.5, '2026.5', 3047.25];
  for (const input of decimalInputs) {
    const res = validateYear(input);
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /decimal|integer/i);
  }
});

test('accurately calculates leap years according to Gregorian calendar rules', () => {
  // Common divisible by 4
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2028), true);
  assert.equal(isLeapYear(3048), true);

  // Common non-leap
  assert.equal(isLeapYear(2025), false);
  assert.equal(isLeapYear(2026), false);
  assert.equal(isLeapYear(3047), false);

  // Century rule: 1900, 2100 not leap (divisible by 100, not 400)
  assert.equal(isLeapYear(1900), false);
  assert.equal(isLeapYear(2100), false);

  // 400-year rule: 2000, 2400 are leap (divisible by 400)
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(2400), true);
});

test('accurately determines days in month for leap and non-leap February', () => {
  // February in 2026 (non-leap) -> 28 days
  assert.equal(getDaysInMonth(2026, 'February'), 28);
  assert.equal(getDaysInMonth(2026, 1), 28);

  // February in 2024 (leap year) -> 29 days
  assert.equal(getDaysInMonth(2024, 'February'), 29);
  assert.equal(getDaysInMonth(2024, 1), 29);

  // February in 3047 (far-future non-leap) -> 28 days
  assert.equal(getDaysInMonth(3047, 'February'), 28);

  // February in 3048 (far-future leap year: 3048 % 4 == 0, 3048 % 100 != 0) -> 29 days
  assert.equal(getDaysInMonth(3048, 'February'), 29);

  // February in 2000 (leap century) -> 29 days
  assert.equal(getDaysInMonth(2000, 'February'), 29);

  // February in 2100 (non-leap century) -> 28 days
  assert.equal(getDaysInMonth(2100, 'February'), 28);
});

test('accurately determines 30 and 31 day month lengths in 2026 and 3047', () => {
  const thirtyDayMonths = ['April', 'June', 'September', 'November'];
  for (const m of thirtyDayMonths) {
    assert.equal(getDaysInMonth(2026, m), 30, `2026 ${m}`);
    assert.equal(getDaysInMonth(3047, m), 30, `3047 ${m}`);
  }

  const thirtyOneDayMonths = ['January', 'March', 'May', 'July', 'August', 'October', 'December'];
  for (const m of thirtyOneDayMonths) {
    assert.equal(getDaysInMonth(2026, m), 31, `2026 ${m}`);
    assert.equal(getDaysInMonth(3047, m), 31, `3047 ${m}`);
  }
});

test('handles month and year transitions correctly (rollover and rollback)', () => {
  // Next month in same year
  assert.deepEqual(getNextPeriod('March', 2026), { month: 'April', year: 2026 });
  assert.deepEqual(getNextPeriod('October', 3047), { month: 'November', year: 3047 });

  // December rollover to January next year
  assert.deepEqual(getNextPeriod('December', 2026), { month: 'January', year: 2027 });
  assert.deepEqual(getNextPeriod('December', 3047), { month: 'January', year: 3048 });

  // Previous month in same year
  assert.deepEqual(getPreviousPeriod('July', 2026), { month: 'June', year: 2026 });
  assert.deepEqual(getPreviousPeriod('April', 3047), { month: 'March', year: 3047 });

  // January rollback to December previous year
  assert.deepEqual(getPreviousPeriod('January', 2026), { month: 'December', year: 2025 });
  assert.deepEqual(getPreviousPeriod('January', 3047), { month: 'December', year: 3046 });
});

test('formats payroll period string clearly', () => {
  assert.equal(formatPayrollPeriod('october', 2026), 'October 2026');
  assert.equal(formatPayrollPeriod('february', 3047), 'February 3047');
});
