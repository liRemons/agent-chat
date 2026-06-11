const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

// 自定义 HTTPS 启动入口：用于本地或 PM2 以 HTTPS 方式启动 Next.js。
// 注意：这里不读取 .env.local，敏感配置只从真实服务端环境变量注入。

// 证书文件必须放在项目根目录，HTTPS 服务启动时会同步读取。
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname,'./a.key')),
  cert: fs.readFileSync(path.join(__dirname,'./a.pem'))
};

// Next.js 的请求处理器负责接管所有页面、静态资源和 API 路由。
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // prepare 完成后再创建 HTTPS 服务，避免请求进来时 Next.js 还没初始化。
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on https://localhost:3000');
  });
});
