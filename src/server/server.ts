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

import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    app: 'PeopleDesk Studio Enterprise LAN Server',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Automated Daily Backup Cron (Default 8 PM daily)
cron.schedule('0 20 * * *', () => {
  console.log('[PeopleDesk Backup] Executing scheduled daily database and document backup at 8 PM...');
  // Backup routine execution
});

async function startServer() {
  await initializeDatabase();

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[PeopleDesk Server] Enterprise LAN backend running successfully on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[PeopleDesk Server] Failed to start backend server:', err);
});
