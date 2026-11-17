import { google } from 'googleapis';
import { Readable } from 'stream';

export class GoogleDriveError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 503) {
    super(message);
    this.name = 'GoogleDriveError';
    this.statusCode = statusCode;
  }
}

export function extractDriveFolderId(input: string): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const folderUrlMatch = raw.match(
    /^https?:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]{10,120})(?:[/?#]|$)/i
  );
  if (folderUrlMatch && folderUrlMatch[1]) {
    return folderUrlMatch[1];
  }

  try {
    if (/^https?:\/\/drive\.google\.com\/open/i.test(raw)) {
      const parsed = new URL(raw);
      const idParam = parsed.searchParams.get('id');
      if (idParam && /^[a-zA-Z0-9_-]{10,120}$/.test(idParam)) {
        return idParam;
      }
    }
  } catch {}

  if (/^https?:\/\//i.test(raw) || raw.includes('/')) {
    return null;
  }

  if (/^[a-zA-Z0-9_-]{10,120}$/.test(raw)) {
    return raw;
  }

  return null;
}

export function buildCanonicalDriveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export function createGoogleDriveClient(accessToken: string, rootFolderId?: string | null) {
  if (!accessToken || !accessToken.trim()) {
    throw new GoogleDriveError(
      'Google OAuth access token is required. Sign in with Google in Company Settings.',
      401
    );
  }
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken.trim() });
  const drive = google.drive({ version: 'v3', auth });

  const resolvedFolderId = rootFolderId ? extractDriveFolderId(rootFolderId) || rootFolderId.trim() : null;

  return {
    drive,
    auth,
    rootFolderId: resolvedFolderId,
    folderUrl: resolvedFolderId ? buildCanonicalDriveFolderUrl(resolvedFolderId) : null,
  };
}

export interface DriveFolderVerification {
  folderId: string;
  folderName: string;
  folderUrl: string;
  canWrite: boolean;
  privateAccessOnly: true;
}

export async function verifyAndLinkDriveFolder(
  accessToken: string,
  folderUrlOrId: string,
  accountEmail?: string
): Promise<DriveFolderVerification> {
  const folderId = extractDriveFolderId(folderUrlOrId);
  if (!folderId) {
    throw new GoogleDriveError(
      'Invalid Google Drive Folder URL or ID. Paste a valid https://drive.google.com/drive/folders/... URL or Folder ID.',
      400
    );
  }

  const { drive } = createGoogleDriveClient(accessToken, folderId);
  const label = accountEmail || 'your Google account';

  try {
    const meta = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType, trashed, webViewLink, capabilities(canAddChildren,canEdit)',
    });

    if (meta.data.trashed) {
      throw new GoogleDriveError('The target Google Drive folder is currently in Trash. Restore it before linking.', 400);
    }

    if (meta.data.mimeType !== 'application/vnd.google-apps.folder') {
      throw new GoogleDriveError(
        'The supplied Google Drive link points to a file rather than a folder. Please paste a Google Drive folder URL.',
        400
      );
    }

    const canWrite =
      meta.data.capabilities?.canAddChildren !== false &&
      meta.data.capabilities?.canEdit !== false;

    if (!canWrite) {
      throw new GoogleDriveError(
        `Your connected Google account (${label}) does not have write/upload permissions on folder "${meta.data.name}". Grant Editor permission in Google Drive and retry.`,
        403
      );
    }

    const canonicalUrl = buildCanonicalDriveFolderUrl(folderId);
    return {
      folderId,
      folderName: meta.data.name || 'Linked Drive Workspace Folder',
      folderUrl: meta.data.webViewLink || canonicalUrl,
      canWrite: true,
      privateAccessOnly: true,
    };
  } catch (err: any) {
    if (err instanceof GoogleDriveError) throw err;
    const status = err?.code || err?.response?.status;
    if (status === 401) {
      throw new GoogleDriveError('Google OAuth session expired. Please reconnect your Google account.', 401);
    }
    if (status === 403) {
      throw new GoogleDriveError(
        `Access denied for Drive folder (${folderId}). Share this folder as Editor with ${label}.`,
        403
      );
    }
    if (status === 404) {
      throw new GoogleDriveError(
        `Drive folder (${folderId}) was not found or cannot be seen under drive.file permission for ${label}. Ensure the folder was created by the app or initialize a fresh private folder.`,
        404
      );
    }
    throw new GoogleDriveError(err?.message || 'Failed to verify Google Drive folder.', status || 500);
  }
}

async function findOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId?: string
): Promise<string> {
  const safeName = name.replace(/'/g, "\\'");
  const qParts = [
    `name = '${safeName}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `trashed = false`,
  ];
  if (parentId) {
    qParts.push(`'${parentId}' in parents`);
  }

  const existing = await drive.files.list({
    q: qParts.join(' and '),
    fields: 'files(id, name)',
    spaces: 'drive',
    pageSize: 5,
  });

  if (existing.data.files && existing.data.files.length > 0 && existing.data.files[0].id) {
    return existing.data.files[0].id;
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id, name',
  });

  if (!created.data.id) {
    throw new GoogleDriveError(`Failed to create Drive folder "${name}".`, 502);
  }
  return created.data.id;
}

export interface DriveHierarchy {
  rootFolderId: string;
  folderUrl: string;
  folders: {
    database: string;
    employeeDocuments: string;
    payrollRecords: string;
    generatedPayslips: string;
    manualPayslips: string;
    applicationBackups: string;
    companyBranding: string;
  };
}

export async function ensureDriveHierarchy(
  accessToken: string,
  existingRootFolderId?: string | null
): Promise<DriveHierarchy> {
  const { drive } = createGoogleDriveClient(accessToken, existingRootFolderId);

  let rootFolderId: string | null = existingRootFolderId
    ? extractDriveFolderId(existingRootFolderId) || existingRootFolderId.trim()
    : null;

  if (rootFolderId) {
    try {
      const check = await drive.files.get({ fileId: rootFolderId, fields: 'id, trashed, mimeType' });
      if (check.data.trashed || check.data.mimeType !== 'application/vnd.google-apps.folder') {
        rootFolderId = null;
      }
    } catch {
      rootFolderId = null;
    }
  }

  if (!rootFolderId) {
    rootFolderId = await findOrCreateFolder(drive, 'Employee Database Studio');
  }

  const canonicalUrl = buildCanonicalDriveFolderUrl(rootFolderId);

  const [
    database,
    employeeDocuments,
    payrollRecords,
    generatedPayslips,
    manualPayslips,
    applicationBackups,
    companyBranding,
  ] = await Promise.all([
    findOrCreateFolder(drive, 'Database', rootFolderId),
    findOrCreateFolder(drive, 'Employee Documents', rootFolderId),
    findOrCreateFolder(drive, 'Payroll Records', rootFolderId),
    findOrCreateFolder(drive, 'Generated Payslips', rootFolderId),
    findOrCreateFolder(drive, 'Manual Payslips', rootFolderId),
    findOrCreateFolder(drive, 'Application Backups', rootFolderId),
    findOrCreateFolder(drive, 'Company Branding', rootFolderId),
  ]);

  return {
    rootFolderId,
    folderUrl: canonicalUrl,
    folders: {
      database,
      employeeDocuments,
      payrollRecords,
      generatedPayslips,
      manualPayslips,
      applicationBackups,
      companyBranding,
    },
  };
}

export type DriveCategory =
  | 'employee-documents'
  | 'payslip-pdfs'
  | 'manual-payslips'
  | 'payroll-records'
  | 'company-assets'
  | 'backups'
  | 'database';

export async function resolveTargetDriveFolder(
  accessToken: string,
  rootFolderId: string | null | undefined,
  category: DriveCategory,
  opts?: { employeeId?: string; year?: string | number; month?: string }
): Promise<string> {
  const { drive } = createGoogleDriveClient(accessToken, rootFolderId);
  const hierarchy = await ensureDriveHierarchy(accessToken, rootFolderId);

  if (category === 'employee-documents') {
    if (opts?.employeeId) {
      return findOrCreateFolder(drive, String(opts.employeeId).trim(), hierarchy.folders.employeeDocuments);
    }
    return hierarchy.folders.employeeDocuments;
  }

  if (category === 'payslip-pdfs') {
    let target = hierarchy.folders.generatedPayslips;
    if (opts?.year) {
      target = await findOrCreateFolder(drive, String(opts.year), target);
    }
    if (opts?.month) {
      target = await findOrCreateFolder(drive, String(opts.month), target);
    }
    return target;
  }

  if (category === 'manual-payslips') return hierarchy.folders.manualPayslips;
  if (category === 'payroll-records') return hierarchy.folders.payrollRecords;
  if (category === 'company-assets') return hierarchy.folders.companyBranding;
  if (category === 'backups') return hierarchy.folders.applicationBackups;
  return hierarchy.folders.database;
}

export async function uploadFileToDrive(params: {
  accessToken: string;
  rootFolderId?: string | null;
  category: DriveCategory;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  employeeId?: string;
  year?: string | number;
  month?: string;
  description?: string;
}): Promise<{ fileId: string; fileName: string; webViewLink?: string; folderId: string; sizeBytes: number; rootFolderId?: string }> {
  const { drive } = createGoogleDriveClient(params.accessToken, params.rootFolderId);
  const hierarchy = await ensureDriveHierarchy(params.accessToken, params.rootFolderId);
  const folderId = await resolveTargetDriveFolder(params.accessToken, hierarchy.rootFolderId, params.category, {
    employeeId: params.employeeId,
    year: params.year,
    month: params.month,
  });

  const mediaBody = Readable.from(params.buffer);
  const uploadRes = await drive.files.create({
    requestBody: {
      name: params.fileName,
      parents: [folderId],
      description: params.description || `Uploaded by Employee Database Studio (${params.category})`,
    },
    media: {
      mimeType: params.mimeType || 'application/octet-stream',
      body: mediaBody,
    },
    fields: 'id, name, webViewLink, size, mimeType',
  });

  if (!uploadRes.data.id) {
    throw new GoogleDriveError('Google Drive did not return a file ID.', 502);
  }

  return {
    fileId: uploadRes.data.id,
    fileName: uploadRes.data.name || params.fileName,
    webViewLink: uploadRes.data.webViewLink || undefined,
    folderId,
    rootFolderId: hierarchy.rootFolderId,
    sizeBytes: params.buffer.length,
  };
}

export async function downloadFileFromDrive(
  accessToken: string,
  fileId: string
): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const { drive } = createGoogleDriveClient(accessToken);
  const meta = await drive.files.get({ fileId, fields: 'id, name, mimeType' });

  const mediaRes = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return {
    buffer: Buffer.from(mediaRes.data as ArrayBuffer),
    mimeType: meta.data.mimeType || 'application/octet-stream',
    fileName: meta.data.name || `${fileId}.bin`,
  };
}

export async function deleteFileFromDrive(accessToken: string, fileId: string): Promise<boolean> {
  const { drive } = createGoogleDriveClient(accessToken);
  await drive.files.delete({ fileId });
  return true;
}

export async function listDriveFolderFiles(
  accessToken: string,
  rootFolderId?: string | null,
  category?: DriveCategory,
  employeeId?: string
): Promise<{ rootFolderId: string; files: Array<{ id: string; name: string; mimeType: string; size?: string; modifiedTime?: string }> }> {
  const { drive } = createGoogleDriveClient(accessToken, rootFolderId);
  const hierarchy = await ensureDriveHierarchy(accessToken, rootFolderId);
  const folderId = category
    ? await resolveTargetDriveFolder(accessToken, hierarchy.rootFolderId, category, { employeeId })
    : hierarchy.rootFolderId;

  const listRes = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, size, modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 100,
  });

  return {
    rootFolderId: hierarchy.rootFolderId,
    files: (listRes.data.files || []).map((f) => ({
      id: f.id || '',
      name: f.name || '',
      mimeType: f.mimeType || '',
      size: f.size || undefined,
      modifiedTime: f.modifiedTime || undefined,
    })),
  };
}
