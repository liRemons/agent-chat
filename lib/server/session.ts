import * as crypto from 'node:crypto';
import { cookies } from 'next/headers';

const sessionCookieName = 'agent_session';

interface SessionPayload {
  userId: string;
  issuedAt: number;
}

function getSessionSecret() {
  const sessionSecret = process.env.AGENT_SESSION_SECRET;

  if (!sessionSecret) {
    throw new Error('Missing required environment variable: AGENT_SESSION_SECRET');
  }

  return sessionSecret;
}

function encodeBase64Url(value: Uint8Array | string) {
  const source = typeof value === 'string' ? Buffer.from(value) : Buffer.from(value);
  return source.toString('base64url');
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload: string) {
  return crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

export function createSignedSession(userId: string) {
  const payload = encodeBase64Url(JSON.stringify({
    userId,
    issuedAt: Date.now(),
  } satisfies SessionPayload));
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

export function verifySignedSession(sessionToken: string | undefined): SessionPayload | null {
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
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, createSignedSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}
