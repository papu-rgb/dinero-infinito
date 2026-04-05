import { Request, Response, NextFunction } from 'express';

/**
 * Middleware de autenticación (placeholder).
 * Tu compañero lo reemplazará con JWT real.
 * 
 * Por ahora simula un usuario autenticado con:
 * - req.user.id = 'dev-user-id'
 * - req.user.role = 'OWNER'
 */

// Extender el tipo Request de Express
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tenantId: string;
        role: string;
      };
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // En producción: verificar JWT del header Authorization
  // Por ahora: simular usuario autenticado para desarrollo
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    // En desarrollo, permitir sin token pero con usuario simulado
    if (process.env.NODE_ENV === 'development') {
      req.user = {
        id: 'dev-user-id',
        tenantId: req.tenant?.id || 'dev-tenant-id',
        role: 'OWNER',
      };
      return next();
    }
    
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Token de autenticación requerido' }
    });
    return;
  }

  // Placeholder: simular decodificación del JWT
  req.user = {
    id: 'dev-user-id',
    tenantId: req.tenant?.id || 'dev-tenant-id',
    role: 'OWNER',
  };
  
  next();
}
