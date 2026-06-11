const promptInjectionPatterns = [
  // 输入侧安全规则：这些短语通常用于要求模型忽略系统约束或泄露内部提示词。
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
  // 统一转小写后做包含匹配，覆盖英文大小写混用的提示词注入尝试。
  const normalizedInput = input.toLowerCase();
  const matchedPattern = promptInjectionPatterns.find(pattern => normalizedInput.includes(pattern));

  if (matchedPattern) {
    return { allowed: false, reason: `输入命中安全规则：${matchedPattern}` };
  }

  return { allowed: true };
}

export function redactSensitiveText(text: string): string {
  // 回复返回给前端前做基础脱敏，避免模型或工具把手机号、邮箱原样展示出来。
  return text
    .replace(/\b1[3-9]\d{9}\b/g, '[PHONE_REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTED]');
}
