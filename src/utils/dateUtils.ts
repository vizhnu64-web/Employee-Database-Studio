/**
 * Payroll Date and Year Utilities
 *
 * Supports unlimited 4-digit payroll year selection (e.g. 2026, 3047, 9999).
 * Provides leap year calculations, month lengths, period transitions, and validation.
 */

export const MONTHS: readonly string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
] as const;

export interface YearValidationResult {
  isValid: boolean;
  year?: number;
  error?: string;
}

/**
 * Validates whether a value represents a valid 4-digit payroll year.
 * Allowed range: 1000 through 9999 (all valid 4-digit years supported by JS Date).
 * Rejects blank, letters, negative numbers, floats, and years with <4 or >4 digits.
 */
export function validateYear(input: unknown): YearValidationResult {
  if (input === null || input === undefined) {
    return {
      isValid: false,
      error: 'Year cannot be blank. Enter a valid 4-digit year (e.g. 2026, 3047).'
    };
  }

  const trimmed = String(input).trim();
  if (trimmed === '') {
    return {
      isValid: false,
      error: 'Year cannot be blank. Enter a valid 4-digit year (e.g. 2026, 3047).'
    };
  }

  // Check for negative numbers
  if (trimmed.startsWith('-')) {
    return {
      isValid: false,
      error: 'Invalid year: Negative years are not supported. Must be a positive 4-digit year.'
    };
  }

  // Check for decimals
  if (trimmed.includes('.')) {
    return {
      isValid: false,
      error: 'Invalid year: Decimal numbers are not allowed. Year must be a whole 4-digit integer.'
    };
  }

  // Must contain only digits
  if (!/^\d+$/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Invalid year format: Year must contain numeric digits only (no letters or symbols).'
    };
  }

  // Check exactly 4 digits
  if (!/^\d{4}$/.test(trimmed)) {
    return {
      isValid: false,
      error: `Invalid year length: "${trimmed}" has ${trimmed.length} digits. Year must be exactly 4 digits between 1000 and 9999 (e.g. 2026, 3047).`
    };
  }

  const num = parseInt(trimmed, 10);
  if (isNaN(num) || num < 1000 || num > 9999) {
    return {
      isValid: false,
      error: 'Year must be a 4-digit number between 1000 and 9999.'
    };
  }

  // Confirm JavaScript Date can accurately represent this year
  const testDate = new Date(num, 0, 1);
  if (isNaN(testDate.getTime()) || testDate.getFullYear() !== num) {
    return {
      isValid: false,
      error: `Year ${num} is outside the platform date engine capability.`
    };
  }

  return {
    isValid: true,
    year: num
  };
}

/**
 * Returns true if the year is a Gregorian leap year.
 * Rule: Divisible by 4, unless divisible by 100 but not 400.
 */
export function isLeapYear(year: number): boolean {
  if (typeof year !== 'number' || isNaN(year)) return false;
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Converts a month name or number to a 0-indexed month (0 = January, 11 = December).
 */
export function getMonthIndex(month: string | number): number {
  if (typeof month === 'number') {
    if (month >= 0 && month <= 11) return Math.floor(month);
    if (month >= 1 && month <= 12) return Math.floor(month) - 1;
  }

  const normalized = String(month).trim().toLowerCase();

  const exactIdx = MONTHS.findIndex(m => m.toLowerCase() === normalized);
  if (exactIdx !== -1) return exactIdx;

  // Try 3-letter prefix (Jan, Feb, Mar, etc.)
  const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const prefixIdx = shortMonths.findIndex(sm => normalized.startsWith(sm));
  if (prefixIdx !== -1) return prefixIdx;

  // Fallback: Check numeric month string ('1' -> 0, '12' -> 11)
  const parsedNum = parseInt(normalized, 10);
  if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 12) {
    return parsedNum - 1;
  }

  return 0; // Default to January if unparseable
}

/**
 * Returns the exact number of days in the specified month and year.
 * Accurately accounts for leap years in February (28 vs 29 days).
 */
export function getDaysInMonth(year: number, month: string | number): number {
  const monthIdx = getMonthIndex(month);
  // Date(year, monthIdx + 1, 0) gives the last day of monthIdx
  return new Date(year, monthIdx + 1, 0).getDate();
}

/**
 * Transitions to the next payroll period (handles December -> January year rollover).
 */
export function getNextPeriod(month: string, year: number): { month: string; year: number } {
  const currentIdx = getMonthIndex(month);
  if (currentIdx === 11) {
    // December to January next year
    return { month: MONTHS[0], year: year + 1 };
  }
  return { month: MONTHS[currentIdx + 1], year };
}

/**
 * Transitions to the previous payroll period (handles January -> December year rollback).
 */
export function getPreviousPeriod(month: string, year: number): { month: string; year: number } {
  const currentIdx = getMonthIndex(month);
  if (currentIdx === 0) {
    // January to December previous year
    return { month: MONTHS[11], year: year - 1 };
  }
  return { month: MONTHS[currentIdx - 1], year };
}

/**
 * Formats a payroll period label (e.g. "October 2026", "February 3047").
 */
export function formatPayrollPeriod(month: string, year: number): string {
  const idx = getMonthIndex(month);
  return `${MONTHS[idx]} ${year}`;
}
