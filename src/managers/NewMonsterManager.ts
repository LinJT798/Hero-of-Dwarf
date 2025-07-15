import { Goblin, GoblinState } from '../entities/Goblin';
import { CombatUnit } from '../interfaces/CombatUnit';

/**
 * 新的怪物管理器
 * 专门管理哥布林实体，支持波次系统
 */
export class NewMonsterManager {
    private scene: Phaser.Scene;
    private container: Phaser.GameObjects.Container;
    private goblins: Map<string, Goblin> = new Map();
    private nextGoblinId = 1;
    
    // 波次系统
    private currentWave: number = 1;
    private maxWaves: number = 5;
    private isWaveActive: boolean = false;
    private waveCompleteTimer: number = 0;
    private readonly WAVE_COMPLETE_DELAY = 3000; // 3秒延迟
    
    // 生成配置
    private readonly SPAWN_X = 1200; // 屏幕右侧
    private readonly SPAWN_Y = 789;  // 与矮人y轴一致
    
    // 波次配置
    private waveConfigs = [
        { wave: 1, goblins: 3, spawnInterval: 2000 }, // 第1波：3只哥布林，间隔2秒
        { wave: 2, goblins: 5, spawnInterval: 1500 }, // 第2波：5只哥布林，间隔1.5秒
        { wave: 3, goblins: 7, spawnInterval: 1200 }, // 第3波：7只哥布林，间隔1.2秒
        { wave: 4, goblins: 10, spawnInterval: 1000 }, // 第4波：10只哥布林，间隔1秒
        { wave: 5, goblins: 15, spawnInterval: 800 }   // 第5波：15只哥布林，间隔0.8秒
    ];
    
    // 生成队列
    private spawnQueue: Array<{ spawnTime: number; goblinIndex: number }> = [];
    private spawnTimer: number = 0;
    private goblinsSpawned: number = 0;
    private goblinsToSpawn: number = 0;
    
    // 目标列表（用于哥布林攻击）
    private targetBuildings: CombatUnit[] = [];
    private targetDwarfs: CombatUnit[] = [];
    
    constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
        this.scene = scene;
        this.container = container;
        
        this.setupEventListeners();
        this.startWave(1);
        
        console.log('NewMonsterManager initialized');
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
    private handleCastleAttacked(data: { goblin: Goblin }): void {
        console.log(`Castle attacked by goblin ${data.goblin.id}`);
        
        // 触发游戏失败事件
        this.scene.events.emit('castle-attacked', {
            attacker: data.goblin,
            type: 'goblin'
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
        
        const config = this.waveConfigs[waveNumber - 1];
        this.goblinsToSpawn = config.goblins;
        this.goblinsSpawned = 0;
        
        // 准备生成队列
        this.spawnQueue = [];
        this.spawnTimer = 0;
        
        for (let i = 0; i < config.goblins; i++) {
            this.spawnQueue.push({
                spawnTime: i * config.spawnInterval,
                goblinIndex: i
            });
        }
        
        console.log(`Wave ${waveNumber} started: ${config.goblins} goblins, interval: ${config.spawnInterval}ms`);
        this.scene.events.emit('wave-started', { wave: waveNumber, config });
    }
    
    /**
     * 生成哥布林
     */
    private spawnGoblin(): void {
        const goblinId = `goblin_${this.nextGoblinId++}`;
        const goblin = new Goblin(this.scene, goblinId, this.SPAWN_X);
        
        // 设置目标列表
        goblin.setTargets(this.targetBuildings, this.targetDwarfs);
        
        // 添加到容器
        this.container.add(goblin.getSprite());
        this.goblins.set(goblinId, goblin);
        this.goblinsSpawned++;
        
        console.log(`Spawned ${goblinId} for wave ${this.currentWave} (${this.goblinsSpawned}/${this.goblinsToSpawn})`);
    }
    
    /**
     * 检查波次是否完成
     */
    private checkWaveComplete(): void {
        if (!this.isWaveActive) return;
        
        // 检查是否所有哥布林都已生成且死亡/离开
        const allSpawned = this.goblinsSpawned >= this.goblinsToSpawn;
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
            goblinsSpawned: this.goblinsSpawned,
            goblinsToSpawn: this.goblinsToSpawn,
            aliveGoblins: this.getAliveGoblins().length,
            totalGoblins: this.goblins.size
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
            
            // 检查是否需要生成哥布林
            while (this.spawnQueue.length > 0 && this.spawnTimer >= this.spawnQueue[0].spawnTime) {
                this.spawnQueue.shift();
                this.spawnGoblin();
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
            if (this.waveCompleteTimer >= this.WAVE_COMPLETE_DELAY) {
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