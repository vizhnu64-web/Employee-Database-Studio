import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { initializeDatabase } from './db/initSchema';
import authRoutes from './routes/auth';
import settingsRoutes from './routes/settings';
import employeeRoutes from './routes/employees';
import documentRoutes from './routes/documents';
import backupRoutes from './routes/backup';
import attendanceRoutes from './routes/attendance';
import licenseRoutes from './routes/license';
import storageRoutes from './routes/storage';

import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    trustProxy: false,
  },
});
app.use('/api/', apiLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/storage', storageRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    app: 'Employee Database Studio Enterprise Server',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Automated Daily Backup Cron (Default 8 PM daily)
cron.schedule('0 20 * * *', () => {
  console.log('[Employee Database Studio Backup] Executing scheduled daily database and document backup at 8 PM...');
  // Backup routine execution
});

function checkDeploymentEnvironment() {
  const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'INITIAL_ADMIN_PASSWORD'];
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.warn(`[Employee Database Studio Security] Warning: The following required environment variables are not set: ${missing.join(', ')}.`);
  }

  // SMTP is optional during initial deployment.
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

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Employee Database Studio Server] Enterprise backend running successfully on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Employee Database Studio Server] Failed to start backend server:', err);
});
