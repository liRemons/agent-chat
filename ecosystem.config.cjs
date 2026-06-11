// PM2 进程配置：生产环境用它启动自定义 HTTPS 服务入口 server.js。
module.exports = {
  apps: [
    {
      name: 'agent-chat',
      script: './agent-chat-server.js',
      cwd: __dirname,
      // fork 模式只启动一个 Node.js 进程，适合当前这种带本地证书文件的简单部署。
      exec_mode: 'fork',
      instances: 1,
      env: {
        // 生产模式会启用 Next.js 的生产运行逻辑。
        NODE_ENV: 'production',
        // HOSTNAME: '0.0.0.0',
        // PORT: '3000',
        AGENT_SESSION_SECRET: 'remons-agent-chat'
      },
      // 内存超过阈值时让 PM2 自动重启，避免长期运行后内存异常累积。
      max_memory_restart: '512M',
      // 在 PM2 日志中附带时间，排查线上问题时更容易定位。
      time: true,
    },
  ],
};
