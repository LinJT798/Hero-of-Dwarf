/**
 * 建筑配置类型定义
 */

export interface BuildingLayoutConfig {
    maxSlots: number;
    positions: {
        startX: number;
        increment: number;
        y: number;
    };
    foundationSize: {
        width: number;
        height: number;
    };
}

export interface BuildingCombatConfig {
    health: number;
    maxHealth: number;
    attack: number;
    range: number;
    attackSpeed: number;
    armor: number;
}

export interface BuildingProjectileConfig {
    type: string;
    sprite: string;
    size: {
        width: number;
        height: number;
    };
    flightTime: number;
    arcHeightFactor: number;
    minArcHeight: number;
    hitRadius: number;
    areaEffect?: {
        enabled: boolean;
        radius: number;
        damagePercent: number;
    };
}

export interface BuildingAnimationConfig {
    frameRate: number;
    idle?: {
        enabled: boolean;
        chance: number;
        frames: number;
        staticDurationMin: number;
        staticDurationMax: number;
    };
}

export interface BuildingConfig {
    displayName: string;
    type: 'defensive' | 'production' | 'support';
    size: {
        width: number;
        height: number;
    };
    combat: BuildingCombatConfig;
    projectile?: BuildingProjectileConfig;
    animations?: BuildingAnimationConfig;
    buildTime: number;
    cost: { [resourceType: string]: number };
}

export interface BuildingsConfigFile {
    buildingLayout: BuildingLayoutConfig;
    buildings: {
        [buildingType: string]: BuildingConfig;
    };
}