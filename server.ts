import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { initializeDatabase } from './src/server/db/initSchema';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    app: 'Employee Database Studio Enterprise Cloud',
    version: '1.0.0',
    mode: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

function checkDeploymentEnvironment() {
  const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'INITIAL_ADMIN_PASSWORD'];
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.warn(`[Employee Database Studio Security] Warning: The following required environment variables are not set: ${missing.join(', ')}.`);
  }

  // SMTP is optional during initial deployment. No fake or hardcoded fallback credentials.
  const hasSmtp = Boolean(process.env.SMTP_HOST && (process.env.SMTP_SENDER_EMAIL || process.env.SMTP_USER));
  if (!hasSmtp) {
    console.log('[Employee Database Studio Email] Initial deployment: SMTP environment variables are not configured. Email service is unconfigured until an authorized administrator configures SMTP in Company Settings.');
  } else {
    console.log(`[Employee Database Studio Email] Optional SMTP environment configuration detected for host: ${process.env.SMTP_HOST}`);
  }
}

async function startServer() {
  checkDeploymentEnvironment();
  await initializeDatabase();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Employee Database Studio] Full-Stack Enterprise Server listening on http://0.0.0.0:${PORT}`);
  });
}

// Only start the standalone server process if run directly
if (process.env.VERCEL !== '1') {
  startServer().catch(err => {
    console.error('[Employee Database Studio] Server failed to start:', err);
  });
}

export { app };
export default app;
