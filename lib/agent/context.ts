import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { agentConfig, type ModelSettings } from '@/lib/server/config';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

function calculateContextSize(messages: ConversationMessage[]) {
  // 按字符阈值计算上下文大小，超过阈值后触发历史对话压缩。
  return messages.reduce((totalSize, message) => totalSize + message.content.length, 0);
}

function convertConversationMessage(message: ConversationMessage): BaseMessage {
  // 把前端保存的消息结构转换成 LangChain 能识别的消息对象。
  return message.role === 'user' ? new HumanMessage(message.content) : new AIMessage(message.content);
}

function createSummarizerModel(modelSettings: ModelSettings) {
  // 历史压缩也使用当前请求的模型配置，和正式对话保持同一个模型服务来源。
  return new ChatOpenAI({
    apiKey: modelSettings.openAiApiKey,
    model: modelSettings.modelName,
    temperature: 0,
    timeout: agentConfig.modelTimeoutMs,
    configuration: modelSettings.openAiBaseUrl
      ? {
          baseURL: modelSettings.openAiBaseUrl,
        }
      : undefined,
  });
}

async function summarizeConversation(messages: ConversationMessage[], modelSettings: ModelSettings) {
  // 当历史上下文太长时，用模型提炼关键事实，减少后续请求的上下文长度。
  const summarizer = createSummarizerModel(modelSettings);

  const conversationText = messages
    .map(message => `${message.role === 'user' ? '用户' : '助手'}：${message.content}`)
    .join('\n');

  const summary = await summarizer.invoke([
    new SystemMessage(
      [
        '你负责压缩 Agent 对话上下文。',
        '只保留用户目标、已经确认的约束、关键结论、仍然未解决的问题。',
        '删除寒暄、重复表达和无关细节。',
        '不得新增原对话中没有的信息。',
      ].join('\n'),
    ),
    new HumanMessage(conversationText),
  ]);

  return typeof summary.content === 'string' ? summary.content : JSON.stringify(summary.content);
}

export async function buildConversationContext(messages: ConversationMessage[], modelSettings: ModelSettings) {
  // 保留最后一条用户输入；必要时把更早的历史压缩成一条系统上下文。
  if (messages.length <= 1) {
    return messages.map(convertConversationMessage);
  }

  const contextMessages = messages.slice(0, -1);
  const latestMessage = messages[messages.length - 1];
  // 只统计历史部分，最后一条用户输入必须完整保留，不能被摘要替换。
  const contextSize = calculateContextSize(contextMessages);

  if (contextSize <= agentConfig.contextCompressionCharacterThreshold) {
    return messages.map(convertConversationMessage);
  }

  const compressedContext = await summarizeConversation(contextMessages, modelSettings);

  return [
    new SystemMessage(`以下是已压缩的历史对话上下文：\n${compressedContext}`),
    convertConversationMessage(latestMessage),
  ];
}
