# 部署到 GitHub Pages 指南

## 前置准备

1. 确保你有一个 GitHub 账号
2. 创建一个新的 GitHub 仓库，建议命名为 `magic-same-game`

## 部署步骤

### 1. 初始化 Git 仓库（如果还没有）

```bash
git init
git add .
git commit -m "Initial commit"
```

### 2. 添加远程仓库

```bash
git remote add origin https://github.com/你的用户名/magic-same-game.git
```

### 3. 推送代码到 GitHub

```bash
git branch -M main
git push -u origin main
```

### 4. 配置 GitHub Pages

1. 进入你的 GitHub 仓库页面
2. 点击 "Settings" 标签
3. 在左侧菜单找到 "Pages"
4. 在 "Build and deployment" 部分：
   - Source: 选择 "GitHub Actions"

### 5. 等待自动部署

- 推送代码后，GitHub Actions 会自动运行
- 可以在 "Actions" 标签页查看部署进度
- 部署成功后，游戏将可以通过以下地址访问：
  ```
  https://你的用户名.github.io/magic-same-game/
  ```

## 注意事项

1. **仓库名称**：如果你的仓库名称不是 `magic-same-game`，需要修改 `vite.config.ts` 中的 `base` 配置：
   ```typescript
   base: process.env.NODE_ENV === 'production' ? '/你的仓库名/' : '/',
   ```

2. **TypeScript 错误**：当前配置跳过了 TypeScript 检查以快速部署。建议后续修复 TypeScript 错误，然后使用 `npm run build-check` 进行严格构建。

3. **资源优化**：项目包含大量动画帧文件，后续可以考虑：
   - 使用精灵图合并动画帧
   - 实现懒加载策略
   - 添加加载进度条

## 本地测试生产构建

```bash
# 构建项目
npm run build

# 预览生产构建
npm run preview
```

## 更新部署

每次推送到 `main` 分支都会自动触发重新部署：

```bash
git add .
git commit -m "更新内容描述"
git push
```

## 故障排除

1. **部署失败**：检查 Actions 页面的错误日志
2. **资源加载失败**：确保 `vite.config.ts` 中的 `base` 路径正确
3. **页面 404**：等待几分钟让 GitHub Pages 完全部署