'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type MessageType = 'success' | 'error' | 'info';

interface MessageState {
  id: string;
  type: MessageType;
  content: string;
  duration: number;
}

const defaultDurationMs = 3000;

function getMessageClassName(type: MessageType) {
  if (type === 'success') {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700 shadow-emerald-100/70';
  }

  if (type === 'error') {
    return 'border-rose-100 bg-rose-50 text-rose-700 shadow-rose-100/70';
  }

  return 'border-slate-100 bg-white text-slate-700 shadow-slate-200/80';
}

function getMessageIcon(type: MessageType) {
  if (type === 'success') {
    return '✓';
  }

  if (type === 'error') {
    return '!';
  }

  return 'i';
}

export function useAppMessage() {
  const [messageState, setMessageState] = useState<MessageState | null>(null);

  useEffect(() => {
    if (!messageState) {
      return;
    }

    const closeTimer = window.setTimeout(() => {
      setMessageState(null);
    }, messageState.duration);

    return () => {
      window.clearTimeout(closeTimer);
    };
  }, [messageState]);

  const openMessage = useCallback((type: MessageType, content: string, duration = defaultDurationMs) => {
    setMessageState({
      id: crypto.randomUUID(),
      type,
      content,
      duration,
    });
  }, []);

  const message = useMemo(
    () => ({
      success: (content: string, duration?: number) => openMessage('success', content, duration),
      error: (content: string, duration?: number) => openMessage('error', content, duration),
      info: (content: string, duration?: number) => openMessage('info', content, duration),
      destroy: () => setMessageState(null),
    }),
    [openMessage],
  );

  const contextHolder = messageState ? (
    <div className="pointer-events-none fixed left-0 right-0 top-5 z-[80] flex justify-center px-4">
      <div
        key={messageState.id}
        className={`pointer-events-auto flex min-h-11 max-w-xl items-center gap-3 rounded-2xl border px-4 py-2.5 text-sm font-medium shadow-xl backdrop-blur-xl ${getMessageClassName(messageState.type)}`}
      >
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/70 text-xs font-bold">{getMessageIcon(messageState.type)}</span>
        <span className="leading-6">{messageState.content}</span>
      </div>
    </div>
  ) : null;

  return { message, contextHolder };
}
