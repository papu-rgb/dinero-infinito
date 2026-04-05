import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { appointmentsAdminRouter, appointmentsPublicRouter } from './routes/appointments.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE GLOBAL ====================
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== HEALTH CHECK ====================
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// ==================== RUTAS ====================

// Rutas admin de citas (requieren auth + tenant)
app.use('/api/appointments', appointmentsAdminRouter);

// Rutas públicas de citas (solo requieren tenant, resuelto por subdominio)
app.use('/public/appointments', appointmentsPublicRouter);

// ==================== 404 ====================
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' }
  });
});

// ==================== ERROR HANDLER GLOBAL ====================
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' }
  });
});

// ==================== START ====================
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📅 Citas admin: http://localhost:${PORT}/api/appointments`);
  console.log(`🌐 Citas público: http://localhost:${PORT}/public/appointments`);
});

export default app;
