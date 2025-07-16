import { Scene } from 'phaser';
import { Dwarf } from '../entities/Dwarf';
import { Goblin } from '../entities/Goblin';
import { configManager } from '../systems/ConfigManager';
import { UnitConfig } from '../types/config/UnitConfig';
import { CombatUnit } from '../interfaces/CombatUnit';

/**
 * 单位工厂类
 * 根据配置动态创建不同类型的单位
 */
export class UnitFactory {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * 创建单位
     * @param unitType 单位类型
     * @param id 单位ID
     * @param x X坐标
     * @param y Y坐标（可选，默认使用配置中的groundY）
     */
    createUnit(unitType: string, id: string, x: number, y?: number): CombatUnit | null {
        const unitsConfig = configManager.getUnitsConfig();
        console.log(`[UnitFactory] Creating unit ${unitType}, config:`, unitsConfig);
        
        if (!unitsConfig || !unitsConfig.units || !unitsConfig.units[unitType]) {
            console.error(`Unit type not found in config: ${unitType}`, {
                hasConfig: !!unitsConfig,
                hasUnits: !!(unitsConfig?.units),
                availableTypes: unitsConfig?.units ? Object.keys(unitsConfig.units) : []
            });
            return null;
        }

        const unitConfig = unitsConfig.units[unitType];
        const finalY = y !== undefined ? y : unitConfig.movement.groundY;

        // 根据单位类型创建对应的实例
        switch (unitType) {
            case 'dwarf':
                return this.createDwarf(id, x, finalY, unitConfig);
            
            case 'goblin':
                return this.createGoblin(id, x, finalY, unitConfig);
            
            // 未来可以添加更多单位类型
            // case 'orc_warrior':
            //     return this.createOrcWarrior(id, x, finalY, unitConfig);
            
            default:
                console.error(`Unit type not implemented: ${unitType}`);
                return null;
        }
    }

    /**
     * 创建矮人
     */
    private createDwarf(id: string, x: number, y: number, config: UnitConfig): Dwarf {
        // 暂时仍然使用构造函数创建，后续会修改Dwarf类直接从配置读取
        const dwarf = new Dwarf(this.scene, id, x, y);
        
        // TODO: 将配置传递给Dwarf实例
        // dwarf.loadConfig(config);
        
        return dwarf;
    }

    /**
     * 创建哥布林
     */
    private createGoblin(id: string, x: number, y: number, config: UnitConfig): Goblin {
        // 暂时仍然使用构造函数创建，后续会修改Goblin类直接从配置读取
        const goblin = new Goblin(this.scene, id, x);
        
        // TODO: 将配置传递给Goblin实例
        // goblin.loadConfig(config);
        
        return goblin;
    }

    /**
     * 获取单位配置
     */
    getUnitConfig(unitType: string): UnitConfig | null {
        const unitsConfig = configManager.getUnitsConfig();
        if (!unitsConfig || !unitsConfig.units[unitType]) {
            return null;
        }
        return unitsConfig.units[unitType];
    }

    /**
     * 获取所有可用的单位类型
     */
    getAvailableUnitTypes(): string[] {
        const unitsConfig = configManager.getUnitsConfig();
        if (!unitsConfig) {
            return [];
        }
        return Object.keys(unitsConfig.units);
    }

    /**
     * 获取特定类型的单位列表
     */
    getUnitsByType(type: 'friendly' | 'enemy' | 'neutral'): string[] {
        const unitsConfig = configManager.getUnitsConfig();
        if (!unitsConfig) {
            return [];
        }

        return Object.keys(unitsConfig.units).filter(unitType => {
            return unitsConfig.units[unitType].type === type;
        });
    }
}