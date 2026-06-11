'use client';

import { Button } from 'antd';
import { ReactNode, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './MarkdownMessage.module.css';

function getPlainTextFromNode(node: ReactNode): string {
  // ReactMarkdown 传进来的代码块 children 可能是嵌套节点，这里递归取出可复制的纯文本。
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(childNode => getPlainTextFromNode(childNode)).join('');
  }

  return '';
}

function createHighlightToken(index: number) {
  // 高亮时先用私有区占位符保护已处理片段，避免后续正则重复包裹同一段 HTML。
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let tokenName = '';
  let remainingIndex = index;

  do {
    tokenName = alphabet[remainingIndex % alphabet.length] + tokenName;
    remainingIndex = Math.floor(remainingIndex / alphabet.length) - 1;
  } while (remainingIndex >= 0);

  return `\uE000${tokenName}\uE001`;
}

function highlightCodeSyntax(code: string, language: string) {
  // 内置语法高亮：先转义 HTML，再给常见语言的字符串、注释、关键字等包一层 span。
  let highlightedCode = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const normalizedLanguage = language.toLowerCase();
  if (!['js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript', 'json', 'bash', 'shell', 'sh'].includes(normalizedLanguage)) {
    return highlightedCode;
  }

  const highlightedTokens: string[] = [];
  const createHighlightedToken = (value: string, className: string) => {
    const token = createHighlightToken(highlightedTokens.length);
    highlightedTokens.push(`<span class="${className}">${value}</span>`);
    return token;
  };

  highlightedCode = highlightedCode
    .replace(/(`[\s\S]*?`|".*?"|'.*?')/g, value => createHighlightedToken(value, styles.tokenString))
    .replace(/(\/\/.*)$/gm, value => createHighlightedToken(value, styles.tokenComment))
    .replace(/(#.*)$/gm, value => createHighlightedToken(value, styles.tokenComment))
    .replace(/\b(const|let|var|function|return|if|else|for|while|await|async|import|from|export|type|interface|class|new|try|catch|throw)\b/g, value => createHighlightedToken(value, styles.tokenKeyword))
    .replace(/\b(true|false|null|undefined|console|log|JSON|Promise)\b/g, value => createHighlightedToken(value, styles.tokenBuiltIn))
    .replace(/\b(\d+(?:\.\d+)?)\b/g, value => createHighlightedToken(value, styles.tokenNumber));

  return highlightedTokens.reduce(
    (currentCode, tokenHtml, tokenIndex) => currentCode.replace(createHighlightToken(tokenIndex), tokenHtml),
    highlightedCode,
  );
}

function CodeBlock({ children, className }: { children: ReactNode; className?: string }) {
  // Markdown 代码块组件：展示语言名、复制按钮，并对常见语言做简单高亮。
  const [hasCopied, setHasCopied] = useState(false);
  const languageMatch = /language-(\w+)/.exec(className ?? '');
  const language = languageMatch?.[1] ?? 'text';
  const code = getPlainTextFromNode(children).replace(/\n$/, '');
  const highlightedCode = useMemo(() => highlightCodeSyntax(code, language), [code, language]);

  async function handleCopyCode() {
    await navigator.clipboard.writeText(code);
    setHasCopied(true);
    window.setTimeout(() => {
      setHasCopied(false);
    }, 1600);
  }

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLanguage}>{language}</span>
        <Button size="small" onClick={handleCopyCode}>
          {hasCopied ? '已复制' : '复制'}
        </Button>
      </div>
      <pre>
        <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
      </pre>
    </div>
  );
}

export function MarkdownMessage({ content, isUserMessage }: { content: string; isUserMessage: boolean }) {
  // 用户消息按纯文本展示；助手消息按 Markdown 渲染，支持表格、列表和代码块。
  if (isUserMessage) {
    return <div className={styles.userText}>{content}</div>;
  }

  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className={styles.headingLevel1}>{children}</h1>,
          h2: ({ children }) => <h2 className={styles.headingLevel2}>{children}</h2>,
          h3: ({ children }) => <h3 className={styles.headingLevel3}>{children}</h3>,
          p: ({ children }) => <p>{children}</p>,
          blockquote: ({ children }) => <blockquote>{children}</blockquote>,
          code: ({ children, className }) => {
            if (className?.startsWith('language-')) {
              return <CodeBlock className={className}>{children}</CodeBlock>;
            }

            return <code className={styles.inlineCode}>{children}</code>;
          },
          pre: ({ children }) => <>{children}</>,
          table: ({ children }) => <div className={styles.tableWrapper}><table>{children}</table></div>,
          a: ({ children, href }) => <a href={href} rel="noreferrer" target="_blank">{children}</a>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
