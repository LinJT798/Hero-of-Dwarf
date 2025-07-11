# 游戏资源目录说明

本目录包含游戏的所有图片、动画、音效等资源文件。

## 目录结构

### 矮人NPC资源
```
dwarf/
├── sprites/
│   ├── idle/          # 空闲状态图片
│   ├── walk/          # 行走动画帧
│   ├── collect/       # 收集动画帧
│   └── build/         # 建造动画帧
└── animations/
    ├── walk.json      # 行走动画配置
    ├── collect.json   # 收集动画配置
    └── build.json     # 建造动画配置
```

### 连连看资源
```
match3/
├── tiles/             # 连连看图案
│   ├── gold.png
│   ├── wood.png
│   ├── stone.png
│   ├── mithril.png
│   └── food.png
└── effects/           # 消除特效
```

### 塔防资源
```
tower/
├── arrow_tower/       # 弓箭塔
│   ├── idle.png
│   ├── shoot/         # 射击动画帧
│   └── destroy/       # 摧毁动画帧
├── monsters/          # 怪物
│   ├── basic/
│   │   ├── walk/      # 行走动画
│   │   └── death/     # 死亡动画
│   └── boss/
└── projectiles/       # 投射物
    └── arrow/         # 箭矢
```

### 建筑资源
```
buildings/
├── foundation/        # 地基
├── castle/           # 城堡
└── effects/          # 建筑特效
```

### 资源道具
```
resources/
├── gold/             # 金币
├── wood/             # 木头
├── stone/            # 石头
├── mithril/          # 秘银
└── food/             # 食物
```

### UI资源
```
ui/
├── buttons/          # 按钮
├── panels/           # 面板
├── icons/            # 图标
└── backgrounds/      # 背景
```

## 资源规范

### 图片格式
- **主要格式**：PNG（支持透明）
- **分辨率**：根据UI设计稿确定
- **命名规范**：小写字母，下划线分隔

### 动画规范
- **帧动画**：PNG序列帧
- **命名格式**：frame_001.png, frame_002.png...
- **配置文件**：JSON格式，包含帧数、时长、循环设置

### 文件组织
- **按功能分类**：不同系统的资源分别存放
- **版本控制**：重要资源文件纳入版本控制
- **压缩优化**：发布前进行资源压缩

## 使用说明

1. **资源加载**：游戏启动时预加载关键资源
2. **动态加载**：非核心资源支持动态加载
3. **缓存管理**：合理的资源缓存和释放策略
4. **热更新**：支持资源文件的热更新

---

*最后更新时间：2025年7月8日*