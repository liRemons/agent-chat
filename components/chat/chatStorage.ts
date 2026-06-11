import type { AgentSettings, ChatConversation } from './types';

export const typewriterIntervalMs = 12;

// localStorage key 集中定义，方便以后改名或做数据迁移。
export const conversationsStorageKey = 'remons.agent.chat.conversations';
export const activeConversationStorageKey = 'remons.agent.chat.activeConversationId';
export const agentSettingsStorageKey = 'remons.agent.chat.agentSettings';
export const autoScrollThresholdPx = 96;

export const emptyAgentSettings: AgentSettings = {
  OPENAI_API_KEY: '',
  OPENAI_MODEL: '',
  OPENAI_BASE_URL: '',
};

export function createClientId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createConversation(title = '新建对话'): ChatConversation {
  // 新建会话默认没有消息，updatedAt 用于列表排序和展示更新时间。
  return {
    id: createClientId('conversation'),
    title,
    messages: [],
    updatedAt: new Date().toISOString(),
  };
}

export function wait(milliseconds: number) {
  // 用于打字机效果：每追加一个字符后暂停一小段时间，让回复逐字出现。
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

export function formatConversationTime(value: string) {
  // 会话列表只展示小时和分钟，减少侧边栏信息噪音。
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function parseStoredConversations(value: string | null) {
  // localStorage 可能被用户手动改坏，解析失败时返回空数组让页面自动恢复。
  if (!value) {
    return [];
  }

  try {
    const storedConversations = JSON.parse(value) as ChatConversation[];
    return storedConversations.filter(conversation => Array.isArray(conversation.messages));
  } catch {
    return [];
  }
}

export function parseStoredAgentSettings(value: string | null): AgentSettings {
  // 模型配置只存在当前浏览器；这里负责从 localStorage 恢复并补齐缺省字段。
  if (!value) {
    return emptyAgentSettings;
  }

  try {
    const storedSettings = JSON.parse(value) as Partial<AgentSettings>;
    return {
      OPENAI_API_KEY: String(storedSettings.OPENAI_API_KEY ?? ''),
      OPENAI_MODEL: String(storedSettings.OPENAI_MODEL ?? ''),
      OPENAI_BASE_URL: String(storedSettings.OPENAI_BASE_URL ?? ''),
    };
  } catch {
    return emptyAgentSettings;
  }
}

export function isNearScrollBottom(element: HTMLDivElement) {
  // 用户接近底部时才自动跟随新消息滚动；如果用户翻看历史，就不要强行拉到底部。
  return element.scrollHeight - element.scrollTop - element.clientHeight < autoScrollThresholdPx;
}
