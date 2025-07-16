# 配置文件快速参考

## 配置文件用途一览

| 文件名 | 用途 | 主要内容 |
|--------|------|----------|
| `units.json` | NPC配置 | 矮人、哥布林的属性（血量、攻击、移动速度等） |
| `buildings.json` | 建筑配置 | 弓箭塔的属性（伤害、射程、建造时间等） |
| `waves.json` | 波次配置 | 每波怪物的数量、类型、出现间隔 |
| `shop.json` | 商店配置 | 商品列表、价格、刷新权重 |
| `world.json` | 世界配置 | 城堡位置、地面高度、任务锁定时间 |
| `match3.json` | 网格配置 | 连连看初始分布、资源类型 |

## 常用修改示例

### 1. 调整矮人属性
文件：`units.json`
```json
"dwarf": {
  "combat": {
    "health": 150,        // 增加血量到150
    "attack": 30,         // 增加攻击力到30
    "range": 80          // 增加攻击范围到80
  },
  "movement": {
    "speed": 120         // 增加移动速度到120
  }
}
```

### 2. 调整弓箭塔伤害
文件：`buildings.json`
```json
"arrow_tower": {
  "combat": {
    "attack": 50,        // 增加攻击力到50
    "range": 600,        // 增加射程到600
    "attackSpeed": 1500  // 加快攻击速度（越小越快）
  }
}
```

### 3. 增加怪物数量
文件：`waves.json`
```json
{
  "waveNumber": 1,
  "monsters": [{
    "type": "goblin",
    "count": 5,          // 第一波改为5个哥布林
    "spawnInterval": 1000 // 每秒生成一个
  }]
}
```

### 4. 调整商品价格
文件：`shop.json`
```json
{
  "id": "arrow_tower_1",
  "cost": {
    "wood": 1,           // 降低木头需求
    "stone": 1,          // 降低石头需求
    "gold": 0           // 不需要金币
  }
}
```

## 快速调试命令

在浏览器控制台中：

```javascript
// 查看当前配置
configManager.getUnitsConfig()
configManager.getBuildingsConfig()
configManager.getWavesConfig()

// 查看特定值
configManager.getConfigValue('game_units.units.dwarf.combat.health')

// 临时修改（仅用于测试，刷新后失效）
const config = configManager.getUnitsConfig();
config.units.dwarf.combat.health = 999;
```

## 注意事项

1. ⚠️ 修改后必须刷新页面
2. ⚠️ JSON格式必须正确（使用在线JSON验证器检查）
3. ⚠️ 数字不要加引号
4. ⚠️ 最后一个属性后面不要加逗号

## 常见问题

**Q: 修改了配置但没生效？**
A: 刷新页面（F5）

**Q: 游戏报错了？**
A: 检查JSON格式是否正确，特别是逗号和引号

**Q: 想添加新的塔类型？**
A: 1. 在buildings.json添加配置 2. 在shop.json添加商品 3. 添加对应图标

**Q: 怎么让游戏更简单？**
A: 增加矮人血量/攻击，减少怪物数量/血量，降低商品价格