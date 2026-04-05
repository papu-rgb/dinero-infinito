import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Middleware de tenant (placeholder).
 * Tu compañero lo reemplazará con resolución real por subdominio.
 * 
 * Por ahora intenta resolver el tenant de estas formas:
 * 1. Header 'x-tenant-id' (para pruebas)
 * 2. Query param 'tenantId' (para pruebas)
 * 3. Subdominio del host (producción)
 * 4. Fallback a primer tenant de la BD (solo desarrollo)
 */

// Extender el tipo Request de Express
declare global {
  namespace Express {
    interface Request {
      tenant?: {
        id: string;
        slug: string;
        name: string;
      };
    }
  }
}

export async function tenantMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let tenantId = req.headers['x-tenant-id'] as string | undefined;
    let tenantSlug: string | undefined;

    // 1. Header x-tenant-id
    if (tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (tenant) {
        req.tenant = { id: tenant.id, slug: tenant.slug, name: tenant.name };
        return next();
      }
    }

    // 2. Query param tenantId
    if (req.query.tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.query.tenantId as string } });
      if (tenant) {
        req.tenant = { id: tenant.id, slug: tenant.slug, name: tenant.name };
        return next();
      }
    }

    // 3. Subdominio del host
    const host = req.hostname;
    if (host && host.includes('.')) {
      tenantSlug = host.split('.')[0];
      if (tenantSlug && tenantSlug !== 'www' && tenantSlug !== 'api') {
        const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
        if (tenant) {
          req.tenant = { id: tenant.id, slug: tenant.slug, name: tenant.name };
          return next();
        }
      }
    }

    // 4. Fallback en desarrollo: usar el primer tenant
    if (process.env.NODE_ENV === 'development') {
      const tenant = await prisma.tenant.findFirst();
      if (tenant) {
        req.tenant = { id: tenant.id, slug: tenant.slug, name: tenant.name };
        return next();
      }
    }

    res.status(404).json({
      success: false,
      error: { code: 'TENANT_NOT_FOUND', message: 'Negocio no encontrado' }
    });
  } catch (error) {
    console.error('Error en tenant middleware:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Error al resolver el negocio' }
    });
  }
}
