import { Monster } from '../entities/Monster';

/**
 * 怪物管理器
 * 负责怪物的生成、管理和波次控制
 */
export class MonsterManager {
    private scene: Phaser.Scene;
    private container: Phaser.GameObjects.Container;
    private monsters: Map<string, Monster> = new Map();
    private nextMonsterId = 1;
    
    // 生成配置
    private readonly SPAWN_X = 1200; // 右侧生成点
    private readonly SPAWN_Y_RANGE = { min: 500, max: 750 }; // Y轴生成范围
    
    // 波次系统
    private currentWave = 0;
    private waveInProgress = false;
    private monstersInWave = 0;
    private monstersKilledInWave = 0;
    private waveStartTime = 0;
    private nextSpawnTime = 0;
    
    // 波次配置
    private waveConfigs = [
        {
            wave: 1,
            monsters: [
                { type: 'basic_monster', count: 5, interval: 2000 }
            ]
        },
        {
            wave: 2,
            monsters: [
                { type: 'basic_monster', count: 8, interval: 1500 },
                { type: 'strong_monster', count: 2, interval: 3000 }
            ]
        },
        {
            wave: 3,
            monsters: [
                { type: 'basic_monster', count: 10, interval: 1000 },
                { type: 'fast_monster', count: 5, interval: 2000 },
                { type: 'strong_monster', count: 3, interval: 4000 }
            ]
        }
    ];
    
    private currentWaveConfig: any = null;
    private spawnQueue: any[] = [];

    constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
        this.scene = scene;
        this.container = container;
        
        this.initialize();
    }

    /**
     * 初始化怪物管理器
     */
    private initialize(): void {
        this.setupEventListeners();
        
        console.log('MonsterManager initialized');
    }

    /**
     * 设置事件监听
     */
    private setupEventListeners(): void {
        this.scene.events.on('monster-killed', this.handleMonsterKilled, this);
        this.scene.events.on('castle-attacked', this.handleCastleAttacked, this);
        this.scene.events.on('start-wave', this.startWave, this);
    }

    /**
     * 处理怪物死亡
     */
    private handleMonsterKilled(data: { monsterId: string; monsterType: string; position: any }): void {
        console.log(`Monster killed: ${data.monsterId} (${data.monsterType})`);
        
        this.monsters.delete(data.monsterId);
        this.monstersKilledInWave++;
        
        // 触发奖励事件（可以给玩家奖励资源等）
        this.scene.events.emit('monster-reward', {
            monsterType: data.monsterType,
            position: data.position
        });
        
        // 检查波次是否完成
        this.checkWaveCompletion();
    }

    /**
     * 处理城堡受攻击
     */
    private handleCastleAttacked(data: { monsterId: string; damage: number }): void {
        console.log(`Castle attacked by ${data.monsterId} for ${data.damage} damage`);
        
        this.monsters.delete(data.monsterId);
        
        // 触发城堡血量减少事件
        this.scene.events.emit('castle-damage', {
            damage: data.damage
        });
    }

    /**
     * 开始波次
     */
    public startWave(waveNumber?: number): void {
        if (this.waveInProgress) {
            console.warn('Wave already in progress');
            return;
        }

        this.currentWave = waveNumber || this.currentWave + 1;
        this.currentWaveConfig = this.waveConfigs.find(config => config.wave === this.currentWave);
        
        if (!this.currentWaveConfig) {
            console.log('No more waves configured');
            return;
        }

        this.waveInProgress = true;
        this.monstersInWave = 0;
        this.monstersKilledInWave = 0;
        this.waveStartTime = Date.now();
        this.nextSpawnTime = this.waveStartTime;
        
        // 准备生成队列
        this.prepareSpawnQueue();
        
        console.log(`Starting wave ${this.currentWave}`);
        this.scene.events.emit('wave-started', {
            wave: this.currentWave,
            totalMonsters: this.monstersInWave
        });
    }

    /**
     * 准备生成队列
     */
    private prepareSpawnQueue(): void {
        this.spawnQueue = [];
        
        this.currentWaveConfig.monsters.forEach((monsterGroup: any) => {
            for (let i = 0; i < monsterGroup.count; i++) {
                this.spawnQueue.push({
                    type: monsterGroup.type,
                    spawnTime: this.waveStartTime + (i * monsterGroup.interval)
                });
                this.monstersInWave++;
            }
        });
        
        // 按生成时间排序
        this.spawnQueue.sort((a, b) => a.spawnTime - b.spawnTime);
    }

    /**
     * 生成怪物
     */
    private spawnMonster(monsterType: string): void {
        const monsterId = `monster_${this.nextMonsterId++}`;
        const spawnY = this.SPAWN_Y_RANGE.min + 
                      Math.random() * (this.SPAWN_Y_RANGE.max - this.SPAWN_Y_RANGE.min);
        
        const monster = new Monster(this.scene, monsterId, monsterType, this.SPAWN_X, spawnY);
        this.monsters.set(monsterId, monster);
        
        console.log(`Spawned ${monsterType}: ${monsterId}`);
    }

    /**
     * 检查波次完成
     */
    private checkWaveCompletion(): void {
        if (!this.waveInProgress) return;
        
        const remainingMonsters = this.monsters.size;
        const allMonstersSpawned = this.spawnQueue.length === 0;
        
        if (allMonstersSpawned && remainingMonsters === 0) {
            this.completeWave();
        }
    }

    /**
     * 完成波次
     */
    private completeWave(): void {
        this.waveInProgress = false;
        
        console.log(`Wave ${this.currentWave} completed! Monsters killed: ${this.monstersKilledInWave}`);
        
        this.scene.events.emit('wave-completed', {
            wave: this.currentWave,
            monstersKilled: this.monstersKilledInWave
        });
        
        // 检查是否还有更多波次
        if (this.currentWave < this.waveConfigs.length) {
            // 延迟开始下一波
            this.scene.time.delayedCall(3000, () => {
                this.startWave();
            });
        } else {
            // 所有波次完成
            this.scene.events.emit('all-waves-completed', {
                totalWaves: this.waveConfigs.length
            });
        }
    }

    /**
     * 更新怪物管理器
     */
    public update(delta: number): void {
        const currentTime = Date.now();
        
        // 处理怪物生成
        if (this.waveInProgress && this.spawnQueue.length > 0) {
            const nextSpawn = this.spawnQueue[0];
            if (currentTime >= nextSpawn.spawnTime) {
                this.spawnMonster(nextSpawn.type);
                this.spawnQueue.shift();
            }
        }
        
        // 更新所有怪物
        this.monsters.forEach(monster => {
            monster.update(delta);
        });
    }

    /**
     * 获取所有活着的怪物
     */
    public getAliveMonsters(): Monster[] {
        return Array.from(this.monsters.values()).filter(monster => monster.isAlive());
    }

    /**
     * 获取怪物数量
     */
    public getMonsterCount(): number {
        return this.monsters.size;
    }

    /**
     * 获取当前波次信息
     */
    public getCurrentWaveInfo(): any {
        return {
            wave: this.currentWave,
            inProgress: this.waveInProgress,
            totalMonsters: this.monstersInWave,
            remainingMonsters: this.monsters.size,
            killedMonsters: this.monstersKilledInWave
        };
    }

    /**
     * 强制开始下一波（调试用）
     */
    public forceNextWave(): void {
        if (!this.waveInProgress) {
            this.startWave();
        }
    }

    /**
     * 清除所有怪物
     */
    public clearAllMonsters(): void {
        this.monsters.forEach(monster => {
            monster.destroy();
        });
        this.monsters.clear();
        
        console.log('All monsters cleared');
    }

    /**
     * 暂停/恢复波次
     */
    public pauseWave(): void {
        // 暂停实现（可以用于暂停游戏功能）
        console.log('Wave paused');
    }

    public resumeWave(): void {
        // 恢复实现
        console.log('Wave resumed');
    }

    /**
     * 获取波次统计信息
     */
    public getWaveStats(): string {
        const info = this.getCurrentWaveInfo();
        return `波次 ${info.wave}: ${info.killedMonsters}/${info.totalMonsters} 击杀, 剩余 ${info.remainingMonsters}`;
    }

    /**
     * 销毁管理器
     */
    public destroy(): void {
        this.scene.events.off('monster-killed', this.handleMonsterKilled, this);
        this.scene.events.off('castle-attacked', this.handleCastleAttacked, this);
        this.scene.events.off('start-wave', this.startWave, this);
        
        this.clearAllMonsters();
        
        console.log('MonsterManager destroyed');
    }
}