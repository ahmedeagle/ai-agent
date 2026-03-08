import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Maps route prefixes to resource names
const ROUTE_RESOURCE_MAP: Record<string, string> = {
  '/agent': 'agent',
  '/call': 'call',
  '/calls': 'call',
  '/company': 'company',
  '/qa-rules': 'qa_rules',
  '/qa-results': 'qa_results',
  '/tool': 'tool',
  '/user': 'user',
  '/customer': 'customer',
  '/lead': 'lead',
  '/dnc': 'dnc',
  '/callback': 'callback',
  '/notification': 'notification',
  '/kb': 'knowledge_base',
};

// Methods that should be logged
const AUDITED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Routes to skip (health checks, reads, audit-log itself)
const SKIP_ROUTES = ['/health', '/audit-log'];

function getResource(path: string): string | null {
  for (const [prefix, resource] of Object.entries(ROUTE_RESOURCE_MAP)) {
    if (path.startsWith(prefix)) {
      return resource;
    }
  }
  return null;
}

function getAction(method: string): string {
  switch (method) {
    case 'POST': return 'create';
    case 'PUT':
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return method.toLowerCase();
  }
}

function getResourceId(path: string): string | undefined {
  // Extract ID from paths like /agent/abc-123, /call/by-sid/CA123
  const parts = path.split('/').filter(Boolean);
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    // Skip known sub-routes
    if (['search', 'bulk', 'transcript', 'stats', 'status', 'health'].includes(lastPart)) {
      return parts.length >= 3 ? parts[parts.length - 2] : undefined;
    }
    return lastPart;
  }
  return undefined;
}

/**
 * Automatic audit logging middleware.
 * Logs all POST/PUT/PATCH/DELETE operations to the AuditLog table.
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only audit mutating methods
  if (!AUDITED_METHODS.includes(req.method)) {
    return next();
  }

  // Skip certain routes
  for (const skip of SKIP_ROUTES) {
    if (req.path.startsWith(skip)) {
      return next();
    }
  }

  const resource = getResource(req.path);
  if (!resource) {
    return next();
  }

  // Capture the original json method to log after response
  const originalJson = res.json.bind(res);

  res.json = function (body: any) {
    // Log asynchronously - don't block the response
    setImmediate(async () => {
      try {
        // Extract user info from headers or body
        const userId = (req.headers['x-user-id'] as string) || req.body?.userId || 'system';
        const userEmail = (req.headers['x-user-email'] as string) || req.body?.userEmail || 'system';
        const userRole = (req.headers['x-user-role'] as string) || req.body?.userRole || 'system';
        const companyId = (req.headers['x-company-id'] as string) || req.body?.companyId || 'unknown';

        await prisma.auditLog.create({
          data: {
            userId,
            userEmail,
            userRole,
            companyId,
            action: getAction(req.method),
            resource,
            resourceId: getResourceId(req.path),
            details: {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              success: body?.success ?? (res.statusCode < 400),
              requestBody: sanitizeBody(req.body)
            },
            ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
            userAgent: req.headers['user-agent']
          }
        });
      } catch (err) {
        console.error('Audit log error (non-blocking):', err);
      }
    });

    return originalJson(body);
  } as any;

  next();
}

/**
 * Remove sensitive fields from request body before logging
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'accessToken', 'refreshToken', 'fullContent'];
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  return sanitized;
}
