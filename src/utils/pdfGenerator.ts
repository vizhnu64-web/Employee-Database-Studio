import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { CompanySettings, EmployeeRecord, PayslipLayoutSettings, DEFAULT_LAYOUT_SETTINGS } from '../types/payroll';
import { numberToWords } from './numberToWords';
import { resolvePayslipSectionsData, formatMoneyDisplay } from './payslipFieldRegistry';

/**
 * Sanitizes text for standard jsPDF fonts (WinAnsiEncoding) to prevent gibberish or encoding errors.
 */
function sanitizePdfText(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/[^\x00-\x7F\u00A0-\u00FF]/g, (match) => {
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

function resolvePdfFont(family?: PayslipLayoutSettings['fontFamily'] | 'inherit' | 'sans'): 'helvetica' | 'times' | 'courier' {
  if (family === 'times') return 'times';
  if (family === 'courier') return 'courier';
  return 'helvetica';
}

/**
 * Generates a high-resolution, vector PDF payslip honoring full PayslipLayoutSettings and all 36 mapped fields.
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
    ...(layoutSettings || {}),
  };

  const resolvedData = resolvePayslipSectionsData(record, settings, month, year, layout, true);

  const isLandscape = layout.orientation === 'landscape';
  const [primaryR, primaryG, primaryB] = hexToRgb(layout.primaryColor || settings.themeColor || '#CB1417');
  const showSymbol = settings.showCurrencySymbol !== false;
  const pdfFont = resolvePdfFont(layout.fontFamily);
  const headerFontSize = Math.max(12, Math.min(20, Number(layout.headerFontSize || 15)));
  const bodyFontSize = Math.max(7, Math.min(11, Number(layout.bodyFontSize || 8)));

  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  doc.setProperties({
    title: `Payslip - ${sanitizePdfText(record.employeeId || '')} - ${sanitizePdfText(record.name || '')} (${sanitizePdfText(month)} ${year})`,
    subject: `Official Salary Payslip for ${sanitizePdfText(month)} ${year}`,
    author: sanitizePdfText(settings.companyName || 'Employee Database Studio'),
    creator: 'Employee Database Studio',
  });

  const pageWidth = isLandscape ? 297 : 210;
  const pageHeight = isLandscape ? 210 : 297;
  const margin = Math.max(8, Math.min(22, Number(layout.marginMm ?? 14)));
  const contentWidth = pageWidth - margin * 2;
  const bottomSafeY = pageHeight - margin - 12;

  const ensureSpace = (currentY: number, neededHeight: number): number => {
    if (currentY + neededHeight > bottomSafeY) {
      doc.addPage();
      doc.setDrawColor(210, 210, 215);
      doc.setLineWidth(0.4);
      doc.rect(margin, margin, contentWidth, pageHeight - margin * 2);
      return margin + 8;
    }
    return currentY;
  };

  // Outer page frame
  doc.setDrawColor(210, 210, 215);
  doc.setLineWidth(0.4);
  doc.rect(margin, margin, contentWidth, pageHeight - margin * 2);

  // Header strip
  const headerBoxH = layout.templatePreset === 'compact' || layout.templatePreset === 'minimal_clean' ? 28 : 34;
  doc.setFillColor(252, 252, 252);
  doc.rect(margin, margin, contentWidth, headerBoxH, 'F');
  doc.line(margin, margin + headerBoxH, margin + contentWidth, margin + headerBoxH);

  // Logo dimensions & position
  const logoBounds =
    layout.logoSize === 'small'
      ? { maxW: 22, maxH: 16 }
      : layout.logoSize === 'large'
        ? { maxW: 42, maxH: 28 }
        : { maxW: 32, maxH: 22 };
  const logoPos = layout.logoPosition || 'left';

  let textStartX = margin + 6;
  let textRightReserve = margin + contentWidth - 6;

  if (
    layout.showLogo &&
    settings.logoDataUrl &&
    typeof settings.logoDataUrl === 'string' &&
    settings.logoDataUrl.startsWith('data:image/')
  ) {
    try {
      let format = 'PNG';
      const lower = settings.logoDataUrl.toLowerCase();
      if (lower.includes('image/jpeg') || lower.includes('image/jpg')) format = 'JPEG';
      else if (lower.includes('image/webp')) format = 'WEBP';
      else if (lower.includes('image/svg+xml')) throw new Error('SVG logo unsupported directly');

      const props = doc.getImageProperties(settings.logoDataUrl);
      const imgW = props.width || 100;
      const imgH = props.height || 100;
      let renderW = logoBounds.maxW;
      let renderH = (imgH * logoBounds.maxW) / imgW;
      if (renderH > logoBounds.maxH) {
        renderH = logoBounds.maxH;
        renderW = (imgW * logoBounds.maxH) / imgH;
      }

      const logoX =
        logoPos === 'right'
          ? margin + contentWidth - renderW - 5
          : logoPos === 'center'
            ? (pageWidth - renderW) / 2
            : margin + 5;
      const logoY = logoPos === 'center' ? margin + 2 : margin + (headerBoxH - renderH) / 2;

      doc.addImage(settings.logoDataUrl, format, logoX, logoY, renderW, renderH);
      if (logoPos === 'left') {
        textStartX = margin + renderW + 9;
      } else if (logoPos === 'right') {
        textRightReserve = margin + contentWidth - renderW - 9;
      }
    } catch {
      textStartX = margin + 6;
    }
  }

  const isCenter = layout.alignHeader === 'center';
  const isRight = layout.alignHeader === 'right';
  const headerX = isCenter ? pageWidth / 2 : isRight ? textRightReserve : textStartX;
  const headerAlign: 'left' | 'center' | 'right' = isCenter ? 'center' : isRight ? 'right' : 'left';
  const companyTitleTop = logoPos === 'center' && layout.showLogo && settings.logoDataUrl ? margin + 21 : margin + 10;

  doc.setTextColor(0, 0, 0);
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(headerFontSize);
  doc.text(sanitizePdfText(settings.companyName || 'Corporate Enterprise Ltd.'), headerX, companyTitleTop, {
    align: headerAlign,
  });

  doc.setFont(pdfFont, 'normal');
  doc.setFontSize(Math.max(7, bodyFontSize));
  doc.setTextColor(80, 80, 80);

  const addr = [settings.addressLine1, settings.addressLine2, settings.cityStateZip]
    .filter(Boolean)
    .map(sanitizePdfText)
    .join(', ');
  if (addr) {
    doc.text(addr, headerX, companyTitleTop + 5, { align: headerAlign });
  }

  const contact = [
    settings.email ? `Email: ${settings.email}` : '',
    settings.phone ? `Phone: ${settings.phone}` : '',
    settings.website ? `Web: ${settings.website}` : '',
  ]
    .filter(Boolean)
    .map(sanitizePdfText)
    .join('  |  ');
  if (contact && logoPos !== 'center') {
    doc.text(contact, headerX, companyTitleTop + 9.5, { align: headerAlign });
  }

  if (layout.showTaxId && settings.taxRegistrationNumber && logoPos !== 'center') {
    doc.text(sanitizePdfText(`Registration / Tax ID: ${settings.taxRegistrationNumber}`), headerX, companyTitleTop + 14, {
      align: headerAlign,
    });
  }

  // Title Banner
  doc.setFillColor(primaryR, primaryG, primaryB);
  doc.rect(margin, margin + headerBoxH, contentWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(10);
  doc.text(sanitizePdfText(`PAYSLIP FOR THE PERIOD: ${month.toUpperCase()} ${year}`), pageWidth / 2, margin + headerBoxH + 6.5, {
    align: 'center',
  });

  let cursorY = margin + headerBoxH + 14;

  const renderCustomBlocks = (slot: 'afterEmployeeInfo' | 'afterNetPay' | 'footer') => {
    const blocks = (layout.customTextBlocks || []).filter((b) => b.visible !== false && b.position === slot && b.content?.trim());
    blocks.forEach((blk) => {
      const wrapped = doc.splitTextToSize(sanitizePdfText(blk.content), contentWidth - 10);
      const boxH = 8 + wrapped.length * 4;
      cursorY = ensureSpace(cursorY, boxH + 4);
      doc.setFillColor(248, 248, 250);
      doc.setDrawColor(225, 225, 230);
      doc.rect(margin + 2, cursorY, contentWidth - 4, boxH, 'FD');
      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(bodyFontSize);
      doc.setTextColor(primaryR, primaryG, primaryB);
      doc.text(sanitizePdfText(blk.title || 'Notice'), margin + 5, cursorY + 4.5);
      doc.setFont(pdfFont, 'normal');
      doc.setTextColor(40, 40, 45);
      doc.text(wrapped, margin + 5, cursorY + 8.5);
      cursorY += boxH + 4;
    });
  };

  const renderEmployeeInfoSection = () => {
    const infoItems = resolvedData.infoFields;
    const empPairs: Array<{
      f1: (typeof infoItems)[number] | null;
      f2: (typeof infoItems)[number] | null;
    }> = [];
    for (let i = 0; i < infoItems.length; i += 2) {
      empPairs.push({
        f1: infoItems[i] || null,
        f2: infoItems[i + 1] || null,
      });
    }

    const halfW = (contentWidth - 4) / 2;
    const col1X = margin + 5;
    const val1X = margin + Math.min(44, halfW * 0.44);
    const col2X = margin + 4 + halfW + 2;
    const val2X = margin + 4 + halfW + Math.min(43, halfW * 0.44);
    const maxColWidth = Math.max(32, halfW - (val1X - col1X) - 4);

    const rowH = layout.cellPadding === 'compact' ? 4.4 : layout.cellPadding === 'spacious' ? 6.0 : 5.2;
    doc.setFontSize(bodyFontSize);
    const computedHeights = empPairs.map((pair) => {
      const lines1 = pair.f1 ? doc.splitTextToSize(sanitizePdfText(pair.f1.displayValue), maxColWidth) : [];
      const lines2 = pair.f2 ? doc.splitTextToSize(sanitizePdfText(pair.f2.displayValue), maxColWidth) : [];
      return Math.max(lines1.length, lines2.length, 1) * rowH;
    });
    const gridHeight = Math.max(20, computedHeights.reduce((a, b) => a + b, 0) + 6);
    cursorY = ensureSpace(cursorY, gridHeight + 4);

    doc.setFillColor(248, 248, 250);
    doc.rect(margin + 2, cursorY, contentWidth - 4, gridHeight, 'F');
    doc.setDrawColor(225, 225, 230);
    doc.rect(margin + 2, cursorY, contentWidth - 4, gridHeight);

    let currentY = cursorY + 5;
    empPairs.forEach((pair, idx) => {
      if (pair.f1) {
        const cfg1 = pair.f1.styleConfig;
        const itemFont1 = cfg1.fontFamily && cfg1.fontFamily !== 'inherit' ? resolvePdfFont(cfg1.fontFamily) : pdfFont;
        const itemSize1 = cfg1.fontSize ? Math.max(6.5, Math.min(11, cfg1.fontSize)) : bodyFontSize;
        doc.setFont(itemFont1, 'bold');
        doc.setFontSize(itemSize1);
        doc.setTextColor(80, 80, 80);
        doc.text(sanitizePdfText(pair.f1.label), col1X, currentY);

        if (cfg1.textColor) {
          const [tr, tg, tb] = hexToRgb(cfg1.textColor);
          doc.setTextColor(tr, tg, tb);
        } else {
          doc.setTextColor(0, 0, 0);
        }
        doc.setFont(itemFont1, cfg1.fontWeight === 'bold' ? 'bold' : 'normal');
        const lines1 = doc.splitTextToSize(sanitizePdfText(pair.f1.displayValue), maxColWidth);
        doc.text(lines1, val1X, currentY);
      }

      if (pair.f2) {
        const cfg2 = pair.f2.styleConfig;
        const itemFont2 = cfg2.fontFamily && cfg2.fontFamily !== 'inherit' ? resolvePdfFont(cfg2.fontFamily) : pdfFont;
        const itemSize2 = cfg2.fontSize ? Math.max(6.5, Math.min(11, cfg2.fontSize)) : bodyFontSize;
        doc.setFont(itemFont2, 'bold');
        doc.setFontSize(itemSize2);
        doc.setTextColor(80, 80, 80);
        doc.text(sanitizePdfText(pair.f2.label), col2X, currentY);

        if (cfg2.textColor) {
          const [tr, tg, tb] = hexToRgb(cfg2.textColor);
          doc.setTextColor(tr, tg, tb);
        } else {
          doc.setTextColor(0, 0, 0);
        }
        doc.setFont(itemFont2, cfg2.fontWeight === 'bold' ? 'bold' : 'normal');
        const lines2 = doc.splitTextToSize(sanitizePdfText(pair.f2.displayValue), maxColWidth);
        doc.text(lines2, val2X, currentY);
      }
      currentY += computedHeights[idx];
    });

    cursorY += gridHeight + 6;
    renderCustomBlocks('afterEmployeeInfo');
  };

  const renderSalaryTableSection = () => {
    const colWidth = (contentWidth - 4) / 2;
    const leftX = margin + 2;
    const rightX = leftX + colWidth;
    const borderMode = layout.tableBorderStyle || 'grid';
    const rowHeight = layout.cellPadding === 'compact' ? 6.2 : layout.cellPadding === 'spacious' ? 9.0 : 7.5;

    const earnings = resolvedData.earningRows;
    const deductions = resolvedData.deductionRows;

    const maxRows = Math.max(earnings.length, deductions.length, 1);
    const totalNeeded = 7 + maxRows * rowHeight + 12;
    cursorY = ensureSpace(cursorY, Math.min(totalNeeded, 70));

    // Table Headers
    doc.setFillColor(245, 245, 247);
    doc.rect(leftX, cursorY, colWidth, 7, 'F');
    doc.rect(rightX, cursorY, colWidth, 7, 'F');

    doc.setDrawColor(215, 215, 220);
    if (borderMode === 'grid') {
      doc.rect(leftX, cursorY, colWidth, 7);
      doc.rect(rightX, cursorY, colWidth, 7);
    } else {
      doc.line(leftX, cursorY + 7, rightX + colWidth, cursorY + 7);
    }

    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(bodyFontSize + 0.5);
    doc.setTextColor(0, 0, 0);
    doc.text(sanitizePdfText(layout.labelEarnings || 'EARNINGS'), leftX + 4, cursorY + 5);
    doc.text('AMOUNT', leftX + colWidth - 4, cursorY + 5, { align: 'right' });

    doc.text(sanitizePdfText(layout.labelDeductions || 'DEDUCTIONS'), rightX + 4, cursorY + 5);
    doc.text('AMOUNT', rightX + colWidth - 4, cursorY + 5, { align: 'right' });

    let rowY = cursorY + 7;
    doc.setFontSize(bodyFontSize);

    for (let i = 0; i < maxRows; i++) {
      rowY = ensureSpace(rowY, rowHeight + 2);
      if (i % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(leftX, rowY, colWidth, rowHeight, 'F');
        doc.rect(rightX, rowY, colWidth, rowHeight, 'F');
      }

      if (borderMode !== 'minimal') {
        doc.setDrawColor(226, 232, 240);
        doc.line(leftX, rowY + rowHeight, leftX + colWidth, rowY + rowHeight);
        doc.line(rightX, rowY + rowHeight, rightX + colWidth, rowY + rowHeight);
        if (borderMode === 'grid') {
          doc.line(leftX, rowY, leftX, rowY + rowHeight);
          doc.line(rightX, rowY, rightX, rowY + rowHeight);
          doc.line(rightX + colWidth, rowY, rightX + colWidth, rowY + rowHeight);
        }
      }

      const textBaseline = rowY + rowHeight * 0.66;
      const earn = earnings[i];
      if (earn) {
        const cfg = earn.styleConfig;
        const itemFont = cfg.fontFamily && cfg.fontFamily !== 'inherit' ? resolvePdfFont(cfg.fontFamily) : pdfFont;
        doc.setFont(itemFont, 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(sanitizePdfText(earn.label), leftX + 4, textBaseline);
        doc.setFont(itemFont, 'bold');
        if (cfg.textColor) {
          const [tr, tg, tb] = hexToRgb(cfg.textColor);
          doc.setTextColor(tr, tg, tb);
        } else {
          doc.setTextColor(15, 23, 42);
        }
        doc.text(sanitizePdfText(earn.displayValue), leftX + colWidth - 4, textBaseline, { align: 'right' });
      }

      const ded = deductions[i];
      if (ded) {
        const cfg = ded.styleConfig;
        const itemFont = cfg.fontFamily && cfg.fontFamily !== 'inherit' ? resolvePdfFont(cfg.fontFamily) : pdfFont;
        doc.setFont(itemFont, 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(sanitizePdfText(ded.label), rightX + 4, textBaseline);
        doc.setFont(itemFont, 'bold');
        if (cfg.textColor) {
          const [tr, tg, tb] = hexToRgb(cfg.textColor);
          doc.setTextColor(tr, tg, tb);
        } else {
          doc.setTextColor(15, 23, 42);
        }
        doc.text(sanitizePdfText(ded.displayValue), rightX + colWidth - 4, textBaseline, { align: 'right' });
      }

      rowY += rowHeight;
    }

    // Totals Row
    rowY = ensureSpace(rowY, 12);
    doc.setFillColor(245, 245, 247);
    doc.rect(leftX, rowY, colWidth, 9, 'F');
    doc.rect(rightX, rowY, colWidth, 9, 'F');

    doc.setDrawColor(215, 215, 220);
    if (borderMode === 'grid') {
      doc.rect(leftX, rowY, colWidth, 9);
      doc.rect(rightX, rowY, colWidth, 9);
    } else {
      doc.line(leftX, rowY, rightX + colWidth, rowY);
      doc.line(leftX, rowY + 9, rightX + colWidth, rowY + 9);
    }

    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(bodyFontSize + 0.5);
    doc.setTextColor(0, 0, 0);
    if (layout.showGrossEarnings !== false) {
      doc.text(sanitizePdfText(resolvedData.grossTotal.label), leftX + 4, rowY + 6);
      doc.text(sanitizePdfText(resolvedData.grossTotal.displayValue), leftX + colWidth - 4, rowY + 6, { align: 'right' });
    }

    if (layout.showTotalDeductions !== false) {
      doc.text(sanitizePdfText(resolvedData.deductionTotal.label), rightX + 4, rowY + 6);
      doc.setTextColor(primaryR, primaryG, primaryB);
      doc.text(sanitizePdfText(resolvedData.deductionTotal.displayValue), rightX + colWidth - 4, rowY + 6, { align: 'right' });
    }

    cursorY = rowY + 14;
  };

  const renderNetPaySection = () => {
    if (layout.showNetSalary === false) return;
    cursorY = ensureSpace(cursorY, 28);
    const leftX = margin + 2;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(primaryR, primaryG, primaryB);
    doc.setLineWidth(0.7);
    doc.roundedRect(leftX, cursorY, contentWidth - 4, 22, 2, 2, 'FD');

    doc.setTextColor(0, 0, 0);
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(bodyFontSize + 1.5);
    doc.text(sanitizePdfText(resolvedData.netPaySummary.label || 'NET SALARY PAYABLE:'), leftX + 6, cursorY + 8);

    doc.setFontSize(14);
    doc.setTextColor(primaryR, primaryG, primaryB);
    const netAmountStr = formatMoneyDisplay(record.calculatedNet, settings.currencySymbol, showSymbol, true);
    doc.text(sanitizePdfText(netAmountStr), leftX + contentWidth - 10, cursorY + 9, { align: 'right' });

    doc.setFont(pdfFont, 'italic');
    doc.setFontSize(bodyFontSize + 0.5);
    doc.setTextColor(40, 40, 40);
    const words = numberToWords(record.calculatedNet, settings.currencyName || 'USD');
    const wrappedWords = doc.splitTextToSize(sanitizePdfText(`In Words: ${words}`), contentWidth - 16);
    doc.text(wrappedWords[0] || '', leftX + 6, cursorY + 16);

    cursorY += 28;
    renderCustomBlocks('afterNetPay');
  };

  const renderNotesSection = () => {
    if (layout.showFooterNote && settings.payslipNote) {
      const wrappedNote = doc.splitTextToSize(sanitizePdfText(`Note: ${settings.payslipNote}`), contentWidth - 12);
      cursorY = ensureSpace(cursorY, wrappedNote.length * 4 + 6);
      doc.setFont(pdfFont, 'normal');
      doc.setFontSize(Math.max(7, bodyFontSize - 0.5));
      doc.setTextColor(100, 116, 139);
      doc.text(wrappedNote, margin + 6, cursorY);
      cursorY += wrappedNote.length * 4 + 6;
    }
    renderCustomBlocks('footer');
  };

  const renderSignaturesSection = () => {
    if (!layout.showSignatures) return;
    cursorY = ensureSpace(cursorY, 26);
    const sigY = Math.max(cursorY + 14, pageHeight - margin - 26);
    const sigLeftX = margin + 17;
    const sigRightX = pageWidth - margin - 57;

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.line(sigLeftX, sigY, sigLeftX + 45, sigY);
    doc.line(sigRightX, sigY, sigRightX + 45, sigY);

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(bodyFontSize);
    doc.setTextColor(71, 85, 105);
    doc.text('Employee Signature', sigLeftX + 5, sigY + 5);

    if (
      settings.signatureDataUrl &&
      typeof settings.signatureDataUrl === 'string' &&
      settings.signatureDataUrl.startsWith('data:image/')
    ) {
      try {
        let sigFormat = 'PNG';
        if (settings.signatureDataUrl.toLowerCase().includes('image/jpeg')) sigFormat = 'JPEG';
        doc.addImage(settings.signatureDataUrl, sigFormat, sigRightX + 5, sigY - 14, 35, 12);
      } catch {}
    }

    doc.text(sanitizePdfText(settings.authorizedSignatoryTitle || 'Authorized Signatory'), sigRightX + 4, sigY + 5);
    if (settings.authorizedSignatoryName) {
      doc.setFont(pdfFont, 'bold');
      doc.text(sanitizePdfText(settings.authorizedSignatoryName), sigRightX + 4, sigY + 9);
    }
    cursorY = sigY + 12;
  };

  const defaultOrder: Array<'employeeInfo' | 'salaryTable' | 'netPay' | 'notes' | 'signatures'> = [
    'employeeInfo',
    'salaryTable',
    'netPay',
    'notes',
    'signatures',
  ];
  const order = Array.isArray(layout.sectionOrder) && layout.sectionOrder.length > 0 ? layout.sectionOrder : defaultOrder;
  const rendered = new Set<string>();

  for (const section of order) {
    if (rendered.has(section)) continue;
    rendered.add(section);
    if (section === 'employeeInfo') renderEmployeeInfoSection();
    else if (section === 'salaryTable') renderSalaryTableSection();
    else if (section === 'netPay') renderNetPaySection();
    else if (section === 'notes') renderNotesSection();
    else if (section === 'signatures') renderSignaturesSection();
  }

  for (const fallback of defaultOrder) {
    if (!rendered.has(fallback)) {
      if (fallback === 'employeeInfo') renderEmployeeInfoSection();
      else if (fallback === 'salaryTable') renderSalaryTableSection();
      else if (fallback === 'netPay') renderNetPaySection();
      else if (fallback === 'notes') renderNotesSection();
      else if (fallback === 'signatures') renderSignaturesSection();
    }
  }

  if (layout.showFooterNote) {
    const footerY = pageHeight - margin - 4;
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'This is a computer-generated payslip created securely with Employee Database Studio. No signature required unless specified.',
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );
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

    if (i % 3 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
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
