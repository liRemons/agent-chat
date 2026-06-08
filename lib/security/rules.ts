export type RiskLevel = 'P0' | 'P1' | 'P2' | 'P3';

export type AgentStatus = 'success' | 'requires_clarification' | 'requires_approval' | 'blocked' | 'error';

export interface ToolPolicy {
  operation: string;
  risk: RiskLevel;
  autoApprove: boolean;
  allowedRoles: string[];
}

const toolPolicies: ToolPolicy[] = [
  {
    operation: 'get_city_coordinates',
    risk: 'P3',
    autoApprove: true,
    allowedRoles: ['user', 'admin'],
  },
  {
    operation: 'delete_data',
    risk: 'P0',
    autoApprove: false,
    allowedRoles: ['admin'],
  },
];

export function evaluateToolPolicy(operation: string, role: string) {
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
