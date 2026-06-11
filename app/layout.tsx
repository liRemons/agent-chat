import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { Providers } from './providers';
import 'antd/dist/reset.css';
import './globals.css';

export const metadata: Metadata = {
  // 浏览器标签页和搜索元信息，所有页面默认复用这份配置。
  title: '智能助手',
  description: '生产级智能助手实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Next.js 根布局：AntdRegistry 负责 App Router 下的 antd 样式注入，Providers 提供主题和 message/modal 上下文。
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
