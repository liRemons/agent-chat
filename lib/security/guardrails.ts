const promptInjectionPatterns = [
  'ignore previous instructions',
  'system prompt',
  'developer message',
  'reveal your instructions',
  '忽略之前的指令',
  '泄露系统提示词',
];

export type GuardrailResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export function validateUserInput(input: string): GuardrailResult {
  const normalizedInput = input.toLowerCase();
  const matchedPattern = promptInjectionPatterns.find(pattern => normalizedInput.includes(pattern));

  if (matchedPattern) {
    return { allowed: false, reason: `输入命中安全规则：${matchedPattern}` };
  }

  return { allowed: true };
}

export function redactSensitiveText(text: string): string {
  return text
    .replace(/\b1[3-9]\d{9}\b/g, '[PHONE_REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTED]');
}
