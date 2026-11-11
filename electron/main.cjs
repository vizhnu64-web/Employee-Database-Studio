const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'PeopleDesk Studio',
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  // Build native application menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Excel / CSV...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu:import-file')
        },
        {
          label: 'Export Database Backup...',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow.webContents.send('menu:export-backup')
        },
        { type: 'separator' },
        { role: 'quit', label: 'Exit PeopleDesk Studio' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About PeopleDesk Studio',
          click: () => {
            dialog.showMessageBox(mainWindow, {
               type: 'info',
               title: 'About PeopleDesk Studio',
               message: 'PeopleDesk Studio v1.0.0',
               detail: 'PeopleDesk Studio — Complete HR Employee Database, Records & Payslip Generator.\n100% Offline & Local Data Processing.\nCommercial Enterprise Edition.',
               buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Security: Deny all sensitive permission requests (mic, camera, geolocation, etc.)
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(false);
  });

  // Security: Prevent navigation away from the local app
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsed = new URL(navigationUrl);
      const isAllowedDev = process.env.VITE_DEV_SERVER_URL && navigationUrl.startsWith(process.env.VITE_DEV_SERVER_URL);
      if (parsed.protocol !== 'file:' && !navigationUrl.startsWith('http://localhost:3000') && !isAllowedDev) {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  // Diagnostic logging for packaged app production load monitoring
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error(`[Electron Main Error] did-fail-load: code=${errorCode}, description="${errorDescription}", url="${validatedURL}", isMainFrame=${isMainFrame}`);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error(`[Electron Main Error] render-process-gone: reason="${details.reason}", exitCode=${details.exitCode}`);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['VERBOSE', 'INFO', 'WARNING', 'ERROR'];
    console.log(`[Renderer Console - ${levels[level] || level}] ${message} (${sourceId}:${line})`);
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    console.log('[PeopleDesk Studio] Loading Dev URL:', process.env.VITE_DEV_SERVER_URL);
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // In production, reliably locate dist/index.html using app.getAppPath() with fallbacks
    const appPath = app.getAppPath();
    const candidatePaths = [
      path.join(appPath, 'dist', 'index.html'),
      path.join(__dirname, '../dist/index.html'),
      path.join(__dirname, 'dist', 'index.html'),
      path.join(process.resourcesPath || '', 'app', 'dist', 'index.html')
    ];

    const targetIndexPath = candidatePaths.find(p => fs.existsSync(p)) || candidatePaths[0];
    console.log('[PeopleDesk Studio] Loading Production UI from:', targetIndexPath);

    mainWindow.loadFile(targetIndexPath).catch(err => {
      console.error('[PeopleDesk Studio] Error in loadFile:', err);
    });
  }

  // Open external links in default OS browser, with strictly validated protocols
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// IPC Handlers for Native File Dialogs and Local I/O
ipcMain.handle('dialog:open-excel', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Payroll Excel / CSV File',
    properties: ['openFile'],
    filters: [
      { name: 'Spreadsheets (*.xlsx, *.xls, *.csv)', extensions: ['xlsx', 'xls', 'csv'] },
      { name: 'Excel Workbook (*.xlsx)', extensions: ['xlsx'] },
      { name: 'Excel 97-2003 (*.xls)', extensions: ['xls'] },
      { name: 'CSV File (*.csv)', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    // Extract precise, isolated ArrayBuffer slice matching byteOffset and byteLength.
    // In Node.js, fileBuffer.buffer is a shared internal memory pool slice.
    // Slicing by byteOffset and byteLength creates an isolated ArrayBuffer
    // starting at byte 0, preserving XLSX/ZIP magic headers.
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    );

    return {
      filePath,
      fileName,
      data: arrayBuffer
    };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('dialog:save-file', async (event, params) => {
  if (!params || typeof params !== 'object') {
    return { success: false, error: 'Invalid save parameters.' };
  }

  const { defaultName, filters, dataBuffer } = params;

  if (!dataBuffer) {
    return { success: false, error: 'No data buffer provided to save.' };
  }

  // Sanitize defaultName to prevent path traversal
  const sanitizedName = typeof defaultName === 'string'
    ? path.basename(defaultName).replace(/[<>:"/\\|?*]/g, '_')
    : 'document.pdf';

  const result = await dialog.showSaveDialog({
    title: 'Save File',
    defaultPath: sanitizedName,
    filters: Array.isArray(filters) ? filters : [{ name: 'PDF Documents (*.pdf)', extensions: ['pdf'] }]
  });

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }

  try {
    const bufferToWrite = Buffer.isBuffer(dataBuffer) ? dataBuffer : Buffer.from(dataBuffer);
    fs.writeFileSync(result.filePath, bufferToWrite);
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('app:get-info', () => {
  return {
    name: 'PeopleDesk Studio',
    version: app.getVersion() || '1.0.0',
    platform: process.platform,
    userDataPath: app.getPath('userData')
  };
});

ipcMain.handle('app:reveal-file', (event, filePath) => {
  if (filePath && typeof filePath === 'string' && fs.existsSync(filePath)) {
    try {
      shell.showItemInFolder(filePath);
      return true;
    } catch {
      return false;
    }
  }
  return false;
});

// Helper to resolve employee documents directory with legacy migration support
function getEmployeeDocsDir() {
  const currentDocsDir = path.join(app.getPath('userData'), 'employee_documents');
  try {
    const appData = app.getPath('appData');
    const legacyDocsDir = path.join(appData, 'PaySlip Studio', 'employee_documents');
    if (fs.existsSync(legacyDocsDir) && !fs.existsSync(currentDocsDir)) {
      fs.mkdirSync(currentDocsDir, { recursive: true });
      const files = fs.readdirSync(legacyDocsDir);
      for (const file of files) {
        const src = path.join(legacyDocsDir, file);
        const dest = path.join(currentDocsDir, file);
        if (!fs.existsSync(dest) && fs.statSync(src).isFile()) {
          fs.copyFileSync(src, dest);
        }
      }
    }
  } catch {
    // Migration handled safely
  }

  if (!fs.existsSync(currentDocsDir)) {
    fs.mkdirSync(currentDocsDir, { recursive: true });
  }
  return currentDocsDir;
}

// Employee Documents Secure Local Storage IPC
ipcMain.handle('docs:save', async (event, params) => {
  if (!params || !params.employeeId || !params.dataBuffer) {
    return { success: false, error: 'Invalid document parameters.' };
  }
  try {
    const docsDir = getEmployeeDocsDir();

    const safeExt = path.extname(params.originalFilename || '').toLowerCase().replace(/[^a-z0-9.]/g, '') || '.dat';
    const safeEmpId = String(params.employeeId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const docId = params.docId || Date.now().toString(36);
    const storedFilename = `doc_${safeEmpId}_${docId}${safeExt}`;
    const targetPath = path.join(docsDir, storedFilename);

    const buffer = Buffer.isBuffer(params.dataBuffer) ? params.dataBuffer : Buffer.from(params.dataBuffer);
    fs.writeFileSync(targetPath, buffer);

    return {
      success: true,
      storedFilename,
      storagePath: targetPath,
      fileSizeBytes: buffer.length
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('docs:read', async (event, storagePath) => {
  if (!storagePath || typeof storagePath !== 'string') {
    return { success: false, error: 'Invalid storage path.' };
  }
  try {
    const docsDir = getEmployeeDocsDir();
    // Security: check that storagePath is within docsDir to prevent directory traversal
    const resolved = path.resolve(storagePath);
    if (!resolved.startsWith(path.resolve(docsDir))) {
      return { success: false, error: 'Access denied: Path outside secure storage directory.' };
    }
    if (!fs.existsSync(resolved)) {
      return { success: false, error: 'Document file not found on disk.' };
    }

    const buffer = fs.readFileSync(resolved);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    return { success: true, data: arrayBuffer };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('docs:delete', async (event, storagePath) => {
  if (!storagePath || typeof storagePath !== 'string') return false;
  try {
    const docsDir = getEmployeeDocsDir();
    const resolved = path.resolve(storagePath);
    if (resolved.startsWith(path.resolve(docsDir)) && fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
      return true;
    }
    return false;
  } catch {
    return false;
  }
});

ipcMain.handle('docs:open', async (event, storagePath) => {
  if (!storagePath || typeof storagePath !== 'string') return false;
  try {
    const docsDir = getEmployeeDocsDir();
    const resolved = path.resolve(storagePath);
    if (resolved.startsWith(path.resolve(docsDir)) && fs.existsSync(resolved)) {
      await shell.openPath(resolved);
      return true;
    }
    return false;
  } catch {
    return false;
  }
});

// Email and SMTP IPC Handlers
ipcMain.handle('email:verify-smtp', async (event, smtpConfig) => {
  if (!smtpConfig || !smtpConfig.host) {
    return { success: false, error: 'Invalid SMTP configuration provided.' };
  }
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: Number(smtpConfig.port) || 587,
      secure: Number(smtpConfig.port) === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      }
    });
    await transporter.verify();
    return { success: true, message: 'SMTP server connection verified successfully.' };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to connect to SMTP server.' };
  }
});

ipcMain.handle('email:send-payslip', async (event, { smtpConfig, mailOptions, pdfArrayBuffer }) => {
  if (!smtpConfig || !mailOptions) {
    return { success: false, error: 'Missing SMTP configuration or mail options.' };
  }
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: Number(smtpConfig.port) || 587,
      secure: Number(smtpConfig.port) === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      }
    });

    const attachments = [];
    if (pdfArrayBuffer && mailOptions.attachmentName) {
      attachments.push({
        filename: mailOptions.attachmentName,
        content: Buffer.isBuffer(pdfArrayBuffer) ? pdfArrayBuffer : Buffer.from(pdfArrayBuffer)
      });
    }

    const info = await transporter.sendMail({
      from: mailOptions.from || smtpConfig.user,
      to: mailOptions.to,
      subject: mailOptions.subject,
      text: mailOptions.text,
      html: mailOptions.html,
      attachments
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to send email.' };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
