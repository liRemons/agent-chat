import type { AgentSettingField } from './types';

export const agentSettingFields: AgentSettingField[] = [
  {
    key: 'OPENAI_API_KEY',
    label: 'OPENAI_API_KEY',
    chineseLabel: '接口密钥',
    description: '模型服务的访问密钥，用于调用兼容 OpenAI 协议的模型接口。',
    type: 'password',
    placeholder: '输入模型服务 API Key',
  },
  {
    key: 'OPENAI_MODEL',
    label: 'OPENAI_MODEL',
    chineseLabel: '模型名称',
    description: '要调用的模型 ID，例如 qwen、gpt 等模型服务中的具体模型名。',
    type: 'text',
    placeholder: '例如：gpt-4o-mini',
  },
  {
    key: 'OPENAI_BASE_URL',
    label: 'OPENAI_BASE_URL',
    chineseLabel: '服务地址',
    description: '模型服务的接口地址，需填写兼容 OpenAI Chat Completions 的 Base URL。',
    type: 'text',
    placeholder: '例如：https://api.openai.com/v1',
  },
];
