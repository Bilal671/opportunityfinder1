import crypto from 'node:crypto';
import { SecurityEvent } from '../../types';

// In-memory store for security events (can also write to Supabase / persistent DB)
const securityEvents: SecurityEvent[] = [];

/**
 * Creates an anonymous SHA-256 hash of an IP address to preserve privacy while enabling rate/abuse correlation.
 */
export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + (process.env.SECURITY_SALT || 'salt-default-key')).digest('hex').substring(0, 16);
}

/**
 * Logs a security event.
 */
export function logSecurityEvent(
  eventType: SecurityEvent['eventType'],
  ip: string,
  metadata: Record<string, unknown> = {},
  userId?: string,
  workspaceId?: string
): SecurityEvent {
  const event: SecurityEvent = {
    id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    userId,
    workspaceId,
    eventType,
    ipHash: hashIp(ip || '0.0.0.0'),
    metadata,
    createdAt: new Date().toISOString(),
  };

  securityEvents.unshift(event);
  if (securityEvents.length > 500) {
    securityEvents.pop();
  }

  // Console notice without exposing secrets
  console.warn(`[SECURITY EVENT] [${eventType}] IP Hash: ${event.ipHash} Meta:`, JSON.stringify(metadata));
  return event;
}

export function getSecurityEvents(limit = 50): SecurityEvent[] {
  return securityEvents.slice(0, limit);
}
