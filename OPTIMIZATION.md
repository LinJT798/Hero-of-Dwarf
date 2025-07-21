# 性能优化指南

## 已完成的优化

### 1. ✅ 资源优化脚本
- 创建了 `scripts/optimize-animations.js` - Node.js 脚本，可以批量优化动画
- 创建了 `scripts/quick-optimize.sh` - 快速优化脚本
- 删除了重复目录，节省了约 100MB 空间

### 2. ✅ 延迟加载系统
- 创建了 `LazyAssetLoader.ts` - 按需加载动画资源
- 只在需要时加载特定动画，不是一次性加载所有

### 3. ✅ 预加载场景
- 创建了 `PreloadScene.ts` - 带进度条的加载界面
- 只加载核心资源，其他资源延迟加载

### 4. ✅ 代码分割
- 配置了 Vite 将代码分成多个 chunk：
  - `phaser` - Phaser 引擎单独打包
  - `game` - 游戏核心逻辑
  - `ui` - UI 相关代码

### 5. ✅ 清理脚本
- 创建了 `scripts/cleanup-assets.sh` - 清理重复和临时文件
- 已删除约 476 个重复的动画帧

## 立即可用的优化方案

### 方案 1：快速优化（推荐）
不修改代码，只优化资源：

```bash
# 1. 运行优化脚本减少动画帧
./scripts/quick-optimize.sh

# 2. 用优化后的文件替换原文件
mv public/assets/animations public/assets/animations-backup
mv public/assets/animations-optimized public/assets/animations

# 3. 重新构建并部署
npm run build
git add .
git commit -m "优化：减少动画帧数量"
git push
```

### 方案 2：启用延迟加载
修改代码使用新的加载系统：

1. 修改 `MainGameScene.ts`，使用 `LazyAssetLoader` 替代 `AssetManager`
2. 动画按需加载，不是一次性全部加载

### 方案 3：进一步优化

1. **使用 WebP 格式**
   ```bash
   # 安装 cwebp
   brew install webp
   
   # 转换 PNG 到 WebP
   find public/assets -name "*.png" -exec cwebp {} -o {}.webp \;
   ```

2. **使用 CDN**
   - 将 `public/assets` 上传到 CDN（如 Cloudflare）
   - 修改资源路径指向 CDN

3. **实现精灵图集**
   - 使用 TexturePacker 将动画帧合并
   - 减少 HTTP 请求数量

## 优化效果预估

当前状态：
- 资源大小：540MB
- 动画帧：1659 个文件
- 主 JS：1.6MB

优化后预估：
- 资源大小：~100MB（减少 80%）
- 动画帧：~400 个文件（减少 75%）
- 加载时间：减少 70-80%

## 快速命令

```bash
# 查看当前资源大小
du -sh public/assets/

# 统计动画帧数量
find public/assets/animations -name "*.png" | wc -l

# 构建并查看包大小
npm run build
ls -lh dist/assets/*.js
```

## 注意事项

1. 优化动画帧会略微降低动画流畅度，但在手机和低配设备上性能会大幅提升
2. 建议先在本地测试优化效果再部署
3. 保留原始资源的备份，以便需要时恢复