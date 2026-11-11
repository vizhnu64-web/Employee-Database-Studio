/**
 * Converts a numeric amount to English words for official payslip text.
 * Handles integer and decimal parts accurately.
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertBelowThousand(n: number): string {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + ' ';
    n %= 10;
  }
  if (n > 0) {
    str += ONES[n] + ' ';
  }
  return str.trim();
}

export function numberToWords(amount: number, currency = 'USD'): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'Zero Only';
  }

  const isNegative = amount < 0;
  amount = Math.abs(amount);

  const rounded = Math.round(amount * 100) / 100;
  const integerPart = Math.floor(rounded);
  const decimalPart = Math.round((rounded - integerPart) * 100);

  if (integerPart === 0 && decimalPart === 0) {
    return 'Zero Only';
  }

  // Currency labels
  let mainCurrency = 'Dollars';
  let subCurrency = 'Cents';

  const cur = currency.toUpperCase();
  if (cur === 'INR' || cur === 'RS' || cur === 'RUPEES' || cur === '₹') {
    mainCurrency = 'Rupees';
    subCurrency = 'Paise';
  } else if (cur === 'EUR' || cur === '€') {
    mainCurrency = 'Euros';
    subCurrency = 'Cents';
  } else if (cur === 'GBP' || cur === '£') {
    mainCurrency = 'Pounds';
    subCurrency = 'Pence';
  } else if (cur === 'AED') {
    mainCurrency = 'Dirhams';
    subCurrency = 'Fils';
  } else if (cur === 'CAD') {
    mainCurrency = 'Canadian Dollars';
    subCurrency = 'Cents';
  } else if (cur === 'AUD') {
    mainCurrency = 'Australian Dollars';
    subCurrency = 'Cents';
  }

  // Convert Indian numbering system if INR, else standard international
  let words = '';
  if (cur === 'INR' || cur === 'RS' || cur === 'RUPEES' || cur === '₹') {
    words = convertIndianSystem(integerPart);
  } else {
    words = convertInternationalSystem(integerPart);
  }

  if (!words) {
    words = 'Zero';
  }

  let result = words + ' ' + mainCurrency;

  if (decimalPart > 0) {
    const decimalWords = convertBelowThousand(decimalPart);
    result += ' and ' + decimalWords + ' ' + subCurrency;
  }

  result += ' Only';

  return isNegative ? 'Minus ' + result : result;
}

function convertInternationalSystem(n: number): string {
  if (n === 0) return '';

  const billions = Math.floor(n / 1000000000);
  n %= 1000000000;
  const millions = Math.floor(n / 1000000);
  n %= 1000000;
  const thousands = Math.floor(n / 1000);
  n %= 1000;
  const remainder = n;

  let str = '';
  if (billions > 0) {
    str += convertBelowThousand(billions) + ' Billion ';
  }
  if (millions > 0) {
    str += convertBelowThousand(millions) + ' Million ';
  }
  if (thousands > 0) {
    str += convertBelowThousand(thousands) + ' Thousand ';
  }
  if (remainder > 0) {
    str += convertBelowThousand(remainder) + ' ';
  }

  return str.trim();
}

function convertIndianSystem(n: number): string {
  if (n === 0) return '';

  const crores = Math.floor(n / 10000000);
  n %= 10000000;
  const lakhs = Math.floor(n / 100000);
  n %= 100000;
  const thousands = Math.floor(n / 1000);
  n %= 1000;
  const remainder = n;

  let str = '';
  if (crores > 0) {
    str += convertBelowThousand(crores) + ' Crore ';
  }
  if (lakhs > 0) {
    str += convertBelowThousand(lakhs) + ' Lakh ';
  }
  if (thousands > 0) {
    str += convertBelowThousand(thousands) + ' Thousand ';
  }
  if (remainder > 0) {
    str += convertBelowThousand(remainder) + ' ';
  }

  return str.trim();
}
