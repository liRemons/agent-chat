import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Drawer, Flex, Space } from 'antd';
import { KeyboardEvent } from 'react';
import styles from './Chat.module.css';
import type { ChatConversation } from './types';
import { ConversationList } from './ConversationList';

interface MobileConversationDrawerProps {
  open: boolean;
  conversations: ChatConversation[];
  activeConversationId: string;
  editingConversationId: string;
  editingConversationTitle: string;
  onClose: () => void;
  onCreateConversation: () => void;
  onConversationSelect: (conversationId: string) => void;
  onRenameStart: (conversation: ChatConversation) => void;
  onRenameTitleChange: (title: string) => void;
  onRenameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onRenameSave: () => void;
  onDeleteRequest: (conversation: ChatConversation) => void;
}

export function MobileConversationDrawer({
  open,
  conversations,
  activeConversationId,
  editingConversationId,
  editingConversationTitle,
  onClose,
  onCreateConversation,
  onConversationSelect,
  onRenameStart,
  onRenameTitleChange,
  onRenameKeyDown,
  onRenameSave,
  onDeleteRequest,
}: MobileConversationDrawerProps) {
  // 移动端会话抽屉：使用 antd Drawer 替代自研遮罩和滑入动画。
  return (
    <Drawer
      closeIcon={<CloseOutlined />}
      open={open}
      placement="left"
      size={300}
      title={
        <Space>
          <span className={styles.brandIcon}>✦</span>
          <span>智能助手</span>
        </Space>
      }
      rootClassName={styles.mobileDrawer}
      onClose={onClose}
    >
      <Flex className={styles.mobileDrawerContent} vertical gap={16}>
        <Button block className={styles.createButton} type="primary" icon={<PlusOutlined />} onClick={onCreateConversation}>
          新建对话
        </Button>
        <Flex align="center" className={styles.listHeader} justify="space-between">
          <span className={styles.listHeaderTitle}>会话列表</span>
          <span className={styles.listCountBadge}>{conversations.length}</span>
        </Flex>
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
      </Flex>
    </Drawer>
  );
}
