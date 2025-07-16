/**
 * 世界配置类型定义
 */

export interface WorldGroundConfig {
    y: number;
}

export interface WorldCastleConfig {
    boundary: {
        left: number;
        right: number;
    };
    position: {
        x: number;
        y: number;
    };
    size: {
        width: number;
        height: number;
    };
}

export interface WorldGameAreaConfig {
    width: number;
    height: number;
}

export interface WorldConfigFile {
    ground: WorldGroundConfig;
    castle: WorldCastleConfig;
    gameArea: WorldGameAreaConfig;
}