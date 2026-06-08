import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { agentConfig } from '@/lib/server/config';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

function calculateContextSize(messages: ConversationMessage[]) {
  return messages.reduce((totalSize, message) => totalSize + message.content.length, 0);
}

function convertConversationMessage(message: ConversationMessage): BaseMessage {
  return message.role === 'user' ? new HumanMessage(message.content) : new AIMessage(message.content);
}

function createSummarizerModel() {
  return new ChatOpenAI({
    model: agentConfig.modelName,
    temperature: 0,
    timeout: agentConfig.modelTimeoutMs,
    configuration: agentConfig.openAiBaseUrl
      ? {
          baseURL: agentConfig.openAiBaseUrl,
        }
      : undefined,
  });
}

async function summarizeConversation(messages: ConversationMessage[]) {
  const summarizer = createSummarizerModel();

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

export async function buildConversationContext(messages: ConversationMessage[]) {
  if (messages.length <= 1) {
    return messages.map(convertConversationMessage);
  }

  const contextMessages = messages.slice(0, -1);
  const latestMessage = messages[messages.length - 1];
  const contextSize = calculateContextSize(contextMessages);

  if (contextSize <= agentConfig.contextCompressionCharacterThreshold) {
    return messages.map(convertConversationMessage);
  }

  const compressedContext = await summarizeConversation(contextMessages);

  return [
    new SystemMessage(`以下是已压缩的历史对话上下文：\n${compressedContext}`),
    convertConversationMessage(latestMessage),
  ];
}
