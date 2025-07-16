import { Scene } from 'phaser';
import { configManager } from '../systems/ConfigManager';
import { BuildingConfig } from '../types/config/BuildingConfig';

/**
 * 建筑工厂类
 * 根据配置动态创建不同类型的建筑
 */
export class BuildingFactory {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * 获取建筑配置
     */
    getBuildingConfig(buildingType: string): BuildingConfig | null {
        const buildingsConfig = configManager.getBuildingsConfig();
        if (!buildingsConfig || !buildingsConfig.buildings[buildingType]) {
            console.error(`Building type not found in config: ${buildingType}`);
            return null;
        }
        return buildingsConfig.buildings[buildingType];
    }

    /**
     * 获取建筑布局配置
     */
    getBuildingLayoutConfig() {
        const buildingsConfig = configManager.getBuildingsConfig();
        if (!buildingsConfig) {
            return null;
        }
        return buildingsConfig.buildingLayout;
    }

    /**
     * 获取所有可用的建筑类型
     */
    getAvailableBuildingTypes(): string[] {
        const buildingsConfig = configManager.getBuildingsConfig();
        if (!buildingsConfig) {
            return [];
        }
        return Object.keys(buildingsConfig.buildings);
    }

    /**
     * 获取特定类型的建筑列表
     */
    getBuildingsByType(type: 'defensive' | 'production' | 'support'): string[] {
        const buildingsConfig = configManager.getBuildingsConfig();
        if (!buildingsConfig) {
            return [];
        }

        return Object.keys(buildingsConfig.buildings).filter(buildingType => {
            return buildingsConfig.buildings[buildingType].type === type;
        });
    }

    /**
     * 获取建筑的成本
     */
    getBuildingCost(buildingType: string): { [resourceType: string]: number } | null {
        const config = this.getBuildingConfig(buildingType);
        if (!config) {
            return null;
        }
        return config.cost;
    }

    /**
     * 获取建筑的显示名称
     */
    getBuildingDisplayName(buildingType: string): string {
        const config = this.getBuildingConfig(buildingType);
        if (!config) {
            return buildingType;
        }
        return config.displayName;
    }

    /**
     * 检查建筑是否可以攻击
     */
    canBuildingAttack(buildingType: string): boolean {
        const config = this.getBuildingConfig(buildingType);
        if (!config) {
            return false;
        }
        return config.combat.attack > 0 && config.combat.range > 0;
    }

    /**
     * 获取建筑的投射物配置
     */
    getBuildingProjectileConfig(buildingType: string) {
        const config = this.getBuildingConfig(buildingType);
        if (!config) {
            return null;
        }
        return config.projectile;
    }
}