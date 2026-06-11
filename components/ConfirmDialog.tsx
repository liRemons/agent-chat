'use client';

import { ExclamationCircleOutlined } from '@ant-design/icons';
import { Modal } from 'antd';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isConfirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  isConfirming = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  // 使用 antd Modal 替代自研遮罩、动画和按钮状态。
  return (
    <Modal
      centered
      open={open}
      title={title}
      okText={confirmText}
      cancelText={cancelText}
      okButtonProps={{ danger: true }}
      confirmLoading={isConfirming}
      onCancel={onCancel}
      onOk={onConfirm}
    >
      <div className={styles.content}>
        <ExclamationCircleOutlined className={styles.icon} />
        <span>{description}</span>
      </div>
    </Modal>
  );
}
