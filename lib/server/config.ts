export const agentConfig = {
  modelName: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  openAiBaseUrl: process.env.OPENAI_BASE_URL,
  requestTimeoutMs: Number(process.env.AGENT_REQUEST_TIMEOUT_MS ?? 30_000),
  modelTimeoutMs: Number(process.env.OPENAI_TIMEOUT_MS ?? 20_000),
  weatherRequestTimeoutMs: Number(process.env.WEATHER_REQUEST_TIMEOUT_MS ?? 8_000),
  contextCompressionCharacterThreshold: Number(process.env.CONTEXT_COMPRESSION_CHARACTER_THRESHOLD ?? 4_000),
};

export function assertServerConfig() {
  const missingVariables = ['OPENAI_API_KEY', 'AGENT_SESSION_SECRET'].filter(
    variableName => !process.env[variableName],
  );

  if (missingVariables.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}`);
  }
}
