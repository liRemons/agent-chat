'use client';

import Link from 'next/link';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useAppMessage } from '@/components/AppMessage';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type MemoryScope = 'project' | 'global';
type MemoryKind = 'memory' | 'prompt';
type MemoryType = 'preference' | 'feedback' | 'insight' | 'reference';
interface MemoryItem {
  id: string;
  scope: MemoryScope;
  kind: MemoryKind;
  title: string;
  summary: string;
  fileName: string;
  content: string;
}

interface MemoryFormState {
  scope: MemoryScope;
  kind: MemoryKind;
  memoryType: MemoryType;
  title: string;
  summary: string;
  content: string;
}

const emptyFormState: MemoryFormState = {
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
  const frontmatterEndIndex = content.indexOf('---', 4);
  const contentWithoutFrontmatter = frontmatterEndIndex >= 0 ? content.slice(frontmatterEndIndex + 3) : content;
  return contentWithoutFrontmatter.trim() || '暂无正文';
}

function getMemoryDirectoryLabel(scope: MemoryScope) {
  return scope === 'project' ? '当前项目 data/memories' : '全局 ~/testAgent-memories';
}

export default function MemoriesPage() {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [formState, setFormState] = useState<MemoryFormState>(emptyFormState);
  const [activeScope, setActiveScope] = useState<MemoryScope | 'all'>('all');
  const [activeKind, setActiveKind] = useState<MemoryKind | 'all'>('all');
  const [selectedItemId, setSelectedItemId] = useState('');
  const { message, contextHolder } = useAppMessage();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState('');
  const [pendingDeleteItem, setPendingDeleteItem] = useState<MemoryItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const scopeMatched = activeScope === 'all' || item.scope === activeScope;
      const kindMatched = activeKind === 'all' || item.kind === activeKind;
      return scopeMatched && kindMatched;
    });
  }, [activeKind, activeScope, items]);

  const selectedItem = items.find(item => item.id === selectedItemId) ?? filteredItems[0];

  async function parseErrorMessage(response: Response, fallbackMessage: string) {
    try {
      const data = (await response.json()) as { error?: string };
      return data.error || fallbackMessage;
    } catch {
      return fallbackMessage;
    }
  }

  const loadMemories = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/memories', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response, '记忆加载失败，请稍后重试。'));
      }

      const data = (await response.json()) as { items: MemoryItem[] };
      setItems(data.items);
      setSelectedItemId(currentSelectedItemId => currentSelectedItemId || data.items[0]?.id || '');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '记忆加载失败，请稍后重试。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadMemories();
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, [loadMemories]);

  function updateFormField<FieldName extends keyof MemoryFormState>(fieldName: FieldName, value: MemoryFormState[FieldName]) {
    setFormState(currentFormState => ({
      ...currentFormState,
      [fieldName]: value,
    }));
  }

  async function handleCreateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formState),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response, '保存失败，请检查输入内容。'));
      }

      const data = (await response.json()) as { item: MemoryItem };
      setItems(currentItems => [...currentItems, data.item]);
      setSelectedItemId(data.item.id);
      setFormState(currentFormState => ({
        ...emptyFormState,
        scope: currentFormState.scope,
        kind: currentFormState.kind,
        memoryType: currentFormState.memoryType,
      }));
      message.success(`保存成功，已写入 ${getMemoryDirectoryLabel(data.item.scope)}。`);
      setIsCreateModalOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败，请稍后重试。');
    } finally {
      setIsSaving(false);
    }
  }

  function requestDeleteItem(item: MemoryItem) {
    setPendingDeleteItem(item);
  }

  async function confirmDeleteItem() {
    if (!pendingDeleteItem) {
      return;
    }

    const item = pendingDeleteItem;
    setDeletingItemId(item.id);
    try {
      const response = await fetch('/api/memories', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scope: item.scope,
          fileName: item.fileName,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response, '删除失败，请稍后重试。'));
      }

      const nextItems = items.filter(currentItem => currentItem.id !== item.id);
      setItems(nextItems);
      setSelectedItemId(nextItems[0]?.id || '');
      setPendingDeleteItem(null);
      message.success('删除成功，已同步更新索引。');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败，请稍后重试。');
    } finally {
      setDeletingItemId('');
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe_0,#f8fafc_36%,#f0fdfa_100%)] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      {contextHolder}
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-7xl gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-2xl shadow-slate-200/70 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-indigo-500">记忆中心</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-950">记忆 / 常用提示词</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">查看、创建和删除项目级或全局级配置。</p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button className="rounded-2xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-500" type="button" onClick={() => setIsCreateModalOpen(true)}>
                新增
              </button>
              <Link className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700" href="/">
                返回
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {(['all', 'project', 'global'] as const).map(scope => (
              <button
                key={scope}
                className={`min-h-10 rounded-2xl px-3 text-xs font-semibold transition ${
                  activeScope === scope ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                }`}
                type="button"
                onClick={() => setActiveScope(scope)}
              >
                {scope === 'all' ? '全部范围' : scopeLabels[scope]}
              </button>
            ))}
            {(['all', 'memory', 'prompt'] as const).map(kind => (
              <button
                key={kind}
                className={`min-h-10 rounded-2xl px-3 text-xs font-semibold transition ${
                  activeKind === kind ? 'bg-slate-950 text-white shadow-lg shadow-slate-200' : 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                }`}
                type="button"
                onClick={() => setActiveKind(kind)}
              >
                {kind === 'all' ? '全部类型' : kindLabels[kind]}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-2 overflow-y-auto pr-1 xl:max-h-[calc(100vh-20rem)]">
            {isLoading ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">正在加载...</p> : null}
            {!isLoading && filteredItems.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">暂无匹配项。</p> : null}
            {filteredItems.map(item => (
              <button
                key={item.id}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  selectedItem?.id === item.id ? 'border-indigo-200 bg-indigo-50/80' : 'border-slate-100 bg-white hover:border-indigo-100 hover:bg-slate-50'
                }`}
                type="button"
                onClick={() => setSelectedItemId(item.id)}
              >
                <div className="flex items-center gap-2 text-[0.7rem] font-semibold text-slate-400">
                  <span>{scopeLabels[item.scope]}</span>
                  <span>·</span>
                  <span>{kindLabels[item.kind]}</span>
                </div>
                <p className="mt-2 line-clamp-1 text-sm font-bold text-slate-900">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.summary}</p>
              </button>
            ))}
          </div>
        </aside>

        <article className="min-h-0 overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-2xl shadow-slate-200/70 backdrop-blur-xl">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-500">当前选中</p>
                <h2 className="mt-1 truncate text-2xl font-bold text-slate-950">{selectedItem?.title || '暂无记忆'}</h2>
                {selectedItem ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">{scopeLabels[selectedItem.scope]}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{kindLabels[selectedItem.kind]}</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{selectedItem.fileName}</span>
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">{getMemoryDirectoryLabel(selectedItem.scope)}</span>
                  </div>
                ) : null}
              </div>

              {selectedItem ? (
                <button
                  className="min-h-10 rounded-2xl border border-rose-100 bg-rose-50 px-4 text-sm font-semibold text-rose-600 transition hover:border-rose-200 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  disabled={deletingItemId === selectedItem.id}
                  onClick={() => requestDeleteItem(selectedItem)}
                >
                  {deletingItemId === selectedItem.id ? '删除中' : '删除'}
                </button>
              ) : null}
            </div>
          </div>
          <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-5 sm:p-6">
            <p className="whitespace-pre-wrap rounded-3xl border border-slate-100 bg-slate-50 p-5 text-sm leading-7 text-slate-700">
              {selectedItem ? getContentPreview(selectedItem.content) : '左侧选择一条记忆，或点击新增按钮创建。'}
            </p>
          </div>
        </article>

      </div>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
          <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-bold text-slate-950">新增条目</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  保存到：{getMemoryDirectoryLabel(formState.scope)}，并同步更新索引。
                </p>
              </div>
              <button
                aria-label="关闭新增弹窗"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-lg leading-none text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
              >
                ×
              </button>
            </div>
            <form className="mt-5 flex min-h-0 flex-1 flex-col" onSubmit={handleCreateItem}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 pb-5">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">范围</span>
              <select className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" value={formState.scope} onChange={event => updateFormField('scope', event.target.value as MemoryScope)}>
                <option value="project">项目级</option>
                <option value="global">全局</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500">类型</span>
              <select className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" value={formState.kind} onChange={event => updateFormField('kind', event.target.value as MemoryKind)}>
                <option value="memory">记忆</option>
                <option value="prompt">常用提示词</option>
              </select>
            </label>

            {formState.kind === 'memory' ? (
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">记忆分类</span>
                <select className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" value={formState.memoryType} onChange={event => updateFormField('memoryType', event.target.value as MemoryType)}>
                  {Object.entries(memoryTypeLabels).map(([memoryType, label]) => (
                    <option key={memoryType} value={memoryType}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block">
              <span className="text-xs font-semibold text-slate-500">标题</span>
              <input className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" placeholder="例如：代码评审常用提示词" value={formState.title} onChange={event => updateFormField('title', event.target.value)} />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500">摘要</span>
              <input className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" placeholder="用于索引的一句话说明" value={formState.summary} onChange={event => updateFormField('summary', event.target.value)} />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500">正文</span>
              <textarea className="mt-2 min-h-44 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" placeholder="写入提示词或记忆正文" value={formState.content} onChange={event => updateFormField('content', event.target.value)} />
            </label>
          </div>

          <div className="sticky bottom-0 -mx-5 mt-0 grid grid-cols-2 gap-3 border-t border-slate-100 bg-white/95 px-5 pt-4 sm:-mx-6 sm:px-6">
            <button className="min-h-11 rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-100 transition hover:-translate-y-0.5 hover:bg-indigo-500 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={isSaving}>
              {isSaving ? '保存中' : '保存条目'}
            </button>
            <button className="min-h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700" type="button" onClick={loadMemories} disabled={isLoading}>
              重新加载
            </button>
          </div>
        </form>
          </div>
        </div>
      ) : null}


      <ConfirmDialog
        open={Boolean(pendingDeleteItem)}
        title="确认删除记忆"
        description={pendingDeleteItem ? `确认删除「${pendingDeleteItem.title}」吗？删除后会同步更新索引。` : ''}
        confirmText="删除"
        cancelText="取消"
        isConfirming={Boolean(pendingDeleteItem && deletingItemId === pendingDeleteItem.id)}
        onCancel={() => setPendingDeleteItem(null)}
        onConfirm={confirmDeleteItem}
      />

    </main>
  );
}
