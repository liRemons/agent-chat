import { NextResponse } from 'next/server';
import { setSessionCookie } from '@/lib/server/session';

export async function POST() {
  const userId = crypto.randomUUID();
  await setSessionCookie(userId);

  return NextResponse.json({ userId });
}
