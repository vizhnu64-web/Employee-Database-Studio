import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { ensureDatabaseInitialized } from './src/server/db/initSchema';
import { getDatabaseDiagnostics, pool } from './src/server/db/pool';
import { supabaseStorage } from './src/server/storage/supabaseStorage';
import authRoutes from './src/server/routes/auth';
import settingsRoutes from './src/server/routes/settings';
import employeeRoutes from './src/server/routes/employees';
import documentRoutes from './src/server/routes/documents';
import backupRoutes from './src/server/routes/backup';
import attendanceRoutes from './src/server/routes/attendance';
import licenseRoutes from './src/server/routes/license';
import emailRoutes from './src/server/routes/email';
import serverStatsRoutes from './src/server/routes/serverStats';
import payrollRoutes from './src/server/routes/payroll';
import storageRoutes from './src/server/routes/storage';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust first proxy (Cloud Run, Vercel, Load Balancers)
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rate limiter for general API routes
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

// Health check endpoint (always accessible without crashing, never leaks secrets)
app.get('/api/health', async (req, res) => {
  const dbDiag = getDatabaseDiagnostics();
  let dbReachable = false;
  let dbError: string | null = null;

  if (dbDiag.configured) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      dbReachable = true;
    } catch (err: any) {
      dbError = err?.message || 'PostgreSQL connection check failed';
    }
  }

  const storageConfigured = supabaseStorage.isConfigured();
  const authConfigured = Boolean(process.env.JWT_SECRET?.trim()) || !dbDiag.productionMode;
  const healthy = (!dbDiag.productionMode || (dbDiag.configured && dbReachable && authConfigured));

  res.status(200).json({
    status: healthy ? 'healthy' : 'degraded',
    app: 'Employee Database Studio Enterprise Cloud',
    version: '1.0.0',
    mode: process.env.NODE_ENV || 'development',
    serverless: process.env.VERCEL === '1',
    checks: {
      database: {
        configured: dbDiag.configured,
        sourceVar: dbDiag.sourceVar,
        reachable: dbReachable,
        sslEnabled: dbDiag.sslEnabled,
        error: dbError,
      },
      storage: {
        provider: storageConfigured ? 'supabase' : 'unconfigured',
        configured: storageConfigured,
      },
      auth: {
        jwtConfigured: Boolean(process.env.JWT_SECRET?.trim()),
      },
    },
    timestamp: new Date().toISOString()
  });
});

// Ensure database schema/bootstrap runs safely once per cold start before handling operational API routes
app.use('/api', async (req, res, next) => {
  if (req.path === '/health') {
    return next();
  }
  try {
    await ensureDatabaseInitialized();
    next();
  } catch (err: any) {
    console.error('[Employee Database Studio Cold-Start Init Error]:', err?.message || err);
    res.status(err?.statusCode || 503).json({
      success: false,
      error: err?.message || 'Database service unavailable.'
    });
  }
});

// Central API Routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/server', serverStatsRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/storage', storageRoutes);

// Controlled JSON error handler (catches multer file limits, malformed JSON, config 503s cleanly)
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
  const missing: string[] = [];
  if (!process.env.DATABASE_URL?.trim() && !process.env.POSTGRES_URL?.trim()) {
    missing.push('DATABASE_URL (or POSTGRES_URL)');
  }
  if (!process.env.JWT_SECRET?.trim()) {
    missing.push('JWT_SECRET');
  }
  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  }

  if (missing.length > 0) {
    console.warn(`[Employee Database Studio Config] Missing optional/production environment variables: ${missing.join(', ')}.`);
  }

  const hasSmtp = Boolean(process.env.SMTP_HOST && (process.env.SMTP_SENDER_EMAIL || process.env.SMTP_USER));
  if (!hasSmtp) {
    console.log('[Employee Database Studio Email] Initial deployment: SMTP environment variables are not configured. Email service is unconfigured until an authorized administrator configures SMTP in Company Settings.');
  } else {
    console.log(`[Employee Database Studio Email] Optional SMTP environment configuration detected for host: ${process.env.SMTP_HOST}`);
  }
}

async function startServer() {
  checkDeploymentEnvironment();
  await ensureDatabaseInitialized();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Employee Database Studio] Full-Stack Enterprise Server listening on http://0.0.0.0:${PORT}`);
  });
}

// Only start the standalone HTTP server when executed directly via `tsx server.ts` / `node server.js`
const isDirectExecution =
  process.env.VERCEL !== '1' &&
  process.env.NODE_ENV !== 'test' &&
  Boolean(process.argv[1] && /(?:^|[\\/])server\.(?:ts|js|mjs|cjs)$/.test(process.argv[1]));

if (isDirectExecution) {
  startServer().catch(err => {
    console.error('[Employee Database Studio] Server failed to start:', err?.message || err);
  });
}

export { app, ensureDatabaseInitialized };
export default app;
