import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Tooltip } from 'antd';
import { ChangeEvent, FormEvent } from 'react';
import styles from './Chat.module.less';
import type { AgentSettings } from './types';
import { agentSettingFields } from './settingsFields';

interface SettingsModalProps {
  agentSettings: AgentSettings;
  settingsStatus: string;
  isSavingSettings: boolean;
  visibleSecretFields: Partial<Record<keyof AgentSettings, boolean>>;
  onClose: () => void;
  onSettingChange: (settingKey: keyof AgentSettings, event: ChangeEvent<HTMLInputElement>) => void;
  onSecretVisibilityToggle: (settingKey: keyof AgentSettings) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function SettingsModal({
  agentSettings,
  settingsStatus,
  isSavingSettings,
  visibleSecretFields,
  onClose,
  onSettingChange,
  onSecretVisibilityToggle,
  onSubmit,
}: SettingsModalProps) {
  // 模型配置弹窗：使用 antd Modal、Input、Button 替换自研弹窗和输入框样式。
  return (
    <Modal centered footer={null} open title="助手配置" width={820} onCancel={onClose}>
      <p className={styles.settingsDescription}>
        修改模型、服务地址和接口密钥。配置仅保存在当前浏览器，不会写入服务器文件。
      </p>

      <Form component="form" layout="vertical" onSubmitCapture={onSubmit}>
        <div className={styles.settingsFormGrid}>
          {agentSettingFields.map(field => {
            const isSecretField = field.type === 'password';
            const isSecretVisible = Boolean(visibleSecretFields[field.key]);
            const inputType = isSecretField && isSecretVisible ? 'text' : field.type;

            return (
              <Form.Item
                key={field.key}
                label={
                  <span>
                    {field.label}（{field.chineseLabel}）{' '}
                    <Tooltip title={field.description}>
                      <span className={styles.mutedText}>?</span>
                    </Tooltip>
                  </span>
                }
              >
                <Input
                  placeholder={field.placeholder}
                  type={inputType}
                  value={agentSettings[field.key]}
                  disabled={isSavingSettings}
                  onChange={event => onSettingChange(field.key, event)}
                  suffix={
                    isSecretField ? (
                      <Button
                        aria-label={isSecretVisible ? `隐藏 ${field.label}` : `显示 ${field.label}`}
                        icon={isSecretVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        size="small"
                        type="text"
                        onClick={() => onSecretVisibilityToggle(field.key)}
                      />
                    ) : null
                  }
                />
              </Form.Item>
            );
          })}
        </div>

        <div className={styles.settingsActions}>
          <Button htmlType="submit" loading={isSavingSettings} type="primary">
            保存配置
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
