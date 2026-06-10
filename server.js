const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

// 手动加载 .env.local（standalone 模式下 Next.js 不会自动加载）
const envLocalPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envLocalPath)) {
  for (const line of fs.readFileSync(envLocalPath, 'utf8').split('\n')) {
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1 || line.startsWith('#')) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

// 1. 配置你的证书路径
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname,'./a.key')),
  cert: fs.readFileSync(path.join(__dirname,'./a.pem'))
};

// 2. 初始化 Next.js 应用
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // 3. 创建 HTTPS 服务器并监听 3000 端口（或你想要的其他端口）
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on https://localhost:3000');
  });
});
