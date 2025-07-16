import { Goblin, GoblinState } from '../entities/Goblin';
import { CombatUnit } from '../interfaces/CombatUnit';
import { configManager } from '../systems/ConfigManager';
import { WaveConfig, MonsterSpawnConfig } from '../types/config/WaveConfig';
import { UnitFactory } from '../factories/UnitFactory';

/**
 * 新的怪物管理器
 * 专门管理哥布林实体，支持波次系统
 */
export class NewMonsterManager {
    private scene: Phaser.Scene;
    private container: Phaser.GameObjects.Container;
    private goblins: Map<string, Goblin> = new Map();
    private nextGoblinId = 1;
    private unitFactory: UnitFactory;
    
    // 波次系统
    private currentWave: number = 1;
    private maxWaves: number;
    private isWaveActive: boolean = false;
    private waveCompleteTimer: number = 0;
    private waveCompleteDelay: number;
    
    // 生成配置
    private spawnPosition: { x: number; y: number };
    
    // 波次配置
    private waveConfigs: WaveConfig[] = [];
    
    // 生成队列
    private spawnQueue: Array<{ spawnTime: number; monsterType: string; monsterIndex: number }> = [];
    private spawnTimer: number = 0;
    private monstersSpawned: number = 0;
    private monstersToSpawn: number = 0;
    private currentWaveConfig: WaveConfig | null = null;
    
    // 目标列表（用于哥布林攻击）
    private targetBuildings: CombatUnit[] = [];
    private targetDwarfs: CombatUnit[] = [];
    
    constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
        this.scene = scene;
        this.container = container;
        this.unitFactory = new UnitFactory(scene);
        
        // 加载波次配置
        this.loadWaveConfig();
        
        this.setupEventListeners();
        this.startWave(1);
        
        console.log('NewMonsterManager initialized with config');
    }
    
    /**
     * 加载波次配置
     */
    private loadWaveConfig(): void {
        const wavesConfig = configManager.getWavesConfig();
        
        console.log('[NewMonsterManager] Loading wave config:', wavesConfig);
        
        if (wavesConfig) {
            this.maxWaves = wavesConfig.waveSettings.maxWaves;
            this.waveCompleteDelay = wavesConfig.waveSettings.waveCompleteDelay;
            this.spawnPosition = { ...wavesConfig.waveSettings.spawnPosition };
            this.waveConfigs = [...wavesConfig.waves];
            
            console.log(`[NewMonsterManager] Wave config loaded: ${this.maxWaves} waves, spawn at (${this.spawnPosition.x}, ${this.spawnPosition.y})`);
            console.log('[NewMonsterManager] Wave configs:', this.waveConfigs);
        } else {
            console.warn('[NewMonsterManager] Wave config not found, using defaults');
            this.loadDefaultWaveConfig();
        }
    }
    
    /**
     * 加载默认波次配置
     */
    private loadDefaultWaveConfig(): void {
        this.maxWaves = 5;
        this.waveCompleteDelay = 3000;
        this.spawnPosition = { x: 1200, y: 789 };
        
        // 默认波次配置
        this.waveConfigs = [
            { waveNumber: 1, monsters: [{ type: 'goblin', count: 3, spawnInterval: 2000 }] },
            { waveNumber: 2, monsters: [{ type: 'goblin', count: 5, spawnInterval: 1500 }] },
            { waveNumber: 3, monsters: [{ type: 'goblin', count: 7, spawnInterval: 1200 }] },
            { waveNumber: 4, monsters: [{ type: 'goblin', count: 10, spawnInterval: 1000 }] },
            { waveNumber: 5, monsters: [{ type: 'goblin', count: 15, spawnInterval: 800 }] }
        ];
    }
    
    /**
     * 设置事件监听
     */
    private setupEventListeners(): void {
        this.scene.events.on('goblin-killed', this.handleGoblinKilled, this);
        this.scene.events.on('castle-attacked', this.handleCastleAttacked, this);
    }
    
    /**
     * 处理哥布林死亡事件
     */
    private handleGoblinKilled(data: { goblin: Goblin; position: { x: number; y: number } }): void {
        console.log(`Goblin ${data.goblin.id} was killed at (${data.position.x}, ${data.position.y})`);
        
        // 触发游戏事件（用于分数系统等）
        this.scene.events.emit('monster-killed', {
            type: 'goblin',
            position: data.position,
            reward: 10 // 哥布林击杀奖励
        });
        
        // 检查波次是否完成
        this.checkWaveComplete();
    }
    
    /**
     * 处理城堡攻击事件
     */
    private handleCastleAttacked(data: { goblinId: string; goblinType: string; position: { x: number; y: number } }): void {
        if (!data || !data.goblinId) {
            console.error('handleCastleAttacked called with invalid data:', data);
            return;
        }
        
        console.log(`Castle attacked by ${data.goblinType} ${data.goblinId} at position (${data.position.x}, ${data.position.y})`);
        
        // 触发游戏失败事件
        this.scene.events.emit('castle-destroyed', {
            attackerId: data.goblinId,
            attackerType: data.goblinType,
            position: data.position
        });
    }
    
    /**
     * 开始波次
     */
    public startWave(waveNumber: number): void {
        if (waveNumber > this.maxWaves) {
            console.log('All waves completed!');
            this.scene.events.emit('all-waves-completed');
            return;
        }
        
        this.currentWave = waveNumber;
        this.isWaveActive = true;
        this.waveCompleteTimer = 0;
        
        // 找到对应的波次配置
        this.currentWaveConfig = this.waveConfigs.find(w => w.waveNumber === waveNumber) || null;
        
        console.log(`[NewMonsterManager] Starting wave ${waveNumber}, looking for config in:`, this.waveConfigs);
        console.log(`[NewMonsterManager] Found wave config:`, this.currentWaveConfig);
        
        if (!this.currentWaveConfig) {
            console.error(`Wave config not found for wave ${waveNumber}`);
            return;
        }
        
        // 计算总怪物数量
        this.monstersToSpawn = 0;
        this.currentWaveConfig.monsters.forEach(monsterGroup => {
            this.monstersToSpawn += monsterGroup.count;
            console.log(`[NewMonsterManager] Wave ${waveNumber} - ${monsterGroup.type}: ${monsterGroup.count} monsters`);
        });
        
        this.monstersSpawned = 0;
        
        // 准备生成队列
        this.spawnQueue = [];
        this.spawnTimer = 0;
        
        let currentTime = 0;
        this.currentWaveConfig.monsters.forEach(monsterGroup => {
            for (let i = 0; i < monsterGroup.count; i++) {
                this.spawnQueue.push({
                    spawnTime: currentTime,
                    monsterType: monsterGroup.type,
                    monsterIndex: i
                });
                currentTime += monsterGroup.spawnInterval;
            }
        });
        
        console.log(`Wave ${waveNumber} started: ${this.monstersToSpawn} monsters`);
        this.scene.events.emit('wave-started', { wave: waveNumber, config: this.currentWaveConfig });
    }
    
    /**
     * 生成怪物
     */
    private spawnMonster(monsterType: string): void {
        const monsterId = `${monsterType}_${this.nextGoblinId++}`;
        const monster = this.unitFactory.createUnit(monsterType, monsterId, this.spawnPosition.x);
        
        if (!monster) {
            console.error(`Failed to create monster of type: ${monsterType}`);
            return;
        }
        
        // 如果是哥布林，设置目标列表
        if (monster instanceof Goblin) {
            const goblin = monster as Goblin;
            goblin.setTargets(this.targetBuildings, this.targetDwarfs);
            
            // 添加到容器
            this.container.add(goblin.getSprite());
            
            // 添加血条到容器
            const healthBarObjects = goblin.getHealthBarObjects();
            healthBarObjects.forEach(obj => {
                this.container.add(obj);
            });
            
            this.goblins.set(monsterId, goblin);
        }
        
        this.monstersSpawned++;
        
        console.log(`Spawned ${monsterId} for wave ${this.currentWave} (${this.monstersSpawned}/${this.monstersToSpawn})`);
    }
    
    /**
     * 检查波次是否完成
     */
    private checkWaveComplete(): void {
        if (!this.isWaveActive) return;
        
        // 检查是否所有怪物都已生成且死亡/离开
        const allSpawned = this.monstersSpawned >= this.monstersToSpawn;
        const allGone = this.getAliveGoblins().length === 0;
        
        if (allSpawned && allGone) {
            this.isWaveActive = false;
            this.waveCompleteTimer = 0;
            
            console.log(`Wave ${this.currentWave} completed`);
            this.scene.events.emit('wave-completed', { wave: this.currentWave });
        }
    }
    
    /**
     * 设置目标列表
     */
    public setTargets(buildings: CombatUnit[], dwarfs: CombatUnit[]): void {
        this.targetBuildings = buildings;
        this.targetDwarfs = dwarfs;
        
        // 更新所有哥布林的目标列表
        this.goblins.forEach(goblin => {
            goblin.setTargets(buildings, dwarfs);
        });
    }
    
    /**
     * 获取活着的哥布林
     */
    public getAliveGoblins(): Goblin[] {
        return Array.from(this.goblins.values()).filter(goblin => goblin.isAlive());
    }
    
    /**
     * 获取所有哥布林
     */
    public getAllGoblins(): Goblin[] {
        return Array.from(this.goblins.values());
    }
    
    /**
     * 获取波次统计信息
     */
    public getWaveStats(): any {
        return {
            currentWave: this.currentWave,
            maxWaves: this.maxWaves,
            isWaveActive: this.isWaveActive,
            monstersSpawned: this.monstersSpawned,
            monstersToSpawn: this.monstersToSpawn,
            aliveMonsters: this.getAliveGoblins().length,
            totalMonsters: this.goblins.size
        };
    }
    
    /**
     * 强制开始下一波（调试用）
     */
    public forceNextWave(): void {
        if (this.currentWave < this.maxWaves) {
            this.startWave(this.currentWave + 1);
        }
    }
    
    /**
     * 主更新方法
     */
    public update(delta: number): void {
        // 处理生成队列
        if (this.isWaveActive && this.spawnQueue.length > 0) {
            this.spawnTimer += delta;
            
            // 检查是否需要生成怪物
            while (this.spawnQueue.length > 0 && this.spawnTimer >= this.spawnQueue[0].spawnTime) {
                const spawnInfo = this.spawnQueue.shift()!;
                this.spawnMonster(spawnInfo.monsterType);
            }
        }
        
        // 更新所有哥布林
        const goblinsToRemove: string[] = [];
        this.goblins.forEach((goblin, id) => {
            if (goblin.isAlive() || goblin.getState() === GoblinState.DEAD) {
                goblin.update(delta);
            } else {
                // 哥布林已销毁，标记为待移除
                goblinsToRemove.push(id);
            }
        });
        
        // 清理已销毁的哥布林
        goblinsToRemove.forEach(id => {
            this.goblins.delete(id);
        });
        
        // 检查波次完成
        this.checkWaveComplete();
        
        // 处理波次间隔
        if (!this.isWaveActive && this.currentWave < this.maxWaves) {
            this.waveCompleteTimer += delta;
            if (this.waveCompleteTimer >= this.waveCompleteDelay) {
                this.startWave(this.currentWave + 1);
            }
        }
    }
    
    /**
     * 销毁管理器
     */
    public destroy(): void {
        this.scene.events.off('goblin-killed', this.handleGoblinKilled, this);
        this.scene.events.off('castle-attacked', this.handleCastleAttacked, this);
        
        // 销毁所有哥布林
        this.goblins.forEach(goblin => {
            goblin.destroy();
        });
        
        this.goblins.clear();
        this.spawnQueue = [];
        
        console.log('NewMonsterManager destroyed');
    }
}