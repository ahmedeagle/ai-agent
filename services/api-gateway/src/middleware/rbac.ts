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
  { pattern: /\/company/, methods: ['DELETE'], minRole: 'super_admin' },

  // Admin+
  { pattern: /\/user/, methods: ['POST', 'DELETE'], minRole: 'admin' },
  { pattern: /\/user\/.*\/role/, methods: ['PUT'], minRole: 'admin' },
  { pattern: /\/billing\/packages/, methods: ['POST', 'PUT', 'DELETE'], minRole: 'admin' },
  { pattern: /\/company/, methods: ['PUT'], minRole: 'admin' },
  { pattern: /\/audit-log/, methods: ['GET'], minRole: 'admin' },

  // Supervisor+
  { pattern: /\/monitor/, methods: ['GET', 'POST'], minRole: 'supervisor' },
  { pattern: /\/agent/, methods: ['POST', 'PUT', 'DELETE'], minRole: 'supervisor' },
  { pattern: /\/ivr/, methods: ['POST', 'PUT', 'DELETE'], minRole: 'supervisor' },
  { pattern: /\/queue/, methods: ['POST', 'DELETE'], minRole: 'supervisor' },
  { pattern: /\/campaign/, methods: ['POST', 'PUT', 'DELETE'], minRole: 'supervisor' },
  { pattern: /\/qa-rules/, methods: ['POST', 'PUT', 'DELETE'], minRole: 'supervisor' },
  { pattern: /\/tool/, methods: ['POST', 'PUT', 'DELETE'], minRole: 'supervisor' },

  // Agent+ (read most things, manage calls)
  { pattern: /\/call/, methods: ['GET', 'POST'], minRole: 'agent' },
  { pattern: /\/sms/, methods: ['GET', 'POST'], minRole: 'agent' },
  { pattern: /\/voicemail/, methods: ['GET', 'POST'], minRole: 'agent' },
  { pattern: /\/whatsapp/, methods: ['GET', 'POST'], minRole: 'agent' },
  { pattern: /\/knowledge-base/, methods: ['GET'], minRole: 'agent' },

  // Viewer+ (read-only access)
  { pattern: /\/analytics/, methods: ['GET'], minRole: 'viewer' },
  { pattern: /\/billing/, methods: ['GET'], minRole: 'viewer' },
  { pattern: /\/agent/, methods: ['GET'], minRole: 'viewer' },
  { pattern: /\/qa-results/, methods: ['GET'], minRole: 'viewer' },
  { pattern: /\/queue/, methods: ['GET'], minRole: 'viewer' },
  { pattern: /\/ivr/, methods: ['GET'], minRole: 'viewer' },
];

function getRoleLevel(role: string): number {
  return ROLE_HIERARCHY[role] ?? 0;
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
    // Strip /api/service-name prefix to get the downstream path
    const path = req.originalUrl.replace(/^\/api\/[^/]+/, '');

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
