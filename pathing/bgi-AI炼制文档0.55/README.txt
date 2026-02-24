# BGI 文档

## 使用方法

### 方式1：使用本地服务器（推荐）
```bash
npm run serve
# 或
npx serve . -p 8080
```
然后在浏览器中打开 http://localhost:8080

### 方式2：直接打开（需要内联资源）
如果您使用了 `npm run docs:build:standalone` 命令构建，
所有资源已被内联到 HTML 文件中，可以直接双击 index.html 打开。

## 构建说明

- **标准构建**: `npm run docs:build` - 需要本地服务器才能正常访问
- **独立构建**: `npm run docs:build:standalone` - 资源内联，可直接双击打开

## 目录结构

```
dist/
├── index.html          # 首页
├── README.txt          # 使用说明
├── assets/             # 资源文件（CSS、JS等）
├── vp-icons.css        # 图标样式
└── docs/               # 文档页面
    ├── 01-全局方法API.html
    ├── 02-原神游戏API.html
    └── ...
```
