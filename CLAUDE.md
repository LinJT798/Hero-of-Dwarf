# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Magic Same Game (连连看塔防游戏) - A match-3 tower defense game combining elimination gameplay with strategic tower defense mechanics. Built with Phaser 3 and TypeScript.

## Technology Stack

- **Game Engine**: Phaser 3.70.0
- **Language**: TypeScript 5.0+
- **Build Tool**: Vite 4.0+
- **Physics**: Phaser Arcade Physics
- **Resolution**: 1280x832 pixels

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Type check TypeScript files
npm run type-check

# Build for production (type checks first)
npm run build

# Preview production build
npm run preview
```

## Project Architecture

```
src/
├── main.ts                 # Game initialization, Phaser config
├── entities/               # Game objects
│   ├── Dwarf.ts           # Resource collector NPC with state machine
│   ├── Match3Cell.ts      # Individual grid cells
│   ├── Match3Grid.ts      # 9x7 match-3 game board
│   ├── Monster.ts         # Enemy units
│   ├── DroppedResource.ts # Falling resources with claiming system
│   └── Shop.ts            # Building purchase interface
├── managers/              # State and entity management
│   ├── BuildingManager.ts # Tower placement and management
│   ├── DwarfManager.ts    # Multi-dwarf task scheduling
│   ├── MonsterManager.ts  # Enemy spawning and waves
│   └── ResourceManager.ts # Resource tracking and economy
├── scenes/
│   └── MainGameScene.ts   # Primary game scene
├── systems/               # Core infrastructure
│   ├── AssetManager.ts    # Asset loading and caching
│   ├── ConfigManager.ts   # JSON config loading
│   └── GameStateManager.ts # Game state and progression
└── utils/
    └── PathFinder.ts      # BFS pathfinding for match-3

public/
├── assets/
│   ├── animations/        # Animation sprite sheets
│   ├── audio/            # Sound effects and music
│   └── images/           # Figma-exported static images
└── configs/
    └── game/             # Core game configurations
        ├── match3.json   # Grid mechanics, resource distribution
        ├── monster.json  # Enemy types, stats, waves
        ├── shop.json     # Building costs, shop items
        └── tower.json    # Tower stats, damage, range
```

## Key Systems and Usage

### ConfigManager
Loads and manages JSON configuration files:
```typescript
// Access nested config values
const towerDamage = configManager.getConfigValue('game_tower.arrow_tower.damage');
const monsterHealth = configManager.getConfigValue('game_monster.basic_monster.health');
```

### AssetManager
Handles resource loading with Phaser and creates fallback textures:
```typescript
// Load Figma assets in preload
await assetManager.loadBaseAssets();
// Creates fallback textures if assets fail to load
assetManager.createDemoTextures();
```

### GameStateManager
Tracks game progression and state:
```typescript
// Update game state
GameStateManager.setState('currentWave', 5);
GameStateManager.getState('playerResources');
```

### ResourceManager (Singleton)
Global resource management with observer pattern:
```typescript
// Add resources
resourceManager.addResource('gold', 10);
// Listen for resource changes
resourceManager.addListener((resources) => {
    console.log('Resources updated:', resources);
});
```

### Dwarf State Machine
Dwarves use a priority-based task system:
```typescript
// Task priorities: FIGHT(4) > BUILD_STRUCTURE(3) > DELIVER_RESOURCE(2) > COLLECT_RESOURCE(1)
dwarf.addTask({
    type: TaskType.COLLECT_RESOURCE,
    priority: TaskPriority.COLLECT_RESOURCE,
    target: droppedResource
});
```

## Configuration System

All game balance and content is driven by JSON files in `public/configs/game/`:

- **match3.json**: Grid size (9x7), resource types, match requirements, drop probabilities
- **monster.json**: Enemy health, speed, damage, spawn patterns
- **tower.json**: Building costs, damage, range, attack speed
- **shop.json**: Available items, costs, refresh mechanics

Configuration changes take effect on page refresh during development.

**Key Configuration Details:**
- Match-3 grid is exactly 9 columns × 7 rows with 51×51px cells
- Grid positioned at (469,90) with total resource count of 63 cells
- Resource distribution ensures even numbers (one empty cell strategy)
- BFS pathfinding allows maximum 2 turns for match connections
- Building position slots are 162×162px (8 predefined positions)
- Shop slots are 190×96px with left-aligned 85×85px icons
- Resource panel is 170×304px with 34×34px resource icons

## Resource Types

The game uses 5 resource types (defined in match3.json):
1. Gold (金币)
2. Wood (木材)
3. Stone (石头)
4. Mithril (秘银)
5. Food (食物)

## Game Flow

1. **Match-3 Phase**: Player makes matches on 9x7 grid
2. **Resource Drop**: Matched cells drop resources with claiming system
3. **Collection**: Dwarf NPC collects dropped resources (one dwarf per resource)
4. **Building**: Use resources to purchase towers from shop
5. **Defense**: Towers attack incoming monsters
6. **Victory**: Survive all waves to complete level

## Critical Implementation Details

### Match-3 Connection Algorithm
- Uses BFS algorithm with state tracking: `(row, col, direction, turns)`
- Maximum 2 turns allowed (3 line segments total)
- Supports edge traversal for out-of-bounds pathfinding
- Connections require same resource type and both cells non-empty

### Multi-Dwarf Task Management
- Resource claiming prevents multiple dwarves targeting same resource
- Task priority system ensures combat takes precedence
- State machine: IDLE → WALKING → FIGHTING/BUILDING
- Automatic task detection when idle

### Resource Distribution
- Total 63 grid cells, using 62 for resources (one empty)
- Even distribution: 4 types × 12 each + 1 type × 14 = 62 total
- Fisher-Yates shuffle for randomization
- Ensures all resource types appear in even numbers

### Event-Driven Architecture
The game uses Phaser's event system for component communication:
- `'resource-landed'` - When resources hit ground
- `'building-purchased'` - When player buys from shop
- `'monster-killed'` - When enemies are defeated
- `'place-building'` - When player places buildings

## Adding New Content

### New Monster Type
1. Add entry to `public/configs/game/monster.json`
2. Add sprite assets to `public/assets/images/monsters/`
3. Update `MonsterManager` spawn logic if needed

### New Building Type
1. Add entry to `public/configs/game/tower.json`
2. Add to `public/configs/game/shop.json`
3. Update `BuildingManager` for placement logic

### New Animation
1. Add sprite sheet to `public/assets/animations/`
2. Register with `AssetManager.loadBaseAssets()`
3. Create animation config in scene

## Debug Controls

During development, use these keyboard shortcuts in-game:
- **R**: Add test resources
- **S**: Refresh shop inventory
- **D**: Display dwarf status info
- **M**: Force next monster wave
- **V**: Force victory (debug)
- **B**: Force defeat (debug)

## Important Notes

- Project uses TypeScript path aliases (`@/` maps to `src/`)
- All text is bilingual (Chinese primary, English secondary)
- No test framework is currently configured
- Development server runs on port 3000 with auto-open
- Hot reload works for code changes, config changes require refresh
- Game uses strict Figma design coordinates (1280×832 resolution)
- Dwarf movement is constrained to horizontal only (ground level)
- Castle delivery area: x coordinates from -221 to 239
- BuildingManager supports 8 pre-defined building positions (162×162px each)
- All managers use singleton pattern for global state management
- Shop layout uses left-aligned icon (85×85px) with right-side cost display
- Resource information panel uses larger 34×34px icons with improved spacing