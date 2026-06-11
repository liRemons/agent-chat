import * as crypto from 'node:crypto';
import { cookies } from 'next/headers';

const sessionCookieName = 'agent_session';

interface SessionPayload {
  userId: string;
  issuedAt: number;
}

function getSessionSecret() {
  // 会话签名密钥只允许从真实服务端环境变量读取，不能由浏览器配置或 .env.local 共享。
  const sessionSecret = process.env.AGENT_SESSION_SECRET;

  if (!sessionSecret) {
    throw new Error('Missing required environment variable: AGENT_SESSION_SECRET');
  }

  return sessionSecret;
}

function encodeBase64Url(value: Uint8Array | string) {
  // Cookie 里只放 base64url 文本，避免 JSON 中的特殊字符破坏 Cookie 格式。
  const source = typeof value === 'string' ? Buffer.from(value) : Buffer.from(value);
  return source.toString('base64url');
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload: string) {
  // 使用 HMAC-SHA256 签名 payload，服务端校验时可发现 Cookie 是否被篡改。
  return crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

export function createSignedSession(userId: string) {
  // Cookie 格式为 payload.signature；payload 可解码，signature 用于防篡改。
  const payload = encodeBase64Url(JSON.stringify({
    userId,
    issuedAt: Date.now(),
  } satisfies SessionPayload));
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

export function verifySignedSession(sessionToken: string | undefined): SessionPayload | null {
  // 任何缺失、格式错误、签名不匹配或 payload 不完整的 Cookie 都视为无会话。
  if (!sessionToken) {
    return null;
  }

  const [payload, signature] = sessionToken.split('.');
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payload);
  if (signature !== expectedSignature) {
    return null;
  }

  const parsedPayload = JSON.parse(decodeBase64Url(payload)) as SessionPayload;
  if (!parsedPayload.userId || !parsedPayload.issuedAt) {
    return null;
  }

  return parsedPayload;
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  return verifySignedSession(cookieStore.get(sessionCookieName)?.value);
}

export async function setSessionCookie(userId: string) {
  // httpOnly 防止前端脚本读取 Cookie；生产环境启用 secure 只允许 HTTPS 传输。
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, createSignedSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}
