# 游戏配置系统指南

本文档详细说明了 Magic Same Game 的配置系统，包括所有配置文件的用途、结构和使用方法。

## 配置文件概览

所有配置文件位于 `public/configs/game/` 目录下：

```
public/configs/game/
├── units.json        # NPC单位配置（矮人、哥布林等）
├── buildings.json    # 建筑物配置（弓箭塔等）
├── waves.json        # 怪物波次配置
├── shop.json         # 商店配置
├── world.json        # 世界常量配置
├── match3.json       # 连连看网格配置
├── tower.json        # (旧)塔防配置
└── monster.json      # (旧)怪物配置
```

## 1. units.json - 单位配置

定义游戏中所有NPC单位的属性，包括友方单位（矮人）和敌方单位（哥布林）。

### 结构示例：
```json
{
  "units": {
    "dwarf": {
      "displayName": "矮人",
      "type": "friendly",
      "combat": {
        "health": 100,
        "maxHealth": 100,
        "attack": 20,
        "range": 50,
        "attackSpeed": 1500,
        "armor": 5
      },
      "movement": {
        "speed": 100,
        "groundY": 789
      },
      "ai": {
        "senseRadius": 120,
        "threatRadius": 80,
        "collectionRange": 50,
        "buildRange": 60,
        "carryCapacity": 5,
        "castleBoundary": {
          "left": -221,
          "right": 239
        }
      },
      "idle": {
        "animationChance": 0.33,
        "moveChance": 0.33,
        "staticDurationMin": 2000,
        "staticDurationMax": 4000
      },
      "display": {
        "size": 80
      }
    },
    "goblin": {
      "displayName": "哥布林",
      "type": "enemy",
      "combat": {
        "health": 100,
        "maxHealth": 100,
        "attack": 20,
        "range": 50,
        "attackSpeed": 1500,
        "armor": 5
      },
      "movement": {
        "speed": 50,
        "groundY": 789
      },
      "ai": {
        "deathDuration": 20000
      },
      "display": {
        "size": 79,
        "flipX": true,
        "healthBar": {
          "width": 60,
          "height": 4,
          "offsetY": -85
        }
      }
    }
  }
}
```

### 使用方式：
```typescript
// 通过 UnitFactory 创建单位
const unitFactory = new UnitFactory(scene);
const dwarf = unitFactory.createUnit('dwarf', 'dwarf_1', 100, 789);

// 直接访问配置
const unitsConfig = configManager.getUnitsConfig();
const dwarfSpeed = unitsConfig.units.dwarf.movement.speed;
```

### 关键参数说明：
- **combat**: 战斗属性（生命值、攻击力、射程、攻击速度、护甲）
- **movement**: 移动属性（速度、地面Y坐标）
- **ai**: AI行为参数（感知范围、威胁范围、收集范围等）
- **idle**: 空闲行为（动画播放概率、移动概率、静止时间）
- **display**: 显示属性（尺寸、是否水平翻转、血条配置）

## 2. buildings.json - 建筑配置

定义所有可建造的建筑物及其属性。

### 结构示例：
```json
{
  "buildings": {
    "arrow_tower": {
      "displayName": "弓箭塔",
      "type": "defensive",
      "combat": {
        "health": 200,
        "maxHealth": 200,
        "attack": 30,
        "range": 500,
        "attackSpeed": 2000,
        "armor": 10
      },
      "construction": {
        "buildTime": 5000,
        "foundation": {
          "width": 162,
          "height": 162
        }
      },
      "display": {
        "size": {
          "width": 162,
          "height": 162
        },
        "animations": {
          "idle": {
            "key": "arrow_tower_idle",
            "frameRate": 20
          },
          "attack": {
            "key": "arrow_tower_attack",
            "frameRate": 20
          }
        }
      },
      "projectile": {
        "type": "arrow",
        "speed": 400,
        "damage": 30,
        "size": {
          "width": 49,
          "height": 13
        }
      }
    }
  },
  "layout": {
    "maxSlots": 8,
    "positions": {
      "startX": 209,
      "increment": 107,
      "y": 630
    }
  }
}
```

### 使用方式：
```typescript
// 通过 BuildingFactory 创建建筑
const buildingFactory = new BuildingFactory(scene);
const building = buildingFactory.createBuilding('arrow_tower', 'tower_1', x, y);

// 获取建筑配置
const buildingConfig = buildingFactory.getBuildingConfig('arrow_tower');
const towerDamage = buildingConfig.combat.attack;
```

### 关键参数说明：
- **combat**: 建筑的战斗属性
- **construction**: 建造相关（建造时间、地基尺寸）
- **display**: 显示相关（尺寸、动画配置）
- **projectile**: 投射物配置（类型、速度、伤害、尺寸）
- **layout**: 建筑槽位布局（最大数量、位置计算）

## 3. waves.json - 波次配置

定义怪物的出现波次、数量和时间间隔。

### 结构示例：
```json
{
  "waveSettings": {
    "maxWaves": 5,
    "waveCompleteDelay": 3000,
    "spawnPosition": {
      "x": 1200,
      "y": 789
    }
  },
  "waves": [
    {
      "waveNumber": 1,
      "monsters": [
        {
          "type": "goblin",
          "count": 3,
          "spawnInterval": 2000
        }
      ]
    },
    {
      "waveNumber": 2,
      "monsters": [
        {
          "type": "goblin",
          "count": 5,
          "spawnInterval": 1500
        }
      ]
    }
  ]
}
```

### 使用方式：
```typescript
// NewMonsterManager 自动加载并使用波次配置
const monsterManager = new NewMonsterManager(scene, container);
// 波次会自动开始

// 手动触发下一波
monsterManager.forceNextWave();
```

### 关键参数说明：
- **maxWaves**: 总波数
- **waveCompleteDelay**: 波次间隔时间（毫秒）
- **spawnPosition**: 怪物生成位置
- **waves**: 每波的具体配置
  - **type**: 怪物类型
  - **count**: 数量
  - **spawnInterval**: 生成间隔

## 4. shop.json - 商店配置

定义商店的商品、价格和布局。

### 结构示例：
```json
{
  "shop_settings": {
    "slot_count": 2,
    "refresh_delay": 1000
  },
  "shopLayout": {
    "slots": [
      { "x": 115, "y": 81 },
      { "x": 115, "y": 204 }
    ],
    "iconSize": { "width": 85, "height": 85 },
    "resourceIconSize": { "width": 22, "height": 22 },
    "priceTextSize": 24
  },
  "products": [
    {
      "id": "arrow_tower_1",
      "type": "arrow_tower",
      "buildingType": "arrow_tower",
      "cost": {
        "wood": 2,
        "stone": 1,
        "gold": 1
      },
      "weight": 10
    }
  ]
}
```

### 使用方式：
```typescript
// Shop 类自动加载配置
const shop = new Shop(scene, container);

// 手动刷新商店
shop.forceRefresh();
```

### 关键参数说明：
- **slot_count**: 商店槽位数量
- **shopLayout**: 布局配置（槽位位置、图标尺寸）
- **products**: 商品列表
  - **type/buildingType**: 建筑类型
  - **cost**: 购买成本
  - **weight**: 随机权重（越高越容易出现）

## 5. world.json - 世界配置

定义游戏世界的全局常量。

### 结构示例：
```json
{
  "castle": {
    "position": { "x": -221, "y": 405 },
    "size": { "width": 460, "height": 384 },
    "boundary": { "left": -221, "right": 239 }
  },
  "ground": {
    "height": 789
  },
  "taskSettings": {
    "resourceLockTTL": 10000,
    "buildSiteLockTTL": 30000
  }
}
```

### 使用方式：
```typescript
const worldConfig = configManager.getWorldConfig();
const castleX = worldConfig.castle.position.x;
```

## 6. match3.json - 连连看配置

定义连连看网格的初始分布。

### 结构示例：
```json
{
  "gridSize": {
    "rows": 7,
    "cols": 9
  },
  "blockTypes": {
    "resources": ["gold", "wood", "stone", "mithril", "food"],
    "nonResources": ["dirt", "grass", "lava", "sand"]
  },
  "distribution": {
    "resourceCount": 42,
    "nonResourceCount": 20,
    "emptyCount": 1
  }
}
```

## 配置加载流程

1. **初始化阶段**：
```typescript
// 在 MainGameScene.create() 中
await this.initializeConfigs();
```

2. **批量加载**：
```typescript
await configManager.loadConfigs([
    'game/units.json',
    'game/buildings.json',
    'game/waves.json',
    'game/shop.json',
    'game/world.json',
    'game/match3.json'
]);
```

3. **使用配置**：
```typescript
// 获取特定配置
const unitsConfig = configManager.getUnitsConfig();
const buildingsConfig = configManager.getBuildingsConfig();

// 直接访问值
const dwarfHealth = configManager.getConfigValue('game_units.units.dwarf.combat.health', 100);
```

## 添加新内容

### 添加新单位类型：
1. 在 `units.json` 中添加新单位配置
2. 在 `UnitFactory` 中添加对应的创建逻辑
3. 创建对应的单位类（继承自 CombatUnit）

### 添加新建筑类型：
1. 在 `buildings.json` 中添加新建筑配置
2. 放置图标文件：`/assets/images/{type}_icon.png`
3. 在 `shop.json` 中添加对应的商品

### 添加新波次：
1. 修改 `waves.json` 中的 `maxWaves`
2. 在 `waves` 数组中添加新的波次配置

## 最佳实践

1. **版本控制**：配置文件应该纳入版本控制
2. **验证**：修改配置后刷新页面查看效果
3. **平衡性**：小步调整，频繁测试
4. **备份**：在大改动前备份配置文件
5. **注释**：虽然JSON不支持注释，但可以用 `"_comment"` 字段添加说明

## 调试技巧

1. 查看配置是否加载：
```javascript
console.log(configManager.getUnitsConfig());
```

2. 检查可用的配置键：
```javascript
console.log(Array.from(configManager.configs.keys()));
```

3. 实时修改（仅用于测试）：
```javascript
const config = configManager.getUnitsConfig();
config.units.dwarf.combat.health = 200;
```

## 注意事项

1. 配置文件必须是有效的JSON格式
2. 修改配置后需要刷新页面才能生效
3. 数值类型要正确（数字不要加引号）
4. 路径使用正斜杠 `/`，不要使用反斜杠
5. 配置键名使用下划线分隔（如 `game_units`）