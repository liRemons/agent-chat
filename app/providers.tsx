'use client';

import { App, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  // 全局 Ant Design Provider：统一中文文案、主题色，并给 message/modal 等静态能力提供上下文。
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#4f46e5',
          borderRadius: 14,
          fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
