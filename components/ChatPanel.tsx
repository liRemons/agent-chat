'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, KeyboardEvent, ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ConfirmDialog } from './ConfirmDialog';
import remarkGfm from 'remark-gfm';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
}

interface AgentSettings {
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  OPENAI_BASE_URL: string;
  AGENT_SESSION_SECRET: string;
}

const typewriterIntervalMs = 12;
const conversationsStorageKey = 'testAgent.chat.conversations';
const activeConversationStorageKey = 'testAgent.chat.activeConversationId';
const autoScrollThresholdPx = 96;

const agentSettingFields: Array<{
  key: keyof AgentSettings;
  label: string;
  chineseLabel: string;
  description: string;
  type: 'password' | 'text';
  placeholder: string;
}> = [
  {
    key: 'OPENAI_API_KEY',
    label: 'OPENAI_API_KEY',
    chineseLabel: '接口密钥',
    description: '模型服务的访问密钥，用于调用兼容 OpenAI 协议的模型接口。',
    type: 'password',
    placeholder: '输入模型服务 API Key',
  },
  {
    key: 'OPENAI_MODEL',
    label: 'OPENAI_MODEL',
    chineseLabel: '模型名称',
    description: '要调用的模型 ID，例如 qwen、gpt 等模型服务中的具体模型名。',
    type: 'text',
    placeholder: '例如：gpt-4o-mini',
  },
  {
    key: 'OPENAI_BASE_URL',
    label: 'OPENAI_BASE_URL',
    chineseLabel: '服务地址',
    description: '模型服务的接口地址，需填写兼容 OpenAI Chat Completions 的 Base URL。',
    type: 'text',
    placeholder: '例如：https://api.openai.com/v1',
  },
  {
    key: 'AGENT_SESSION_SECRET',
    label: 'AGENT_SESSION_SECRET',
    chineseLabel: '会话密钥',
    description: '服务端用于签名和校验会话的密钥，建议使用足够长的随机字符串。',
    type: 'password',
    placeholder: '输入服务端会话签名密钥',
  },
];

const emptyAgentSettings: AgentSettings = {
  OPENAI_API_KEY: '',
  OPENAI_MODEL: '',
  OPENAI_BASE_URL: '',
  AGENT_SESSION_SECRET: '',
};

function createClientId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createConversation(title = '新建对话'): ChatConversation {
  return {
    id: createClientId('conversation'),
    title,
    messages: [],
    updatedAt: new Date().toISOString(),
  };
}

function wait(milliseconds: number) {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

function formatConversationTime(value: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function parseStoredConversations(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const storedConversations = JSON.parse(value) as ChatConversation[];
    return storedConversations.filter(conversation => Array.isArray(conversation.messages));
  } catch {
    return [];
  }
}

function isNearScrollBottom(element: HTMLDivElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < autoScrollThresholdPx;
}

function getPlainTextFromNode(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(childNode => getPlainTextFromNode(childNode)).join('');
  }

  return '';
}

function createHighlightToken(index: number) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let tokenName = '';
  let remainingIndex = index;

  do {
    tokenName = alphabet[remainingIndex % alphabet.length] + tokenName;
    remainingIndex = Math.floor(remainingIndex / alphabet.length) - 1;
  } while (remainingIndex >= 0);

  return `\uE000${tokenName}\uE001`;
}

function highlightCodeSyntax(code: string, language: string) {
  let highlightedCode = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const normalizedLanguage = language.toLowerCase();
  if (!['js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript', 'json', 'bash', 'shell', 'sh'].includes(normalizedLanguage)) {
    return highlightedCode;
  }

  const highlightedTokens: string[] = [];
  const createHighlightedToken = (value: string, className: string) => {
    const token = createHighlightToken(highlightedTokens.length);
    highlightedTokens.push(`<span class="${className}">${value}</span>`);
    return token;
  };

  highlightedCode = highlightedCode
    .replace(/(`[\s\S]*?`|".*?"|'.*?')/g, value => createHighlightedToken(value, 'text-emerald-300'))
    .replace(/(\/\/.*)$/gm, value => createHighlightedToken(value, 'text-slate-500'))
    .replace(/(#.*)$/gm, value => createHighlightedToken(value, 'text-slate-500'))
    .replace(/\b(const|let|var|function|return|if|else|for|while|await|async|import|from|export|type|interface|class|new|try|catch|throw)\b/g, value => createHighlightedToken(value, 'text-violet-300'))
    .replace(/\b(true|false|null|undefined|console|log|JSON|Promise)\b/g, value => createHighlightedToken(value, 'text-sky-300'))
    .replace(/\b(\d+(?:\.\d+)?)\b/g, value => createHighlightedToken(value, 'text-amber-300'));

  return highlightedTokens.reduce(
    (currentCode, tokenHtml, tokenIndex) => currentCode.replace(createHighlightToken(tokenIndex), tokenHtml),
    highlightedCode,
  );
}

function CodeBlock({ children, className }: { children: ReactNode; className?: string }) {
  const [hasCopied, setHasCopied] = useState(false);
  const languageMatch = /language-(\w+)/.exec(className ?? '');
  const language = languageMatch?.[1] ?? 'text';
  const code = getPlainTextFromNode(children).replace(/\n$/, '');
  const highlightedCode = useMemo(() => highlightCodeSyntax(code, language), [code, language]);

  async function handleCopyCode() {
    await navigator.clipboard.writeText(code);
    setHasCopied(true);
    window.setTimeout(() => {
      setHasCopied(false);
    }, 1600);
  }

  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-xs leading-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-2 text-[11px] text-slate-400">
        <span className="font-medium tracking-wide">{language}</span>
        <button
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300 transition hover:border-indigo-400 hover:text-white"
          onClick={handleCopyCode}
          type="button"
        >
          {hasCopied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-slate-100">
        <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
      </pre>
    </div>
  );
}

function MarkdownMessage({ content, isUserMessage }: { content: string; isUserMessage: boolean }) {
  if (isUserMessage) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  return (
    <div className="space-y-3 text-sm leading-7 text-slate-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-bold text-slate-950">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold text-slate-950">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-slate-950">{children}</h3>,
          p: ({ children }) => <p className="my-2">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => <blockquote className="my-3 border-l-4 border-indigo-200 bg-indigo-50/70 px-4 py-2 text-slate-600">{children}</blockquote>,
          code: ({ children, className }) => {
            if (className?.startsWith('language-')) {
              return <CodeBlock className={className}>{children}</CodeBlock>;
            }

            return <code className="rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[0.85em] text-slate-900">{children}</code>;
          },
          pre: ({ children }) => <>{children}</>,
          table: ({ children }) => <div className="my-3 overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full divide-y divide-slate-200 text-left text-xs">{children}</table></div>,
          th: ({ children }) => <th className="bg-slate-100 px-3 py-2 font-semibold text-slate-700">{children}</th>,
          td: ({ children }) => <td className="border-t border-slate-100 px-3 py-2 text-slate-600">{children}</td>,
          a: ({ children, href }) => <a className="font-medium text-indigo-600 underline underline-offset-2" href={href} rel="noreferrer" target="_blank">{children}</a>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ChatPanel() {
  const stableId = useId();
  const initialConversation = useMemo(
    () => ({ id: `conversation-${stableId}`, title: '新建对话', messages: [] as ChatMessage[], updatedAt: '' }),
    [stableId],
  );
  const [conversations, setConversations] = useState<ChatConversation[]>([initialConversation]);
  const [activeConversationId, setActiveConversationId] = useState(initialConversation.id);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(emptyAgentSettings);
  const [settingsStatus, setSettingsStatus] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [visibleSecretFields, setVisibleSecretFields] = useState<Partial<Record<keyof AgentSettings, boolean>>>({});
  const [editingConversationId, setEditingConversationId] = useState('');
  const [editingConversationTitle, setEditingConversationTitle] = useState('');
  const [pendingDeleteConversation, setPendingDeleteConversation] = useState<ChatConversation | null>(null);
  const messagesScrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const hasLoadedStoredConversationsRef = useRef(false);

  const activeConversation = conversations.find(conversation => conversation.id === activeConversationId) ?? conversations[0];
  const messages = useMemo(() => activeConversation?.messages ?? [], [activeConversation]);

  function hasMissingSettings(settings: AgentSettings) {
    return agentSettingFields.some(field => settings[field.key].trim().length === 0);
  }

  useEffect(() => {
    const loadStoredConversationTimer = window.setTimeout(() => {
      const storedConversations = parseStoredConversations(window.localStorage.getItem(conversationsStorageKey));
      const storedActiveConversationId = window.localStorage.getItem(activeConversationStorageKey);

      if (storedConversations.length > 0) {
        setConversations(storedConversations);
        setActiveConversationId(
          storedConversations.some(conversation => conversation.id === storedActiveConversationId)
            ? String(storedActiveConversationId)
            : storedConversations[0].id,
        );
      } else {
        setConversations(currentConversations =>
          currentConversations.map(conversation =>
            conversation.updatedAt === '' ? { ...conversation, updatedAt: new Date().toISOString() } : conversation,
          ),
        );
      }

      hasLoadedStoredConversationsRef.current = true;
    }, 0);

    return () => {
      window.clearTimeout(loadStoredConversationTimer);
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredConversationsRef.current) {
      return;
    }

    window.localStorage.setItem(conversationsStorageKey, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (!hasLoadedStoredConversationsRef.current) {
      return;
    }

    window.localStorage.setItem(activeConversationStorageKey, activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) {
      return;
    }

    const scrollTimer = window.setTimeout(() => {
      scrollMessagesToBottom('auto');
    }, 0);

    return () => {
      window.clearTimeout(scrollTimer);
    };
  }, [activeConversationId, messages]);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error('配置加载失败');
      }

      const data = (await response.json()) as { settings: AgentSettings };
      if (isMounted) {
        setAgentSettings(data.settings);
        if (hasMissingSettings(data.settings)) {
          setSettingsStatus('检测到配置信息不完整，请先补齐配置并保存。');
          setIsSettingsOpen(true);
        }
      }
    }

    loadSettings().catch(() => {
      if (isMounted) {
        setSettingsStatus('未获取到配置信息，请先完成助手配置。');
        setIsSettingsOpen(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initializeSession() {
      const response = await fetch('/api/session', { method: 'POST' });
      if (!response.ok) {
        throw new Error('会话初始化失败');
      }

      if (isMounted) {
        setSessionReady(true);
      }
    }

    initializeSession().catch(() => {
      if (!isMounted) {
        return;
      }

      updateConversationMessages(activeConversationId, [
        {
          id: createClientId('assistant'),
          role: 'assistant',
          content: '会话初始化失败，请检查服务端会话密钥配置。',
        },
      ], '初始化失败');
    });

    return () => {
      isMounted = false;
    };
  }, [activeConversationId]);

  function updateConversationMessages(conversationId: string, nextMessages: ChatMessage[], title?: string) {
    setConversations(currentConversations =>
      currentConversations.map(conversation =>
        conversation.id === conversationId
          ? {
              ...conversation,
              title: title ?? conversation.title,
              messages: nextMessages,
              updatedAt: new Date().toISOString(),
            }
          : conversation,
      ),
    );
  }

  function handleCreateConversation() {
    const nextConversation = createConversation();
    shouldStickToBottomRef.current = true;
    setConversations(currentConversations => [nextConversation, ...currentConversations]);
    setActiveConversationId(nextConversation.id);
    setInput('');
  }

  function handleSettingChange(settingKey: keyof AgentSettings, event: ChangeEvent<HTMLInputElement>) {
    setAgentSettings(currentSettings => ({ ...currentSettings, [settingKey]: event.target.value }));
    setSettingsStatus('');
  }

  async function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingSettings(true);
    setSettingsStatus('');

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentSettings),
      });

      if (!response.ok) {
        throw new Error('配置保存失败');
      }

      setSettingsStatus('保存成功，请刷新页面后生效。');
    } catch (error) {
      setSettingsStatus(error instanceof Error ? error.message : '配置保存失败');
    } finally {
      setIsSavingSettings(false);
    }
  }

  function handleReloadPage() {
    window.location.reload();
  }

  function toggleSecretFieldVisibility(settingKey: keyof AgentSettings) {
    setVisibleSecretFields(currentVisibleSecretFields => ({
      ...currentVisibleSecretFields,
      [settingKey]: !currentVisibleSecretFields[settingKey],
    }));
  }

  function scrollMessagesToBottom(behavior: ScrollBehavior = 'smooth') {
    const scrollContainer = messagesScrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    scrollContainer.scrollTo({
      top: scrollContainer.scrollHeight,
      behavior,
    });
  }

  function handleMessagesScroll() {
    const scrollContainer = messagesScrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    shouldStickToBottomRef.current = isNearScrollBottom(scrollContainer);
  }

  function handleConversationSelect(conversationId: string) {
    shouldStickToBottomRef.current = true;
    setActiveConversationId(conversationId);
  }

  function startRenameConversation(conversation: ChatConversation) {
    setEditingConversationId(conversation.id);
    setEditingConversationTitle(conversation.title);
  }

  function cancelRenameConversation() {
    setEditingConversationId('');
    setEditingConversationTitle('');
  }

  function saveRenameConversation() {
    const nextTitle = editingConversationTitle.trim();
    if (!editingConversationId || !nextTitle) {
      cancelRenameConversation();
      return;
    }

    setConversations(currentConversations =>
      currentConversations.map(conversation =>
        conversation.id === editingConversationId
          ? { ...conversation, title: nextTitle, updatedAt: new Date().toISOString() }
          : conversation,
      ),
    );
    cancelRenameConversation();
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveRenameConversation();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      cancelRenameConversation();
    }
  }

  function confirmDeleteConversation() {
    if (!pendingDeleteConversation) {
      return;
    }

    const nextConversations = conversations.filter(conversation => conversation.id !== pendingDeleteConversation.id);
    const fallbackConversation = nextConversations[0] ?? createConversation();
    const normalizedConversations = nextConversations.length > 0 ? nextConversations : [fallbackConversation];

    if (activeConversationId === pendingDeleteConversation.id) {
      shouldStickToBottomRef.current = true;
      setActiveConversationId(fallbackConversation.id);
    }

    setConversations(normalizedConversations);
    setPendingDeleteConversation(null);

    if (editingConversationId === pendingDeleteConversation.id) {
      cancelRenameConversation();
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();

    if (isLoading || !sessionReady || input.trim().length === 0) {
      return;
    }

    event.currentTarget.form?.requestSubmit();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const userInput = input.trim();
    if (!userInput || isLoading || !sessionReady || !activeConversation) {
      return;
    }

    const conversationId = activeConversation.id;
    const userMessage: ChatMessage = { id: createClientId('user'), role: 'user', content: userInput };
    const assistantMessage: ChatMessage = { id: createClientId('assistant'), role: 'assistant', content: '' };
    const nextMessages = [...activeConversation.messages, userMessage];
    const conversationTitle = activeConversation.messages.length === 0 ? userInput.slice(0, 18) : activeConversation.title;

    shouldStickToBottomRef.current = true;
    updateConversationMessages(conversationId, [...nextMessages, assistantMessage], conversationTitle);
    setInput('');
    setIsLoading(true);
    window.setTimeout(() => scrollMessagesToBottom('smooth'), 0);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          messages: nextMessages.map(message => ({ role: message.role, content: message.content })),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Agent 服务请求失败');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const responseChunk = decoder.decode(value, { stream: true });
        for (const character of responseChunk) {
          assistantContent += character;
          updateConversationMessages(conversationId, [...nextMessages, { ...assistantMessage, content: assistantContent }], conversationTitle);
          await wait(typewriterIntervalMs);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      updateConversationMessages(conversationId, [...nextMessages, { ...assistantMessage, content: errorMessage }], conversationTitle);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#f7f9ff] text-slate-950">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200/80 bg-white/95 shadow-xl shadow-slate-200/40 backdrop-blur-xl md:flex">
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-100">✦</div>
          <p className="text-sm font-semibold text-slate-800">智能助手</p>
          </div>
          <span className={`h-2.5 w-2.5 rounded-full ${sessionReady ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        </div>

        <div className="p-4">
          <button className="flex min-h-11 w-full items-center gap-3 rounded-2xl bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100" type="button" onClick={handleCreateConversation}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-indigo-300 text-sm leading-none">+</span>
            <span>新建对话</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="text-xs font-semibold text-slate-400">会话列表</p>
            <span className="text-xs text-slate-300">{conversations.length}</span>
          </div>
          <div className="space-y-1.5">
            {conversations.map(conversation => {
              const isActive = conversation.id === activeConversationId;
              const isEditing = conversation.id === editingConversationId;

              return (
                <div key={conversation.id} className={`group relative rounded-xl px-2.5 py-1.5 transition ${isActive ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>
                  {isEditing ? (
                    <div>
                      <input
                        autoFocus
                        className="min-h-8 w-full rounded-lg border border-indigo-200 bg-white px-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                        value={editingConversationTitle}
                        onChange={event => setEditingConversationTitle(event.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        onBlur={saveRenameConversation}
                      />
                    </div>
                  ) : (
                    <>
                      <button className="w-full text-left" type="button" onClick={() => handleConversationSelect(conversation.id)}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="line-clamp-1 text-xs font-semibold">{conversation.title}</p>
                          <span className="shrink-0 text-[0.68rem] text-slate-400 transition group-hover:opacity-0">{formatConversationTime(conversation.updatedAt)}</span>
                        </div>
                      </button>
                      <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 group-hover:flex">
                        <button className="rounded-md bg-white/90 px-1.5 py-0.5 text-[0.65rem] font-semibold text-slate-400 shadow-sm transition hover:text-indigo-600" type="button" onClick={() => startRenameConversation(conversation)}>
                          重命名
                        </button>
                        <button className="rounded-md bg-white/90 px-1.5 py-0.5 text-[0.65rem] font-semibold text-slate-400 shadow-sm transition hover:text-rose-600" type="button" onClick={() => setPendingDeleteConversation(conversation)}>
                          删除
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-50 text-lg text-indigo-700 md:hidden" type="button" onClick={handleCreateConversation} aria-label="新建对话">+</button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-xl bg-indigo-600 text-sm text-white">✦</span>
                <p className="truncate text-sm font-bold text-slate-950 sm:text-base">{activeConversation?.title || '新建对话'}</p>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">在线 · 工具守卫已开启</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700" href="/memories">记忆</Link>
            <button className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700" type="button" onClick={() => setIsSettingsOpen(true)}>配置</button>
            <span className="hidden rounded-2xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white sm:inline-flex">已守护</span>
          </div>
        </header>

        <div ref={messagesScrollContainerRef} className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,#eef2ff_0,#f8fafc_38%,#f7f9ff_100%)] px-4 py-6 sm:px-8" onScroll={handleMessagesScroll}>
          <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col">
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-white/70 px-6 py-12 text-center shadow-sm">
                <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600 text-2xl text-white shadow-xl shadow-indigo-200">✦</div>
                <h1 className="text-2xl font-bold text-slate-950">开始一次工具调用</h1>
                <p className="mt-3 max-w-md text-sm leading-7 text-slate-500">输入城市经纬度、业务查询或需要助手规划的问题，系统会自动完成安全校验与工具调用。</p>
              </div>
            ) : (
              <div className="space-y-7 pb-4">
                {messages.map(message => {
                  const isUserMessage = message.role === 'user';
                  return (
                    <article key={message.id} className={`flex gap-3 ${isUserMessage ? 'justify-end' : 'justify-start'}`}>
                      {!isUserMessage ? <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-sm text-white shadow-lg shadow-indigo-100">✦</div> : null}
                      <div className={`max-w-[86%] rounded-[1.5rem] px-5 py-4 text-sm leading-7 shadow-sm ${isUserMessage ? 'rounded-br-md bg-indigo-600 text-white shadow-indigo-100' : 'rounded-bl-md border border-slate-100 bg-white/95 text-slate-800'}`}>
                        <p className={`mb-1 text-xs font-semibold ${isUserMessage ? 'text-indigo-100' : 'text-slate-400'}`}>{isUserMessage ? '我' : 'AI 助手'}</p>
                        <MarkdownMessage content={message.content || '正在生成回复...'} isUserMessage={isUserMessage} />
                      </div>
                      {isUserMessage ? <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-bold text-white shadow-lg shadow-amber-100"></div> : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200/80 bg-white/85 px-4 py-4 backdrop-blur-xl sm:px-8">
          <form onSubmit={handleSubmit} className="mx-auto w-full max-w-5xl rounded-[1.7rem] border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-200/70">
            <div className="flex items-end gap-3">
              <textarea aria-label="输入你的需求" className="max-h-36 min-h-12 flex-1 resize-none rounded-2xl border-0 bg-transparent px-2 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50" placeholder={sessionReady ? '输入你的问题，Enter 发送，Shift + Enter 换行' : '正在初始化会话...'} value={input} onChange={event => setInput(event.target.value)} onKeyDown={handleInputKeyDown} disabled={isLoading || !sessionReady} rows={1} />
              <button className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-lg font-semibold text-white shadow-lg shadow-indigo-100 transition hover:-translate-y-0.5 hover:bg-indigo-500 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={isLoading || !sessionReady || input.trim().length === 0} aria-label="发送">
                {isLoading ? '…' : '➤'}
              </button>
            </div>
          </form>
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(pendingDeleteConversation)}
        title="删除会话"
        description={pendingDeleteConversation ? `确认删除「${pendingDeleteConversation.title}」吗？删除后无法恢复。` : ''}
        confirmText="删除"
        cancelText="取消"
        onCancel={() => setPendingDeleteConversation(null)}
        onConfirm={confirmDeleteConversation}
      />

      {isSettingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-[2rem] border border-white/70 bg-white p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-lg font-bold text-slate-950">助手配置</p>
                <p className="mt-1 text-sm text-slate-500">修改模型、服务地址、接口密钥和会话密钥。保存后需刷新页面生效。</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700" type="button" onClick={handleReloadPage}>刷新生效</button>
                <button aria-label="关闭配置弹窗" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-lg leading-none text-slate-500 transition hover:border-slate-300 hover:text-slate-900" type="button" onClick={() => setIsSettingsOpen(false)}>×</button>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="mt-5 grid gap-4 lg:grid-cols-2">
              {agentSettingFields.map(field => {
                const isSecretField = field.type === 'password';
                const isSecretVisible = Boolean(visibleSecretFields[field.key]);
                const inputType = isSecretField && isSecretVisible ? 'text' : field.type;

                return (
                  <label key={field.key} className="block">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <span>{field.label}（{field.chineseLabel}）</span>
                      <span className="group/help relative inline-grid h-4 w-4 place-items-center rounded-full border border-slate-300 text-[10px] text-slate-400">
                        ?
                        <span className="pointer-events-none absolute left-1/2 top-6 z-10 hidden w-56 -translate-x-1/2 rounded-xl bg-slate-950 px-3 py-2 text-left text-[11px] font-medium leading-5 text-white shadow-xl group-hover/help:block">
                          {field.description}
                        </span>
                      </span>
                    </span>
                    <span className="relative mt-2 block">
                      <input className={`min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 ${isSecretField ? 'pr-12' : ''}`} placeholder={field.placeholder} type={inputType} value={agentSettings[field.key]} onChange={event => handleSettingChange(field.key, event)} disabled={isSavingSettings} />
                      {isSecretField ? (
                        <button aria-label={isSecretVisible ? `隐藏 ${field.label}` : `显示 ${field.label}`} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" type="button" onClick={() => toggleSecretFieldVisibility(field.key)}>
                          {isSecretVisible ? '🙈' : '👁️'}
                        </button>
                      ) : null}
                    </span>
                  </label>
                );
              })}

              <div className="flex flex-col gap-3 lg:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">{settingsStatus || '配置将保存到 .env.local，不会在保存后自动重启服务。'}</p>
                <button className="min-h-11 rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-100 transition hover:-translate-y-0.5 hover:bg-indigo-500 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={isSavingSettings}>
                  {isSavingSettings ? '保存中' : '保存配置'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
