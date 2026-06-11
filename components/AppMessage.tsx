'use client';

import { App } from 'antd';
import { useEffect, useMemo, useRef } from 'react';

const defaultDurationSeconds = 3;

export function useAppMessage() {
  // antd 的 message 实例通过 ref 保存，返回对象保持稳定，避免调用方 effect 因引用变化反复触发。
  const { message: antdMessage } = App.useApp();
  const messageRef = useRef(antdMessage);

  useEffect(() => {
    messageRef.current = antdMessage;
  }, [antdMessage]);

  const message = useMemo(() => ({
    success: (content: string, duration = defaultDurationSeconds * 1000) => messageRef.current.success(content, duration / 1000),
    error: (content: string, duration = defaultDurationSeconds * 1000) => messageRef.current.error(content, duration / 1000),
    info: (content: string, duration = defaultDurationSeconds * 1000) => messageRef.current.info(content, duration / 1000),
    destroy: () => messageRef.current.destroy(),
  }), []);

  return {
    message,
    contextHolder: null,
  };
}
