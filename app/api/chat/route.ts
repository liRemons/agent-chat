import { NextResponse } from 'next/server';
import { runAgent } from '@/lib/agent/runAgent';
import { validateUserInput, redactSensitiveText } from '@/lib/security/guardrails';
import { agentConfig, assertModelSettings, assertServerConfig, normalizeModelSettings, type IncomingModelSettings } from '@/lib/server/config';
import { getCurrentSession } from '@/lib/server/session';
import { writeAuditLog } from '@/lib/server/audit';

export const maxDuration = 30;

// 前端每次聊天会把当前对话历史和浏览器本地模型配置一起提交到这里。

interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface IncomingMemory {
  scope?: unknown;
  kind?: unknown;
  title?: unknown;
  summary?: unknown;
  content?: unknown;
}

interface NormalizedMemory {
  scope: 'project' | 'global';
  kind: 'memory' | 'prompt';
  title: string;
  summary: string;
  content: string;
}

interface ChatRequestBody {
  messages?: IncomingMessage[];
  conversationId?: string;
  settings?: IncomingModelSettings;
  memories?: IncomingMemory[];
}

function normalizeMessages(messages: IncomingMessage[] | undefined) {
  // 只保留用户和助手的有效文本，避免脏数据进入 Agent 上下文。
  return (messages ?? [])
    .filter(message => (message.role === 'user' || message.role === 'assistant') && message.content.trim().length > 0)
    .map(message => ({
      role: message.role,
      content: message.content.trim(),
    }));
}

function normalizeMemories(memories: IncomingMemory[] | undefined): NormalizedMemory[] {
  return (memories ?? [])
    .map<NormalizedMemory>(memory => ({
      scope: memory?.scope === 'global' ? 'global' : 'project',
      kind: memory.kind === 'prompt' ? 'prompt' : 'memory',
      title: typeof memory.title === 'string' ? memory.title.trim() : '',
      summary: typeof memory.summary === 'string' ? memory.summary.trim() : '',
      content: typeof memory.content === 'string' ? memory.content.trim() : '',
    }))
    .filter(memory => memory.title && memory.content)
    .slice(0, 20);
}

function getLatestUserInput(messages: IncomingMessage[]) {
  // Agent 只处理最后一条用户消息；更早的消息作为 history 提供上下文。
  const latestUserMessage = [...messages].reverse().find(message => message.role === 'user');
  return latestUserMessage?.content?.trim() ?? '';
}

function createRequestId() {
  return crypto.randomUUID();
}

function streamPlainText(text: string) {
  // 前端按流式文本读取响应，这里即使是一次性文本也统一包装成 ReadableStream。
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

function stripWrappingQuotes(value: string) {
  return value
    .trim()
    .replace(/^[“”"'「」『』]+/, '')
    .replace(/[“”"'「」『』]+$/, '')
    .trim();
}

function findDirectMemoryReply(userInput: string, memories: NormalizedMemory[]) {
  const directRulePatterns = [
    /发送[“”"'「」『』]?(.+?)[“”"'「」『』]?时[，,]?\s*(?:必须|请|需要)?回复[：:]\s*([\s\S]+)/,
    /当(?:用户)?(?:发送|输入|说)[“”"'「」『』]?(.+?)[“”"'「」『』]?时[，,]?\s*(?:必须|请|需要)?回复[：:]\s*([\s\S]+)/,
  ];

  for (const memory of memories) {
    for (const directRulePattern of directRulePatterns) {
      const matchedRule = memory.content.match(directRulePattern);
      if (!matchedRule) {
        continue;
      }

      const triggerText = stripWrappingQuotes(matchedRule[1] ?? '');
      const replyText = stripWrappingQuotes(matchedRule[2] ?? '');
      if (triggerText && replyText && userInput.trim() === triggerText) {
        return replyText;
      }
    }
  }

  return '';
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
  // requestId 贯穿审计日志、Agent 执行和错误排查。
  const requestId = createRequestId();

  try {
    assertServerConfig();

    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = (await request.json()) as ChatRequestBody;
    // 模型配置来自当前浏览器，而不是服务器 .env.local，避免被其他访问者共享或读取。
    const modelSettings = normalizeModelSettings(body.settings);
    try {
      assertModelSettings(modelSettings);
    } catch {
      return NextResponse.json({ error: '模型配置不完整，请先在当前浏览器完成助手配置。' }, { status: 400 });
    }

    const userId = session.userId;
    const conversationId = body.conversationId ?? requestId;
    const conversationMessages = normalizeMessages(body.messages);
    const memoryContext = normalizeMemories(body.memories);
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
    // 用户输入先过安全规则，命中敏感/危险内容时不进入模型，直接返回拦截原因。
    if (!inputGuardrailResult.allowed) {
      return streamPlainText(inputGuardrailResult.reason);
    }

    const directMemoryReply = findDirectMemoryReply(userInput, memoryContext);
    if (directMemoryReply) {
      return streamPlainText(redactSensitiveText(directMemoryReply));
    }

    const agentOutput = await resolveWithTimeout(
      // runAgent 会串起模型、上下文压缩、工具调用和审计日志。
      runAgent({
        requestId,
        userId,
        conversationId,
        role: 'user',
        input: userInput,
        history: conversationMessages,
        memories: memoryContext,
        modelSettings,
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
