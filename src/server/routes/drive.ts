import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { requireGoogleAccessToken, GoogleAuthRequest } from '../middleware/googleAuth';
import {
  verifyAndLinkDriveFolder,
  ensureDriveHierarchy,
  uploadFileToDrive,
  downloadFileFromDrive,
  deleteFileFromDrive,
  listDriveFolderFiles,
  buildCanonicalDriveFolderUrl,
  DriveCategory,
} from '../services/googleDrive';

const router = Router();
router.use(requireGoogleAccessToken);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExt = new Set([
      '.pdf',
      '.png',
      '.jpg',
      '.jpeg',
      '.svg',
      '.webp',
      '.doc',
      '.docx',
      '.xlsx',
      '.xls',
      '.csv',
      '.json',
      '.txt',
    ]);
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ext || allowedExt.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file extension for Google Drive workspace upload.'));
    }
  },
});

function resolveFolderId(req: GoogleAuthRequest): string {
  return String(
    req.driveRootFolderId || req.body?.driveRootFolderId || req.query?.driveRootFolderId || ''
  ).trim();
}

// GET /api/drive/status
router.get('/status', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const folderId = resolveFolderId(req);
    if (!folderId) {
      return res.json({
        success: true,
        isConnected: true,
        rootFolderId: null,
        folderUrl: null,
        message: 'Google Drive authorized. Link an existing folder or create the Employee Database Studio folder structure.',
      });
    }

    const verified = await verifyAndLinkDriveFolder(req.googleAccessToken!, folderId, req.googleEmail);
    res.json({
      success: true,
      isConnected: true,
      rootFolderId: verified.folderId,
      folderName: verified.folderName,
      folderUrl: verified.folderUrl || buildCanonicalDriveFolderUrl(verified.folderId),
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// POST /api/drive/verify-url - Read-only verify Drive folder URL & write permission
router.post('/verify-url', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const folderUrl = String(
      req.body?.folderUrl || req.body?.url || req.body?.folderId || ''
    ).trim();
    const verification = await verifyAndLinkDriveFolder(
      req.googleAccessToken!,
      folderUrl,
      req.googleEmail
    );
    res.json({
      success: true,
      ...verification,
      message: `Verified private write access to Google Drive folder "${verification.folderName}".`,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 400).json({
      success: false,
      error: err?.message || 'Drive folder verification failed.',
    });
  }
});

// POST /api/drive/connect-url - Verify Drive folder URL & return verified private root folder
router.post('/connect-url', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const folderUrl = String(
      req.body?.folderUrl || req.body?.url || req.body?.folderId || ''
    ).trim();
    const verification = await verifyAndLinkDriveFolder(
      req.googleAccessToken!,
      folderUrl,
      req.googleEmail
    );
    res.json({
      success: true,
      ...verification,
      message: `Linked private Google Drive folder "${verification.folderName}" (${verification.folderId}).`,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 400).json({
      success: false,
      error: err?.message || 'Failed to link Google Drive folder.',
    });
  }
});

// POST /api/drive/setup - Initialize private Employee Database Studio folder structure
router.post('/setup', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const existingRoot = resolveFolderId(req) || null;
    const hierarchy = await ensureDriveHierarchy(req.googleAccessToken!, existingRoot);
    res.json({
      success: true,
      message: 'Google Drive private workspace folder hierarchy initialized.',
      rootFolderId: hierarchy.rootFolderId,
      folderUrl: hierarchy.folderUrl,
      folders: hierarchy.folders,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// GET /api/drive/files
router.get('/files', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const category = req.query.category as DriveCategory | undefined;
    const employeeId = req.query.employeeId as string | undefined;
    const result = await listDriveFolderFiles(
      req.googleAccessToken!,
      resolveFolderId(req) || null,
      category,
      employeeId
    );
    res.json({ success: true, rootFolderId: result.rootFolderId, files: result.files });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// POST /api/drive/upload
router.post('/upload', upload.single('file'), async (req: GoogleAuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file provided.' });
    }
    const category = (req.body.category as DriveCategory) || 'employee-documents';
    const result = await uploadFileToDrive({
      accessToken: req.googleAccessToken!,
      rootFolderId: resolveFolderId(req) || null,
      category,
      fileName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      buffer: file.buffer,
      employeeId: req.body.employeeId,
      year: req.body.year,
      month: req.body.month,
      description: req.body.description,
    });
    res.json({ success: true, file: result });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// GET /api/drive/download/:fileId
router.get('/download/:fileId', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const { fileId } = req.params;
    const { buffer, mimeType, fileName } = await downloadFileFromDrive(req.googleAccessToken!, fileId);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// DELETE /api/drive/:fileId
router.delete('/:fileId', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const { fileId } = req.params;
    await deleteFileFromDrive(req.googleAccessToken!, fileId);
    res.json({ success: true, message: 'File deleted from Google Drive.' });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// POST /api/drive/backup - Upload workspace JSON backup snapshot to Google Drive
router.post('/backup', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const { backupJson, fileName } = req.body || {};
    if (!backupJson) {
      return res.status(400).json({ success: false, error: 'Backup JSON payload is required.' });
    }
    const payloadStr = typeof backupJson === 'string' ? backupJson : JSON.stringify(backupJson, null, 2);
    const safeName = fileName || `EmployeeDatabaseStudio_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    const uploaded = await uploadFileToDrive({
      accessToken: req.googleAccessToken!,
      rootFolderId: resolveFolderId(req) || null,
      category: 'backups',
      fileName: safeName,
      mimeType: 'application/json',
      buffer: Buffer.from(payloadStr, 'utf-8'),
      description: 'Employee Database Studio full JSON backup',
    });
    res.json({
      success: true,
      message: `Backup snapshot "${uploaded.fileName}" saved to Google Drive.`,
      file: uploaded,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

export default router;
