import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { fetchCityCoordinates } from '@/lib/agent/weather';
import { evaluateToolPolicy } from '@/lib/security/rules';
import { writeAuditLog } from '@/lib/server/audit';

interface ToolRuntimeContext {
  requestId: string;
  userId: string;
  conversationId: string;
  role: string;
}

export function createAgentTools(runtimeContext: ToolRuntimeContext) {
  // 每次 Agent 请求都会创建带当前用户、会话和审计信息的工具实例。
  const getCityCoordinatesTool = tool(
    async ({ city }: { city: string }) => {
      // 工具真正执行前先过安全策略，未授权或高风险操作会直接返回拦截原因。
      const policyResult = evaluateToolPolicy('get_city_coordinates', runtimeContext.role);

      writeAuditLog({
        requestId: runtimeContext.requestId,
        userId: runtimeContext.userId,
        conversationId: runtimeContext.conversationId,
        event: 'tool.policy_evaluated',
        metadata: {
          operation: 'get_city_coordinates',
          status: policyResult.status,
          allowed: policyResult.allowed,
        },
      });

      if (!policyResult.allowed) {
        // 策略拒绝时把原因返回给模型，让模型向用户解释而不是继续执行外部请求。
        return policyResult.reason;
      }

      return fetchCityCoordinates(city);
    },
    {
      name: 'get_city_coordinates',
      description: '获取指定城市的经纬度。必须提供城市名称。',
      schema: z.object({
        city: z.string().min(1).describe('城市名称，例如杭州、北京、上海'),
      }),
    },
  );

  return [getCityCoordinatesTool];
}
