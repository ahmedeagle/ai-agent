import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { logger } from '../utils/logger';

// ============ ROLE HIERARCHY ============
// super_admin > admin > supervisor > agent > viewer
const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  admin: 80,
  supervisor: 60,
  agent: 40,
  viewer: 20,
  user: 40, // legacy "user" role treated as agent-level
};

// ============ ROUTE PERMISSIONS ============
// Maps route prefixes + HTTP methods to minimum required role
const ROUTE_PERMISSIONS: {
  pattern: RegExp;
  methods: string[];
  minRole: string;
}[] = [
  // Super admin only
  { pattern: /\/api\/admin\/company/, methods: ['DELETE'], minRole: 'super_admin' },

  // Admin+
  { pattern: /\/api\/admin\/user/, methods: ['POST', 'DELETE'], minRole: 'admin' },
  { pattern: /\/api\/admin\/user\/.*\/role/, methods: ['PUT'], minRole: 'admin' },
  { pattern: /\/api\/billing\/packages/, methods: ['POST', 'PUT', 'DELETE'], minRole: 'admin' },
  { pattern: /\/api\/admin\/company/, methods: ['PUT'], minRole: 'admin' },
  { pattern: /\/api\/admin\/audit-log/, methods: ['GET'], minRole: 'admin' },

  // Supervisor+
  { pattern: /\/api\/admin\/monitor/, methods: ['GET', 'POST'], minRole: 'supervisor' },
  { pattern: /\/api\/admin\/agent/, methods: ['POST', 'PUT', 'DELETE'], minRole: 'supervisor' },
  { pattern: /\/api\/ivr/, methods: ['POST', 'PUT', 'DELETE'], minRole: 'supervisor' },
  { pattern: /\/api\/admin\/queue/, methods: ['POST', 'DELETE'], minRole: 'supervisor' },
  { pattern: /\/api\/campaigns/, methods: ['POST', 'PUT', 'DELETE'], minRole: 'supervisor' },
  { pattern: /\/api\/qa\/rules/, methods: ['POST', 'PUT', 'DELETE'], minRole: 'supervisor' },
  { pattern: /\/api\/admin\/tool/, methods: ['POST', 'PUT', 'DELETE'], minRole: 'supervisor' },

  // Agent+ (read most things, manage calls)
  { pattern: /\/api\/(admin|voice)\/call/, methods: ['GET', 'POST'], minRole: 'agent' },
  { pattern: /\/api\/sms/, methods: ['GET', 'POST'], minRole: 'agent' },
  { pattern: /\/api\/admin\/voicemail/, methods: ['GET', 'POST'], minRole: 'agent' },
  { pattern: /\/api\/whatsapp/, methods: ['GET', 'POST'], minRole: 'agent' },
  { pattern: /\/api\/knowledge-base/, methods: ['GET'], minRole: 'agent' },

  // Viewer+ (read-only access)
  { pattern: /\/api\/analytics/, methods: ['GET'], minRole: 'viewer' },
  { pattern: /\/api\/billing/, methods: ['GET'], minRole: 'viewer' },
  { pattern: /\/api\/admin\/agent/, methods: ['GET'], minRole: 'viewer' },
  { pattern: /\/api\/qa/, methods: ['GET'], minRole: 'viewer' },
  { pattern: /\/api\/admin\/queue/, methods: ['GET'], minRole: 'viewer' },
  { pattern: /\/api\/ivr/, methods: ['GET'], minRole: 'viewer' },
];

function getRoleLevel(role: string): number {
  // Normalize to lowercase for case-insensitive comparison
  return ROLE_HIERARCHY[role.toLowerCase()] ?? 0;
}

function hasPermission(userRole: string, requiredRole: string): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
}

/**
 * RBAC middleware factory - checks if user's role meets the minimum
 * required role for the requested route.
 * 
 * Usage in gateway:
 *   app.use('/api/admin', authMiddleware, rbacMiddleware, proxy(...))
 */
export const rbacMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const userRole = req.user.role;
    const method = req.method.toUpperCase();
    // Use the full path for matching (patterns include /api/)
    const path = req.originalUrl.split('?')[0]; // Remove query params

    // Find the most specific matching permission rule
    let matchedRule: typeof ROUTE_PERMISSIONS[0] | null = null;
    for (const rule of ROUTE_PERMISSIONS) {
      if (rule.pattern.test(path) && rule.methods.includes(method)) {
        // Take the first (most specific) match
        if (!matchedRule) {
          matchedRule = rule;
        }
      }
    }

    // If no rule matches, allow by default (authenticated users can access)
    if (!matchedRule) {
      return next();
    }

    if (!hasPermission(userRole, matchedRule.minRole)) {
      logger.warn(
        `RBAC denied: user ${req.user.email} (${userRole}) tried ${method} ${req.originalUrl} — requires ${matchedRule.minRole}`
      );
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: matchedRule.minRole,
        current: userRole,
      });
    }

    next();
  } catch (error) {
    logger.error('RBAC middleware error:', error);
    next();
  }
};

/**
 * Factory to create role-check middleware for specific minimum role.
 * Usage: app.use('/api/admin', authMiddleware, requireRole('admin'), proxy(...))
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    // Check if user's role is in allowed list OR the user's role level
    // is >= the highest allowed role level
    const userLevel = getRoleLevel(req.user.role);
    const minRequiredLevel = Math.min(...allowedRoles.map(getRoleLevel));

    if (userLevel >= minRequiredLevel) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Insufficient permissions',
      allowed: allowedRoles,
      current: req.user.role,
    });
  };
};
