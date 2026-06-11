interface AuditLogPayload {
  requestId: string;
  userId: string;
  conversationId: string;
  event: string;
  metadata?: Record<string, unknown>;
}

export function writeAuditLog(payload: AuditLogPayload) {
  // 审计日志统一打到服务端 stdout，PM2 或部署平台可以集中采集和检索。
  console.info('[agent-audit]', JSON.stringify({
    ...payload,
    timestamp: new Date().toISOString(),
  }));
}
