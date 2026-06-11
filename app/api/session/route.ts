import { NextResponse } from 'next/server';
import { setSessionCookie } from '@/lib/server/session';

export async function POST() {
  // 页面初始化时创建一个匿名会话，用签名 Cookie 标识当前浏览器用户。
  const userId = crypto.randomUUID();
  await setSessionCookie(userId);

  return NextResponse.json({ userId });
}
