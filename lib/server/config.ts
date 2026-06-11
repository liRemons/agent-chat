export interface ModelSettings {
  openAiApiKey: string;
  modelName: string;
  openAiBaseUrl: string;
}

export interface IncomingModelSettings {
  OPENAI_API_KEY?: unknown;
  OPENAI_MODEL?: unknown;
  OPENAI_BASE_URL?: unknown;
}

export const agentConfig = {
  // 这些超时和阈值只属于服务端运行参数，不包含任何用户模型密钥。
  requestTimeoutMs: Number(process.env.AGENT_REQUEST_TIMEOUT_MS ?? 30_000),
  modelTimeoutMs: Number(process.env.OPENAI_TIMEOUT_MS ?? 20_000),
  weatherRequestTimeoutMs: Number(process.env.WEATHER_REQUEST_TIMEOUT_MS ?? 8_000),
  contextCompressionCharacterThreshold: Number(process.env.CONTEXT_COMPRESSION_CHARACTER_THRESHOLD ?? 4_000),
};

function normalizeSettingValue(value: unknown) {
  // 请求体里的配置必须是字符串；非字符串一律当作空值，避免对象注入到模型配置。
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeModelSettings(settings: IncomingModelSettings | undefined): ModelSettings {
  // 把前端使用的环境变量风格字段转换成服务端内部更易读的驼峰字段。
  return {
    openAiApiKey: normalizeSettingValue(settings?.OPENAI_API_KEY),
    modelName: normalizeSettingValue(settings?.OPENAI_MODEL),
    openAiBaseUrl: normalizeSettingValue(settings?.OPENAI_BASE_URL),
  };
}

export function assertModelSettings(settings: ModelSettings) {
  // 模型调用必须同时具备 Key、模型名和 Base URL，缺任意一个都不进入 Agent。
  const missingSettings = [
    ['OPENAI_API_KEY', settings.openAiApiKey],
    ['OPENAI_MODEL', settings.modelName],
    ['OPENAI_BASE_URL', settings.openAiBaseUrl],
  ].filter(([, value]) => !value);

  if (missingSettings.length > 0) {
    throw new Error(`Missing required model settings: ${missingSettings.map(([key]) => key).join(', ')}`);
  }
}

export function assertServerConfig() {
  if (!process.env.AGENT_SESSION_SECRET) {
    throw new Error('Missing required environment variable: AGENT_SESSION_SECRET');
  }
}
