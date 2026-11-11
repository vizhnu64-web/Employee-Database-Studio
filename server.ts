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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rate limiter for general API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    app: 'PeopleDesk Studio Enterprise Cloud',
    version: '1.0.0',
    mode: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
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
    console.log(`[PeopleDesk Studio] Full-Stack Enterprise Server listening on http://0.0.0.0:${PORT}`);
  });
}

// Only start the standalone server process if run directly
if (process.env.VERCEL !== '1') {
  startServer().catch(err => {
    console.error('[PeopleDesk Studio] Server failed to start:', err);
  });
}

export { app };
export default app;
