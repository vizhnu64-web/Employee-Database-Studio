import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { CompanySettings, EmployeeRecord, PayslipLayoutSettings, DEFAULT_LAYOUT_SETTINGS } from '../types/payroll';
import { numberToWords } from './numberToWords';
import { getDaysInMonth } from './dateUtils';

/**
 * Sanitizes text for standard jsPDF fonts (WinAnsiEncoding) to prevent gibberish or encoding errors.
 */
function sanitizePdfText(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/[^\x00-\x7F\u00A0-\u00FF]/g, match => {
      if (match === '₹') return 'Rs.';
      if (match === '€') return 'EUR ';
      if (match === '£') return 'GBP ';
      if (match === '¥') return 'JPY ';
      return '';
    })
    .trim();
}

/**
 * Converts a hex color string (e.g. '#CB1417') to RGB tuple.
 */
function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#CB1417').replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [isNaN(r) ? 203 : r, isNaN(g) ? 20 : g, isNaN(b) ? 23 : b];
}

/**
 * Generates a high-resolution, vector A4 Portrait PDF payslip for an employee.
 */
export function generatePayslipPdf(
  record: EmployeeRecord,
  settings: CompanySettings,
  month: string,
  year: number,
  layoutSettings?: PayslipLayoutSettings
): jsPDF {
  const layout: PayslipLayoutSettings = {
    ...DEFAULT_LAYOUT_SETTINGS,
    ...(layoutSettings || {})
  };

  const [primaryR, primaryG, primaryB] = hexToRgb(layout.primaryColor);
  const showSymbol = settings.showCurrencySymbol !== false;

  // A4 dimensions: 210 x 297 mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // Outer border
  doc.setDrawColor(210, 210, 215);
  doc.setLineWidth(0.4);
  doc.rect(margin, margin, contentWidth, pageHeight - margin * 2);

  // Top header background
  doc.setFillColor(252, 252, 252);
  doc.rect(margin, margin, contentWidth, 32, 'F');
  doc.line(margin, margin + 32, margin + contentWidth, margin + 32);

  // Optional Logo with aspect ratio preservation and robust format detection
  let textStartX = margin + 6;
  if (layout.showLogo && settings.logoDataUrl && typeof settings.logoDataUrl === 'string' && settings.logoDataUrl.startsWith('data:image/')) {
    try {
      let format = 'PNG';
      const lower = settings.logoDataUrl.toLowerCase();
      if (lower.includes('image/jpeg') || lower.includes('image/jpg')) {
        format = 'JPEG';
      } else if (lower.includes('image/webp')) {
        format = 'WEBP';
      } else if (lower.includes('image/svg+xml')) {
        throw new Error('SVG logo format requires rasterization');
      }

      const props = doc.getImageProperties(settings.logoDataUrl);
      const imgW = props.width || 100;
      const imgH = props.height || 100;
      const maxW = 32;
      const maxH = 24;
      let renderW = maxW;
      let renderH = (imgH * maxW) / imgW;
      if (renderH > maxH) {
        renderH = maxH;
        renderW = (imgW * maxH) / imgH;
      }

      doc.addImage(settings.logoDataUrl, format, margin + 4, margin + (32 - renderH) / 2, renderW, renderH);
      textStartX = margin + renderW + 8;
    } catch {
      textStartX = margin + 6;
    }
  }

  // Header alignment adjustments
  const isCenter = layout.alignHeader === 'center';
  const isRight = layout.alignHeader === 'right';
  const headerX = isCenter ? pageWidth / 2 : isRight ? pageWidth - margin - 6 : textStartX;

  // Company Name & Details
  doc.setTextColor(0, 0, 0); // Black #000000
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(sanitizePdfText(settings.companyName || 'Corporate Enterprise Ltd.'), headerX, margin + 9, { align: isCenter ? 'center' : isRight ? 'right' : 'left' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  const addr = [
    settings.addressLine1,
    settings.addressLine2,
    settings.cityStateZip
  ].filter(Boolean).map(sanitizePdfText).join(', ');
  if (addr) {
    doc.text(addr, headerX, margin + 14, { align: isCenter ? 'center' : isRight ? 'right' : 'left' });
  }

  const contact = [
    settings.email ? `Email: ${settings.email}` : '',
    settings.phone ? `Phone: ${settings.phone}` : '',
    settings.website ? `Web: ${settings.website}` : ''
  ].filter(Boolean).map(sanitizePdfText).join('  |  ');
  if (contact) {
    doc.text(contact, headerX, margin + 19, { align: isCenter ? 'center' : isRight ? 'right' : 'left' });
  }

  if (layout.showTaxId && settings.taxRegistrationNumber) {
    doc.text(sanitizePdfText(`Registration / Tax ID: ${settings.taxRegistrationNumber}`), headerX, margin + 24, { align: isCenter ? 'center' : isRight ? 'right' : 'left' });
  }

  // Title Banner: Primary Accent Color
  const titleY = margin + 37;
  doc.setFillColor(primaryR, primaryG, primaryB);
  doc.rect(margin, margin + 32, contentWidth, 10, 'F');
  doc.setTextColor(255, 255, 255); // #FFFFFF White
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const payPeriodText = sanitizePdfText(`PAYSLIP FOR THE PERIOD: ${month.toUpperCase()} ${year}`);
  doc.text(payPeriodText, pageWidth / 2, titleY - 0.5, { align: 'center' });

  // Employee Information Grid with dynamic text wrapping, bank details, ESI, and custom layout labels
  const allEmpFields: Array<{ label: string; val: string }> = [];

  const addEmpField = (show: boolean | undefined, label: string, val: any) => {
    if (show === false) return;
    const strVal = val !== undefined && val !== null && String(val).trim() !== '' ? String(val).trim() : '—';
    allEmpFields.push({ label, val: strVal });
  };

  addEmpField(layout.showEmployeeId, layout.labelEmployeeId || 'Employee ID', record.employeeId);
  addEmpField(layout.showName, layout.labelName || 'Employee Name', record.name);
  addEmpField(layout.showDepartment, layout.labelDepartment || 'Department', record.department);
  addEmpField(layout.showDesignation, layout.labelDesignation || 'Designation', record.designation);
  addEmpField(layout.showJoiningDate, layout.labelJoiningDate || 'Joining Date', record.joiningDate);

  // Attendance
  if (layout.showTotalWorkingDays && record.totalWorkingDays !== undefined) {
    addEmpField(true, layout.labelTotalWorkingDays || 'Total Working Days', `${record.totalWorkingDays} Days`);
  }
  addEmpField(layout.showPaidDays, layout.labelPaidDays || 'Paid Days', `${record.paidDays ?? getDaysInMonth(year, month)} Days`);

  if (layout.showLopDays !== false && record.lopDays !== undefined && record.lopDays > 0) {
    addEmpField(true, layout.labelLopDays || 'LOP Days', `${record.lopDays} Days`);
  } else if (layout.showUnpaidDays !== false) {
    addEmpField(true, layout.labelUnpaidDays || 'Loss of Pay (LOP)', `${record.unpaidDays ?? record.lopDays ?? 0} Days`);
  }

  // Statutory & Identifiers
  addEmpField(layout.showPan, layout.labelPan || 'PAN', record.pan);
  addEmpField(layout.showUan, layout.labelUan || 'UAN', record.uan);
  addEmpField(layout.showEsiNumber, layout.labelEsiNumber || 'ESI Number', record.esiNumber);
  if (layout.showPfNumber && record.pfNumber) {
    addEmpField(true, layout.labelPfNumber || 'PF Number', record.pfNumber);
  }
  if (layout.showAadhaar && record.aadhaarNumber) {
    addEmpField(true, layout.labelAadhaar || 'Aadhaar Number', record.aadhaarNumber);
  }

  // Bank Details
  addEmpField(layout.showBankName, layout.labelBankName || 'Bank Name', record.bankName);
  addEmpField(layout.showBankAccount, layout.labelBankAccount || 'Bank Account No', record.bankAccount);
  addEmpField(layout.showIfscCode, layout.labelIfscCode || 'IFSC Code', record.ifscCode);
  if (layout.showBranchName && record.branchName) {
    addEmpField(true, layout.labelBranchName || 'Branch Name', record.branchName);
  }
  if (layout.showAccountHolderName && record.accountHolderName) {
    addEmpField(true, layout.labelAccountHolderName || 'Account Holder Name', record.accountHolderName);
  }

  if (layout.showCtc !== false && record.ctc !== undefined) {
    const ctcStr = formatMoney(record.ctc, settings.currencySymbol, settings.showCurrencySymbol !== false);
    addEmpField(true, layout.labelCtc || 'Cost to Company (CTC)', ctcStr);
  }

  if (layout.showEmployerEsi !== false && record.employerEsi !== undefined && record.employerEsi > 0) {
    const esiStr = formatMoney(record.employerEsi, settings.currencySymbol, settings.showCurrencySymbol !== false);
    addEmpField(true, layout.labelEmployerEsi || 'Employer ESI', esiStr);
  }

  // Custom Fields (Employee section)
  if (record.customFields && typeof record.customFields === 'object') {
    const customLayouts = layout.customFieldLayouts || [];
    const seenCustomKeys = new Set<string>();
    Object.entries(record.customFields).forEach(([key, val]) => {
      const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seenCustomKeys.has(normKey)) return;
      seenCustomKeys.add(normKey);

      const cfg = customLayouts.find(c => c.key === key || c.key.toLowerCase().replace(/[^a-z0-9]/g, '') === normKey);
      if (cfg && cfg.showInPdf === false) return; // explicit hide
      const fieldLabel = cfg?.label || key.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      // Skip if this is a purely financial/allowance custom field displayed in salary tables
      const lowerKey = key.toLowerCase();
      if (typeof val === 'number' && (
        lowerKey.includes('allowance') ||
        lowerKey.includes('deduction') ||
        lowerKey.includes('loan') ||
        lowerKey.includes('advance') ||
        lowerKey.includes('pf') ||
        lowerKey.includes('esi') ||
        lowerKey.includes('tax') ||
        lowerKey.includes('tds') ||
        lowerKey.includes('lop') ||
        lowerKey.includes('late') ||
        lowerKey.includes('basic') ||
        lowerKey.includes('hra') ||
        lowerKey.includes('gross') ||
        lowerKey.includes('net') ||
        lowerKey.includes('ctc')
      )) {
        return;
      }
      addEmpField(true, fieldLabel, val);
    });
  }

  const empPairs: { label1: string; val1: string; label2: string; val2: string }[] = [];
  for (let i = 0; i < allEmpFields.length; i += 2) {
    const f1 = allEmpFields[i];
    const f2 = allEmpFields[i + 1];
    empPairs.push({
      label1: f1 ? f1.label : '',
      val1: f1 ? f1.val : '',
      label2: f2 ? f2.label : '',
      val2: f2 ? f2.val : ''
    });
  }

  let gridY = margin + 44;
  const rowH = 5.2;
  const gridHeight = Math.max(26, empPairs.length * rowH + 6);
  doc.setFillColor(248, 248, 250);
  doc.rect(margin + 2, gridY, contentWidth - 4, gridHeight, 'F');
  doc.setDrawColor(225, 225, 230);
  doc.rect(margin + 2, gridY, contentWidth - 4, gridHeight);

  const col1X = margin + 5;
  const val1X = margin + 44;
  const col2X = margin + 96;
  const val2X = margin + 137;
  const maxColWidth = 48;

  let currentY = gridY + 5;
  empPairs.forEach(pair => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(pair.label1, col1X, currentY);
    if (pair.label2) {
      doc.text(pair.label2, col2X, currentY);
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0); // Black #000000

    const safeVal1 = sanitizePdfText(pair.val1);
    const lines1 = doc.splitTextToSize(safeVal1, maxColWidth);
    doc.text(lines1, val1X, currentY);

    let maxLines = lines1.length;
    if (pair.label2) {
      const safeVal2 = sanitizePdfText(pair.val2);
      const lines2 = doc.splitTextToSize(safeVal2, maxColWidth);
      doc.text(lines2, val2X, currentY);
      maxLines = Math.max(maxLines, lines2.length);
    }

    currentY += maxLines * rowH;
  });

  // Salary Breakdown Table (Earnings vs Deductions)
  const tableY = gridY + gridHeight + 6;
  const colWidth = (contentWidth - 4) / 2;
  const leftX = margin + 2;
  const rightX = leftX + colWidth;

  // Table Headers
  doc.setFillColor(245, 245, 247);
  doc.rect(leftX, tableY, colWidth, 7, 'F');
  doc.rect(rightX, tableY, colWidth, 7, 'F');

  doc.setDrawColor(215, 215, 220);
  doc.rect(leftX, tableY, colWidth, 7);
  doc.rect(rightX, tableY, colWidth, 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0); // Black #000000
  doc.text(sanitizePdfText(layout.labelEarnings || 'EARNINGS'), leftX + 4, tableY + 5);
  doc.text('AMOUNT', leftX + colWidth - 4, tableY + 5, { align: 'right' });

  doc.text(sanitizePdfText(layout.labelDeductions || 'DEDUCTIONS'), rightX + 4, tableY + 5);
  doc.text('AMOUNT', rightX + colWidth - 4, tableY + 5, { align: 'right' });

  // Rows of Earnings and Deductions
  const earnings: Array<{ label: string; amount: number }> = [
    layout.showBasic !== false ? { label: layout.labelBasic || 'Basic Salary', amount: record.basic } : null,
    layout.showHra !== false ? { label: layout.labelHra || 'HRA', amount: record.hra } : null,
    layout.showSpecialAllowance !== false ? { label: layout.labelSpecialAllowance || 'Special Allowance', amount: record.specialAllowance || 0 } : null,
    layout.showOtherAllowances !== false ? { label: layout.labelOtherAllowances || 'Other Allowances', amount: record.otherAllowances || 0 } : null,
    record.conveyance ? { label: 'Conveyance Allowance', amount: record.conveyance } : null,
    record.medicalAllowance ? { label: 'Medical Allowance', amount: record.medicalAllowance } : null,
  ].filter(Boolean) as { label: string; amount: number }[];

  // Custom Allowances
  if (record.customFields) {
    const seenEarnKeys = new Set<string>();
    Object.entries(record.customFields).forEach(([key, val]) => {
      const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seenEarnKeys.has(normKey)) return;
      seenEarnKeys.add(normKey);
      if (typeof val === 'number' && key.toLowerCase().includes('allowance')) {
        const label = key.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        earnings.push({ label, amount: val });
      }
    });
  }

  const deductions: Array<{ label: string; amount: number }> = [
    layout.showPf !== false ? { label: layout.labelPf || 'Provident Fund (EPF)', amount: record.pf } : null,
    layout.showEsi !== false ? { label: layout.labelEsi || 'ESI', amount: record.esi } : null,
    layout.showProfessionalTax !== false ? { label: layout.labelProfessionalTax || 'Professional Tax', amount: record.professionalTax } : null,
    layout.showTds !== false ? { label: layout.labelTds || 'TDS / Income Tax', amount: record.tds } : null,
    (layout.showLoan !== false && record.loan && record.loan > 0)
      ? { label: layout.labelLoan || 'Staff Loan / Advance', amount: record.loan }
      : null,
    (layout.showLateDeduction !== false && record.lateDeduction && record.lateDeduction > 0)
      ? { label: layout.labelLateDeduction || 'Late Deduction', amount: record.lateDeduction }
      : null,
    // Explicit LOP Deduction if provided
    (layout.showLopAmount !== false && record.lopAmount && record.lopAmount > 0)
      ? { label: layout.labelLopAmount || 'Loss of Pay (LOP) Deduction', amount: record.lopAmount }
      : null,
    layout.showOtherDeductions !== false ? { label: layout.labelOtherDeductions || 'Other Deductions', amount: record.otherDeductions || 0 } : null,
  ].filter(Boolean) as { label: string; amount: number }[];

  const maxRows = Math.max(earnings.length, deductions.length);
  const rowHeight = 7.5;
  let rowY = tableY + 7;

  doc.setFontSize(8);

  for (let i = 0; i < maxRows; i++) {
    // Alternating zebra stripe
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(leftX, rowY, colWidth, rowHeight, 'F');
      doc.rect(rightX, rowY, colWidth, rowHeight, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(leftX, rowY + rowHeight, leftX + colWidth, rowY + rowHeight);
    doc.line(rightX, rowY + rowHeight, rightX + colWidth, rowY + rowHeight);

    // Earnings cell
    const earn = earnings[i];
    if (earn) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(sanitizePdfText(earn.label), leftX + 4, rowY + 5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(formatMoney(earn.amount, settings.currencySymbol, showSymbol), leftX + colWidth - 4, rowY + 5, { align: 'right' });
    }

    // Deductions cell
    const ded = deductions[i];
    if (ded) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(sanitizePdfText(ded.label), rightX + 4, rowY + 5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(formatMoney(ded.amount, settings.currencySymbol, showSymbol), rightX + colWidth - 4, rowY + 5, { align: 'right' });
    }

    rowY += rowHeight;
  }

  // Totals Row
  doc.setFillColor(245, 245, 247);
  doc.rect(leftX, rowY, colWidth, 9, 'F');
  doc.rect(rightX, rowY, colWidth, 9, 'F');

  doc.setDrawColor(215, 215, 220);
  doc.rect(leftX, rowY, colWidth, 9);
  doc.rect(rightX, rowY, colWidth, 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0); // Black #000000
  doc.text('TOTAL GROSS EARNINGS', leftX + 4, rowY + 6);
  doc.text(formatMoney(record.calculatedGross, settings.currencySymbol, showSymbol), leftX + colWidth - 4, rowY + 6, { align: 'right' });

  doc.text('TOTAL DEDUCTIONS', rightX + 4, rowY + 6);
  doc.setTextColor(primaryR, primaryG, primaryB);
  doc.text(formatMoney(record.calculatedDeductions, settings.currencySymbol, showSymbol), rightX + colWidth - 4, rowY + 6, { align: 'right' });

  rowY += 14;

  // NET PAY HIGHLIGHT CARD
  doc.setFillColor(255, 255, 255); // White #FFFFFF
  doc.setDrawColor(primaryR, primaryG, primaryB);
  doc.setLineWidth(0.7);
  doc.roundedRect(leftX, rowY, contentWidth - 4, 22, 2, 2, 'FD');

  doc.setTextColor(0, 0, 0); // Black #000000
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(sanitizePdfText(layout.labelNetSalary || 'NET SALARY PAYABLE:'), leftX + 6, rowY + 8);

  doc.setFontSize(14);
  doc.setTextColor(primaryR, primaryG, primaryB);
  const netAmountStr = showSymbol ? `${settings.currencySymbol} ${formatMoneyNumber(record.calculatedNet)}` : formatMoneyNumber(record.calculatedNet);
  const netText = sanitizePdfText(netAmountStr);
  doc.text(netText, leftX + contentWidth - 10, rowY + 9, { align: 'right' });

  // Amount in words
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  const words = numberToWords(record.calculatedNet, settings.currencyName || 'USD');
  doc.text(sanitizePdfText(`In Words: ${words}`), leftX + 6, rowY + 16);

  // Signatures & Notes Section
  rowY += 32;

  // Optional Note
  if (layout.showFooterNote && settings.payslipNote) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(sanitizePdfText(`Note: ${settings.payslipNote}`), leftX + 4, rowY);
    rowY += 8;
  }

  // Signatures
  if (layout.showSignatures) {
    const sigY = pageHeight - margin - 28;
    const sigLeftX = leftX + 15;
    const sigRightX = pageWidth - margin - 55;

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.line(sigLeftX, sigY, sigLeftX + 45, sigY);
    doc.line(sigRightX, sigY, sigRightX + 45, sigY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Employee Signature', sigLeftX + 5, sigY + 5);

    if (settings.signatureDataUrl && typeof settings.signatureDataUrl === 'string' && settings.signatureDataUrl.startsWith('data:image/')) {
      try {
        let sigFormat = 'PNG';
        if (settings.signatureDataUrl.toLowerCase().includes('image/jpeg')) sigFormat = 'JPEG';
        doc.addImage(settings.signatureDataUrl, sigFormat, sigRightX + 5, sigY - 14, 35, 12);
      } catch {
        // ignore
      }
    }

    doc.text(sanitizePdfText(settings.authorizedSignatoryTitle || 'Authorized Signatory'), sigRightX + 4, sigY + 5);
    if (settings.authorizedSignatoryName) {
      doc.setFont('helvetica', 'bold');
      doc.text(sanitizePdfText(settings.authorizedSignatoryName), sigRightX + 4, sigY + 9);
    }
  }

  // Footer text
  if (layout.showFooterNote) {
    const footerY = pageHeight - margin - 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('This is a computer-generated payslip created securely with PeopleDesk Studio. No signature required unless specified.', pageWidth / 2, footerY, { align: 'center' });
  }

  return doc;
}

/**
 * Creates a unique, safe filename for the PDF.
 */
export function getSafeFileName(record: EmployeeRecord, month: string, year: number): string {
  const safeId = (record.employeeId || 'EMPID').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeName = (record.name || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeMonth = month.replace(/[^a-zA-Z0-9]/g, '');
  return `Payslip_${safeId}_${safeName}_${safeMonth}_${year}.pdf`;
}

/**
 * Batch generates payslips into a ZIP archive with real-time progress callbacks.
 */
export async function generateBulkPayslipsZip(
  records: EmployeeRecord[],
  settings: CompanySettings,
  month: string,
  year: number,
  onProgress?: (completed: number, total: number, currentName: string) => void,
  layoutSettings?: PayslipLayoutSettings
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder(`Payslips_${month}_${year}`) || zip;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (onProgress) {
      onProgress(i + 1, records.length, record.name || record.employeeId);
    }

    const doc = generatePayslipPdf(record, settings, month, year, layoutSettings);
    const pdfBlob = doc.output('blob');
    const fileName = getSafeFileName(record, month, year);

    folder.file(fileName, pdfBlob);

    // Yield back to event loop slightly so UI progress updates smoothly
    if (i % 3 === 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  return await zip.generateAsync({ type: 'blob' });
}

function formatMoney(amount: number, symbol: string, showSymbol = true): string {
  const numStr = formatMoneyNumber(amount);
  if (!showSymbol) return numStr;
  const safeSymbol = symbol === '₹' ? 'Rs.' : sanitizePdfText(symbol) || '$';
  return `${safeSymbol} ${numStr}`;
}

function formatMoneyNumber(amount: number): string {
  const val = Number(amount) || 0;
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
