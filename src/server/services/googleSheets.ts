import { google } from 'googleapis';

export class GoogleSheetsError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'GoogleSheetsError';
    this.statusCode = statusCode;
  }
}

export const WORKSHEET_SCHEMAS = {
  Employees: [
    'Employee ID', 'Employee Name', 'Email', 'Phone', 'Designation',
    'Department', 'Joining Date', 'Employment Status', 'Bank Details',
    'Payroll Identifiers', 'Document Folder ID', 'Created Date', 'Updated Date', 'Version',
  ],
  'Salary Structures': [
    'Employee ID', 'Basic Salary', 'HRA', 'Allowances', 'CTC',
    'Employer PF', 'Employer ESI', 'Employee PF', 'Employee ESI',
    'Professional Tax', 'Effective From', 'Effective To', 'Updated Date', 'Version',
  ],
  'Payroll Batches': [
    'Batch ID', 'Payroll Month', 'Payroll Year', 'Created Date',
    'Employee Count', 'Total Payroll', 'Batch Status', 'Updated Date', 'Version',
  ],
  'Payroll Details': [
    'Payroll Record ID', 'Batch ID', 'Employee ID', 'Earnings',
    'Deductions', 'Net Salary', 'LOP Days', 'LOP Deduction',
    'Payslip File ID', 'Status', 'Updated Date', 'Version',
  ],
  'Manual Payslips': [
    'Manual Payslip ID', 'Employee ID', 'Employee Name', 'Email',
    'Payroll Month', 'Payroll Year', 'Earnings Details', 'Deductions Details',
    'Total Earnings', 'Total Deductions', 'Net Salary', 'PDF File ID', 'Created Date', 'Updated Date', 'Version',
  ],
  'Payslip History': [
    'Payslip ID', 'Employee ID', 'Employee Name', 'Payroll Period',
    'Generation Method', 'Drive File ID', 'Generation Date', 'Email Status', 'Updated Date', 'Version',
  ],
  'Email Logs': [
    'Email ID', 'Payslip ID', 'Employee ID', 'Recipient', 'Provider',
    'Sent Date', 'Delivery Status', 'Error Message', 'Retry Count',
  ],
  'Company Settings': [
    'Company Name', 'Company Address', 'Company Phone', 'Company Email',
    'Logo File ID', 'Payslip Design Settings', 'Default Email Template', 'Updated Date', 'Version',
  ],
  'Layout Settings': [
    'Layout ID', 'Template Name', 'Element Styles', 'Section Order',
    'Visibility Rules', 'Branding Overrides', 'Updated Date', 'Version',
  ],
  'Synchronization Logs': [
    'Sync ID', 'Worksheet', 'Record Key', 'Action',
    'Status', 'Version', 'Details', 'Synced At',
  ],
} as const;

export type WorksheetName = keyof typeof WORKSHEET_SCHEMAS;

export const REQUIRED_WORKSHEETS = Object.keys(WORKSHEET_SCHEMAS) as WorksheetName[];

export function extractSpreadsheetId(input: string): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const urlMatch = raw.match(
    /^https?:\/\/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{15,120})(?:[/?#]|$)/i
  );
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  if (/^https?:\/\//i.test(raw) || raw.includes('/')) {
    return null;
  }

  if (/^[a-zA-Z0-9_-]{20,120}$/.test(raw)) {
    return raw;
  }

  return null;
}

export function buildCanonicalSpreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

function colIndexToLetter(index1Based: number): string {
  let n = index1Based;
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result || 'A';
}

export function createGoogleSheetsClient(accessToken: string, spreadsheetId?: string | null) {
  if (!accessToken || !accessToken.trim()) {
    throw new GoogleSheetsError(
      'Google OAuth access token is required. Sign in with Google in Company Settings.',
      401
    );
  }
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken.trim() });

  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });
  const resolvedId = spreadsheetId ? extractSpreadsheetId(spreadsheetId) || spreadsheetId.trim() : null;

  return {
    sheets,
    drive,
    auth,
    spreadsheetId: resolvedId,
    spreadsheetUrl: resolvedId ? buildCanonicalSpreadsheetUrl(resolvedId) : null,
  };
}

export interface SpreadsheetVerificationResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  canWrite: boolean;
  existingWorksheets: string[];
  missingWorksheets: WorksheetName[];
  requiresWorksheetApproval: boolean;
}

export async function verifySpreadsheetUrlAccess(
  accessToken: string,
  spreadsheetUrlOrId: string,
  accountEmail?: string
): Promise<SpreadsheetVerificationResult> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetUrlOrId);
  if (!spreadsheetId) {
    throw new GoogleSheetsError(
      'Invalid Google Spreadsheet URL or ID. Paste a valid https://docs.google.com/spreadsheets/d/... URL or Spreadsheet ID.',
      400
    );
  }

  const { sheets, drive } = createGoogleSheetsClient(accessToken, spreadsheetId);
  const label = accountEmail || 'your Google account';

  try {
    const [meta, fileMeta] = await Promise.all([
      sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetId,properties.title,spreadsheetUrl,sheets.properties.title',
      }),
      drive.files
        .get({
          fileId: spreadsheetId,
          fields: 'id,name,capabilities(canEdit)',
        })
        .catch(() => null),
    ]);

    const canEdit = fileMeta?.data?.capabilities?.canEdit !== false;
    if (!canEdit) {
      throw new GoogleSheetsError(
        `Your connected Google account (${label}) has read-only access to this spreadsheet. Request Editor access and retry.`,
        403
      );
    }

    const existingWorksheets = (meta.data.sheets || [])
      .map((s) => s.properties?.title || '')
      .filter(Boolean);

    const missingWorksheets = REQUIRED_WORKSHEETS.filter((w) => !existingWorksheets.includes(w));

    return {
      spreadsheetId,
      spreadsheetUrl: meta.data.spreadsheetUrl || buildCanonicalSpreadsheetUrl(spreadsheetId),
      title: meta.data.properties?.title || fileMeta?.data?.name || 'Linked Google Spreadsheet',
      canWrite: canEdit,
      existingWorksheets,
      missingWorksheets,
      requiresWorksheetApproval: missingWorksheets.length > 0,
    };
  } catch (err: any) {
    if (err instanceof GoogleSheetsError) throw err;
    const status = err?.code || err?.response?.status;
    if (status === 401) {
      throw new GoogleSheetsError('Google OAuth session expired. Please reconnect your Google account.', 401);
    }
    if (status === 403) {
      throw new GoogleSheetsError(
        `Permission denied accessing spreadsheet (${spreadsheetId}). Share it as Editor with ${label} or re-authorize Sheets access.`,
        403
      );
    }
    if (status === 404) {
      throw new GoogleSheetsError(
        `Spreadsheet (${spreadsheetId}) was not found or is not accessible to ${label}. With drive.file scope, ensure the spreadsheet was created by Employee Database Studio or shared with your account.`,
        404
      );
    }
    throw new GoogleSheetsError(err?.message || 'Failed to inspect Google Spreadsheet.', status || 500);
  }
}

export async function ensureMissingWorksheetsSafe(
  accessToken: string,
  spreadsheetId: string
): Promise<{ spreadsheetId: string; addedWorksheets: WorksheetName[]; worksheets: WorksheetName[] }> {
  const { sheets } = createGoogleSheetsClient(accessToken, spreadsheetId);
  if (!spreadsheetId) {
    throw new GoogleSheetsError('No Google Spreadsheet ID provided.', 400);
  }

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = (meta.data.sheets || []).map((s) => s.properties?.title || '').filter(Boolean);
  const missingSheets = REQUIRED_WORKSHEETS.filter((w) => !existingSheets.includes(w));

  if (missingSheets.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missingSheets.map((title) => ({
          addSheet: { properties: { title } },
        })),
      },
    });
  }

  for (const sheetName of REQUIRED_WORKSHEETS) {
    const headers = WORKSHEET_SCHEMAS[sheetName];
    const range = `'${sheetName}'!A1:${colIndexToLetter(headers.length)}1`;
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    if (!getRes.data.values || getRes.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [headers as unknown as string[]] },
      });
    }
  }

  return {
    spreadsheetId,
    addedWorksheets: missingSheets,
    worksheets: REQUIRED_WORKSHEETS,
  };
}

export async function initializeMasterSpreadsheet(
  accessToken: string,
  existingSpreadsheetId?: string | null
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; worksheets: WorksheetName[] }> {
  const { sheets } = createGoogleSheetsClient(accessToken);
  let activeId = existingSpreadsheetId ? extractSpreadsheetId(existingSpreadsheetId) || existingSpreadsheetId.trim() : '';

  if (!activeId) {
    const createRes = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: 'Employee Database Studio Database' },
      },
    });
    activeId = createRes.data.spreadsheetId || '';
    if (!activeId) {
      throw new GoogleSheetsError('Failed to create master Google Spreadsheet.', 502);
    }
  }

  await ensureMissingWorksheetsSafe(accessToken, activeId);

  return {
    spreadsheetId: activeId,
    spreadsheetUrl: buildCanonicalSpreadsheetUrl(activeId),
    worksheets: REQUIRED_WORKSHEETS,
  };
}

export async function appendWorksheetRow(
  accessToken: string,
  spreadsheetId: string,
  worksheetName: WorksheetName,
  rowData: any[]
): Promise<boolean> {
  const { sheets } = createGoogleSheetsClient(accessToken, spreadsheetId);
  if (!spreadsheetId) throw new GoogleSheetsError('Master spreadsheet ID not configured.', 400);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${worksheetName}'!A:A`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowData] },
  });
  return true;
}

export async function appendWorksheetRows(
  accessToken: string,
  spreadsheetId: string,
  worksheetName: WorksheetName,
  rows: any[][]
): Promise<number> {
  if (rows.length === 0) return 0;
  const { sheets } = createGoogleSheetsClient(accessToken, spreadsheetId);
  if (!spreadsheetId) throw new GoogleSheetsError('Master spreadsheet ID not configured.', 400);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${worksheetName}'!A:A`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  });
  return rows.length;
}

export async function getWorksheetRows(
  accessToken: string,
  spreadsheetId: string,
  worksheetName: WorksheetName
): Promise<any[][]> {
  if (!spreadsheetId) return [];
  const { sheets } = createGoogleSheetsClient(accessToken, spreadsheetId);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${worksheetName}'!A:Z`,
  });
  return res.data.values || [];
}

export async function updateWorksheetRow(
  accessToken: string,
  spreadsheetId: string,
  worksheetName: WorksheetName,
  rowNumber1Based: number,
  rowData: any[]
): Promise<boolean> {
  const { sheets } = createGoogleSheetsClient(accessToken, spreadsheetId);
  if (!spreadsheetId) throw new GoogleSheetsError('Master spreadsheet ID not configured.', 400);

  const colEnd = colIndexToLetter(Math.max(rowData.length, WORKSHEET_SCHEMAS[worksheetName].length));
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${worksheetName}'!A${rowNumber1Based}:${colEnd}${rowNumber1Based}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowData] },
  });
  return true;
}

export function getVersionColumnIndex(worksheetName: WorksheetName): number {
  const headers = WORKSHEET_SCHEMAS[worksheetName] as readonly string[];
  return headers.findIndex((h) => h.toLowerCase() === 'version');
}

export async function upsertWorksheetRowByKey(
  accessToken: string,
  spreadsheetId: string,
  worksheetName: WorksheetName,
  keyValue: string,
  rowData: any[],
  keyColumnIndex = 0
): Promise<'inserted' | 'updated'> {
  const rows = await getWorksheetRows(accessToken, spreadsheetId, worksheetName);
  const cleanKey = String(keyValue || '').trim().toLowerCase();
  const matchIdx = rows.findIndex(
    (r, idx) => idx > 0 && String(r[keyColumnIndex] || '').trim().toLowerCase() === cleanKey
  );

  if (matchIdx > 0) {
    await updateWorksheetRow(accessToken, spreadsheetId, worksheetName, matchIdx + 1, rowData);
    return 'updated';
  }
  await appendWorksheetRow(accessToken, spreadsheetId, worksheetName, rowData);
  return 'inserted';
}

export interface VersionedUpsertResult {
  action: 'inserted' | 'updated' | 'conflict';
  version: number;
  remoteVersion?: number;
  remoteRow?: any[];
}

export async function upsertWorksheetRowVersioned(
  accessToken: string,
  spreadsheetId: string,
  worksheetName: WorksheetName,
  keyValue: string,
  rowData: any[],
  expectedVersion?: number,
  keyColumnIndex = 0
): Promise<VersionedUpsertResult> {
  const rows = await getWorksheetRows(accessToken, spreadsheetId, worksheetName);
  const cleanKey = String(keyValue || '').trim().toLowerCase();
  if (!cleanKey) {
    throw new GoogleSheetsError(`Primary key value is required for ${worksheetName}.`, 400);
  }

  const versionColIdx = getVersionColumnIndex(worksheetName);
  const matchIdx = rows.findIndex(
    (r, idx) => idx > 0 && String(r[keyColumnIndex] || '').trim().toLowerCase() === cleanKey
  );

  if (matchIdx > 0) {
    const existingRow = rows[matchIdx];
    const currentRemoteVer = versionColIdx >= 0 ? Math.max(1, Number(existingRow[versionColIdx] || 1)) : 1;

    if (expectedVersion !== undefined && currentRemoteVer > expectedVersion) {
      return {
        action: 'conflict',
        version: currentRemoteVer,
        remoteVersion: currentRemoteVer,
        remoteRow: existingRow,
      };
    }

    const nextVer = currentRemoteVer + 1;
    const preparedRow = [...rowData];
    if (versionColIdx >= 0) {
      while (preparedRow.length <= versionColIdx) preparedRow.push('');
      preparedRow[versionColIdx] = nextVer;
    }

    await updateWorksheetRow(accessToken, spreadsheetId, worksheetName, matchIdx + 1, preparedRow);
    return { action: 'updated', version: nextVer };
  }

  const initialVer = Math.max(1, Number(expectedVersion || 1));
  const preparedRow = [...rowData];
  if (versionColIdx >= 0) {
    while (preparedRow.length <= versionColIdx) preparedRow.push('');
    preparedRow[versionColIdx] = initialVer;
  }
  await appendWorksheetRow(accessToken, spreadsheetId, worksheetName, preparedRow);
  return { action: 'inserted', version: initialVer };
}

export async function batchUpsertWorksheetRows(
  accessToken: string,
  spreadsheetId: string,
  worksheetName: WorksheetName,
  entries: Array<{ key: string; row: any[] }>,
  keyColumnIndex = 0
): Promise<{ inserted: number; updated: number }> {
  if (entries.length === 0) return { inserted: 0, updated: 0 };

  const { sheets } = createGoogleSheetsClient(accessToken, spreadsheetId);
  if (!spreadsheetId) throw new GoogleSheetsError('Master spreadsheet ID not configured.', 400);

  const existingRows = await getWorksheetRows(accessToken, spreadsheetId, worksheetName);
  const existingMap = new Map<string, number>();
  existingRows.forEach((r, idx) => {
    if (idx > 0) {
      const k = String(r[keyColumnIndex] || '').trim().toLowerCase();
      if (k) existingMap.set(k, idx + 1);
    }
  });

  const versionColIdx = getVersionColumnIndex(worksheetName);
  const updateData: Array<{ range: string; values: any[][] }> = [];
  const toInsert: any[][] = [];

  for (const entry of entries) {
    const cleanKey = String(entry.key || entry.row[keyColumnIndex] || '').trim().toLowerCase();
    if (!cleanKey) continue;
    const matchedRowNum = existingMap.get(cleanKey);
    if (matchedRowNum) {
      const existingRow = existingRows[matchedRowNum - 1] || [];
      const currentVer = versionColIdx >= 0 ? Math.max(1, Number(existingRow[versionColIdx] || 1)) : 1;
      const prepared = [...entry.row];
      if (versionColIdx >= 0) {
        while (prepared.length <= versionColIdx) prepared.push('');
        prepared[versionColIdx] = currentVer + 1;
      }
      const colEnd = colIndexToLetter(Math.max(prepared.length, WORKSHEET_SCHEMAS[worksheetName].length));
      updateData.push({
        range: `'${worksheetName}'!A${matchedRowNum}:${colEnd}${matchedRowNum}`,
        values: [prepared],
      });
    } else {
      const prepared = [...entry.row];
      if (versionColIdx >= 0) {
        while (prepared.length <= versionColIdx) prepared.push('');
        if (!prepared[versionColIdx]) prepared[versionColIdx] = 1;
      }
      toInsert.push(prepared);
      existingMap.set(cleanKey, -1);
    }
  }

  if (updateData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updateData,
      },
    });
  }

  if (toInsert.length > 0) {
    await appendWorksheetRows(accessToken, spreadsheetId, worksheetName, toInsert);
  }

  return { inserted: toInsert.length, updated: updateData.length };
}

export async function deleteWorksheetRowByKey(
  accessToken: string,
  spreadsheetId: string,
  worksheetName: WorksheetName,
  keyValue: string,
  keyColumnIndex = 0
): Promise<boolean> {
  const { sheets } = createGoogleSheetsClient(accessToken, spreadsheetId);
  if (!spreadsheetId) throw new GoogleSheetsError('Master spreadsheet ID not configured.', 400);

  const rows = await getWorksheetRows(accessToken, spreadsheetId, worksheetName);
  const cleanKey = String(keyValue || '').trim().toLowerCase();
  const matchIdx = rows.findIndex(
    (r, idx) => idx > 0 && String(r[keyColumnIndex] || '').trim().toLowerCase() === cleanKey
  );
  if (matchIdx <= 0) return false;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetObj = (meta.data.sheets || []).find((s) => s.properties?.title === worksheetName);
  const sheetId = sheetObj?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: matchIdx,
              endIndex: matchIdx + 1,
            },
          },
        },
      ],
    },
  });
  return true;
}

export async function recordSyncLog(
  accessToken: string,
  spreadsheetId: string | undefined,
  params: {
    worksheetName: string;
    recordKey: string;
    action: string;
    status: string;
    versionAfter?: number;
    details?: string;
  }
): Promise<void> {
  if (!accessToken || !spreadsheetId) return;
  const syncId = `sync_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  await appendWorksheetRow(accessToken, spreadsheetId, 'Synchronization Logs', [
    syncId,
    params.worksheetName,
    params.recordKey,
    params.action,
    params.status,
    params.versionAfter ?? 1,
    params.details || '',
    new Date().toISOString(),
  ]).catch(() => {});
}
