import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NextResponse } from 'next/server';

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

interface CreateMemoryRequest {
  scope?: MemoryScope;
  kind?: MemoryKind;
  title?: string;
  summary?: string;
  content?: string;
  memoryType?: MemoryType;
}

interface DeleteMemoryRequest {
  scope?: MemoryScope;
  fileName?: string;
}

const memoryScopes: Record<MemoryScope, string> = {
  project: path.join(process.cwd(), 'data', 'memories'),
  global: path.join(os.homedir(), 'testAgent-memories'),
};

const validMemoryTypes = new Set<MemoryType>(['preference', 'feedback', 'insight', 'reference']);

async function readTextFile(filePath: string) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

function createErrorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function createSlug(value: string) {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');

  return normalizedValue || 'untitled';
}

function parseIndexLine(line: string, scope: MemoryScope): MemoryItem | null {
  const markdownLinkMatch = line.match(/^- \[([^\]]+)]\(([^)]+)\) — (.*)$/);
  const plainPathMatch = line.match(/^- \[([^\]]+)]\s+(.+?)\s+—\s+(.*)$/);
  const match = markdownLinkMatch ?? plainPathMatch;

  if (!match) {
    return null;
  }

  const [, kindLabel, rawFileName, summary] = match;
  const fileName = path.basename(rawFileName);

  return {
    id: `${scope}:${fileName}`,
    scope,
    kind: kindLabel === 'prompt' ? 'prompt' : 'memory',
    title: fileName.replace(/\.md$/, ''),
    summary,
    fileName,
    content: '',
  };
}

function parseFrontmatterValue(content: string, fieldName: string) {
  const match = content.match(new RegExp(`^${fieldName}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim();
}

async function listScopeItems(scope: MemoryScope) {
  const memoryDirectory = memoryScopes[scope];
  const indexPath = path.join(memoryDirectory, 'MEMORY.md');
  const indexContent = await readTextFile(indexPath);
  const items = indexContent
    .split('\n')
    .map(line => parseIndexLine(line, scope))
    .filter((item): item is MemoryItem => Boolean(item));

  return Promise.all(
    items.map(async item => {
      const content = await readTextFile(path.join(memoryDirectory, item.fileName));
      return {
        ...item,
        title: parseFrontmatterValue(content, 'name') || item.title,
        summary: parseFrontmatterValue(content, 'description') || item.summary,
        content,
      };
    }),
  );
}

function normalizeMemoryType(memoryType: MemoryType | undefined, kind: MemoryKind) {
  if (kind === 'prompt') {
    return 'reference';
  }

  if (memoryType && validMemoryTypes.has(memoryType)) {
    return memoryType;
  }

  return 'preference';
}

function createFrontmatter(title: string, summary: string, content: string, memoryType: MemoryType) {
  const createdAt = new Date().toISOString().slice(0, 19);

  return `---\nname: ${title}\ndescription: ${summary}\ntype: ${memoryType}\ncreatedAt: ${createdAt}\n---\n${content.trim()}\n`;
}

async function ensureIndex(memoryDirectory: string) {
  await mkdir(memoryDirectory, { recursive: true });
  const indexPath = path.join(memoryDirectory, 'MEMORY.md');

  try {
    await writeFile(indexPath, '', { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== 'EEXIST') {
      throw error;
    }
  }

  return indexPath;
}

function resolveMemoryPath(scope: MemoryScope, fileName: string) {
  const safeFileName = path.basename(fileName);
  if (!safeFileName || safeFileName !== fileName || safeFileName === 'MEMORY.md' || !safeFileName.endsWith('.md')) {
    throw new Error('文件名不合法');
  }

  const memoryDirectory = memoryScopes[scope];
  return {
    indexPath: path.join(memoryDirectory, 'MEMORY.md'),
    targetPath: path.join(memoryDirectory, safeFileName),
  };
}

export async function GET() {
  try {
    const [projectItems, globalItems] = await Promise.all([listScopeItems('project'), listScopeItems('global')]);

    return NextResponse.json({
      items: [...projectItems, ...globalItems],
      scopes: memoryScopes,
    });
  } catch {
    return createErrorResponse('读取记忆失败，请检查记忆文件是否存在或格式是否正确。', 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateMemoryRequest;
    const scope = body.scope === 'global' ? 'global' : 'project';
    const kind = body.kind === 'prompt' ? 'prompt' : 'memory';
    const title = String(body.title ?? '').trim();
    const summary = String(body.summary ?? '').trim();
    const content = String(body.content ?? '').trim();

    if (!title || !summary || !content) {
      return createErrorResponse('请补全标题、摘要和正文后再保存。');
    }

    const memoryType = normalizeMemoryType(body.memoryType, kind);
    const memoryDirectory = memoryScopes[scope];
    const indexPath = await ensureIndex(memoryDirectory);
    const filePrefix = kind === 'prompt' ? 'prompt' : memoryType;
    const fileBaseName = `${filePrefix}_${createSlug(title)}`;
    const fileContent = createFrontmatter(title, summary, content, memoryType);
    let fileName = `${fileBaseName}.md`;
    let targetPath = path.join(memoryDirectory, fileName);
    let isWritten = false;

    for (let duplicateIndex = 1; duplicateIndex <= 100; duplicateIndex += 1) {
      try {
        await writeFile(targetPath, fileContent, { encoding: 'utf8', flag: 'wx' });
        isWritten = true;
        break;
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code !== 'EEXIST') {
          throw error;
        }

        fileName = `${fileBaseName}_${duplicateIndex}.md`;
        targetPath = path.join(memoryDirectory, fileName);
      }
    }

    if (!isWritten) {
      return createErrorResponse('同名记忆过多，请调整标题后再保存。');
    }

    const indexContent = await readTextFile(indexPath);
    const nextIndexLine = `- [${kind === 'prompt' ? 'prompt' : memoryType}] ${targetPath} — ${summary}`;

    await writeFile(indexPath, `${indexContent.trim()}\n${nextIndexLine}\n`.trimStart(), 'utf8');

    return NextResponse.json({
      item: {
        id: `${scope}:${fileName}`,
        scope,
        kind,
        title,
        summary,
        fileName,
        content: fileContent,
      },
    });
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : '保存失败，请稍后重试。', 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as DeleteMemoryRequest;
    const scope = body.scope === 'global' ? 'global' : 'project';
    const fileName = String(body.fileName ?? '').trim();

    if (!fileName) {
      return createErrorResponse('缺少要删除的记忆文件名。');
    }

    const { indexPath, targetPath } = resolveMemoryPath(scope, fileName);
    const indexContent = await readTextFile(indexPath);
    const nextIndexContent = indexContent
      .split('\n')
      .filter(line => !line.includes(`/${fileName}`) && !line.includes(`\\${fileName}`) && !line.includes(`](${fileName})`))
      .join('\n')
      .trim();

    try {
      await unlink(targetPath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'ENOENT') {
        throw error;
      }
    }

    await writeFile(indexPath, nextIndexContent ? `${nextIndexContent}\n` : '', 'utf8');

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : '删除失败，请稍后重试。', 500);
  }
}
