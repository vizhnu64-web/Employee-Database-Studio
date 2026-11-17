import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import settingsRoutes from './src/server/routes/settings';
import employeeRoutes from './src/server/routes/employees';
import documentRoutes from './src/server/routes/documents';
import backupRoutes from './src/server/routes/backup';
import emailRoutes, { getResolvedSmtpConfig } from './src/server/routes/email';
import payrollRoutes from './src/server/routes/payroll';
import googleAuthRoutes, { getPublicGoogleClientId } from './src/server/routes/googleAuth';
import sheetsRoutes from './src/server/routes/sheets';
import driveRoutes from './src/server/routes/drive';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust first proxy (Cloud Run, Vercel, Load Balancers)
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    trustProxy: false,
  },
});
app.use('/api/', apiLimiter);

// Stateless Health Check (never blocks startup or requires external DB)
app.get('/api/health', (_req, res) => {
  const clientIdConfigured = Boolean(getPublicGoogleClientId());
  const smtp = getResolvedSmtpConfig();

  res.status(200).json({
    status: 'healthy',
    app: 'Employee Database Studio Enterprise Cloud',
    version: '3.0.0',
    mode: process.env.NODE_ENV || 'development',
    serverless: process.env.VERCEL === '1',
    architecture: {
      database: 'google_sheets',
      fileStorage: 'google_drive',
      authentication: 'google_identity_services_client_in_memory',
      emailProviders: ['gmail_api', 'company_smtp'],
    },
    checks: {
      googleOAuth: {
        configured: clientIdConfigured,
        authFlow: 'client_gis_in_memory',
      },
      googleSheets: {
        provider: 'google-sheets',
        statelessProxyReady: true,
      },
      googleDrive: {
        provider: 'google-drive',
        statelessProxyReady: true,
      },
      smtp: {
        configured: smtp.isConfigured,
        verified: smtp.isVerified,
        source: smtp.source,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// Active Stateless API Routes (Google Workspace + SMTP proxies)
app.use('/api/google', googleAuthRoutes);
app.use('/api/sheets', sheetsRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/backup', backupRoutes);

// Controlled JSON error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status =
    err?.statusCode ||
    (err?.type === 'entity.parse.failed' ? 400 : err?.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  const message = err?.message || 'Internal server error.';
  console.error(`[Employee Database Studio API Error] ${req.method} ${req.path}:`, message);
  if (!res.headersSent) {
    res.status(status).json({ success: false, error: message });
  }
});

function checkDeploymentEnvironment() {
  const googleClientId = getPublicGoogleClientId();
  if (!googleClientId) {
    console.warn(
      '[Employee Database Studio Google Auth] VITE_GOOGLE_CLIENT_ID / GOOGLE_CLIENT_ID is not set. Google Sign-In will stay disabled until a valid OAuth Client ID is configured.'
    );
  } else {
    console.log('[Employee Database Studio Google Auth] Public Google OAuth Client ID detected for client-side GIS.');
  }

  const smtp = getResolvedSmtpConfig();
  if (!smtp.isConfigured) {
    console.log('[Employee Database Studio Email] Company SMTP env variables not configured; email delivery will use HR Gmail API or runtime session SMTP.');
  } else {
    console.log(`[Employee Database Studio Email] Company SMTP env configuration detected for host: ${smtp.smtpHost}`);
  }
}

async function startServer() {
  checkDeploymentEnvironment();

  let viteServer: { close: () => Promise<void>; middlewares: express.RequestHandler } | null = null;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    viteServer = vite;
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  const portNumber = Number(PORT) || 3000;
  const httpServer = app.listen(portNumber, '0.0.0.0', () => {
    console.log(`[Employee Database Studio] Stateless Google Workspace Server listening on http://0.0.0.0:${portNumber}`);
  });

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Employee Database Studio] Port ${portNumber} is already in use (${err.message}).`);
    } else {
      console.error('[Employee Database Studio] HTTP server error:', err?.message || err);
    }
    if (viteServer) {
      viteServer.close().catch(() => {});
    }
    process.exit(1);
  });

  const shutdown = (signal: string) => {
    console.log(`[Employee Database Studio] Received ${signal}, closing server cleanly...`);
    httpServer.close(() => {
      if (viteServer) {
        viteServer.close().finally(() => process.exit(0));
      } else {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

const isDirectExecution =
  process.env.VERCEL !== '1' &&
  process.env.NODE_ENV !== 'test' &&
  Boolean(process.argv[1] && /(?:^|[\\/])server\.(?:ts|js|mjs|cjs)$/.test(process.argv[1]));

if (isDirectExecution) {
  startServer().catch((err) => {
    console.error('[Employee Database Studio] Server failed to start:', err?.message || err);
  });
}

export { app };
export default app;
