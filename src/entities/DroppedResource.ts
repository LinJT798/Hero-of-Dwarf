/**
 * 掉落资源实体
 * 表示从消除块掉落的资源
 */
export class DroppedResource {
    public id: string; // 添加id属性
    private scene: Phaser.Scene;
    private sprite: Phaser.GameObjects.Image;
    private resourceType: string;
    private targetY: number;
    private velocity: { x: number; y: number };
    private gravity: number = 800; // 重力加速度 (像素/秒²)
    private bounceDecay: number = 0.5; // 反弹衰减系数
    private isCollected: boolean = false;
    private claimedBy: string | null = null; // 被哪个矮人认领
    private claimTime: number = 0; // 认领时间
    private readonly CLAIM_TIMEOUT = 10000; // 认领超时时间（10秒）
    private hasLanded: boolean = false;
    
    // 资源大小
    private readonly RESOURCE_SIZE = 30;
    private readonly GROUND_Y = 789; // 地面Y坐标

    constructor(
        scene: Phaser.Scene, 
        x: number, 
        y: number, 
        resourceType: string
    ) {
        this.scene = scene;
        this.resourceType = resourceType;
        this.targetY = this.GROUND_Y - this.RESOURCE_SIZE / 2; // 资源底部接触地面
        
        // 生成唯一ID
        this.id = `resource_${Math.round(x)}_${Math.round(y)}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 使用真实资源图片
        const resourceKey = resourceType === 'gold' ? 'coin' : resourceType;
        this.sprite = scene.add.image(x, y, resourceKey);
        this.sprite.setDisplaySize(this.RESOURCE_SIZE, this.RESOURCE_SIZE);
        this.sprite.setDepth(5);
        
        // 初始化物理属性
        this.velocity = {
            x: (Math.random() - 0.5) * 50, // 较小的随机水平速度 (-25 到 25)
            y: 0 // 初始垂直速度为0
        };
        
        // 不再需要固定的反弹速度，使用物理计算
    }

    /**
     * 更新掉落逻辑
     */
    public update(delta: number): boolean {
        if (this.isCollected) return false;
        
        // 检查认领超时
        if (this.claimedBy !== null && Date.now() - this.claimTime > this.CLAIM_TIMEOUT) {
            console.log(`[Resource] ${this.resourceType} 认领超时，自动释放认领 (之前被 ${this.claimedBy} 认领)`);
            this.releaseClaim();
        }
        
        const deltaSeconds = delta / 1000;
        
        // 应用重力
        this.velocity.y += this.gravity * deltaSeconds;
        
        // 更新位置
        const newX = this.sprite.x + this.velocity.x * deltaSeconds;
        const newY = this.sprite.y + this.velocity.y * deltaSeconds;
        
        this.sprite.setX(newX);
        
        // 检查是否碰到地面
        if (newY >= this.targetY) {
            this.sprite.setY(this.targetY);
            
            // 反弹效果
            if (!this.hasLanded) {
                // 第一次落地，产生反弹
                this.velocity.y = -Math.abs(this.velocity.y) * this.bounceDecay; // 使用当前速度的一部分反弹
                this.velocity.x = (Math.random() - 0.5) * 30; // 较小的随机水平速度
                this.hasLanded = true;
            } else if (Math.abs(this.velocity.y) > 50) {
                // 后续反弹
                this.velocity.y = -Math.abs(this.velocity.y) * this.bounceDecay;
                this.velocity.x *= 0.8; // 水平速度也衰减
            } else {
                // 停止垂直运动
                this.velocity.y = 0;
                // 水平速度快速衰减
                this.velocity.x *= 0.8;
                
                // 如果速度很小，完全停止
                if (Math.abs(this.velocity.x) < 2) {
                    this.velocity.x = 0;
                }
            }
        } else {
            this.sprite.setY(newY);
        }
        
        // 边界检查
        if (this.sprite.x < 0 || this.sprite.x > 1280) {
            this.velocity.x = -this.velocity.x; // 反弹
        }
        
        return true; // 继续更新
    }

    /**
     * 获取资源颜色
     */
    private getResourceColor(type: string): number {
        const colors: { [key: string]: number } = {
            'gold': 0xFFD700,
            'wood': 0x8B4513,
            'stone': 0x696969,
            'mithril': 0xC0C0C0,
            'food': 0x32CD32
        };
        return colors[type] || 0xFFFFFF;
    }

    /**
     * 获取资源符号
     */
    private getResourceSymbol(type: string): string {
        const symbols: { [key: string]: string } = {
            'gold': '金',
            'wood': '木',
            'stone': '石',
            'mithril': '银',
            'food': '食'
        };
        return symbols[type] || '?';
    }

    /**
     * 标记为已收集
     */
    public collect(): void {
        this.isCollected = true;
    }
    
    /**
     * 认领资源
     */
    public claim(dwarfId: string): boolean {
        if (this.claimedBy === null && !this.isCollected) {
            this.claimedBy = dwarfId;
            this.claimTime = Date.now(); // 记录认领时间
            console.log(`[Resource] ${this.resourceType} 被矮人 ${dwarfId} 认领`);
            return true;
        }
        return false;
    }
    
    /**
     * 释放认领
     */
    public releaseClaim(): void {
        if (this.claimedBy !== null) {
            console.log(`[Resource] ${this.resourceType} 的认领被释放，之前被 ${this.claimedBy} 认领`);
            this.claimedBy = null;
            this.claimTime = 0; // 重置认领时间
        }
    }
    
    /**
     * 检查是否已被认领
     */
    public isClaimed(): boolean {
        return this.claimedBy !== null;
    }
    
    /**
     * 获取认领者ID
     */
    public getClaimedBy(): string | null {
        return this.claimedBy;
    }

    /**
     * 获取资源类型
     */
    public getResourceType(): string {
        return this.resourceType;
    }

    /**
     * 获取位置
     */
    public getPosition(): { x: number; y: number } {
        return {
            x: this.sprite.x,
            y: this.sprite.y
        };
    }

    /**
     * 检查是否在收集范围内
     */
    public isInCollectionRange(x: number, y: number, range: number): boolean {
        const dx = this.sprite.x - x;
        const dy = this.sprite.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= range;
    }

    /**
     * 是否已被收集
     */
    public getIsCollected(): boolean {
        return this.isCollected;
    }
    
    /**
     * 检查资源是否已经稳定（停止移动）
     */
    public isStable(): boolean {
        // 降低速度阈值，让资源更容易被认为稳定
        const velocityThreshold = 2; // 从5降低到2
        const groundThreshold = 10; // 允许资源在地面附近就被认为稳定
        
        // 如果资源接近地面且速度很小，就认为稳定
        const nearGround = this.sprite.y >= (this.GROUND_Y - groundThreshold);
        const slowMoving = Math.abs(this.velocity.x) < velocityThreshold && 
                          Math.abs(this.velocity.y) < velocityThreshold;
        
        // 更宽松的稳定性判断：接近地面且移动缓慢就行
        const stable = nearGround && slowMoving;
        
        return stable;
    }

    /**
     * 销毁资源
     */
    public destroy(): void {
        this.sprite.destroy();
    }
}