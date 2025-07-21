#!/usr/bin/env node

/**
 * 动画资源优化脚本
 * 功能：
 * 1. 减少动画帧数（每隔N帧取1帧）
 * 2. 调整图片尺寸
 * 3. 压缩PNG文件
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const config = {
  // 动画帧优化配置
  frameReduction: {
    // 每隔多少帧取1帧（3表示101帧会变成34帧左右）
    keepEveryNthFrame: 3,
    // 要处理的动画目录
    animationDirs: [
      'public/assets/animations/dwarf/walk',
      'public/assets/animations/dwarf/idle1',
      'public/assets/animations/dwarf/idle2',
      'public/assets/animations/dwarf/attack',
      'public/assets/animations/dwarf/death',
      'public/assets/animations/goblin/walk',
      'public/assets/animations/goblin/idle',
      'public/assets/animations/goblin/attack',
      'public/assets/animations/goblin/death',
      'public/assets/animations/arrow_tower/idle',
      'public/assets/animations/arrow_tower/attack'
    ]
  },
  // 图片尺寸调整配置
  sizeReduction: {
    // 尺寸缩放比例
    scale: 0.5, // 50% 缩放
    // 特定尺寸映射
    sizeMap: {
      '720x720': '360x360',
      '960x960': '480x480',
      '1024x1024': '512x512'
    }
  }
};

// 获取动画帧文件列表
function getAnimationFrames(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`目录不存在: ${dir}`);
    return [];
  }
  
  return fs.readdirSync(dir)
    .filter(file => file.match(/processed_frame_\d+\.png$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0]);
      const numB = parseInt(b.match(/\d+/)[0]);
      return numA - numB;
    });
}

// 减少动画帧
function reduceFrames(dir, keepEveryNth) {
  const frames = getAnimationFrames(dir);
  if (frames.length === 0) return;
  
  console.log(`\n处理目录: ${dir}`);
  console.log(`原始帧数: ${frames.length}`);
  
  // 创建备份目录
  const backupDir = path.join(dir, 'backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  let keptFrames = 0;
  let deletedFrames = 0;
  
  frames.forEach((frame, index) => {
    const framePath = path.join(dir, frame);
    const frameNumber = parseInt(frame.match(/\d+/)[0]);
    
    // 保留第1帧和最后一帧，以及每隔N帧
    if (frameNumber === 1 || index === frames.length - 1 || frameNumber % keepEveryNth === 1) {
      keptFrames++;
      // 重命名帧以保持连续性
      const newFrameNumber = keptFrames;
      const newFrameName = `processed_frame_${newFrameNumber}.png`;
      const newFramePath = path.join(dir, newFrameName);
      
      if (framePath !== newFramePath) {
        // 先备份原文件
        fs.copyFileSync(framePath, path.join(backupDir, frame));
        // 重命名
        fs.renameSync(framePath, newFramePath);
      }
    } else {
      // 备份并删除
      fs.copyFileSync(framePath, path.join(backupDir, frame));
      fs.unlinkSync(framePath);
      deletedFrames++;
    }
  });
  
  console.log(`保留帧数: ${keptFrames}`);
  console.log(`删除帧数: ${deletedFrames}`);
  console.log(`帧数减少: ${Math.round((deletedFrames / frames.length) * 100)}%`);
}

// 调整图片大小
function resizeImages(dir, scale) {
  const files = fs.readdirSync(dir).filter(file => file.endsWith('.png'));
  
  if (files.length === 0) return;
  
  console.log(`\n调整图片大小: ${dir}`);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    try {
      // 使用 sips 命令调整大小（macOS）
      // 对于其他系统，可以使用 ImageMagick 的 convert 命令
      execSync(`sips -Z ${Math.round(1024 * scale)} "${filePath}" --out "${filePath}"`, {
        stdio: 'pipe'
      });
    } catch (error) {
      console.error(`调整图片大小失败: ${file}`);
    }
  });
  
  console.log(`已调整 ${files.length} 个文件的大小`);
}

// 压缩PNG文件（需要安装 pngquant）
function compressPNG(dir) {
  const files = fs.readdirSync(dir).filter(file => file.endsWith('.png'));
  
  if (files.length === 0) return;
  
  console.log(`\n压缩PNG文件: ${dir}`);
  
  // 检查是否安装了 pngquant
  try {
    execSync('which pngquant', { stdio: 'pipe' });
  } catch (error) {
    console.log('未安装 pngquant，跳过压缩步骤');
    console.log('安装方法: brew install pngquant (macOS) 或 apt-get install pngquant (Linux)');
    return;
  }
  
  let totalSizeBefore = 0;
  let totalSizeAfter = 0;
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    totalSizeBefore += stats.size;
    
    try {
      // 使用 pngquant 压缩
      execSync(`pngquant --quality=65-80 --skip-if-larger --force --output "${filePath}" "${filePath}"`, {
        stdio: 'pipe'
      });
      
      const newStats = fs.statSync(filePath);
      totalSizeAfter += newStats.size;
    } catch (error) {
      // 如果压缩失败，保留原文件
      totalSizeAfter += stats.size;
    }
  });
  
  const reduction = Math.round((1 - totalSizeAfter / totalSizeBefore) * 100);
  console.log(`压缩完成: ${(totalSizeBefore / 1024 / 1024).toFixed(2)}MB → ${(totalSizeAfter / 1024 / 1024).toFixed(2)}MB (减少${reduction}%)`);
}

// 主函数
function main() {
  console.log('开始优化动画资源...\n');
  
  // 1. 减少动画帧
  console.log('=== 第1步：减少动画帧 ===');
  config.frameReduction.animationDirs.forEach(dir => {
    reduceFrames(dir, config.frameReduction.keepEveryNthFrame);
  });
  
  // 2. 调整图片大小
  console.log('\n=== 第2步：调整图片大小 ===');
  config.frameReduction.animationDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      resizeImages(dir, config.sizeReduction.scale);
    }
  });
  
  // 3. 压缩PNG
  console.log('\n=== 第3步：压缩PNG文件 ===');
  config.frameReduction.animationDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      compressPNG(dir);
    }
  });
  
  console.log('\n优化完成！');
  console.log('备份文件保存在各动画目录的 backup 文件夹中');
  console.log('如需恢复，请从备份目录复制文件');
}

// 执行主函数
if (require.main === module) {
  main();
}

module.exports = { reduceFrames, resizeImages, compressPNG };