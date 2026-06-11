import { PlusOutlined } from '@ant-design/icons';
import { Button, Space } from 'antd';
import { KeyboardEvent } from 'react';
import styles from './Chat.module.css';
import type { ChatConversation } from './types';
import { ConversationList } from './ConversationList';

interface ConversationSidebarProps {
  conversations: ChatConversation[];
  activeConversationId: string;
  editingConversationId: string;
  editingConversationTitle: string;
  sessionReady: boolean;
  onCreateConversation: () => void;
  onConversationSelect: (conversationId: string) => void;
  onRenameStart: (conversation: ChatConversation) => void;
  onRenameTitleChange: (title: string) => void;
  onRenameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onRenameSave: () => void;
  onDeleteRequest: (conversation: ChatConversation) => void;
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  editingConversationId,
  editingConversationTitle,
  sessionReady,
  onCreateConversation,
  onConversationSelect,
  onRenameStart,
  onRenameTitleChange,
  onRenameKeyDown,
  onRenameSave,
  onDeleteRequest,
}: ConversationSidebarProps) {
  // 桌面端左侧栏：使用原生 aside 承载布局，避免 antd Layout.Sider 额外 DOM 影响样式。
  return (
    <aside className={styles.desktopSidebar}>
      <div className={styles.sidebarPanel}>
        <div className={styles.sidebarHeader}>
          <Space>
            <span className={styles.brandIcon}>✦</span>
            <strong>智能助手</strong>
          </Space>
          <span className={sessionReady ? `${styles.sessionStatus} ${styles.sessionStatusReady}` : `${styles.sessionStatus} ${styles.sessionStatusPending}`} />
        </div>

        <div className={styles.sidebarCreate}>
          <Button block className={styles.createButton} type="primary" icon={<PlusOutlined />} onClick={onCreateConversation}>
            新建对话
          </Button>
        </div>

        <div className={styles.sidebarListSection}>
          <div className={styles.listHeader}>
            <span className={styles.listHeaderTitle}>会话列表</span>
            <span className={styles.listCountBadge}>{conversations.length}</span>
          </div>
          <div className={styles.listScroll}>
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversationId}
              editingConversationId={editingConversationId}
              editingConversationTitle={editingConversationTitle}
              onConversationSelect={onConversationSelect}
              onRenameStart={onRenameStart}
              onRenameTitleChange={onRenameTitleChange}
              onRenameKeyDown={onRenameKeyDown}
              onRenameSave={onRenameSave}
              onDeleteRequest={onDeleteRequest}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
