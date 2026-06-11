import { NextResponse } from 'next/server';

const disabledSettingsApiResponse = {
  // 配置接口保留 410 响应，明确告诉旧前端或调试请求：不要再通过服务端保存模型配置。
  error: '配置接口已禁用。模型配置仅保存在当前浏览器，并随聊天请求提交；服务端会话密钥只允许通过服务器环境变量配置。',
};

export async function GET() {
  return NextResponse.json(disabledSettingsApiResponse, { status: 410 });
}

export async function PUT() {
  return NextResponse.json(disabledSettingsApiResponse, { status: 410 });
}
