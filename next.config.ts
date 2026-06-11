import type { NextConfig } from 'next';

// standalone 会把生产运行需要的服务端代码打包到 .next/standalone，方便用 server.js 或 PM2 部署。
const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
