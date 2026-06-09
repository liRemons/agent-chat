module.exports = {
  apps: [
    {
      name: 'agent-chat',
      script: '.next/standalone/server.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        HOSTNAME: '0.0.0.0',
        PORT: '3000',
      },
      max_memory_restart: '512M',
      time: true,
    },
  ],
};
