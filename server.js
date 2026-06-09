const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

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