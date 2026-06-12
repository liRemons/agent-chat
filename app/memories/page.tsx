'use client';

import Link from 'next/link';
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Flex, Form, Input, Modal, Select, Space, Spin, Tag } from 'antd';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useAppMessage } from '@/components/AppMessage';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import styles from './Memories.module.less';

type MemoryScope = 'project' | 'global';
// memory 表示长期记忆文件，prompt 表示用户可复用的常用提示词文件。
type MemoryKind = 'memory' | 'prompt';
// 这四类和记忆系统 frontmatter 的 type 字段保持一致，用于区分保存目的。
type MemoryType = 'preference' | 'feedback' | 'insight' | 'reference';
interface MemoryItem {
  // id 存储在浏览器 localStorage 中，用来稳定选中某一条记录。
  id: string;
  // scope 仅用于前端分类筛选，当前临时统一保存到浏览器 localStorage。
  scope: MemoryScope;
  // kind 决定它在页面上展示为记忆还是常用提示词。
  kind: MemoryKind;
  // title 和 summary 通常来自 md 文件 frontmatter 的 name/description。
  title: string;
  summary: string;
  // fileName 用作本地条目的展示标识，不会写入磁盘。
  fileName: string;
  // content 是完整 md 内容，页面预览时会去掉 frontmatter。
  content: string;
}

interface MemoryFormState {
  // 新增弹窗里的所有字段集中存在 formState，提交时保存到浏览器 localStorage。
  scope: MemoryScope;
  kind: MemoryKind;
  memoryType: MemoryType;
  title: string;
  summary: string;
  content: string;
}

const emptyFormState: MemoryFormState = {
  // 默认创建项目级记忆，避免用户不小心把只属于当前项目的内容写到全局。
  scope: 'project',
  kind: 'memory',
  memoryType: 'preference',
  title: '',
  summary: '',
  content: '',
};

const scopeLabels: Record<MemoryScope, string> = {
  project: '项目级',
  global: '全局',
};

const kindLabels: Record<MemoryKind, string> = {
  memory: '记忆',
  prompt: '常用提示词',
};

const memoryTypeLabels: Record<MemoryType, string> = {
  preference: '偏好',
  feedback: '反馈',
  insight: '洞察',
  reference: '参考',
};

function getContentPreview(content: string) {
  // 记忆文件带 frontmatter，这里只截取真正的正文给页面预览。
  const frontmatterEndIndex = content.indexOf('---', 4);
  const contentWithoutFrontmatter = frontmatterEndIndex >= 0 ? content.slice(frontmatterEndIndex + 3) : content;
  return contentWithoutFrontmatter.trim() || '暂无正文';
}

function getMemoryDirectoryLabel() {
  return '浏览器本地存储（临时）';
}

const memoriesStorageKey = 'agent-chat:memories';

function createSlug(value: string) {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');

  return normalizedValue || 'untitled';
}

function createFrontmatter(title: string, summary: string, content: string, memoryType: MemoryType) {
  const createdAt = new Date().toISOString().slice(0, 19);

  return `---\nname: ${title}\ndescription: ${summary}\ntype: ${memoryType}\ncreatedAt: ${createdAt}\n---\n${content.trim()}\n`;
}

function readStoredMemories() {
  const rawValue = window.localStorage.getItem(memoriesStorageKey);
  if (!rawValue) {
    return [];
  }

  const parsedValue = JSON.parse(rawValue) as unknown;
  if (!Array.isArray(parsedValue)) {
    return [];
  }

  return parsedValue as MemoryItem[];
}

function writeStoredMemories(items: MemoryItem[]) {
  window.localStorage.setItem(memoriesStorageKey, JSON.stringify(items));
}

function createMemoryItem(formState: MemoryFormState): MemoryItem {
  const title = formState.title.trim();
  const summary = formState.summary.trim();
  const content = formState.content.trim();

  if (!title || !summary || !content) {
    throw new Error('请补全标题、摘要和正文后再保存。');
  }

  const memoryType = formState.kind === 'prompt' ? 'reference' : formState.memoryType;
  const filePrefix = formState.kind === 'prompt' ? 'prompt' : memoryType;
  const fileName = `${filePrefix}_${createSlug(title)}.md`;
  const id = `${formState.scope}:${Date.now()}:${fileName}`;

  return {
    id,
    scope: formState.scope,
    kind: formState.kind,
    title,
    summary,
    fileName,
    content: createFrontmatter(title, summary, content, memoryType),
  };
}

export default function MemoriesPage() {
  // 记忆中心页面：负责展示、筛选、新增和删除项目级/全局级记忆。
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [formState, setFormState] = useState<MemoryFormState>(emptyFormState);
  const [activeScope, setActiveScope] = useState<MemoryScope | 'all'>('all');
  const [activeKind, setActiveKind] = useState<MemoryKind | 'all'>('all');
  const [selectedItemId, setSelectedItemId] = useState('');
  const { message, contextHolder } = useAppMessage();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState('');
  const [pendingDeleteItem, setPendingDeleteItem] = useState<MemoryItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const filteredItems = useMemo(() => {
    // 根据左侧筛选条件过滤记忆列表，all 表示不过滤。
    return items.filter(item => {
      const scopeMatched = activeScope === 'all' || item.scope === activeScope;
      const kindMatched = activeKind === 'all' || item.kind === activeKind;
      return scopeMatched && kindMatched;
    });
  }, [activeKind, activeScope, items]);

  const selectedItem = useMemo(
    () => filteredItems.find(item => item.id === selectedItemId) ?? filteredItems[0] ?? null,
    [filteredItems, selectedItemId],
  );
  // 详情区只展示当前筛选结果里的条目，避免筛选后仍显示已被过滤掉的旧选中项。

  const loadMemories = useCallback(() => {
    setIsLoading(true);
    try {
      const storedItems = readStoredMemories();
      setItems(storedItems);
      setSelectedItemId(currentSelectedItemId => currentSelectedItemId || storedItems[0]?.id || '');
    } catch {
      message.error('记忆加载失败，请检查浏览器本地存储是否可用。');
    } finally {
      setIsLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  function updateFormField<FieldName extends keyof MemoryFormState>(fieldName: FieldName, value: MemoryFormState[FieldName]) {
    // 表单字段统一从这里更新，保证新增弹窗的状态结构始终完整。
    setFormState(currentFormState => ({
      ...currentFormState,
      [fieldName]: value,
    }));
  }

  function handleCreateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const nextItem = createMemoryItem(formState);
      const nextItems = [...items, nextItem];
      writeStoredMemories(nextItems);
      setItems(nextItems);
      setSelectedItemId(nextItem.id);
      setFormState(currentFormState => ({
        ...emptyFormState,
        scope: currentFormState.scope,
        kind: currentFormState.kind,
        memoryType: currentFormState.memoryType,
      }));
      message.success('保存成功，已写入浏览器本地存储。');
      setIsCreateModalOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败，请检查浏览器本地存储是否可用。');
    } finally {
      setIsSaving(false);
    }
  }

  function requestDeleteItem(item: MemoryItem) {
    // 这里只记录待删除项，真正删除动作交给 ConfirmDialog 的确认按钮。
    setPendingDeleteItem(item);
  }

  function confirmDeleteItem() {
    if (!pendingDeleteItem) {
      return;
    }

    const item = pendingDeleteItem;
    setDeletingItemId(item.id);
    try {
      const nextItems = items.filter(currentItem => currentItem.id !== item.id);
      writeStoredMemories(nextItems);
      setItems(nextItems);
      setSelectedItemId(nextItems[0]?.id || '');
      setPendingDeleteItem(null);
      message.success('删除成功，已同步更新浏览器本地存储。');
    } catch {
      message.error('删除失败，请检查浏览器本地存储是否可用。');
    } finally {
      setDeletingItemId('');
    }
  }

  return (
    <main className={styles.page}>
      {/* antd App Provider 已经接管 message 容器，这里保留兼容返回值。 */}
      {contextHolder}
      <div className={styles.layout}>
        <Card>
          <Flex align="flex-start" justify="space-between" gap={16}>
            <div>
              <span className={styles.mutedText}>记忆中心</span>
              <h2 className={styles.title}>记忆 / 常用提示词</h2>
              <p className={styles.description}>
                查看、创建和删除项目级或全局级配置。
              </p>
            </div>
            <Space orientation="vertical">
              <Button icon={<PlusOutlined />} type="primary" onClick={() => setIsCreateModalOpen(true)}>
                新增
              </Button>
              <Link href="/">
                <Button icon={<ArrowLeftOutlined />}>返回</Button>
              </Link>
            </Space>
          </Flex>

          <div className={styles.filterGroup}>
            <div className={styles.segmentedFilter}>
              {([
                { label: '全部范围', value: 'all' },
                { label: scopeLabels.project, value: 'project' },
                { label: scopeLabels.global, value: 'global' },
              ] as Array<{ label: string; value: MemoryScope | 'all' }>).map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={activeScope === option.value ? `${styles.filterButton} ${styles.filterButtonActive}` : styles.filterButton}
                  onClick={() => setActiveScope(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className={styles.segmentedFilter}>
              {([
                { label: '全部类型', value: 'all' },
                { label: kindLabels.memory, value: 'memory' },
                { label: kindLabels.prompt, value: 'prompt' },
              ] as Array<{ label: string; value: MemoryKind | 'all' }>).map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={activeKind === option.value ? `${styles.filterButton} ${styles.filterButtonActive}` : styles.filterButton}
                  onClick={() => setActiveKind(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.listSection}>
            {isLoading ? (
              <div className={styles.listLoading}>
                <Spin description="加载记忆中" />
              </div>
            ) : filteredItems.length === 0 ? (
              <Empty className={styles.emptyList} description="暂无匹配项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div className={styles.memoryList}>
                {filteredItems.map(item => {
                  const cardClassName = selectedItem?.id === item.id
                    ? `${styles.memoryCard} ${styles.memoryCardActive}`
                    : styles.memoryCard;

                  return (
                    <Card
                      hoverable
                      key={item.id}
                      size="small"
                      onClick={() => setSelectedItemId(item.id)}
                      className={cardClassName}
                    >
                      <Space size={6} wrap>
                        <Tag color="blue">{scopeLabels[item.scope]}</Tag>
                        <Tag>{kindLabels[item.kind]}</Tag>
                      </Space>
                      <strong className={styles.cardTitle}>
                        {item.title}
                      </strong>
                      <p className={styles.cardSummary}>
                        {item.summary}
                      </p>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card
          title={
            <div>
              <span className={styles.mutedText}>当前选中</span>
              <h3 className={styles.detailTitle}>
                {selectedItem?.title || '暂无记忆'}
              </h3>
            </div>
          }
          extra={
            selectedItem ? (
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={deletingItemId === selectedItem.id}
                onClick={() => requestDeleteItem(selectedItem)}
              >
                删除
              </Button>
            ) : null
          }
        >
          {selectedItem ? (
            <Space className={styles.detailTags} size={8} wrap>
              <Tag color="blue">{scopeLabels[selectedItem.scope]}</Tag>
              <Tag>{kindLabels[selectedItem.kind]}</Tag>
              <Tag color="green">{selectedItem.fileName}</Tag>
              <Tag color="cyan">{getMemoryDirectoryLabel()}</Tag>
            </Space>
          ) : null}
          <Card className={styles.contentPreview} type="inner">
            <p className={styles.previewText}>
              {selectedItem ? getContentPreview(selectedItem.content) : '左侧选择一条记忆，或点击新增按钮创建。'}
            </p>
          </Card>
        </Card>
      </div>

      <Modal
        centered
        footer={null}
        open={isCreateModalOpen}
        title="新增条目"
        width={720}
        onCancel={() => setIsCreateModalOpen(false)}
      >
        <p className={styles.description}>
          保存到：{getMemoryDirectoryLabel()}。
        </p>
        <Form component="form" layout="vertical" onSubmitCapture={handleCreateItem}>
          <Form.Item label="范围">
            <Select
              value={formState.scope}
              onChange={value => updateFormField('scope', value)}
              options={[
                { label: '项目级', value: 'project' },
                { label: '全局', value: 'global' },
              ]}
            />
          </Form.Item>

          <Form.Item label="类型">
            <Select
              value={formState.kind}
              onChange={value => updateFormField('kind', value)}
              options={[
                { label: '记忆', value: 'memory' },
                { label: '常用提示词', value: 'prompt' },
              ]}
            />
          </Form.Item>

          {formState.kind === 'memory' ? (
            <Form.Item label="记忆分类">
              <Select
                value={formState.memoryType}
                onChange={value => updateFormField('memoryType', value)}
                options={Object.entries(memoryTypeLabels).map(([memoryType, label]) => ({ label, value: memoryType }))}
              />
            </Form.Item>
          ) : null}

          <Form.Item label="标题">
            <Input
              placeholder="例如：代码评审常用提示词"
              value={formState.title}
              onChange={event => updateFormField('title', event.target.value)}
            />
          </Form.Item>

          <Form.Item label="摘要">
            <Input
              placeholder="用于索引的一句话说明"
              value={formState.summary}
              onChange={event => updateFormField('summary', event.target.value)}
            />
          </Form.Item>

          <Form.Item label="正文">
            <Input.TextArea
              autoSize={{ minRows: 7, maxRows: 14 }}
              placeholder="写入提示词或记忆正文"
              value={formState.content}
              onChange={event => updateFormField('content', event.target.value)}
            />
          </Form.Item>

          <Flex justify="space-between" gap={12}>
            <Button icon={<ReloadOutlined />} onClick={loadMemories} disabled={isLoading}>
              重新加载
            </Button>
            <Button htmlType="submit" icon={<SaveOutlined />} loading={isSaving} type="primary">
              保存条目
            </Button>
          </Flex>
        </Form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDeleteItem)}
        title="确认删除记忆"
        description={pendingDeleteItem ? `确认删除「${pendingDeleteItem.title}」吗？删除后会同步更新浏览器本地存储。` : ''}
        confirmText="删除"
        cancelText="取消"
        isConfirming={Boolean(pendingDeleteItem && deletingItemId === pendingDeleteItem.id)}
        onCancel={() => setPendingDeleteItem(null)}
        onConfirm={confirmDeleteItem}
      />
    </main>
  );
}
