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
  const getCityCoordinatesTool = tool(
    async ({ city }: { city: string }) => {
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
