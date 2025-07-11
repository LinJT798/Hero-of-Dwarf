/**
 * 怪物实体类
 * 负责怪物的移动、攻击和状态管理
 */
export class Monster {
    public id: string;
    private scene: Phaser.Scene;
    private sprite: Phaser.GameObjects.Rectangle;
    private healthBar: Phaser.GameObjects.Rectangle | null = null;
    private healthBackground: Phaser.GameObjects.Rectangle | null = null;
    
    // 位置和移动
    private x: number;
    private y: number;
    private targetX: number = 0;
    private targetY: number = 0;
    private moveSpeed: number;
    private isMoving: boolean = true;
    
    // 怪物属性
    private health: number;
    private maxHealth: number;
    private attack: number;
    private defense: number;
    private monsterType: string;
    private isDestroyed: boolean = false;
    
    // 路径和目标
    private pathIndex: number = 0;
    private movementPath: { x: number; y: number }[] = [];
    
    // 配置
    private readonly MONSTER_SIZE = 30;
    private readonly LEFT_BORDER = 0; // 最左边界

    constructor(scene: Phaser.Scene, id: string, monsterType: string, spawnX: number, spawnY: number) {
        this.scene = scene;
        this.id = id;
        this.monsterType = monsterType;
        this.x = spawnX;
        this.y = spawnY;
        
        this.loadMonsterConfig();
        this.createSprite();
        this.setupMovementPath();
        
        console.log(`Monster ${this.id} (${this.monsterType}) spawned at (${spawnX}, ${spawnY})`);
    }

    /**
     * 加载怪物配置
     */
    private loadMonsterConfig(): void {
        // 根据怪物类型设置属性（暂时使用默认值）
        const configs: { [key: string]: any } = {
            'basic_monster': {
                health: 50,
                attack: 10,
                defense: 5,
                moveSpeed: 60
            },
            'strong_monster': {
                health: 100,
                attack: 20,
                defense: 10,
                moveSpeed: 40
            },
            'fast_monster': {
                health: 30,
                attack: 8,
                defense: 2,
                moveSpeed: 100
            }
        };

        const config = configs[this.monsterType] || configs['basic_monster'];
        this.health = config.health;
        this.maxHealth = config.health;
        this.attack = config.attack;
        this.defense = config.defense;
        this.moveSpeed = config.moveSpeed;
    }

    /**
     * 创建精灵
     */
    private createSprite(): void {
        // 根据怪物类型设置颜色
        const colors: { [key: string]: number } = {
            'basic_monster': 0xFF4444,
            'strong_monster': 0xFF0000,
            'fast_monster': 0xFF8888
        };

        const color = colors[this.monsterType] || 0xFF4444;
        
        // 创建怪物主体
        this.sprite = this.scene.add.rectangle(this.x, this.y, this.MONSTER_SIZE, this.MONSTER_SIZE, color);
        this.sprite.setStrokeStyle(2, 0x000000);

        // 创建血条
        this.updateHealthBar();
    }

    /**
     * 设置移动路径
     */
    private setupMovementPath(): void {
        // 简单的直线路径：从右侧生成点到最左边界
        this.movementPath = [
            { x: this.x, y: this.y }, // 起始点
            { x: this.LEFT_BORDER, y: this.y } // 终点（最左边界）
        ];
        
        this.pathIndex = 0;
        this.setNextTarget();
    }

    /**
     * 设置下一个移动目标
     */
    private setNextTarget(): void {
        if (this.pathIndex < this.movementPath.length - 1) {
            this.pathIndex++;
            const target = this.movementPath[this.pathIndex];
            this.targetX = target.x;
            this.targetY = target.y;
            this.isMoving = true;
        } else {
            // 到达左边界
            this.reachLeftBorder();
        }
    }

    /**
     * 到达左边界
     */
    private reachLeftBorder(): void {
        console.log(`Monster ${this.id} reached the left border!`);
        
        // 触发游戏失败事件
        this.scene.events.emit('castle-attacked', {
            monsterId: this.id,
            damage: 1 // 数值无关紧要，到达即失败
        });
        
        // 怪物消失
        this.destroy();
    }

    /**
     * 更新怪物逻辑
     */
    public update(delta: number): void {
        if (this.isDestroyed) return;

        if (this.isMoving) {
            this.updateMovement(delta);
        }
    }

    /**
     * 更新移动逻辑
     */
    private updateMovement(delta: number): void {
        const deltaSeconds = delta / 1000;
        const moveDistance = this.moveSpeed * deltaSeconds;

        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= moveDistance) {
            // 到达当前目标点
            this.x = this.targetX;
            this.y = this.targetY;
            this.isMoving = false;
            this.setNextTarget();
        } else {
            // 继续移动
            const ratio = moveDistance / distance;
            this.x += dx * ratio;
            this.y += dy * ratio;
        }

        // 更新精灵位置
        this.sprite.setPosition(this.x, this.y);
        this.updateHealthBarPosition();
    }

    /**
     * 受到伤害
     */
    public takeDamage(damage: number): void {
        if (this.isDestroyed) return;

        const actualDamage = Math.max(1, damage - this.defense);
        this.health = Math.max(0, this.health - actualDamage);
        
        console.log(`Monster ${this.id} took ${actualDamage} damage, health: ${this.health}/${this.maxHealth}`);
        
        this.updateHealthBar();

        if (this.health <= 0) {
            this.onDeath();
        }
    }

    /**
     * 怪物死亡处理
     */
    private onDeath(): void {
        console.log(`Monster ${this.id} died`);
        
        // 触发怪物死亡事件
        this.scene.events.emit('monster-killed', {
            monsterId: this.id,
            monsterType: this.monsterType,
            position: { x: this.x, y: this.y }
        });
        
        this.destroy();
    }

    /**
     * 更新血条
     */
    private updateHealthBar(): void {
        if (this.healthBackground) {
            this.healthBackground.destroy();
        }
        if (this.healthBar) {
            this.healthBar.destroy();
        }

        const healthRatio = this.health / this.maxHealth;
        const barWidth = this.MONSTER_SIZE;
        const barHeight = 4;
        
        // 血条背景
        this.healthBackground = this.scene.add.rectangle(
            this.x, 
            this.y - this.MONSTER_SIZE/2 - 8, 
            barWidth, 
            barHeight, 
            0x000000
        );
        
        // 血条
        this.healthBar = this.scene.add.rectangle(
            this.x - barWidth/2 + (barWidth * healthRatio)/2, 
            this.y - this.MONSTER_SIZE/2 - 8, 
            barWidth * healthRatio, 
            barHeight, 
            healthRatio > 0.5 ? 0x00FF00 : healthRatio > 0.25 ? 0xFFFF00 : 0xFF0000
        );
    }

    /**
     * 更新血条位置
     */
    private updateHealthBarPosition(): void {
        if (this.healthBackground) {
            this.healthBackground.setPosition(this.x, this.y - this.MONSTER_SIZE/2 - 8);
        }
        if (this.healthBar) {
            const healthRatio = this.health / this.maxHealth;
            const barWidth = this.MONSTER_SIZE;
            this.healthBar.setPosition(
                this.x - barWidth/2 + (barWidth * healthRatio)/2,
                this.y - this.MONSTER_SIZE/2 - 8
            );
        }
    }

    /**
     * 获取怪物位置
     */
    public getPosition(): { x: number; y: number } {
        return { x: this.x, y: this.y };
    }

    /**
     * 获取怪物类型
     */
    public getMonsterType(): string {
        return this.monsterType;
    }

    /**
     * 获取怪物血量
     */
    public getHealth(): number {
        return this.health;
    }

    /**
     * 获取怪物最大血量
     */
    public getMaxHealth(): number {
        return this.maxHealth;
    }

    /**
     * 检查怪物是否还活着
     */
    public isAlive(): boolean {
        return !this.isDestroyed && this.health > 0;
    }

    /**
     * 获取到左边界的距离
     */
    public getDistanceToLeftBorder(): number {
        return this.x - this.LEFT_BORDER;
    }

    /**
     * 销毁怪物
     */
    public destroy(): void {
        if (this.isDestroyed) return;
        
        this.isDestroyed = true;
        
        // 播放死亡动画
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0,
            scaleX: 0,
            scaleY: 0,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                this.sprite.destroy();
                if (this.healthBar) {
                    this.healthBar.destroy();
                }
                if (this.healthBackground) {
                    this.healthBackground.destroy();
                }
            }
        });

        console.log(`Monster ${this.id} destroyed`);
    }
}