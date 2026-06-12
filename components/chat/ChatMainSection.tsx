import { MenuOutlined, SendOutlined, SettingOutlined } from '@ant-design/icons';
import { Avatar, Button, Card, Empty, Flex, Input, Layout, Space } from 'antd';
import Link from 'next/link';
import { FormEvent, KeyboardEvent, RefObject } from 'react';
import styles from './Chat.module.less';
import type { ChatConversation, ChatMessage } from './types';
import { MarkdownMessage } from './MarkdownMessage';

interface ChatMainSectionProps {
  activeConversation?: ChatConversation;
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  sessionReady: boolean;
  messagesScrollContainerRef: RefObject<HTMLDivElement | null>;
  onDrawerOpen: () => void;
  onSettingsOpen: () => void;
  onMessagesScroll: () => void;
  onInputChange: (value: string) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function ChatMainSection({
  activeConversation,
  messages,
  input,
  isLoading,
  sessionReady,
  messagesScrollContainerRef,
  onDrawerOpen,
  onSettingsOpen,
  onMessagesScroll,
  onInputChange,
  onInputKeyDown,
  onSubmit,
}: ChatMainSectionProps) {
  // 右侧主聊天区域：用 antd Layout、Button、Input.TextArea、Card 等组件替换自研 Tailwind UI。
  return (
    <Layout className={styles.mainSection}>
      <Layout.Header className={styles.header}>
        <Flex align="center" className={styles.headerInner} justify="space-between" gap={16}>
          <Space className={styles.titleArea} size={12}>
            <Button className={styles.mobileMenuButton} icon={<MenuOutlined />} type="text" onClick={onDrawerOpen} aria-label="打开会话列表" />
            <Avatar className={styles.assistantAvatar}>✦</Avatar>
            <div className={styles.titleText}>
              <strong className={styles.title}>
                {activeConversation?.title || '新建对话'}
              </strong>
              <span className={styles.subtitle}>
                {sessionReady ? '在线' : '离线'}
              </span>
            </div>
          </Space>
          <Space className={styles.headerActions}>
            <Link href="/memories"><Button>记忆</Button></Link>
            <Button icon={<SettingOutlined />} onClick={onSettingsOpen}>配置</Button>
            <Button className={styles.guardedButton} type="primary">已守护</Button>
          </Space>
        </Flex>
      </Layout.Header>

      <Layout.Content ref={messagesScrollContainerRef} className={styles.messageScroll} onScroll={onMessagesScroll}>
        <div className={styles.messageContainer}>
          {messages.length === 0 ? (
            <Card className={styles.emptyCard}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Space orientation="vertical" size={8}>
                    <h3 className={styles.emptyTitle}>开始一次工具调用</h3>
                    <span className={styles.mutedText}>输入城市经纬度、业务查询或需要助手规划的问题，系统会自动完成安全校验与工具调用。</span>
                  </Space>
                }
              />
            </Card>
          ) : (
            <Flex vertical gap={16}>
              {messages.map(message => {
                const isUserMessage = message.role === 'user';
                const bubbleClassName = isUserMessage
                  ? `${styles.bubble} ${styles.userBubble}`
                  : `${styles.bubble} ${styles.assistantBubble}`;

                return (
                  <Flex key={message.id} justify={isUserMessage ? 'flex-end' : 'flex-start'} gap={12}>
                    {!isUserMessage ? <Avatar className={styles.assistantAvatar}>✦</Avatar> : null}
                    <Card className={bubbleClassName}>
                      <span className={isUserMessage ? styles.bubbleRole : `${styles.bubbleRole} ${styles.mutedText}`}>
                        {isUserMessage ? '我' : 'AI 助手'}
                      </span>
                      <MarkdownMessage
                        content={message.content}
                        isGenerating={!isUserMessage && isLoading && message.content.length === 0}
                        isUserMessage={isUserMessage}
                      />
                    </Card>
                    {isUserMessage ? <Avatar className={styles.userAvatar}>我</Avatar> : null}
                  </Flex>
                );
              })}
            </Flex>
          )}
        </div>
      </Layout.Content>

      <Layout.Footer className={styles.inputFooter}>
        <form onSubmit={onSubmit} className={styles.inputForm}>
          <Input.TextArea
            className={styles.messageInput}
            autoSize={{ minRows: 1, maxRows: 5 }}
            aria-label="输入你的需求"
            placeholder={sessionReady ? '输入你的问题，Enter 发送，Shift + Enter 换行' : '正在初始化会话...'}
            value={input}
            disabled={isLoading || !sessionReady}
            onChange={event => onInputChange(event.target.value)}
            onKeyDown={onInputKeyDown}
          />
          <Button
            htmlType="submit"
            icon={<SendOutlined />}
            loading={isLoading}
            type="primary"
            disabled={!sessionReady || input.trim().length === 0}
            aria-label="发送"
          />
        </form>
      </Layout.Footer>
    </Layout>
  );
}
