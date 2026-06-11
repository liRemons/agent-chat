'use client';

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { ChatMainSection } from './chat/ChatMainSection';
import { ConversationSidebar } from './chat/ConversationSidebar';
import { MobileConversationDrawer } from './chat/MobileConversationDrawer';
import { SettingsModal } from './chat/SettingsModal';
import { agentSettingFields } from './chat/settingsFields';
import styles from './chat/Chat.module.css';
import {
  activeConversationStorageKey,
  agentSettingsStorageKey,
  conversationsStorageKey,
  createClientId,
  createConversation,
  emptyAgentSettings,
  isNearScrollBottom,
  parseStoredAgentSettings,
  parseStoredConversations,
  typewriterIntervalMs,
  wait,
} from './chat/chatStorage';
import type { AgentSettings, ChatConversation, ChatMessage } from './chat/types';

export function ChatPanel() {
  // 聊天页主组件：现在只负责状态编排和事件处理，具体 UI 已拆到 components/chat/*。
  const stableId = useId();
  // 首屏先创建一个稳定 ID 的空会话，等 localStorage 加载完成后再替换成真实历史会话。
  const initialConversation = useMemo(
    () => ({ id: `conversation-${stableId}`, title: '新建对话', messages: [] as ChatMessage[], updatedAt: '' }),
    [stableId],
  );
  // conversations 是整个会话列表；activeConversationId 决定右侧正在展示哪一条会话。
  const [conversations, setConversations] = useState<ChatConversation[]>([initialConversation]);
  const [activeConversationId, setActiveConversationId] = useState(initialConversation.id);
  // input 只保存输入框当前内容；真正进入历史记录的是提交时创建的 userMessage。
  const [input, setInput] = useState('');
  // isLoading 表示当前正在等待 Agent 回复，用于禁用输入和展示生成中状态。
  const [isLoading, setIsLoading] = useState(false);
  // sessionReady 表示服务端已经写入签名 Cookie，之后 /api/chat 才能通过鉴权。
  const [sessionReady, setSessionReady] = useState(false);
  // 模型配置只保存在浏览器 localStorage，每次聊天请求都会随 body 提交到服务端。
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(emptyAgentSettings);
  const [settingsStatus, setSettingsStatus] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // 抽屉分成“是否打开”和“是否渲染”两个状态，关闭时才能先播放动画再卸载 DOM。
  const [isMobileConversationDrawerOpen, setIsMobileConversationDrawerOpen] = useState(false);
  const [shouldRenderMobileConversationDrawer, setShouldRenderMobileConversationDrawer] = useState(false);
  // 密钥输入框默认用 password 类型，用户点击眼睛按钮后才临时明文展示。
  const [visibleSecretFields, setVisibleSecretFields] = useState<Partial<Record<keyof AgentSettings, boolean>>>({});
  // 重命名状态独立保存，用户取消时不会提前污染真实会话标题。
  const [editingConversationId, setEditingConversationId] = useState('');
  const [editingConversationTitle, setEditingConversationTitle] = useState('');
  // pendingDeleteConversation 不为空时展示二次确认弹窗。
  const [pendingDeleteConversation, setPendingDeleteConversation] = useState<ChatConversation | null>(null);
  const messagesScrollContainerRef = useRef<HTMLDivElement>(null);
  // shouldStickToBottomRef 不触发渲染，只记录“新消息来时是否应该自动滚到底部”。
  const shouldStickToBottomRef = useRef(true);
  // 防止首屏从 localStorage 恢复数据前，把默认空会话反向写回覆盖历史记录。
  const hasLoadedStoredConversationsRef = useRef(false);

  const activeConversation = conversations.find(conversation => conversation.id === activeConversationId) ?? conversations[0];
  // messages 只跟随当前会话变化，避免渲染时到处写 activeConversation?.messages。
  const messages = useMemo(() => activeConversation?.messages ?? [], [activeConversation]);

  useEffect(() => {
    // 移动端抽屉关闭后延迟卸载，让侧滑退出动画有时间播放。
    if (isMobileConversationDrawerOpen || !shouldRenderMobileConversationDrawer) {
      return;
    }

    const drawerCloseTimer = window.setTimeout(() => {
      setShouldRenderMobileConversationDrawer(false);
    }, 220);

    return () => {
      window.clearTimeout(drawerCloseTimer);
    };
  }, [isMobileConversationDrawerOpen, shouldRenderMobileConversationDrawer]);

  function closeMobileConversationDrawer() {
    // 只切换打开状态，真正卸载由上面的 useEffect 延迟完成。
    setIsMobileConversationDrawerOpen(false);
  }

  function openMobileConversationDrawer() {
    // 先渲染抽屉，再在下一帧设置打开状态，否则浏览器没有机会播放 translate 动画。
    setShouldRenderMobileConversationDrawer(true);
    window.requestAnimationFrame(() => {
      setIsMobileConversationDrawerOpen(true);
    });
  }

  function hasMissingSettings(settings: AgentSettings) {
    // 提交聊天前必须保证三个模型字段都填写，否则服务端无法创建 ChatOpenAI。
    return agentSettingFields.some(field => settings[field.key].trim().length === 0);
  }

  useEffect(() => {
    // 首次进入页面时恢复历史会话和上次选中的会话。
    const loadStoredConversationTimer = window.setTimeout(() => {
      const storedConversations = parseStoredConversations(window.localStorage.getItem(conversationsStorageKey));
      const storedActiveConversationId = window.localStorage.getItem(activeConversationStorageKey);

      if (storedConversations.length > 0) {
        // 有历史数据时直接恢复，并尽量保持用户上次正在查看的会话。
        setConversations(storedConversations);
        setActiveConversationId(
          storedConversations.some(conversation => conversation.id === storedActiveConversationId)
            ? String(storedActiveConversationId)
            : storedConversations[0].id,
        );
      } else {
        // 没有历史数据时给首个默认会话补更新时间，保证列表时间展示正常。
        setConversations(currentConversations =>
          currentConversations.map(conversation =>
            conversation.updatedAt === '' ? { ...conversation, updatedAt: new Date().toISOString() } : conversation,
          ),
        );
      }

      hasLoadedStoredConversationsRef.current = true;
      // 标记恢复完成后，后续 conversations/activeConversationId 变化才允许写回 localStorage。
    }, 0);

    return () => {
      window.clearTimeout(loadStoredConversationTimer);
    };
  }, []);

  useEffect(() => {
    // 会话列表变化后写回浏览器；首轮恢复完成前不写，避免覆盖历史。
    if (!hasLoadedStoredConversationsRef.current) {
      return;
    }

    window.localStorage.setItem(conversationsStorageKey, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    // 当前会话切换后持久化 ID，下次刷新页面可以回到同一条会话。
    if (!hasLoadedStoredConversationsRef.current) {
      return;
    }

    window.localStorage.setItem(activeConversationStorageKey, activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    // 新消息或切换会话后，如果用户原本就在底部附近，就自动滚到最新消息。
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
    // 页面加载后恢复当前浏览器保存的模型配置；缺配置时主动打开配置弹窗。
    const loadStoredAgentSettingsTimer = window.setTimeout(() => {
      const storedAgentSettings = parseStoredAgentSettings(window.localStorage.getItem(agentSettingsStorageKey));
      setAgentSettings(storedAgentSettings);

      if (hasMissingSettings(storedAgentSettings)) {
        setSettingsStatus('模型配置仅保存在当前浏览器，请先补齐配置并保存。');
        setIsSettingsOpen(true);
      }
    }, 0);

    return () => {
      window.clearTimeout(loadStoredAgentSettingsTimer);
    };
  }, []);

  useEffect(() => {
    // 初始化匿名会话 Cookie。后续聊天接口会用这个 Cookie 识别当前浏览器会话。
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
    // 所有消息更新都走这里，确保更新时间和标题同步刷新。
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
    // 新建会话放到列表顶部，并切换为当前会话；移动端抽屉中点击后顺便关闭抽屉。
    const nextConversation = createConversation();
    shouldStickToBottomRef.current = true;
    setConversations(currentConversations => [nextConversation, ...currentConversations]);
    setActiveConversationId(nextConversation.id);
    setInput('');
    closeMobileConversationDrawer();
  }

  function handleSettingChange(settingKey: keyof AgentSettings, event: ChangeEvent<HTMLInputElement>) {
    // 用户修改任意配置字段后清空状态文案，避免旧的成功/失败提示误导用户。
    setAgentSettings(currentSettings => ({ ...currentSettings, [settingKey]: event.target.value }));
    setSettingsStatus('');
  }

  function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    // 配置只保存到当前浏览器 localStorage，不写服务器文件，也不会影响其他访问者。
    event.preventDefault();
    setIsSavingSettings(true);
    setSettingsStatus('');

    try {
      window.localStorage.setItem(agentSettingsStorageKey, JSON.stringify(agentSettings));
      setSettingsStatus('保存成功。配置仅保存在当前浏览器，不会写入服务器文件。');
      setIsSettingsOpen(false);
    } catch (error) {
      setSettingsStatus(error instanceof Error ? error.message : '配置保存失败');
    } finally {
      setIsSavingSettings(false);
    }
  }

  function toggleSecretFieldVisibility(settingKey: keyof AgentSettings) {
    // 只切换指定密钥字段的可见性，不改变真实配置值。
    setVisibleSecretFields(currentVisibleSecretFields => ({
      ...currentVisibleSecretFields,
      [settingKey]: !currentVisibleSecretFields[settingKey],
    }));
  }

  function scrollMessagesToBottom(behavior: ScrollBehavior = 'smooth') {
    // 消息容器不存在时直接返回，避免首屏或卸载阶段访问空 DOM。
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
    // 用户滚动时实时记录是否靠近底部，决定后续流式回复是否自动跟随。
    const scrollContainer = messagesScrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    shouldStickToBottomRef.current = isNearScrollBottom(scrollContainer);
  }

  function handleConversationSelect(conversationId: string) {
    // 切换会话时默认滚到底部，因为用户通常想看该会话最新内容。
    shouldStickToBottomRef.current = true;
    setActiveConversationId(conversationId);
    closeMobileConversationDrawer();
  }

  function startRenameConversation(conversation: ChatConversation) {
    // 进入重命名态时先复制当前标题，输入框修改不会立刻影响真实会话。
    setEditingConversationId(conversation.id);
    setEditingConversationTitle(conversation.title);
  }

  function cancelRenameConversation() {
    // 清空重命名临时状态，列表项会回到普通展示模式。
    setEditingConversationId('');
    setEditingConversationTitle('');
  }

  function saveRenameConversation() {
    // 空标题不保存，直接取消编辑，避免出现无名称会话。
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
    // Enter 保存，Escape 取消；阻止默认行为是为了避免触发表单或焦点副作用。
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
    // 真正删除会话的逻辑只在确认弹窗点击“删除”后执行。
    if (!pendingDeleteConversation) {
      return;
    }

    const nextConversations = conversations.filter(conversation => conversation.id !== pendingDeleteConversation.id);
    // 删除最后一条会话时自动创建兜底会话，保证页面始终有可展示的 activeConversation。
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
    // 普通 Enter 发送，Shift + Enter 换行；中文输入法组合中不发送，避免误提交。
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
    // 提交入口：把用户输入写入当前会话，调用 /api/chat，再把流式返回逐字追加到助手消息。
    event.preventDefault();

    const userInput = input.trim();
    if (!userInput || isLoading || !sessionReady || !activeConversation) {
      return;
    }

    if (hasMissingSettings(agentSettings)) {
      // 模型配置不完整时不发请求，直接引导用户补齐当前浏览器配置。
      setSettingsStatus('模型配置仅保存在当前浏览器，请先补齐配置并保存。');
      setIsSettingsOpen(true);
      return;
    }

    const conversationId = activeConversation.id;
    // 先创建一条空助手消息占位，后续流式内容会不断替换它的 content。
    const userMessage: ChatMessage = { id: createClientId('user'), role: 'user', content: userInput };
    const assistantMessage: ChatMessage = { id: createClientId('assistant'), role: 'assistant', content: '' };
    const nextMessages = [...activeConversation.messages, userMessage];
    const conversationTitle = activeConversation.messages.length === 0 ? userInput.slice(0, 18) : activeConversation.title;

    shouldStickToBottomRef.current = true;
    // 立即把用户消息和助手占位消息写入界面，让用户看到请求已经开始。
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
          // 只把 role/content 发给服务端，前端内部 id 不参与 Agent 上下文。
          messages: nextMessages.map(message => ({ role: message.role, content: message.content })),
          settings: agentSettings,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Agent 服务请求失败');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      // assistantContent 保存当前已经收到的完整回复；每收到一段流就追加并刷新界面。
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const responseChunk = decoder.decode(value, { stream: true });
        // 服务端按文本流返回，这里逐字符写入，形成可感知的打字机效果。
        for (const character of responseChunk) {
          assistantContent += character;
          updateConversationMessages(conversationId, [...nextMessages, { ...assistantMessage, content: assistantContent }], conversationTitle);
          await wait(typewriterIntervalMs);
        }
      }
    } catch (error) {
      // 请求失败时仍复用助手消息气泡展示错误，避免页面静默失败。
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      updateConversationMessages(conversationId, [...nextMessages, { ...assistantMessage, content: errorMessage }], conversationTitle);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className={`${styles.appShell} ${styles.chatShell}`}>
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        editingConversationId={editingConversationId}
        editingConversationTitle={editingConversationTitle}
        sessionReady={sessionReady}
        onCreateConversation={handleCreateConversation}
        onConversationSelect={handleConversationSelect}
        onRenameStart={startRenameConversation}
        onRenameTitleChange={setEditingConversationTitle}
        onRenameKeyDown={handleRenameKeyDown}
        onRenameSave={saveRenameConversation}
        onDeleteRequest={setPendingDeleteConversation}
      />

      <ChatMainSection
        activeConversation={activeConversation}
        messages={messages}
        input={input}
        isLoading={isLoading}
        sessionReady={sessionReady}
        messagesScrollContainerRef={messagesScrollContainerRef}
        onDrawerOpen={openMobileConversationDrawer}
        onSettingsOpen={() => setIsSettingsOpen(true)}
        onMessagesScroll={handleMessagesScroll}
        onInputChange={setInput}
        onInputKeyDown={handleInputKeyDown}
        onSubmit={handleSubmit}
      />

      {shouldRenderMobileConversationDrawer ? (
        <MobileConversationDrawer
          open={isMobileConversationDrawerOpen}
          conversations={conversations}
          activeConversationId={activeConversationId}
          editingConversationId={editingConversationId}
          editingConversationTitle={editingConversationTitle}
          onClose={closeMobileConversationDrawer}
          onCreateConversation={handleCreateConversation}
          onConversationSelect={handleConversationSelect}
          onRenameStart={startRenameConversation}
          onRenameTitleChange={setEditingConversationTitle}
          onRenameKeyDown={handleRenameKeyDown}
          onRenameSave={saveRenameConversation}
          onDeleteRequest={setPendingDeleteConversation}
        />
      ) : null}

      {/* 删除会话确认框：pendingDeleteConversation 存在时打开，确认后才真正删除。 */}
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
        <SettingsModal
          agentSettings={agentSettings}
          settingsStatus={settingsStatus}
          isSavingSettings={isSavingSettings}
          visibleSecretFields={visibleSecretFields}
          onClose={() => setIsSettingsOpen(false)}
          onSettingChange={handleSettingChange}
          onSecretVisibilityToggle={toggleSecretFieldVisibility}
          onSubmit={handleSaveSettings}
        />
      ) : null}
    </main>
  );
}
