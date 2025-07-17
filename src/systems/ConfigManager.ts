import { UnitsConfigFile } from '../types/config/UnitConfig';
import { BuildingsConfigFile } from '../types/config/BuildingConfig';
import { WavesConfigFile } from '../types/config/WaveConfig';
import { ShopConfigFile } from '../types/config/ShopConfig';
import { WorldConfigFile } from '../types/config/WorldConfig';
import { AudioConfig } from '../types/config/AudioConfig';

/**
 * 简化的配置管理器
 * 用于Demo版本的配置加载和管理
 */
export class ConfigManager {
    private static instance: ConfigManager;
    private configs: Map<string, any> = new Map();
    private loadingPromises: Map<string, Promise<any>> = new Map();

    private constructor() {}

    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    /**
     * 加载配置文件
     * @param configPath 配置文件路径（相对于public/configs/）
     * @returns 配置对象
     */
    async loadConfig(configPath: string): Promise<any> {
        const configName = this.getConfigName(configPath);
        
        // 如果已经加载过，直接返回
        if (this.configs.has(configName)) {
            return this.configs.get(configName);
        }

        // 如果正在加载，等待加载完成
        if (this.loadingPromises.has(configName)) {
            return this.loadingPromises.get(configName);
        }

        // 开始加载
        const loadPromise = this.doLoadConfig(configPath);
        this.loadingPromises.set(configName, loadPromise);

        try {
            const config = await loadPromise;
            this.configs.set(configName, config);
            console.log(`Config loaded: ${configName}`);
            return config;
        } catch (error) {
            console.error(`Failed to load config: ${configPath}`, error);
            // 返回默认配置
            const defaultConfig = this.getDefaultConfig(configName);
            this.configs.set(configName, defaultConfig);
            return defaultConfig;
        } finally {
            this.loadingPromises.delete(configName);
        }
    }

    /**
     * 获取配置对象
     * @param configName 配置名称
     * @returns 配置对象
     */
    getConfig(configName: string): any {
        return this.configs.get(configName);
    }

    /**
     * 获取配置值
     * @param path 配置路径，格式：configName.key1.key2
     * @param defaultValue 默认值
     * @returns 配置值
     */
    getConfigValue(path: string, defaultValue: any = undefined): any {
        const parts = path.split('.');
        const configName = parts[0];
        const config = this.getConfig(configName);

        if (!config) {
            console.warn(`Config not found: ${configName}`);
            return defaultValue;
        }

        let value = config;
        for (let i = 1; i < parts.length; i++) {
            if (value && typeof value === 'object' && parts[i] in value) {
                value = value[parts[i]];
            } else {
                console.warn(`Config path not found: ${path}`);
                return defaultValue;
            }
        }

        return value;
    }

    /**
     * 批量加载配置
     * @param configPaths 配置文件路径数组
     */
    async loadConfigs(configPaths: string[]): Promise<void> {
        console.log('[ConfigManager] Loading configs:', configPaths);
        const promises = configPaths.map(path => this.loadConfig(path));
        await Promise.all(promises);
        console.log('[ConfigManager] All configs loaded, available configs:', Array.from(this.configs.keys()));
    }

    /**
     * 检查配置是否已加载
     * @param configName 配置名称
     * @returns 是否已加载
     */
    isConfigLoaded(configName: string): boolean {
        return this.configs.has(configName);
    }

    private async doLoadConfig(configPath: string): Promise<any> {
        const url = `/configs/${configPath}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    }

    private getConfigName(configPath: string): string {
        return configPath.replace('.json', '').replace(/\//g, '_');
    }

    /**
     * 获取单位配置
     */
    getUnitsConfig(): UnitsConfigFile | null {
        return this.getConfig('game_units') as UnitsConfigFile;
    }

    /**
     * 获取建筑配置
     */
    getBuildingsConfig(): BuildingsConfigFile | null {
        return this.getConfig('game_buildings') as BuildingsConfigFile;
    }

    /**
     * 获取波次配置
     */
    getWavesConfig(): WavesConfigFile | null {
        return this.getConfig('game_waves') as WavesConfigFile;
    }

    /**
     * 获取商店配置
     */
    getShopConfig(): ShopConfigFile | null {
        return this.getConfig('game_shop') as ShopConfigFile;
    }

    /**
     * 获取世界配置
     */
    getWorldConfig(): WorldConfigFile | null {
        return this.getConfig('game_world') as WorldConfigFile;
    }

    /**
     * 获取音频配置
     */
    getAudioConfig(): AudioConfig | null {
        return this.getConfig('game_audio') as AudioConfig;
    }

    private getDefaultConfig(configName: string): any {
        // 返回各种配置的默认值
        const defaultConfigs: { [key: string]: any } = {
            'game_match3': {
                gridWidth: 9,
                gridHeight: 7,
                resourceTypes: ['gold', 'wood', 'stone', 'mithril', 'food'],
                dropWeights: {
                    gold: 25,
                    wood: 30,
                    stone: 25,
                    mithril: 15,
                    food: 20
                }
            },
            'game_tower': {
                arrow_tower: {
                    attackDamage: 25,
                    attackSpeed: 1.2,
                    attackRange: 120,
                    health: 100,
                    cost: {
                        wood: 2,
                        stone: 1,
                        gold: 1
                    }
                }
            },
            'game_monster': {
                basic_monster: {
                    health: 50,
                    moveSpeed: 60,
                    attackDamage: 20,
                    attackSpeed: 1.5
                }
            },
            'game_shop': {
                slotCount: 2,
                autoRefresh: true,
                products: [
                    {
                        id: 'arrow_tower_1',
                        type: 'arrow_tower',
                        name: '弓箭塔',
                        cost: {
                            wood: 2,
                            stone: 1,
                            gold: 1
                        },
                        weight: 10
                    }
                ]
            },
            'game_units': {
                units: {
                    dwarf: {
                        displayName: "矮人",
                        type: "friendly",
                        combat: { health: 100, maxHealth: 100, attack: 20, range: 50, attackSpeed: 1500, armor: 5 },
                        movement: { speed: 100, groundY: 789 },
                        ai: { senseRadius: 120, threatRadius: 80, collectionRange: 50, buildRange: 60, carryCapacity: 5 },
                        display: { size: 80, healthBar: { width: 60, height: 4, offsetY: -85 } },
                        animations: { frameRate: 20, types: ["idle", "walk", "build", "attack", "death"] }
                    }
                }
            },
            'game_buildings': {
                buildingLayout: {
                    maxSlots: 8,
                    positions: { startX: 209, increment: 107, y: 630 },
                    foundationSize: { width: 162, height: 162 }
                },
                buildings: {
                    arrow_tower: {
                        displayName: "弓箭塔",
                        type: "defensive",
                        size: { width: 162, height: 162 },
                        combat: { health: 200, maxHealth: 200, attack: 25, range: 500, attackSpeed: 1000, armor: 10 },
                        buildTime: 5000
                    }
                }
            },
            'game_waves': {
                waveSettings: { maxWaves: 5, waveCompleteDelay: 3000, spawnPosition: { x: 1200, y: 789 } },
                waves: []
            },
            'game_world': {
                ground: { y: 789 },
                castle: { boundary: { left: -221, right: 239 } },
                gameArea: { width: 1280, height: 832 }
            },
            'game_audio': {
                music: {
                    menu_bgm: "assets/audio/music/menu_bgm.mp3",
                    game_bgm: "assets/audio/music/game_bgm.mp3"
                },
                soundEffects: {
                    match_success: "assets/audio/sfx/match_success.wav",
                    attack: "assets/audio/sfx/attack.wav"
                },
                volumes: {
                    music: 0.7,
                    soundEffects: 0.8
                }
            }
        };

        return defaultConfigs[configName] || {};
    }
}

// 导出单例实例
export const configManager = ConfigManager.getInstance();