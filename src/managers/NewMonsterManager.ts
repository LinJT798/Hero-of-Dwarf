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
    
    // 新的时间系统
    private gameStartTime: number = 0;
    private totalGameTime: number = 0;
    private currentGameTime: number = 0;
    private waveStartTimes: number[] = [];
    
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
        this.startGameTimer();
        
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
            
            // 计算总游戏时间和波次开始时间
            this.calculateGameTiming();
            
            console.log(`[NewMonsterManager] Wave config loaded: ${this.maxWaves} waves, spawn at (${this.spawnPosition.x}, ${this.spawnPosition.y})`);
            console.log(`[NewMonsterManager] Total game time: ${this.totalGameTime}ms`);
            console.log('[NewMonsterManager] Wave start times:', this.waveStartTimes);
        } else {
            console.warn('[NewMonsterManager] Wave config not found, using defaults');
            this.loadDefaultWaveConfig();
        }
    }
    
    /**
     * 计算游戏时间和波次开始时间
     */
    private calculateGameTiming(): void {
        this.waveStartTimes = [];
        let accumulatedTime = 0;
        
        this.waveConfigs.forEach(wave => {
            accumulatedTime += wave.delayFromPrevious || 0;
            this.waveStartTimes.push(accumulatedTime);
        });
        
        this.totalGameTime = accumulatedTime;
        
        console.log(`[NewMonsterManager] Calculated timing - Total: ${this.totalGameTime}ms, Wave times:`, this.waveStartTimes);
    }
    
    /**
     * 加载默认波次配置
     */
    private loadDefaultWaveConfig(): void {
        this.maxWaves = 5;
        this.waveCompleteDelay = 3000;
        this.spawnPosition = { x: 1200, y: 789 };
        
        // 默认波次配置（保持向后兼容）
        this.waveConfigs = [
            { waveNumber: 1, waveType: 'normal', delayFromPrevious: 30000, monsters: [{ type: 'goblin', count: 3, spawnInterval: 2000 }] },
            { waveNumber: 2, waveType: 'normal', delayFromPrevious: 45000, monsters: [{ type: 'goblin', count: 5, spawnInterval: 1500 }] },
            { waveNumber: 3, waveType: 'hard', delayFromPrevious: 60000, monsters: [{ type: 'goblin', count: 7, spawnInterval: 1200 }] },
            { waveNumber: 4, waveType: 'normal', delayFromPrevious: 50000, monsters: [{ type: 'goblin', count: 10, spawnInterval: 1000 }] },
            { waveNumber: 5, waveType: 'hard', delayFromPrevious: 70000, monsters: [{ type: 'goblin', count: 15, spawnInterval: 800 }] }
        ];
        
        this.calculateGameTiming();
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
     * 开始游戏计时器
     */
    public startGameTimer(): void {
        this.gameStartTime = Date.now();
        this.currentGameTime = 0;
        
        console.log(`[NewMonsterManager] Game timer started, total duration: ${this.totalGameTime}ms`);
        
        // 延迟触发游戏开始事件，确保所有UI组件都已创建
        this.scene.time.delayedCall(100, () => {
            console.log(`[NewMonsterManager] Emitting game-timer-started event`);
            this.scene.events.emit('game-timer-started', {
                totalTime: this.totalGameTime,
                waves: this.waveConfigs
            });
        });
    }
    
    /**
     * 获取当前游戏时间
     */
    public getCurrentGameTime(): number {
        return this.currentGameTime;
    }
    
    /**
     * 获取总游戏时间
     */
    public getTotalGameTime(): number {
        return this.totalGameTime;
    }
    
    /**
     * 获取波次配置
     */
    public getWaveConfigs(): any[] {
        return this.waveConfigs;
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
        
        // 显示波次提示横幅
        const waveType = this.currentWaveConfig.waveType || 'normal';
        const mainGameScene = this.scene as any;
        if (mainGameScene.waveBanner) {
            mainGameScene.waveBanner.showWaveBanner(waveType, waveNumber);
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
     * 检查是否需要开始新波次
     */
    private checkWaveStart(): void {
        // 如果当前没有激活波次，检查是否到时间开始下一波
        if (!this.isWaveActive && this.currentWave <= this.maxWaves) {
            const targetTime = this.waveStartTimes[this.currentWave - 1];
            
            if (targetTime && this.currentGameTime >= targetTime) {
                console.log(`[NewMonsterManager] Time to start wave ${this.currentWave} at ${this.currentGameTime}ms (target: ${targetTime}ms)`);
                this.startWave(this.currentWave);
            }
        }
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
            
            // 如果是最后一波，触发胜利
            if (this.currentWave === this.maxWaves) {
                console.log('Final wave completed! Victory!');
                this.scene.events.emit('all-waves-completed');
            } else {
                // 移动到下一波
                this.currentWave++;
            }
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
        // 更新游戏时间
        this.currentGameTime += delta;
        
        // 检查是否需要开始新波次
        this.checkWaveStart();
        
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
        
        // 发送时间更新事件给进度条
        this.scene.events.emit('game-time-update', {
            currentTime: this.currentGameTime,
            totalTime: this.totalGameTime
        });
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