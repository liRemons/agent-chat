import { ChatPanel } from '@/components/ChatPanel';

export default function HomePage() {
  // 首页只负责渲染主聊天面板，具体交互都封装在 ChatPanel 组件里。
  return <ChatPanel />;
}
