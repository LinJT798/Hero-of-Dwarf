import { resourceManager } from '../managers/ResourceManager';
import { WorldTaskManager } from '../managers/WorldTaskManager';
import { CombatUnit, CombatAttributes, CombatUtils } from '../interfaces/CombatUnit';
import { configManager } from '../systems/ConfigManager';
import { UnitConfig } from '../types/config/UnitConfig';

/**
 * 矮人NPC实体 - 全新状态机架构
 * 实现5个状态：Combat > Deliver > Build > Gather > Idle
 */
export class Dwarf implements CombatUnit {
    public id: string;
    private scene: Phaser.Scene;
    private sprite!: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
    private healthBar: Phaser.GameObjects.Rectangle | null = null;
    private healthBarBg: Phaser.GameObjects.Rectangle | null = null;
    
    // 位置和移动
    private x: number;
    private y: number;
    private targetX: number = 0;
    private targetY: number = 0;
    private isMoving: boolean = false;
    private moveSpeed: number;
    private groundY: number;
    
    // 待机动画系统
    private currentIdleSet: number = 1; // 当前使用的待机动画套装 (1 或 2)
    private idleAnimationTimer: number = 0;
    private idleStaticDuration: number = 0; // 静止状态的持续时间
    private isPlayingIdleAnimation: boolean = false; // 是否正在播放idle动画
    private idleAnimationDecided: boolean = false; // 是否已经决定了当前的idle行为
    private idleAnimationChance: number;
    private idleMoveChance: number;
    private idleStaticDurationMin: number;
    private idleStaticDurationMax: number;
    
    // 待机行为类型
    private currentIdleBehavior: 'static' | 'move' | 'animation' | 'none' = 'none';
    
    // 新状态机系统
    private state: DwarfState = DwarfState.IDLE;
    private targetResourceId: string | null = null;
    private targetBuildId: string | null = null;
    private combatTarget: any = null;
    private inventory: Map<string, number> = new Map();
    
    // 感知系统
    private sensedResources: any[] = [];
    private sensedBuildSites: any[] = [];
    private sensedMonsters: any[] = [];
    private lastPerceptionUpdate: number = 0;
    
    // 战斗属性
    private combatAttributes: CombatAttributes;
    
    // 战斗相关
    private attackTimer: number = 0;
    
    // 配置参数
    private dwarfSize: number;
    private senseRadius: number;
    private threatRadius: number;
    private carryCapacity: number;
    private collectionRange: number;
    private buildRange: number;
    private castleXStart: number;
    private castleXEnd: number;
    
    // 单位配置
    private unitConfig: UnitConfig | null = null;
    
    // 随机移动（空闲状态）
    private idleTimer: number = 0;
    private nextIdleMove: number = 8000;
    
    // 销毁标志
    private isDestroyed: boolean = false;

    constructor(scene: Phaser.Scene, id: string, x: number, y: number) {
        this.scene = scene;
        this.id = id;
        this.x = x;
        
        // 加载配置
        this.loadConfig();
        
        // 设置Y坐标为配置中的地面高度
        this.y = this.groundY;
        
        this.createSprite();
        this.createHealthBar();
        this.setupEventListeners();
        
        console.log(`Dwarf ${this.id} created at (${x}, ${y}) with config-based attributes`);
    }
    
    /**
     * 从配置加载矮人属性
     */
    private loadConfig(): void {
        const unitsConfig = configManager.getUnitsConfig();
        const worldConfig = configManager.getWorldConfig();
        
        console.log(`[Dwarf] Loading config, unitsConfig:`, unitsConfig);
        
        if (unitsConfig && unitsConfig.units && unitsConfig.units.dwarf) {
            this.unitConfig = unitsConfig.units.dwarf;
            
            // 战斗属性
            this.combatAttributes = { ...this.unitConfig.combat };
            
            // 移动属性
            this.moveSpeed = this.unitConfig.movement.speed;
            this.groundY = this.unitConfig.movement.groundY;
            
            // AI属性
            const ai = this.unitConfig.ai;
            this.senseRadius = ai.senseRadius || 120;
            this.threatRadius = ai.threatRadius || 80;
            this.collectionRange = ai.collectionRange || 50;
            this.buildRange = ai.buildRange || 60;
            this.carryCapacity = ai.carryCapacity || 5;
            
            // 城堡边界
            if (ai.castleBoundary) {
                this.castleXStart = ai.castleBoundary.left;
                this.castleXEnd = ai.castleBoundary.right;
            } else if (worldConfig?.castle?.boundary) {
                this.castleXStart = worldConfig.castle.boundary.left;
                this.castleXEnd = worldConfig.castle.boundary.right;
            } else {
                this.castleXStart = -221;
                this.castleXEnd = 239;
            }
            
            // 待机行为
            if (this.unitConfig.idle) {
                this.idleAnimationChance = this.unitConfig.idle.animationChance;
                this.idleMoveChance = this.unitConfig.idle.moveChance;
                this.idleStaticDurationMin = this.unitConfig.idle.staticDurationMin;
                this.idleStaticDurationMax = this.unitConfig.idle.staticDurationMax;
            } else {
                this.idleAnimationChance = 0.33;
                this.idleMoveChance = 0.33;
                this.idleStaticDurationMin = 2000;
                this.idleStaticDurationMax = 4000;
            }
            
            // 显示属性
            this.dwarfSize = this.unitConfig.display.size;
            
            console.log(`Dwarf config loaded: health=${this.combatAttributes.health}, speed=${this.moveSpeed}, size=${this.dwarfSize}`);
        } else {
            console.warn('Dwarf config not found, using defaults');
            this.loadDefaultConfig();
        }
    }
    
    /**
     * 加载默认配置
     */
    private loadDefaultConfig(): void {
        this.combatAttributes = {
            health: 100,
            maxHealth: 100,
            attack: 20,
            range: 50,
            attackSpeed: 1500,
            armor: 5
        };
        
        this.moveSpeed = 100;
        this.groundY = 789;
        this.dwarfSize = 80;
        this.senseRadius = 120;
        this.threatRadius = 80;
        this.carryCapacity = 5;
        this.collectionRange = 50;
        this.buildRange = 60;
        this.castleXStart = -221;
        this.castleXEnd = 239;
        
        this.idleAnimationChance = 0.33;
        this.idleMoveChance = 0.33;
        this.idleStaticDurationMin = 2000;
        this.idleStaticDurationMax = 4000;
    }

    /**
     * 创建精灵 (使用动画Sprite)
     */
    private createSprite(): void {
        // 优先使用101帧序列动画
        if (this.scene.textures.exists('dwarf_walk_1')) {
            this.sprite = this.scene.add.sprite(this.x, this.y, 'dwarf_walk_1');
            this.sprite.setOrigin(0.5, 1); // 底部中心对齐，确保矮人站在地面上
            
            // 保存对sprite的引用，确保不会被修改
            this.sprite.setData('isDwarfSprite', true);
            this.sprite.setData('dwarfId', this.id);
            
            // 自动缩放到合适尺寸（保持宽高比）
            this.scaleSprite();
            
            // 创建动画
            this.createAnimations();
            
            // 默认播放idle动画
            this.playAnimation('idle');
        } else if (this.scene.textures.exists('dwarf_character')) {
            // 回退到静态图片
            this.sprite = this.scene.add.image(this.x, this.y, 'dwarf_character');
            this.sprite.setOrigin(0.5, 1);
            this.sprite.setDisplaySize(this.dwarfSize, this.dwarfSize);
        } else {
            // 如果所有图片都加载失败，使用备用矩形
            console.warn('Dwarf images not loaded, using fallback');
            this.sprite = this.scene.add.rectangle(this.x, this.y, this.dwarfSize, this.dwarfSize, 0x0000FF);
            this.sprite.setOrigin(0.5, 1);
            this.sprite.setStrokeStyle(2, 0x000000);
        }
    }
    
    /**
     * 检查并修复精灵状态
     */
    private validateAndFixSprite(): boolean {
        if (!this.sprite) {
            console.error(`[Dwarf ${this.id}] 精灵不存在，尝试重新创建`);
            this.createSprite();
            return !!this.sprite;
        }
        
        if ((this.sprite as any).destroyed) {
            console.error(`[Dwarf ${this.id}] 精灵已被销毁，尝试重新创建`);
            this.createSprite();
            return !!this.sprite;
        }
        
        // 检查是否是正确的Sprite类型
        if (this.sprite instanceof Phaser.GameObjects.Sprite) {
            const sprite = this.sprite as Phaser.GameObjects.Sprite;
            
            // 检查play方法是否存在
            if (typeof sprite.play !== 'function') {
                console.error(`[Dwarf ${this.id}] Sprite的play方法丢失，尝试重新创建`);
                const x = this.sprite.x || this.x;
                const y = this.sprite.y || this.y;
                this.sprite.destroy();
                this.x = x;
                this.y = y;
                this.createSprite();
                return !!this.sprite;
            }
            
            return true;
        }
        
        return false;
    }

    /**
     * 自动缩放精灵到合适尺寸
     */
    private scaleSprite(): void {
        if (this.sprite instanceof Phaser.GameObjects.Sprite || this.sprite instanceof Phaser.GameObjects.Image) {
            // 获取原始尺寸
            const originalWidth = this.sprite.width;
            const originalHeight = this.sprite.height;
            
            // 计算缩放比例，保持宽高比
            const scaleX = this.dwarfSize / originalWidth;
            const scaleY = this.dwarfSize / originalHeight;
            const scale = Math.min(scaleX, scaleY); // 使用较小的缩放比例保持宽高比
            
            this.sprite.setScale(scale);
            
            console.log(`Dwarf sprite scaled: ${originalWidth}x${originalHeight} -> ${scale.toFixed(2)}x scale`);
        }
    }

    /**
     * 创建矮人动画
     */
    private createAnimations(): void {
        const animsManager = this.scene.anims;
        
        // 创建101帧行走动画
        if (!animsManager.exists(`dwarf_walk_${this.id}`)) {
            // 生成101帧的texture keys (使用processed_frame_x命名)
            const walkFrames = [];
            for (let i = 1; i <= 101; i++) {
                walkFrames.push({ key: `dwarf_walk_${i}` });
            }
            
            animsManager.create({
                key: `dwarf_walk_${this.id}`,
                frames: walkFrames,
                frameRate: 20, // 原始20帧/秒
                repeat: -1
            });
        }
        
        // 创建第一套待机动画
        if (!animsManager.exists(`dwarf_idle1_${this.id}`)) {
            if (this.scene.textures.exists('dwarf_idle1_1')) {
                // 如果有专门的待机动画，使用它
                const idle1Frames = [];
                // 101帧待机动画
                for (let i = 1; i <= 101; i++) {
                    if (this.scene.textures.exists(`dwarf_idle1_${i}`)) {
                        idle1Frames.push({ key: `dwarf_idle1_${i}` });
                    }
                }
                
                if (idle1Frames.length > 0) {
                    animsManager.create({
                        key: `dwarf_idle1_${this.id}`,
                        frames: idle1Frames,
                        frameRate: 20, // 20帧/秒，统一帧率
                        repeat: 0 // 播放一次
                    });
                }
            } else {
                // 回退到行走动画的第一帧
                animsManager.create({
                    key: `dwarf_idle1_${this.id}`,
                    frames: [{ key: 'dwarf_walk_1' }],
                    frameRate: 1,
                    repeat: -1
                });
            }
        }
        
        // 创建第二套待机动画
        if (!animsManager.exists(`dwarf_idle2_${this.id}`)) {
            if (this.scene.textures.exists('dwarf_idle2_1')) {
                // 如果有第二套待机动画，使用它
                const idle2Frames = [];
                // 101帧待机动画
                for (let i = 1; i <= 101; i++) {
                    if (this.scene.textures.exists(`dwarf_idle2_${i}`)) {
                        idle2Frames.push({ key: `dwarf_idle2_${i}` });
                    }
                }
                
                if (idle2Frames.length > 0) {
                    animsManager.create({
                        key: `dwarf_idle2_${this.id}`,
                        frames: idle2Frames,
                        frameRate: 20, // 20帧/秒，统一帧率
                        repeat: 0 // 播放一次
                    });
                }
            } else {
                // 回退到行走动画的第一帧
                animsManager.create({
                    key: `dwarf_idle2_${this.id}`,
                    frames: [{ key: 'dwarf_walk_1' }],
                    frameRate: 1,
                    repeat: -1
                });
            }
        }
        
        // 创建建造动画
        if (!animsManager.exists(`dwarf_build_${this.id}`)) {
            console.log(`[Dwarf ${this.id}] 创建建造动画...`);
            if (this.scene.textures.exists('dwarf_build_1')) {
                // 如果有专门的建造动画，使用它
                const buildFrames = [];
                // 73帧建造动画
                for (let i = 1; i <= 73; i++) {
                    if (this.scene.textures.exists(`dwarf_build_${i}`)) {
                        buildFrames.push({ key: `dwarf_build_${i}` });
                    }
                }
                
                console.log(`[Dwarf ${this.id}] 找到 ${buildFrames.length} 帧建造动画`);
                
                if (buildFrames.length > 0) {
                    animsManager.create({
                        key: `dwarf_build_${this.id}`,
                        frames: buildFrames,
                        frameRate: 20, // 20帧/秒，统一帧率
                        repeat: -1
                    });
                    console.log(`[Dwarf ${this.id}] 建造动画创建成功`);
                }
            } else {
                console.log(`[Dwarf ${this.id}] 没有找到建造动画帧，使用备用动画`);
                // 回退到第一套待机动画
                animsManager.create({
                    key: `dwarf_build_${this.id}`,
                    frames: [{ key: 'dwarf_walk_1' }],
                    frameRate: 1,
                    repeat: -1
                });
            }
        }
        
        // 创建攻击动画
        if (!animsManager.exists(`dwarf_attack_${this.id}`)) {
            console.log(`[Dwarf ${this.id}] 创建攻击动画...`);
            if (this.scene.textures.exists('dwarf_attack_1')) {
                const attackFrames = [];
                for (let i = 1; i <= 101; i++) {
                    if (this.scene.textures.exists(`dwarf_attack_${i}`)) {
                        attackFrames.push({ key: `dwarf_attack_${i}` });
                    }
                }
                
                if (attackFrames.length > 0) {
                    animsManager.create({
                        key: `dwarf_attack_${this.id}`,
                        frames: attackFrames,
                        frameRate: 20, // 20帧/秒，统一帧率
                        repeat: 0 // 播放一次
                    });
                    console.log(`[Dwarf ${this.id}] 攻击动画创建成功，共 ${attackFrames.length} 帧`);
                }
            } else {
                console.log(`[Dwarf ${this.id}] 没有找到攻击动画帧，使用备用动画`);
                // 回退到行走动画的第一帧
                animsManager.create({
                    key: `dwarf_attack_${this.id}`,
                    frames: [{ key: 'dwarf_walk_1' }],
                    frameRate: 1,
                    repeat: -1
                });
            }
        }
    }

    /**
     * 获取血条对象（供管理器添加到容器）
     */
    public getHealthBarObjects(): Phaser.GameObjects.GameObject[] {
        const objects: Phaser.GameObjects.GameObject[] = [];
        if (this.healthBarBg) objects.push(this.healthBarBg);
        if (this.healthBar) objects.push(this.healthBar);
        return objects;
    }
    
    /**
     * 创建血条
     */
    private createHealthBar(): void {
        const barWidth = this.unitConfig?.display.healthBar.width || 60;
        const barHeight = this.unitConfig?.display.healthBar.height || 4;
        const barY = this.y + (this.unitConfig?.display.healthBar.offsetY || -85); // 精灵上方
        
        // 背景
        this.healthBarBg = this.scene.add.rectangle(this.x, barY, barWidth, barHeight, 0x000000);
        this.healthBarBg.setOrigin(0.5, 0.5);
        
        // 血条
        this.healthBar = this.scene.add.rectangle(this.x, barY, barWidth, barHeight, 0x00FF00);
        this.healthBar.setOrigin(0.5, 0.5);
    }
    
    /**
     * 更新血条
     */
    private updateHealthBar(): void {
        if (!this.healthBar || !this.healthBarBg) return;
        
        const healthRatio = this.combatAttributes.health / this.combatAttributes.maxHealth;
        const barWidth = this.unitConfig?.display.healthBar.width || 60;
        
        // 更新血条宽度
        this.healthBar.setDisplaySize(barWidth * healthRatio, 4);
        
        // 更新血条颜色
        let color = 0x00FF00; // 绿色
        if (healthRatio < 0.5) {
            color = 0xFFFF00; // 黄色
        }
        if (healthRatio < 0.25) {
            color = 0xFF0000; // 红色
        }
        
        this.healthBar.setFillStyle(color);
        
        // 更新血条位置
        const barOffsetY = this.unitConfig?.display.healthBar.offsetY || -85;
        this.healthBar.setPosition(this.x, this.y + barOffsetY);
        this.healthBarBg.setPosition(this.x, this.y + barOffsetY);
    }

    /**
     * 播放动画
     */
    private playAnimation(animationType: 'walk' | 'idle' | 'build' | 'attack'): void {
        // 调试信息
        console.log(`[Dwarf ${this.id}] playAnimation called with type: ${animationType}`);
        
        // 验证并修复精灵状态
        if (!this.validateAndFixSprite()) {
            console.error(`[Dwarf ${this.id}] 无法播放动画 ${animationType}: 精灵验证失败`);
            return;
        }
        
        const sprite = this.sprite as Phaser.GameObjects.Sprite;
        
        try {
            if (animationType === 'walk') {
                const animKey = `dwarf_walk_${this.id}`;
                if (this.scene.anims.exists(animKey)) {
                    sprite.play(animKey);
                }
            } else if (animationType === 'idle') {
                // 只有在IDLE状态下才通过decideIdleAnimation来处理
                if (this.state === DwarfState.IDLE) {
                    this.idleAnimationDecided = false;
                } else {
                    // 其他状态下停止动画并显示静态帧
                    sprite.stop();
                    if (this.scene.textures.exists('dwarf_walk_1')) {
                        sprite.setTexture('dwarf_walk_1');
                    }
                }
            } else if (animationType === 'build') {
                const animKey = `dwarf_build_${this.id}`;
                console.log(`[Dwarf ${this.id}] 尝试播放建造动画: ${animKey}, 动画存在: ${this.scene.anims.exists(animKey)}`);
                if (this.scene.anims.exists(animKey)) {
                    sprite.play(animKey);
                    console.log(`[Dwarf ${this.id}] 成功播放建造动画`);
                } else {
                    console.warn(`[Dwarf ${this.id}] 建造动画不存在: ${animKey}`);
                }
            } else if (animationType === 'attack') {
                const animKey = `dwarf_attack_${this.id}`;
                console.log(`[Dwarf ${this.id}] 尝试播放攻击动画: ${animKey}, 动画存在: ${this.scene.anims.exists(animKey)}`);
                if (this.scene.anims.exists(animKey)) {
                    sprite.play(animKey);
                    console.log(`[Dwarf ${this.id}] 成功播放攻击动画`);
                } else {
                    console.warn(`[Dwarf ${this.id}] 攻击动画不存在: ${animKey}`);
                }
            }
        } catch (error) {
            console.error(`[Dwarf ${this.id}] 播放动画时出错:`, error);
            console.error(`[Dwarf ${this.id}] sprite状态:`, {
                exists: !!this.sprite,
                type: this.sprite ? this.sprite.constructor.name : 'undefined',
                destroyed: this.sprite ? (this.sprite as any).destroyed : 'unknown'
            });
            
            // 尝试重新创建精灵
            console.error(`[Dwarf ${this.id}] 尝试重新创建精灵...`);
            this.createSprite();
        }
    }

    /**
     * 播放随机待机动画
     */
    private playRandomIdleAnimation(): void {
        if (this.sprite instanceof Phaser.GameObjects.Sprite) {
            // 随机选择待机动画套装
            this.currentIdleSet = Math.random() < 0.5 ? 1 : 2;
            const animKey = `dwarf_idle${this.currentIdleSet}_${this.id}`;
            
            if (this.scene.anims.exists(animKey)) {
                this.sprite.play(animKey);
                this.isPlayingIdleAnimation = true;
                
                // 监听动画完成事件
                this.sprite.once('animationcomplete', (animation: any) => {
                    console.log(`[Dwarf ${this.id}] idle animation completed: ${animation.key}`);
                    this.isPlayingIdleAnimation = false;
                    this.idleAnimationDecided = false; // 重新决定下一个行为
                    this.currentIdleBehavior = 'none';
                });
                
                console.log(`[Dwarf ${this.id}] playing idle animation set ${this.currentIdleSet}`);
            } else {
                // 回退到第一套
                const fallbackKey = `dwarf_idle1_${this.id}`;
                if (this.scene.anims.exists(fallbackKey)) {
                    this.sprite.play(fallbackKey);
                    this.isPlayingIdleAnimation = true;
                    
                    // 监听动画完成事件
                    this.sprite.once('animationcomplete', (animation: any) => {
                        console.log(`[Dwarf ${this.id}] idle animation completed (fallback): ${animation.key}`);
                        this.isPlayingIdleAnimation = false;
                        this.idleAnimationDecided = false;
                        this.currentIdleBehavior = 'none';
                    });
                }
            }
            
            // 重置计时器
            this.idleAnimationTimer = 0;
        }
    }

    /**
     * 更新精灵方向
     */
    private updateSpriteDirection(direction: number): void {
        if (this.sprite instanceof Phaser.GameObjects.Sprite || this.sprite instanceof Phaser.GameObjects.Image) {
            if (direction > 0) {
                // 向右移动：正向（不翻转）
                this.sprite.setFlipX(false);
            } else {
                // 向左移动：反向（翻转）
                this.sprite.setFlipX(true);
            }
        }
    }

    /**
     * 设置事件监听
     */
    private setupEventListeners(): void {
        this.scene.events.on('building-purchased', this.handleBuildingPurchased, this);
        this.scene.events.on('building-task-created', this.handleBuildingTaskCreated, this);
        this.scene.events.on('building-completed', this.handleBuildingCompleted, this);
    }

    /**
     * 处理建筑购买事件
     */
    private handleBuildingPurchased(data: { productId: string; productType: string; productName: string }): void {
        console.log(`[Dwarf ${this.id}] 收到建筑购买通知: ${data.productName}`);
        // 新的状态机会自动检测并分配建筑任务
    }
    
    /**
     * 处理建造任务创建事件
     */
    private handleBuildingTaskCreated(buildingTask: any): void {
        console.log(`[Dwarf ${this.id}] 收到建造任务: ${buildingTask.productName}`);
        // 状态机会在下次更新时检测到这个任务
    }
    
    /**
     * 处理建造完成事件
     */
    private handleBuildingCompleted(data: { taskId: string; buildingType: string }): void {
        if (this.targetBuildId === data.taskId) {
            console.log(`[Dwarf ${this.id}] 建造完成: ${data.buildingType}`);
            
            // 释放建造任务分配
            const buildingManager = (this.scene as any).buildingManager;
            if (buildingManager) {
                buildingManager.releaseBuildingTask(data.taskId, this.id);
            }
            
            this.targetBuildId = null;
            // 切换回待机动画
            this.playAnimation('idle');
        }
    }

    /**
     * 移动到目标位置（只水平移动）
     */
    private moveToTarget(x: number, y: number): void {
        this.targetX = x;
        this.targetY = this.groundY; // 忽略y坐标，始终保持在地面
        this.isMoving = true;
        
        // 开始移动时播放行走动画
        this.playAnimation('walk');
    }

    /**
     * 更新矮人逻辑 - 新状态机架构
     */
    public update(delta: number): void {
        // 检查是否已被销毁
        if (this.isDestroyed || !this.sprite || (this.sprite as any).destroyed) {
            return;
        }
        
        // 检查位置是否有效
        if (this.x === undefined || this.y === undefined) {
            console.error(`[Dwarf ${this.id}] Position is undefined: x=${this.x}, y=${this.y}, groundY=${this.groundY}`);
            // 尝试恢复到地面位置
            if (this.groundY !== undefined) {
                this.y = this.groundY;
            } else {
                // 使用默认地面高度
                this.y = 789;
                this.groundY = 789;
            }
            // 如果x也是undefined，设置一个默认值
            if (this.x === undefined) {
                this.x = 100;
            }
        }
        
        // 定期输出调试信息
        if (Math.random() < 0.01) { // 1% 概率
            console.log(`[Dwarf ${this.id}] update called, state: ${this.state}, position: (${this.x.toFixed(0)}, ${this.y.toFixed(0)})`);
        }
        
        // 1. 更新感知系统
        this.updatePerception(delta);
        
        // 2. 状态机评估转换
        this.evaluateTransitions();
        
        // 3. 执行当前状态动作
        this.executeCurrentState(delta);
        
        // 4. 更新移动
        if (this.isMoving) {
            this.updateMovement(delta);
        } else {
            // 5. 更新待机动画切换
            this.updateIdleAnimation(delta);
        }
        
        // 6. 更新血条
        this.updateHealthBar();
        
        // 7. 处理攻击逻辑
        this.updateCombat(delta);
    }

    /**
     * 更新移动逻辑（只允许水平移动）
     */
    private updateMovement(delta: number): void {
        const deltaSeconds = delta / 1000;
        const moveDistance = this.moveSpeed * deltaSeconds;

        const dx = this.targetX - this.x;
        const distance = Math.abs(dx); // 只计算水平距离

        if (distance <= moveDistance) {
            // 到达目标
            this.x = this.targetX;
            this.y = this.groundY; // 确保在地面上
            this.isMoving = false;
            
            // 更新精灵位置
            if (this.sprite && !this.sprite.destroyed) {
                this.sprite.setPosition(this.x, this.y);
            }
            
            // 停止移动时播放对应状态的动画
            // 但是在BUILD状态下，让executeBuild来决定何时播放建造动画
            if (this.state === DwarfState.BUILD) {
                // BUILD状态下不在这里播放动画，等待executeBuild处理
                console.log(`[Dwarf ${this.id}] 到达目标，BUILD状态，等待executeBuild处理动画`);
            } else if (this.state === DwarfState.IDLE) {
                // IDLE状态下，如果是移动行为完成，不调用playAnimation，而是让updateIdleAnimation处理
                if (this.currentIdleBehavior === 'move') {
                    console.log(`[Dwarf ${this.id}] idle movement completed, will decide next behavior`);
                    // 不需要额外操作，updateIdleAnimation会检测到移动完成并重新决定
                } else {
                    this.playAnimation('idle');
                }
            } else {
                this.playAnimation('idle');
            }
            
            this.onReachedTarget();
        } else {
            // 继续移动（只水平移动）
            const direction = dx > 0 ? 1 : -1;
            this.x += direction * moveDistance;
            this.y = this.groundY; // 始终保持在地面
            
            // 更新精灵方向
            this.updateSpriteDirection(direction);
        }

        // 更新精灵位置
        if (this.sprite && !this.sprite.destroyed) {
            this.sprite.setPosition(this.x, this.y);
        }
    }

    /**
     * 更新待机动画切换逻辑
     */
    private updateIdleAnimation(delta: number): void {
        // 只在IDLE状态且是Sprite时更新
        if (!(this.sprite instanceof Phaser.GameObjects.Sprite) || this.state !== DwarfState.IDLE) {
            return;
        }
        
        // 如果还没有决定idle行为，立即决定
        if (!this.idleAnimationDecided) {
            this.decideIdleAnimation();
            return;
        }
        
        // 根据当前行为类型处理
        switch (this.currentIdleBehavior) {
            case 'animation':
                // 如果正在播放动画，等待动画完成（动画完成会在事件中处理）
                if (this.isPlayingIdleAnimation) {
                    return;
                }
                break;
                
            case 'move':
                // 如果正在移动，等待移动完成
                if (this.isMoving) {
                    return;
                }
                // 移动完成，重新决定
                this.idleAnimationDecided = false;
                this.currentIdleBehavior = 'none';
                break;
                
            case 'static':
                // 如果在静止状态，计时
                this.idleAnimationTimer += delta;
                if (this.idleAnimationTimer >= this.idleStaticDuration) {
                    // 静止时间结束，重新决定
                    this.idleAnimationDecided = false;
                    this.idleAnimationTimer = 0;
                    this.currentIdleBehavior = 'none';
                }
                break;
        }
    }
    
    /**
     * 决定idle行为
     */
    private decideIdleAnimation(): void {
        this.idleAnimationDecided = true;
        
        const random = Math.random();
        
        if (random < this.idleAnimationChance) {
            // 播放动画
            this.currentIdleBehavior = 'animation';
            this.playRandomIdleAnimation();
        } else if (random < this.idleAnimationChance + this.idleMoveChance) {
            // 移动
            this.currentIdleBehavior = 'move';
            this.startIdleMovement();
        } else {
            // 静止2-4秒
            this.currentIdleBehavior = 'static';
            this.idleStaticDuration = this.idleStaticDurationMin + Math.random() * (this.idleStaticDurationMax - this.idleStaticDurationMin);
            this.idleAnimationTimer = 0;
            this.isPlayingIdleAnimation = false;
            
            // 确保显示静态帧
            if (this.sprite instanceof Phaser.GameObjects.Sprite) {
                this.sprite.stop();
                if (this.scene.textures.exists('dwarf_walk_1')) {
                    this.sprite.setTexture('dwarf_walk_1');
                }
            }
            
            console.log(`[Dwarf ${this.id}] will stay static for ${(this.idleStaticDuration/1000).toFixed(1)}s`);
        }
    }
    
    /**
     * 更新攻击逻辑
     */
    private updateCombat(delta: number): void {
        // 只在COMBAT状态下进行攻击逻辑
        if (this.state !== DwarfState.COMBAT) {
            return;
        }
        
        // 检查是否有攻击目标
        if (!this.combatTarget || !this.combatTarget.isAlive()) {
            // 目标已死亡，退出战斗状态
            this.combatTarget = null;
            this.evaluateTransitions(); // 重新评估状态
            return;
        }
        
        // 检查目标是否在攻击范围内
        const targetPos = this.combatTarget.getPosition();
        const distance = Math.sqrt(Math.pow(targetPos.x - this.x, 2) + Math.pow(targetPos.y - this.y, 2));
        
        if (distance > this.combatAttributes.range) {
            // 目标超出攻击范围，移动到攻击范围内
            const moveDirection = targetPos.x > this.x ? 1 : -1;
            const targetX = targetPos.x - (moveDirection * (this.combatAttributes.range - 10));
            this.moveToTarget(targetX, this.groundY);
            return;
        }
        
        // 在攻击范围内，停止移动
        if (this.isMoving) {
            this.isMoving = false;
            this.targetX = this.x;
            this.targetY = this.y;
        }
        
        // 更新攻击计时器
        this.attackTimer += delta;
        
        // 检查是否可以攻击
        if (this.attackTimer >= this.combatAttributes.attackSpeed) {
            this.performAttack();
            this.attackTimer = 0;
        }
    }
    
    /**
     * 执行攻击
     */
    private performAttack(): void {
        if (!this.combatTarget || !this.combatTarget.isAlive()) {
            return;
        }
        
        // 播放攻击动画
        this.playAnimation('attack');
        
        // 监听攻击动画完成事件
        if (this.sprite instanceof Phaser.GameObjects.Sprite) {
            this.sprite.once('animationcomplete', (animation: any) => {
                if (animation.key === `dwarf_attack_${this.id}`) {
                    // 攻击动画完成后，对目标造成伤害
                    if (this.combatTarget && this.combatTarget.isAlive()) {
                        this.attackTarget(this.combatTarget);
                    }
                }
            });
        } else {
            // 如果不是Sprite，直接攻击
            this.attackTarget(this.combatTarget);
        }
    }
    
    /**
     * 开始idle移动
     */
    private startIdleMovement(): void {
        if (this.isMoving) return;
        
        const minX = this.x - 100; // 当前位置附近100像素
        const maxX = this.x + 100;
        let randomX = Math.max(100, Math.min(1100, minX + Math.random() * (maxX - minX)));
        
        // 确保目标位置与当前位置有足够的距离（至少50像素）
        const minDistance = 50;
        if (Math.abs(randomX - this.x) < minDistance) {
            // 如果距离太近，选择一个更远的位置
            randomX = this.x + (Math.random() < 0.5 ? -minDistance : minDistance);
            randomX = Math.max(100, Math.min(1100, randomX));
        }
        
        this.moveToTarget(randomX, this.groundY);
        console.log(`[Dwarf ${this.id}] starting idle movement from x:${this.x.toFixed(0)} to x:${randomX.toFixed(0)}, distance: ${Math.abs(randomX - this.x).toFixed(0)}`);
    }

    /**
     * 到达目标位置时的处理
     */
    private onReachedTarget(): void {
        // 新的状态机不需要这个方法，但保留以避免错误
        console.log(`[Dwarf ${this.id}] 到达目标位置`);
    }

    /**
     * 更新感知系统
     */
    private updatePerception(delta: number): void {
        this.lastPerceptionUpdate += delta;
        
        // 每200ms更新一次感知
        if (this.lastPerceptionUpdate >= 200) {
            this.updateSensedResources();
            this.updateSensedBuildSites();
            this.updateSensedMonsters();
            this.lastPerceptionUpdate = 0;
        }
    }
    
    /**
     * 状态机评估转换 - 每帧检查更高优先级任务
     */
    private evaluateTransitions(): void {
        // 获取当前状态的优先级
        const currentPriority = this.getStatePriority(this.state);
        
        // 1. 最高优先级：战斗（优先级=5）
        if (this.hasNearbyMonster()) {
            if (this.state !== DwarfState.COMBAT) {
                this.enterCombat();
            }
            return;
        }
        
        // 如果当前在战斗状态但没有敌人了，需要重新评估
        if (this.state === DwarfState.COMBAT) {
            // 战斗结束，清理状态，继续评估其他任务
            this.combatTarget = null;
        }
        
        // 2. 建筑优先级（优先级=4）
        const hasBuildTask = this.hasPendingBuild();
        if (hasBuildTask) {
            console.log(`[Dwarf ${this.id}] evaluateTransitions - 发现建筑任务！当前状态: ${this.state}, 当前优先级: ${currentPriority}`);
        }
        
        if (hasBuildTask) {
            // 只有当前状态优先级低于建筑时才切换
            if (currentPriority < 4) {
                console.log(`[Dwarf ${this.id}] 从 ${this.state} 切换到 BUILD 状态`);
                this.enterBuild();
                return;
            } else if (this.state === DwarfState.BUILD) {
                // 保持建筑状态
                console.log(`[Dwarf ${this.id}] 保持 BUILD 状态`);
                return;
            }
        }
        
        // 如果当前在建筑状态但没有建筑任务了，继续评估
        if (this.state === DwarfState.BUILD && !this.targetBuildId) {
            // 建筑完成，继续评估其他任务
            console.log(`[Dwarf ${this.id}] BUILD 状态但没有 targetBuildId，继续评估其他任务`);
        }
        
        // 如果当前在建造状态且有任务，保持状态
        if (this.state === DwarfState.BUILD && this.targetBuildId) {
            return;  // 保持建造状态直到完成
        }
        
        // 3. 交付优先级（优先级=3）
        if (this.inventory.size > 0) {
            // 只有当前状态优先级低于交付时才切换
            if (currentPriority < 3) {
                this.enterDeliver();
                return;
            } else if (this.state === DwarfState.DELIVER) {
                // 保持交付状态
                return;
            }
        }
        
        // 4. 收集优先级（优先级=2）
        // 如果当前在收集状态且有有效目标，继续收集
        if (this.state === DwarfState.GATHER && this.targetResourceId) {
            const resource = this.getTargetResource();
            if (resource && !resource.getIsCollected()) {
                // 继续当前的收集任务
                return;
            } else {
                // 资源已被收集或不存在，清理状态
                if (this.targetResourceId) {
                    const worldTaskMgr = this.getWorldTaskManager();
                    if (worldTaskMgr) {
                        worldTaskMgr.releaseResourceLock(this.targetResourceId);
                    }
                    this.targetResourceId = null;
                }
            }
        }
        
        // 寻找新的资源
        const worldTaskMgr = this.getWorldTaskManager();
        if (worldTaskMgr) {
            const availableResources = worldTaskMgr.getAvailableResources();
            
            if (availableResources.length > 0 && !this.targetResourceId) {
                // 尝试锁定新资源
                const resource = availableResources[0];
                const locked = worldTaskMgr.tryLockResource(resource.resourceRef.id, this.id);
                
                if (locked) {
                    this.targetResourceId = resource.resourceRef.id;
                    if (this.state !== DwarfState.GATHER) {
                        this.enterGather();
                    }
                    return;
                }
            }
        }
        
        // 5. 默认状态：待机（优先级=1）
        if (this.state !== DwarfState.IDLE) {
            this.stayIdle();
        }
    }
    
    /**
     * 获取状态优先级
     */
    private getStatePriority(state: DwarfState): number {
        switch (state) {
            case DwarfState.COMBAT: return 5;
            case DwarfState.BUILD: return 4;
            case DwarfState.DELIVER: return 3;
            case DwarfState.GATHER: return 2;
            case DwarfState.IDLE: return 1;
            default: return 0;
        }
    }
    
    /**
     * 执行当前状态动作
     */
    private executeCurrentState(delta: number): void {
        switch (this.state) {
            case DwarfState.COMBAT:
                this.executeCombat(delta);
                break;
            case DwarfState.DELIVER:
                this.executeDeliver(delta);
                break;
            case DwarfState.BUILD:
                this.executeBuild(delta);
                break;
            case DwarfState.GATHER:
                this.executeGather(delta);
                break;
            case DwarfState.IDLE:
                this.executeIdle(delta);
                break;
        }
    }

    // =================== 状态转换函数 ===================
    
    /**
     * 进入战斗状态
     */
    private enterCombat(): void {
        if (this.state === DwarfState.COMBAT) return;
        
        this.abortCurrentAction();
        this.state = DwarfState.COMBAT;
        
        // 找到最近的敌人
        const nearestMonster = this.findNearestMonster();
        if (nearestMonster) {
            this.combatTarget = nearestMonster;
            const monsterPos = nearestMonster.getPosition();
            this.moveToTarget(monsterPos.x, this.groundY);
        }
        
        this.updateStatusDisplay();
        console.log(`[Dwarf ${this.id}] 进入战斗状态`);
    }
    
    /**
     * 进入交付状态
     */
    private enterDeliver(): void {
        if (this.state === DwarfState.DELIVER) return;
        
        this.abortCurrentAction();
        this.state = DwarfState.DELIVER;
        
        // 移动到城堡交付点
        const castleDeliveryX = (this.castleXStart + this.castleXEnd) / 2;
        this.moveToTarget(castleDeliveryX, this.groundY);
        
        this.updateStatusDisplay();
        console.log(`[Dwarf ${this.id}] 进入交付状态`);
    }
    
    /**
     * 进入建筑状态
     */
    private enterBuild(): void {
        if (this.state === DwarfState.BUILD) return;
        
        // 保存当前的 targetBuildId，因为 abortCurrentAction 会清除它
        const savedTargetBuildId = this.targetBuildId;
        
        this.abortCurrentAction();
        this.state = DwarfState.BUILD;
        
        // 恢复 targetBuildId
        this.targetBuildId = savedTargetBuildId;
        
        console.log(`[Dwarf ${this.id}] 进入建筑状态，targetBuildId: ${this.targetBuildId}`);
        
        // 获取已分配的建造任务
        if (this.targetBuildId) {
            const buildingManager = (this.scene as any).buildingManager;
            if (buildingManager) {
                const buildingTasks = buildingManager.getBuildingTasks();
                console.log(`[Dwarf ${this.id}] 所有建造任务:`, buildingTasks);
                
                const buildingTask = buildingTasks.find((task: any) => task.id === this.targetBuildId);
                if (buildingTask) {
                    // 移动到建筑位置
                    const buildPos = buildingTask.position;
                    const targetX = buildPos.x + 81; // 移动到建筑中心
                    this.moveToTarget(targetX, this.groundY); 
                    console.log(`[Dwarf ${this.id}] 移动到建筑位置: ${buildingTask.productName} at x=${targetX}`);
                } else {
                    console.error(`[Dwarf ${this.id}] 找不到建造任务 ${this.targetBuildId}`);
                }
            } else {
                console.error(`[Dwarf ${this.id}] 无法获取 buildingManager`);
            }
        } else {
            console.error(`[Dwarf ${this.id}] 进入建筑状态但没有 targetBuildId`);
        }
        
        this.updateStatusDisplay();
    }
    
    /**
     * 进入收集状态
     */
    private enterGather(): void {
        if (this.state === DwarfState.GATHER) return;
        
        this.state = DwarfState.GATHER;
        
        // 移动到资源位置
        const resource = this.getTargetResource();
        if (resource) {
            const resourcePos = resource.getPosition();
            this.moveToTarget(resourcePos.x, this.groundY);
            console.log(`[Dwarf ${this.id}] 去收集 ${resource.getResourceType()}`);
        }
        
        this.updateStatusDisplay();
    }
    
    /**
     * 保持待机状态
     */
    private stayIdle(): void {
        if (this.state === DwarfState.IDLE) return;
        
        this.abortCurrentAction();
        this.state = DwarfState.IDLE;
        
        // 重置idle动画状态
        this.idleAnimationDecided = false;
        this.idleAnimationTimer = 0;
        this.isPlayingIdleAnimation = false;
        this.currentIdleBehavior = 'none';
        
        this.updateStatusDisplay();
        console.log(`[Dwarf ${this.id}] 进入待机状态`);
    }
    
    /**
     * 中止当前动作
     */
    private abortCurrentAction(): void {
        // 如果有目标资源，释放锁定
        if (this.targetResourceId) {
            const worldTaskMgr = this.getWorldTaskManager();
            if (worldTaskMgr) {
                worldTaskMgr.releaseResourceLock(this.targetResourceId);
            }
        }
        
        // 清除目标引用
        this.targetResourceId = null;
        this.targetBuildId = null;
        this.combatTarget = null;
        
        // 停止移动
        this.isMoving = false;
        
        // 停止idle动画
        if (this.isPlayingIdleAnimation && this.sprite instanceof Phaser.GameObjects.Sprite) {
            this.sprite.stop();
            this.sprite.off('animationcomplete'); // 移除动画完成监听器
            this.isPlayingIdleAnimation = false;
        }
        
        // 重置idle行为状态
        this.currentIdleBehavior = 'none';
    }

    // =================== 状态执行函数 ===================
    
    /**
     * 执行战斗状态
     */
    private executeCombat(delta: number): void {
        if (!this.combatTarget || !this.combatTarget.isAlive()) {
            // 目标死亡，结束战斗
            this.combatTarget = null;
            return;
        }
        
        // 如果在移动中，等待到达
        if (this.isMoving) return;
        
        // 执行攻击
        this.attackTimer += delta / 1000;
        if (this.attackTimer >= 1 / this.attackSpeed) {
            this.combatTarget.takeDamage(this.attackDamage);
            this.attackTimer = 0;
            console.log(`[Dwarf ${this.id}] 攻击造成 ${this.attackDamage} 点伤害`);
        }
    }
    
    /**
     * 执行交付状态
     */
    private executeDeliver(delta: number): void {
        // 如果在移动中，等待到达
        if (this.isMoving) return;
        
        // 检查是否在城堡范围内
        if (this.x >= this.castleXStart && this.x <= this.castleXEnd) {
            // 交付所有资源
            this.inventory.forEach((amount, resourceType) => {
                resourceManager.addResource(resourceType, amount);
                console.log(`[Dwarf ${this.id}] 交付 ${amount} 个 ${resourceType}`);
            });
            
            // 清空背包
            this.inventory.clear();
        }
    }
    
    /**
     * 执行建筑状态
     */
    private executeBuild(delta: number): void {
        if (!this.targetBuildId) return;
        
        const buildingManager = (this.scene as any).buildingManager;
        if (!buildingManager) return;
        
        const buildingTask = buildingManager.getBuildingTasks().find((task: any) => task.id === this.targetBuildId);
        if (!buildingTask) {
            this.targetBuildId = null;
            return;
        }
        
        // 检查是否需要移动到建造位置（建筑中心）
        const buildingCenterX = buildingTask.position.x + 81; // 建筑大小162px，中心偏移81px
        const distanceToTarget = Math.abs(this.x - buildingCenterX);
        if (distanceToTarget > this.buildRange) {
            // 如果不在移动中，开始移动
            if (!this.isMoving) {
                this.moveToTarget(buildingCenterX, this.y);
                console.log(`[Dwarf ${this.id}] 移动到建造中心位置 (${buildingCenterX}, ${this.y}), 距离: ${distanceToTarget}`);
            }
            return; // 等待到达
        }
        
        // 到达建造位置，开始建造
        if (buildingTask.status === 'waiting_for_dwarf') {
            console.log(`[Dwarf ${this.id}] 到达建造位置，调用 startBuilding`);
            buildingManager.startBuilding(this.targetBuildId);
            
            console.log(`[Dwarf ${this.id}] 切换到建造动画`);
            this.playAnimation('build');
            
            // 创建建筑动画（这将在Building实体中处理）
            this.scene.events.emit('start-building-animation', {
                taskId: this.targetBuildId,
                buildingType: buildingTask.productType,
                position: buildingTask.position
            });
            
            console.log(`[Dwarf ${this.id}] 开始建造 ${buildingTask.productName}`);
        }
        
        // 建造过程中保持建造动画
        if (buildingTask.status === 'building') {
            // 确保持续播放建造动画
            if (this.sprite instanceof Phaser.GameObjects.Sprite) {
                const currentAnim = this.sprite.anims.currentAnim;
                const isPlaying = this.sprite.anims.isPlaying;
                
                // 如果动画停止了或者不是建造动画，重新播放
                if (!isPlaying || !currentAnim || !currentAnim.key.includes('build')) {
                    console.log(`[Dwarf ${this.id}] 重新播放建造动画，当前动画: ${currentAnim?.key}, 是否播放: ${isPlaying}`);
                    this.playAnimation('build');
                }
            }
        }
    }
    
    /**
     * 执行收集状态
     */
    private executeGather(delta: number): void {
        // 如果在移动中，等待到达
        if (this.isMoving) return;
        
        // 执行收集
        if (this.targetResourceId) {
            const resource = this.getTargetResource();
            if (resource && !resource.getIsCollected()) {
                // 检查是否在收集范围内
                const distance = this.getDistanceToPoint(this.x, this.y, resource.getPosition().x, resource.getPosition().y);
                if (distance <= this.collectionRange) {
                    // 收集资源
                    resource.collect();
                    
                    // 添加到背包
                    const resourceType = resource.getResourceType();
                    const currentAmount = this.inventory.get(resourceType) || 0;
                    this.inventory.set(resourceType, currentAmount + 1);
                    
                    console.log(`[Dwarf ${this.id}] 收集了 ${resourceType}`);
                    
                    // 清除目标
                    this.targetResourceId = null;
                }
            } else {
                // 资源已被收集或不存在，清除目标
                this.targetResourceId = null;
            }
        }
    }
    
    /**
     * 执行待机状态
     */
    private executeIdle(delta: number): void {
        // 待机行为现在由updateIdleAnimation统一处理
        // 这里不再需要额外的逻辑
    }

    // =================== 感知系统 ===================
    
    /**
     * 更新感知的资源
     */
    private updateSensedResources(): void {
        // 简化了，不再需要这个方法
    }
    
    /**
     * 更新感知的建筑地点
     */
    private updateSensedBuildSites(): void {
        this.sensedBuildSites = [];
        
        // 这里需要从全局任务管理器获取建筑地点
        const worldTaskMgr = WorldTaskManager.getInstance();
        const buildSites = worldTaskMgr.getBuildSites();
        
        for (const buildSite of buildSites) {
            if (buildSite.isCompleted) continue;
            
            const buildPos = buildSite.position;
            const distance = this.getDistanceToPoint(this.x, this.y, buildPos.x, buildPos.y);
            
            if (distance <= this.senseRadius) {
                this.sensedBuildSites.push(buildSite);
            }
        }
    }
    
    /**
     * 更新感知的怪物
     */
    private updateSensedMonsters(): void {
        this.sensedMonsters = [];
        
        // 检测旧的怪物管理器
        const monsterManager = (this.scene as any).monsterManager;
        if (monsterManager) {
            const monsters = monsterManager.getAliveMonsters();
            for (const monster of monsters) {
                const monsterPos = monster.getPosition();
                const distance = this.getDistanceToPoint(this.x, this.y, monsterPos.x, monsterPos.y);
                
                if (distance <= this.senseRadius) {
                    this.sensedMonsters.push(monster);
                }
            }
        }
        
        // 检测新的哥布林管理器
        const newMonsterManager = (this.scene as any).newMonsterManager;
        if (newMonsterManager) {
            const goblins = newMonsterManager.getAliveGoblins();
            for (const goblin of goblins) {
                const goblinPos = goblin.getPosition();
                const distance = this.getDistanceToPoint(this.x, this.y, goblinPos.x, goblinPos.y);
                
                if (distance <= this.senseRadius) {
                    this.sensedMonsters.push(goblin);
                }
            }
        }
    }

    // =================== 判断函数 ===================
    
    /**
     * 是否有附近的怪物
     */
    private hasNearbyMonster(): boolean {
        return this.sensedMonsters.some(monster => {
            const monsterPos = monster.getPosition();
            const distance = this.getDistanceToPoint(this.x, this.y, monsterPos.x, monsterPos.y);
            return distance <= this.threatRadius;
        });
    }
    
    /**
     * 查找最近的怪物
     */
    private findNearestMonster(): any {
        let nearest = null;
        let minDistance = Infinity;
        
        for (const monster of this.sensedMonsters) {
            const monsterPos = monster.getPosition();
            const distance = this.getDistanceToPoint(this.x, this.y, monsterPos.x, monsterPos.y);
            
            if (distance < minDistance && distance <= this.threatRadius) {
                minDistance = distance;
                nearest = monster;
            }
        }
        
        return nearest;
    }
    
    /**
     * 是否有待建筑任务
     */
    private hasPendingBuild(): boolean {
        // 检查当前是否已有建造任务
        if (this.targetBuildId) {
            return true;
        }
        
        // 简单直接：检查是否有地基存在
        const mainScene = this.scene as any;
        const buildingManager = mainScene.buildingManager;
        
        if (!buildingManager) {
            return false;
        }
        
        // 获取所有建造任务
        const allTasks = buildingManager.getBuildingTasks();
        
        // 找到第一个未分配的任务
        for (const task of allTasks) {
            if (task.status === 'waiting_for_dwarf' && !task.assignedDwarfId) {
                // 直接分配任务
                const assigned = buildingManager.tryAssignBuildingTask(this.id);
                if (assigned) {
                    this.targetBuildId = assigned.id;
                    console.log(`[Dwarf ${this.id}] 发现地基，分配建造任务: ${assigned.productName}`);
                    return true;
                }
            }
        }
        
        return false;
    }
    

    // =================== 辅助函数 ===================
    
    /**
     * 查找可用的建筑地点
     */
    private findAvailableBuildSite(): any {
        for (const buildSite of this.sensedBuildSites) {
            if (!buildSite.isCompleted && !buildSite.claimedBy) {
                return buildSite;
            }
        }
        return null;
    }
    
    /**
     * 根据ID获取建筑地点
     */
    private getBuildSiteById(id: string): any {
        const worldTaskMgr = WorldTaskManager.getInstance();
        return worldTaskMgr.getBuildSiteById(id);
    }
    
    /**
     * 获取WorldTaskManager实例
     */
    private getWorldTaskManager(): any {
        return WorldTaskManager.getInstance();
    }

    /**
     * 获取目标资源
     */
    private getTargetResource(): any {
        if (!this.targetResourceId) return null;
        
        // 从WorldTaskManager获取资源
        const worldTaskMgr = this.getWorldTaskManager();
        if (!worldTaskMgr) return null;
        
        return worldTaskMgr.getResourceById(this.targetResourceId);
    }
    
    /**
     * 根据ID获取资源
     */
    private getResourceById(id: string): any {
        // 从感知到的资源中查找
        return this.sensedResources.find(r => r.id === id);
    }
    
    /**
     * 生成资源ID
     */
    private generateResourceId(resource: any): string {
        const pos = resource.getPosition();
        return `resource_${Math.round(pos.x)}_${Math.round(pos.y)}_${Date.now()}`;
    }

    /**
     * 计算到指定点的距离
     */
    private getDistanceToPoint(x1: number, y1: number, x2: number, y2: number): number {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // =================== 状态显示更新 (已禁用) ===================
    
    /**
     * 更新状态显示 (已禁用)
     */
    private updateStatusDisplay(): void {
        // 不再显示状态文本
    }
    
    /**
     * 获取资源符号 (已禁用)
     */
    private getResourceSymbol(type: string): string {
        // 不再需要显示资源符号
        return '';
    }

    // =================== 公开接口 (为了兼容性保留) ===================
    
    /**
     * 获取矮人当前状态
     */
    public getState(): DwarfState {
        return this.state;
    }
    
    /**
     * 获取精灵对象
     */
    public getSprite(): Phaser.GameObjects.GameObject | null {
        return this.sprite || null;
    }
    
    /**
     * 检查矮人是否空闲
     */
    public isIdle(): boolean {
        return this.state === DwarfState.IDLE;
    }
    
    /**
     * 检查矮人是否可以接受新任务
     */
    public canAcceptTask(): boolean {
        return this.state === DwarfState.IDLE;
    }
    
    /**
     * 获取当前任务 (兼容性保留)
     */
    public getCurrentTask(): DwarfTask | null {
        // 返回兼容的任务格式
        if (this.state === DwarfState.IDLE) return null;
        
        return {
            type: this.state,
            targetPosition: { x: this.targetX, y: this.targetY },
            priority: StatePriority[this.state.toUpperCase() as keyof typeof StatePriority] || 1
        };
    }
    
    /**
     * 分配收集任务 (兼容性保留)
     */
    public assignCollectionTask(resourceType: string, position: { x: number; y: number }): void {
        console.log(`[Dwarf ${this.id}] assignCollectionTask 已废弃，使用新的状态机系统`);
    }
    
    /**
     * 分配建造任务 (兼容性保留)
     */
    public assignBuildingTask(buildingType: string, position: { x: number; y: number }): void {
        console.log(`[Dwarf ${this.id}] assignBuildingTask 已废弃，使用新的状态机系统`);
    }

    /**
     * 添加任务到队列 (已废弃)
     */
    public addTask(task: DwarfTask): void {
        console.log(`[Dwarf ${this.id}] addTask 已废弃`);
    }

    /**
     * 设置矮人位置（只改变x坐标）
     */
    public setPosition(x: number, y: number): void {
        this.x = x;
        this.y = this.groundY; // 忽略y参数，始终在地面
        this.sprite.setPosition(this.x, this.y);
    }

    /**
     * 销毁矮人
     */
    public destroy(): void {
        if (this.isDestroyed) {
            return;
        }
        
        this.isDestroyed = true;
        
        this.scene.events.off('building-purchased', this.handleBuildingPurchased, this);
        
        // 释放资源锁定
        if (this.targetResourceId) {
            const worldTaskMgr = this.getWorldTaskManager();
            if (worldTaskMgr) {
                worldTaskMgr.releaseResourceLock(this.targetResourceId);
            }
        }
        
        // 释放建筑锁
        if (this.targetBuildId) {
            const worldTaskMgr = WorldTaskManager.getInstance();
            worldTaskMgr.releaseBuildSiteLock(this.targetBuildId);
        }
        
        if (this.sprite && !(this.sprite as any).destroyed) {
            this.sprite.destroy();
        }
        
        // 销毁血条
        if (this.healthBar) {
            this.healthBar.destroy();
        }
        if (this.healthBarBg) {
            this.healthBarBg.destroy();
        }
        
        console.log(`Dwarf ${this.id} destroyed`);
    }
    
    // ===== CombatUnit接口实现 =====
    
    public getCombatAttributes(): CombatAttributes {
        return { ...this.combatAttributes };
    }
    
    public getPosition(): { x: number; y: number } {
        return { x: this.x, y: this.y };
    }
    
    public isAlive(): boolean {
        return !this.isDestroyed && this.combatAttributes.health > 0 && this.sprite && !(this.sprite as any).destroyed;
    }
    
    public takeDamage(damage: number): void {
        if (!this.isAlive()) return;
        
        this.combatAttributes.health = Math.max(0, this.combatAttributes.health - damage);
        console.log(`Dwarf ${this.id} took ${damage} damage, health: ${this.combatAttributes.health}`);
        
        if (this.combatAttributes.health <= 0) {
            this.die();
        }
    }
    
    public canAttack(target: CombatUnit): boolean {
        return this.isAlive() && 
               target.isAlive() && 
               CombatUtils.isInRange(this, target);
    }
    
    public attackTarget(target: CombatUnit): void {
        if (!this.canAttack(target)) return;
        
        const damage = CombatUtils.calculateDamage(
            this.combatAttributes.attack, 
            target.getCombatAttributes().armor
        );
        
        target.takeDamage(damage);
        console.log(`Dwarf ${this.id} attacks target for ${damage} damage`);
    }
    
    public getCollisionBounds(): { x: number; y: number; width: number; height: number } {
        return {
            x: this.x - this.dwarfSize / 2,
            y: this.y - this.dwarfSize,
            width: this.dwarfSize,
            height: this.dwarfSize
        };
    }
    
    /**
     * 矮人死亡处理
     */
    private die(): void {
        console.log(`Dwarf ${this.id} died`);
        
        // 设置死亡标记
        this.combatAttributes.health = 0;
        
        // 停止所有动画
        if (this.sprite instanceof Phaser.GameObjects.Sprite) {
            this.sprite.stop();
        }
        
        // 触发死亡事件，让管理器处理清理
        this.scene.events.emit('dwarf-killed', {
            dwarfId: this.id,
            dwarf: this,
            position: this.getPosition()
        });
        
        // 不在这里调用destroy，让管理器来处理
    }
}

/**
 * 新矮人状态枚举 - 5个状态
 */
export enum DwarfState {
    IDLE = 'idle',         // 待机
    GATHER = 'gather',     // 收集资源
    DELIVER = 'deliver',   // 交付资源
    BUILD = 'build',       // 建造建筑
    COMBAT = 'combat'      // 战斗
}

/**
 * 状态优先级常量
 */
export const StatePriority = {
    COMBAT: 5,    // 战斗最高优先级
    DELIVER: 4,   // 交付次高
    BUILD: 3,     // 建造第三
    GATHER: 2,    // 收集第四
    IDLE: 1       // 待机最低
};

/**
 * 矮人配置参数
 */
export const DwarfConfig = {
    R_SENSE: 120,           // 感知半径 (m)
    R_MONSTER_THREAT: 80,   // 战斗触发距离 (m)
    BASE_TTL: 10000,        // 锁生命期 (ms)
    PERCEPTION_INTERVAL: 200 // 感知更新间隔 (ms)
};

/**
 * 矮人任务接口 (兼容性保留)
 */
export interface DwarfTask {
    type: string;
    resourceType?: string;
    buildingType?: string;
    targetPosition: { x: number; y: number };
    priority: number;
    target?: any;
}

/**
 * 旧的枚举和常量 (兼容性保留)
 */
export enum TaskType {
    COLLECT_RESOURCE = 'collect_resource',
    DELIVER_RESOURCE = 'deliver_resource',
    BUILD_STRUCTURE = 'build_structure',
    FIGHT = 'fight'
}

export const TaskPriority = {
    FIGHT: 4,
    BUILD_STRUCTURE: 3,
    DELIVER_RESOURCE: 2,
    COLLECT_RESOURCE: 1
};