import { NextResponse } from 'next/server';
import { runAgent } from '@/lib/agent/runAgent';
import { validateUserInput, redactSensitiveText } from '@/lib/security/guardrails';
import { agentConfig, assertServerConfig } from '@/lib/server/config';
import { getCurrentSession } from '@/lib/server/session';
import { writeAuditLog } from '@/lib/server/audit';

export const maxDuration = 30;

interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequestBody {
  messages?: IncomingMessage[];
  conversationId?: string;
}

function normalizeMessages(messages: IncomingMessage[] | undefined) {
  return (messages ?? [])
    .filter(message => (message.role === 'user' || message.role === 'assistant') && message.content.trim().length > 0)
    .map(message => ({
      role: message.role,
      content: message.content.trim(),
    }));
}

function getLatestUserInput(messages: IncomingMessage[]) {
  const latestUserMessage = [...messages].reverse().find(message => message.role === 'user');
  return latestUserMessage?.content?.trim() ?? '';
}

function createRequestId() {
  return crypto.randomUUID();
}

function streamPlainText(text: string) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    }),
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  );
}

async function resolveWithTimeout<T>(task: Promise<T>, timeoutMs: number, timeoutValue: T): Promise<T> {
  // 兜底保护整条 Agent 链路，避免模型或工具异常时浏览器请求一直挂起。
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutTask = new Promise<T>(resolve => {
    timeoutId = setTimeout(() => resolve(timeoutValue), timeoutMs);
  });

  try {
    return await Promise.race([task, timeoutTask]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    assertServerConfig();

    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = (await request.json()) as ChatRequestBody;
    const userId = session.userId;
    const conversationId = body.conversationId ?? requestId;
    const conversationMessages = normalizeMessages(body.messages);
    const userInput = getLatestUserInput(conversationMessages);

    writeAuditLog({
      requestId,
      userId,
      conversationId,
      event: 'chat.request_received',
      metadata: {
        hasInput: userInput.length > 0,
      },
    });

    if (userInput.length === 0) {
      return NextResponse.json({ error: '请输入有效内容' }, { status: 400 });
    }

    const inputGuardrailResult = validateUserInput(userInput);
    if (!inputGuardrailResult.allowed) {
      return streamPlainText(inputGuardrailResult.reason);
    }

    const agentOutput = await resolveWithTimeout(
      runAgent({
        requestId,
        userId,
        conversationId,
        role: 'user',
        input: userInput,
        history: conversationMessages,
      }),
      agentConfig.requestTimeoutMs,
      'Agent 请求超时。请检查模型服务地址、API Key、网络代理或稍后重试。',
    );
    const safeAgentOutput = redactSensitiveText(agentOutput);

    writeAuditLog({
      requestId,
      userId,
      conversationId,
      event: 'chat.response_ready',
      metadata: {
        outputLength: safeAgentOutput.length,
      },
    });

    return streamPlainText(safeAgentOutput);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';

    writeAuditLog({
      requestId,
      userId: 'unknown',
      conversationId: requestId,
      event: 'chat.error',
      metadata: {
        errorMessage,
      },
    });

    return NextResponse.json({ error: 'Agent 服务不可用，请稍后重试' }, { status: 500 });
  }
}
