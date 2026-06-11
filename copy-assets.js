const fs = require('fs');
const path = require('path');

// Next.js standalone 构建不会自动把静态资源复制到 standalone 目录。
// 部署前运行此脚本，把页面运行所需的静态文件补齐。

const srcStatic = path.join(__dirname, '.next', 'static');
const destStatic = path.join(__dirname, '.next', 'standalone', '.next', 'static');
const srcPublic = path.join(__dirname, 'public');
const destPublic = path.join(__dirname, '.next', 'standalone', 'public');

// 复制编译后的 Next.js 静态资源，例如 JS chunk、CSS 和构建产物。
if (fs.existsSync(srcStatic)) {
  fs.cpSync(srcStatic, destStatic, { recursive: true });
  console.log('✅ Copied .next/static');
}

// 复制 public 目录中的公开资源；项目没有 public 时直接跳过。
if (fs.existsSync(srcPublic)) {
  fs.cpSync(srcPublic, destPublic, { recursive: true });
  console.log('✅ Copied public');
}