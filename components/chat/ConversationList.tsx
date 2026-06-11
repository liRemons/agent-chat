import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { Button, Input } from 'antd';
import { KeyboardEvent } from 'react';
import styles from './Chat.module.css';
import type { ChatConversation } from './types';
import { formatConversationTime } from './chatStorage';

interface ConversationListProps {
  conversations: ChatConversation[];
  activeConversationId: string;
  editingConversationId: string;
  editingConversationTitle: string;
  onConversationSelect: (conversationId: string) => void;
  onRenameStart: (conversation: ChatConversation) => void;
  onRenameTitleChange: (title: string) => void;
  onRenameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onRenameSave: () => void;
  onDeleteRequest: (conversation: ChatConversation) => void;
}

export function ConversationList({
  conversations,
  activeConversationId,
  editingConversationId,
  editingConversationTitle,
  onConversationSelect,
  onRenameStart,
  onRenameTitleChange,
  onRenameKeyDown,
  onRenameSave,
  onDeleteRequest,
}: ConversationListProps) {
  // 桌面侧栏和移动端抽屉共用同一份会话列表渲染逻辑，避免两端行为不一致。
  return (
    <div className={styles.conversationList}>
      {conversations.map(conversation => {
        const isActive = conversation.id === activeConversationId;
        const isEditing = conversation.id === editingConversationId;
        const itemClassName = isActive
          ? `${styles.conversationItem} ${styles.conversationItemActive}`
          : styles.conversationItem;

        return (
          <div className={itemClassName} key={conversation.id}>
            {isEditing ? (
              <Input
                autoFocus
                size="small"
                value={editingConversationTitle}
                onChange={event => onRenameTitleChange(event.target.value)}
                onKeyDown={onRenameKeyDown}
                onBlur={onRenameSave}
              />
            ) : (
              <>
                <button
                  className={styles.conversationTitleButton}
                  type="button"
                  onClick={() => onConversationSelect(conversation.id)}
                >
                  <span className={styles.conversationTitleContent}>
                    <span className={`${styles.conversationTitle} ${isActive ? styles.conversationTitleActive : ''}`}>
                      {conversation.title}
                    </span>
                    <span className={styles.conversationTime}>
                      {formatConversationTime(conversation.updatedAt)}
                    </span>
                  </span>
                </button>
                <span className={styles.conversationActions}>
                  <Button icon={<EditOutlined />} type="text" onClick={() => onRenameStart(conversation)} aria-label="重命名会话" />
                  <Button danger icon={<DeleteOutlined />} type="text" onClick={() => onDeleteRequest(conversation)} aria-label="删除会话" />
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
