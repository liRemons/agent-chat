import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

const editableSettingKeys = [
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_BASE_URL',
  'AGENT_SESSION_SECRET',
] as const;

type EditableSettingKey = (typeof editableSettingKeys)[number];

type EditableSettings = Record<EditableSettingKey, string>;

const envFilePath = path.join(process.cwd(), '.env.local');

function createEmptySettings(): EditableSettings {
  return {
    OPENAI_API_KEY: '',
    OPENAI_MODEL: '',
    OPENAI_BASE_URL: '',
    AGENT_SESSION_SECRET: '',
  };
}

function parseEnvFile(content: string): EditableSettings {
  const settings = createEmptySettings();

  for (const line of content.split('\n')) {
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!editableSettingKeys.includes(key as EditableSettingKey)) {
      continue;
    }

    settings[key as EditableSettingKey] = line.slice(separatorIndex + 1).trim();
  }

  return settings;
}

async function readEnvContent() {
  try {
    return await readFile(envFilePath, 'utf8');
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

function stringifyEnvValue(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue || /^[A-Za-z0-9_./:@+\-]+$/.test(trimmedValue)) {
    return trimmedValue;
  }

  return JSON.stringify(trimmedValue);
}

function mergeEnvContent(originalContent: string, settings: EditableSettings) {
  const handledKeys = new Set<EditableSettingKey>();
  const lines = originalContent.split('\n');
  const nextLines = lines.map(line => {
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      return line;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!editableSettingKeys.includes(key as EditableSettingKey)) {
      return line;
    }

    handledKeys.add(key as EditableSettingKey);
    return `${key}=${stringifyEnvValue(settings[key as EditableSettingKey])}`;
  });

  for (const key of editableSettingKeys) {
    if (!handledKeys.has(key)) {
      nextLines.push(`${key}=${stringifyEnvValue(settings[key])}`);
    }
  }

  return `${nextLines.filter((line, index) => line.length > 0 || index < nextLines.length - 1).join('\n')}\n`;
}

function normalizeRequestBody(body: Partial<EditableSettings>): EditableSettings {
  return {
    OPENAI_API_KEY: String(body.OPENAI_API_KEY ?? ''),
    OPENAI_MODEL: String(body.OPENAI_MODEL ?? ''),
    OPENAI_BASE_URL: String(body.OPENAI_BASE_URL ?? ''),
    AGENT_SESSION_SECRET: String(body.AGENT_SESSION_SECRET ?? ''),
  };
}

export async function GET() {
  const envContent = await readEnvContent();
  return NextResponse.json({ settings: parseEnvFile(envContent) });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as Partial<EditableSettings>;
  const settings = normalizeRequestBody(body);
  const envContent = await readEnvContent();

  await writeFile(envFilePath, mergeEnvContent(envContent, settings), 'utf8');

  return NextResponse.json({ settings, reloadRequired: true });
}
