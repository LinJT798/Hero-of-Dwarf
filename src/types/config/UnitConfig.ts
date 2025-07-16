/**
 * 单位配置类型定义
 */

export interface UnitCombatConfig {
    health: number;
    maxHealth: number;
    attack: number;
    range: number;
    attackSpeed: number;
    armor: number;
}

export interface UnitMovementConfig {
    speed: number;
    groundY: number;
}

export interface UnitAIConfig {
    // 友方单位AI配置
    senseRadius?: number;
    threatRadius?: number;
    collectionRange?: number;
    buildRange?: number;
    carryCapacity?: number;
    castleBoundary?: {
        left: number;
        right: number;
    };
    
    // 敌方单位AI配置
    deathDuration?: number;
    targetPriority?: string[];
}

export interface UnitIdleConfig {
    animationChance: number;
    moveChance: number;
    staticDurationMin: number;
    staticDurationMax: number;
}

export interface UnitDisplayConfig {
    size: number;
    flipX?: boolean;
    healthBar: {
        width: number;
        height: number;
        offsetY: number;
    };
}

export interface UnitAnimationConfig {
    frameRate: number;
    types: string[];
}

export interface UnitRewardsConfig {
    killPoints?: number;
    resources?: { [key: string]: number };
}

export interface UnitConfig {
    displayName: string;
    type: 'friendly' | 'enemy' | 'neutral';
    combat: UnitCombatConfig;
    movement: UnitMovementConfig;
    ai: UnitAIConfig;
    idle?: UnitIdleConfig;
    display: UnitDisplayConfig;
    animations: UnitAnimationConfig;
    rewards?: UnitRewardsConfig;
}

export interface UnitsConfigFile {
    units: {
        [unitType: string]: UnitConfig;
    };
}