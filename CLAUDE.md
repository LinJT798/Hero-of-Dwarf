# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Magic Same Game (连连看塔防游戏) - A match-3 tower defense game combining elimination gameplay with strategic tower defense mechanics. Built with Phaser 3 and TypeScript.

**Game concept**: Players match resources on a 9x7 grid, which are then collected by dwarf NPCs to build defensive towers against waves of monsters attacking the castle.

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

## High-Level Architecture

### Core Game Loop
The game follows a resource generation → collection → building → defense cycle:
1. **MainMenuScene** transitions directly to **MainGameScene**
2. **Match3Grid** generates resources through player matches
3. **DwarfManager** coordinates NPCs to collect **DroppedResource** instances
4. **ResourceManager** (singleton) tracks global economy with observer pattern
5. **Shop** allows tower purchases validated against resources
6. **BuildingManager** handles tower placement and combat
7. **MonsterManager** spawns waves per JSON configuration

### Key Architectural Patterns

1. **Singleton Pattern** for global state:
   - `ConfigManager`: Hierarchical JSON config access
   - `ResourceManager`: Global resource tracking with listeners
   - `WorldTaskManager`: CAS-based task locking with TTL

2. **State Machine Pattern**:
   - Dwarf NPCs: IDLE → WALKING → FIGHTING/BUILDING
   - Task priorities: FIGHT(4) > BUILD(3) > DELIVER(2) > COLLECT(1)

3. **Event-Driven Communication**:
   - `'resource-landed'`: Triggers dwarf collection
   - `'building-purchased'`: Initiates placement mode
   - `'monster-killed'`: Updates wave progress
   - `'place-building'`: Finalizes tower placement

### Critical Systems

**Match-3 Connection Algorithm** (src/utils/PathFinder.ts):
- BFS with state: `(row, col, direction, turns)`
- Maximum 2 turns (3 line segments)
- Edge traversal for out-of-bounds paths
- Same resource type required for valid matches

**Resource Distribution** (src/entities/Match3Grid.ts):
- 63 cells total: 62 blocks + 1 empty
- Block types:
  - Resources (droppable): gold, wood, stone, mithril, food
  - Non-resources (no drops): dirt, grass, lava, sand
- Distribution: Resources 8×5 + 2 = 42, Non-resources 5×4 = 20
- Fisher-Yates shuffle for randomization

**Dwarf Task Management** (src/managers/WorldTaskManager.ts):
- Resource claiming prevents duplicate assignments
- 10-second TTL on resource locks
- Horizontal movement only (y=789)
- Castle delivery zone: x ∈ [-221, 239]

**Configuration System**:
- JSON-driven balance in `public/configs/game/`
- Access pattern: `configManager.getConfigValue('game_tower.arrow_tower.damage')`
- Hot-reload requires page refresh

## Key Implementation Constraints

- **Grid**: Exactly 9×7 cells, 51×51px each, positioned at (469,90)
- **Buildings**: 8 slots, 162×162px each, pre-defined positions
- **Shop**: 190×96px slots with 85×85px left-aligned icons
- **Resources**: 5 types (gold, wood, stone, mithril, food)
- **Animations**: Standardized 20 FPS across all sprites
- **Coordinates**: Strict adherence to Figma design specs

## Debug Controls

- **R**: Add test resources
- **S**: Refresh shop inventory
- **D**: Display dwarf status
- **M**: Force next monster wave
- **V/B**: Force victory/defeat
- **T**: Run Match3 logic tests

## Architecture Notes

- TypeScript path aliases: `@/` → `src/`
- No test framework or linting configured
- Bilingual support (Chinese primary)
- Direct scene transitions (no loading screens)
- All managers use singleton pattern
- Hot reload for code, manual refresh for configs
- MIT licensed project
- Asset loading: Critical assets preloaded, non-core loaded dynamically
- Animation naming: Sequential frames (e.g., `frame_001.png`)
- Resource naming: Lowercase with underscores