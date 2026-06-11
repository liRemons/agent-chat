export type RiskLevel = 'P0' | 'P1' | 'P2' | 'P3';

export type AgentStatus = 'success' | 'requires_clarification' | 'requires_approval' | 'blocked' | 'error';

export interface ToolPolicy {
  operation: string;
  risk: RiskLevel;
  autoApprove: boolean;
  allowedRoles: string[];
}

const toolPolicies: ToolPolicy[] = [
  // 低风险查询类工具可以自动放行，但仍会记录审计日志。
  {
    operation: 'get_city_coordinates',
    risk: 'P3',
    autoApprove: true,
    allowedRoles: ['user', 'admin'],
  },
  // 高风险写入/删除类操作默认只给管理员，并要求人工审批。
  {
    operation: 'delete_data',
    risk: 'P0',
    autoApprove: false,
    allowedRoles: ['admin'],
  },
];

export function evaluateToolPolicy(operation: string, role: string) {
  // 工具执行前统一查策略表；没有显式配置的工具一律拒绝。
  const policy = toolPolicies.find(item => item.operation === operation);

  if (!policy) {
    return {
      allowed: false,
      status: 'blocked' as AgentStatus,
      reason: `工具 ${operation} 未配置白名单`,
    };
  }

  if (!policy.allowedRoles.includes(role)) {
    return {
      allowed: false,
      status: 'blocked' as AgentStatus,
      reason: `当前角色无权调用工具 ${operation}`,
    };
  }

  if (!policy.autoApprove) {
    return {
      allowed: false,
      status: 'requires_approval' as AgentStatus,
      reason: `工具 ${operation} 风险等级为 ${policy.risk}，需要人工审批`,
    };
  }

  return {
    allowed: true,
    status: 'success' as AgentStatus,
    reason: '允许调用',
  };
}
