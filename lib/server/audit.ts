interface AuditLogPayload {
  requestId: string;
  userId: string;
  conversationId: string;
  event: string;
  metadata?: Record<string, unknown>;
}

export function writeAuditLog(payload: AuditLogPayload) {
  console.info('[agent-audit]', JSON.stringify({
    ...payload,
    timestamp: new Date().toISOString(),
  }));
}
