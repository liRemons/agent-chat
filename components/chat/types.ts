export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
}

export interface AgentSettings {
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  OPENAI_BASE_URL: string;
}

export interface AgentSettingField {
  // 配置弹窗的字段元数据，页面根据它统一渲染输入框、提示文案和密文展示按钮。
  key: keyof AgentSettings;
  label: string;
  chineseLabel: string;
  description: string;
  type: 'password' | 'text';
  placeholder: string;
}
