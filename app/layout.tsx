import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '智能助手',
  description: '生产级智能助手最小实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
