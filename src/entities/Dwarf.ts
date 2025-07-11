import { resourceManager } from '../managers/ResourceManager';
import { WorldTaskManager } from '../managers/WorldTaskManager';

/**
 * 矮人NPC实体 - 全新状态机架构
 * 实现5个状态：Combat > Deliver > Build > Gather > Idle
 */
export class Dwarf {
    public id: string;
    private scene: Phaser.Scene;
    private sprite!: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
    
    // 位置和移动
    private x: number;
    private y: number;
    private targetX: number = 0;
    private targetY: number = 0;
    private isMoving: boolean = false;
    private moveSpeed: number = 100; // 像素/秒
    private readonly GROUND_Y = 789; // 地面Y坐标（land的上边界）
    
    // 待机动画系统
    private currentIdleSet: number = 1; // 当前使用的待机动画套装 (1 或 2)
    private idleAnimationTimer: number = 0;
    private readonly IDLE_ANIMATION_SWITCH_TIME = 3000; // 3秒切换一次待机动画
    
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
    
    // 战斗相关
    private attackDamage: number = 10;
    private attackSpeed: number = 1.0; // 攻击/秒
    private attackTimer: number = 0;
    
    // 配置参数
    private readonly DWARF_SIZE = 80;
    private readonly R_SENSE = 120; // 感知半径
    private readonly R_MONSTER_THREAT = 80; // 战斗触发距离
    private readonly CARRY_CAPACITY = 5;
    private readonly COLLECTION_RANGE = 50;
    private readonly BUILD_RANGE = 60;
    private readonly CASTLE_X_START = -221; // 城堡左边界
    private readonly CASTLE_X_END = 239; // 城堡右边界 (-221 + 460)
    
    // 随机移动（空闲状态）
    private idleTimer: number = 0;
    private nextIdleMove: number = 8000;

    constructor(scene: Phaser.Scene, id: string, x: number, y: number) {
        this.scene = scene;
        this.id = id;
        this.x = x;
        this.y = this.GROUND_Y; // 始终保持在地面上
        
        this.createSprite();
        this.setupEventListeners();
        
        console.log(`Dwarf ${this.id} created at (${x}, ${y}) with new state machine`);
    }

    /**
     * 创建精灵 (使用动画Sprite)
     */
    private createSprite(): void {
        // 优先使用101帧序列动画
        if (this.scene.textures.exists('dwarf_walk_1')) {
            this.sprite = this.scene.add.sprite(this.x, this.y, 'dwarf_walk_1');
            this.sprite.setOrigin(0.5, 1); // 底部中心对齐，确保矮人站在地面上
            
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
            this.sprite.setDisplaySize(this.DWARF_SIZE, this.DWARF_SIZE);
        } else {
            // 如果所有图片都加载失败，使用备用矩形
            console.warn('Dwarf images not loaded, using fallback');
            this.sprite = this.scene.add.rectangle(this.x, this.y, this.DWARF_SIZE, this.DWARF_SIZE, 0x0000FF);
            this.sprite.setOrigin(0.5, 1);
            this.sprite.setStrokeStyle(2, 0x000000);
        }
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
            const scaleX = this.DWARF_SIZE / originalWidth;
            const scaleY = this.DWARF_SIZE / originalHeight;
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
                        repeat: -1
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
                        repeat: -1
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
            if (this.scene.textures.exists('dwarf_build_1')) {
                // 如果有专门的建造动画，使用它
                const buildFrames = [];
                // 73帧建造动画
                for (let i = 1; i <= 73; i++) {
                    if (this.scene.textures.exists(`dwarf_build_${i}`)) {
                        buildFrames.push({ key: `dwarf_build_${i}` });
                    }
                }
                
                if (buildFrames.length > 0) {
                    animsManager.create({
                        key: `dwarf_build_${this.id}`,
                        frames: buildFrames,
                        frameRate: 20, // 20帧/秒，统一帧率
                        repeat: -1
                    });
                }
            } else {
                // 回退到第一套待机动画
                animsManager.create({
                    key: `dwarf_build_${this.id}`,
                    frames: [{ key: 'dwarf_walk_1' }],
                    frameRate: 1,
                    repeat: -1
                });
            }
        }
    }

    /**
     * 播放动画
     */
    private playAnimation(animationType: 'walk' | 'idle' | 'build'): void {
        if (this.sprite instanceof Phaser.GameObjects.Sprite) {
            if (animationType === 'walk') {
                const animKey = `dwarf_walk_${this.id}`;
                if (this.scene.anims.exists(animKey)) {
                    this.sprite.play(animKey);
                }
            } else if (animationType === 'idle') {
                // 播放随机待机动画
                this.playRandomIdleAnimation();
            } else if (animationType === 'build') {
                const animKey = `dwarf_build_${this.id}`;
                if (this.scene.anims.exists(animKey)) {
                    this.sprite.play(animKey);
                    console.log(`Dwarf ${this.id} playing build animation`);
                }
            }
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
                console.log(`Dwarf ${this.id} playing idle animation set ${this.currentIdleSet}`);
            } else {
                // 回退到第一套
                const fallbackKey = `dwarf_idle1_${this.id}`;
                if (this.scene.anims.exists(fallbackKey)) {
                    this.sprite.play(fallbackKey);
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
        this.targetY = this.GROUND_Y; // 忽略y坐标，始终保持在地面
        this.isMoving = true;
        
        // 开始移动时播放行走动画（除非在建造状态）
        if (this.state !== DwarfState.BUILD) {
            this.playAnimation('walk');
        }
    }

    /**
     * 更新矮人逻辑 - 新状态机架构
     */
    public update(delta: number): void {
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
            this.y = this.GROUND_Y; // 确保在地面上
            this.isMoving = false;
            
            // 停止移动时播放对应状态的动画
            if (this.state === DwarfState.BUILD) {
                this.playAnimation('build');
            } else {
                this.playAnimation('idle');
            }
            
            this.onReachedTarget();
        } else {
            // 继续移动（只水平移动）
            const direction = dx > 0 ? 1 : -1;
            this.x += direction * moveDistance;
            this.y = this.GROUND_Y; // 始终保持在地面
            
            // 更新精灵方向
            this.updateSpriteDirection(direction);
        }

        // 更新精灵位置
        this.sprite.setPosition(this.x, this.y);
    }

    /**
     * 更新待机动画切换逻辑
     */
    private updateIdleAnimation(delta: number): void {
        // 只在静止状态且是Sprite时更新
        if (this.sprite instanceof Phaser.GameObjects.Sprite && !this.isMoving) {
            this.idleAnimationTimer += delta;
            
            // 如果到了切换时间，随机切换待机动画
            if (this.idleAnimationTimer >= this.IDLE_ANIMATION_SWITCH_TIME) {
                this.playRandomIdleAnimation();
            }
        }
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
     * 状态机评估转换
     */
    private evaluateTransitions(): void {
        // 优先级顺序：Combat > Deliver > Build > Gather > Idle
        
        // 1. 最高优先级：战斗
        if (this.hasNearbyMonster()) {
            if (this.state !== DwarfState.COMBAT) {
                this.enterCombat();
            }
            return;
        }
        
        // 2. 交付优先级：如果背包非空
        if (this.inventory.size > 0) {
            if (this.state !== DwarfState.DELIVER) {
                this.enterDeliver();
            }
            return;
        }
        
        // 3. 建筑优先级：检查待建筑任务
        if (this.hasPendingBuild()) {
            if (this.state !== DwarfState.BUILD) {
                this.enterBuild();
            }
            return;
        }
        
        // 4. 如果已经在收集状态，保持当前状态
        if (this.state === DwarfState.GATHER && this.targetResourceId) {
            return;
        }
        
        // 5. 收集优先级：检查地上是否有资源（只在非收集状态时检查）
        if (this.state !== DwarfState.GATHER) {
            const match3Grid = (this.scene as any).match3Grid;
            if (match3Grid) {
                const resources = match3Grid.getDroppedResources();
                const availableResource = resources.find(r => !r.getIsCollected() && !r.isClaimed());
                
                if (availableResource) {
                    // 直接认领并进入收集状态
                    availableResource.claim(this.id);
                    this.targetResourceId = availableResource.id;
                    this.enterGather();
                    return;
                }
            }
        }
        
        // 6. 默认状态：待机
        if (this.state !== DwarfState.IDLE) {
            this.stayIdle();
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
            this.moveToTarget(monsterPos.x, this.GROUND_Y);
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
        const castleDeliveryX = (this.CASTLE_X_START + this.CASTLE_X_END) / 2;
        this.moveToTarget(castleDeliveryX, this.GROUND_Y);
        
        this.updateStatusDisplay();
        console.log(`[Dwarf ${this.id}] 进入交付状态`);
    }
    
    /**
     * 进入建筑状态
     */
    private enterBuild(): void {
        if (this.state === DwarfState.BUILD) return;
        
        this.abortCurrentAction();
        this.state = DwarfState.BUILD;
        
        // 移动到建筑位置
        const buildSite = this.findAvailableBuildSite();
        if (buildSite) {
            this.targetBuildId = buildSite.id;
            const buildPos = buildSite.getPosition();
            this.moveToTarget(buildPos.x, this.GROUND_Y);
        }
        
        this.updateStatusDisplay();
        console.log(`[Dwarf ${this.id}] 进入建筑状态`);
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
            this.moveToTarget(resourcePos.x, this.GROUND_Y);
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
        
        this.updateStatusDisplay();
        console.log(`[Dwarf ${this.id}] 进入待机状态`);
    }
    
    /**
     * 中止当前动作
     */
    private abortCurrentAction(): void {
        // 如果有目标资源，释放认领
        if (this.targetResourceId) {
            const resource = this.getTargetResource();
            if (resource) {
                resource.releaseClaim();
            }
        }
        
        // 清除目标引用
        this.targetResourceId = null;
        this.targetBuildId = null;
        this.combatTarget = null;
        
        // 停止移动
        this.isMoving = false;
    }

    // =================== 状态执行函数 ===================
    
    /**
     * 执行战斗状态
     */
    private executeCombat(delta: number): void {
        if (!this.combatTarget || this.combatTarget.isDead()) {
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
        if (this.x >= this.CASTLE_X_START && this.x <= this.CASTLE_X_END) {
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
        if (distanceToTarget > this.BUILD_RANGE) {
            // 如果不在移动中，开始移动
            if (!this.isMoving) {
                this.moveToTarget(buildingCenterX, this.y);
                console.log(`[Dwarf ${this.id}] 移动到建造中心位置 (${buildingCenterX}, ${this.y}), 距离: ${distanceToTarget}`);
            }
            return; // 等待到达
        }
        
        // 到达建造位置，开始建造
        if (buildingTask.status === 'waiting_for_dwarf') {
            buildingManager.startBuilding(this.targetBuildId);
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
            // 建造持续时间（可以根据建筑类型调整）
            const buildDuration = 5000; // 5秒
            
            // 这里可以添加建造进度逻辑
            // 简单起见，我们等待建筑动画完成后触发完成事件
            
            // 注意：实际的建造完成会由建筑动画系统触发
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
                if (distance <= this.COLLECTION_RANGE) {
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
        // 随机移动
        this.idleTimer += delta;
        
        if (this.idleTimer >= this.nextIdleMove && !this.isMoving) {
            const minX = this.x - 100; // 当前位置附近100像素
            const maxX = this.x + 100;
            const randomX = Math.max(100, Math.min(1100, minX + Math.random() * (maxX - minX)));
            
            this.moveToTarget(randomX, this.GROUND_Y);
            
            this.idleTimer = 0;
            this.nextIdleMove = 8000 + Math.random() * 10000; // 8-18秒随机，更长间隔
            
            console.log(`[Dwarf ${this.id}] 待机随机移动到 x:${randomX.toFixed(0)}`);
        }
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
            
            if (distance <= this.R_SENSE) {
                this.sensedBuildSites.push(buildSite);
            }
        }
    }
    
    /**
     * 更新感知的怪物
     */
    private updateSensedMonsters(): void {
        this.sensedMonsters = [];
        
        const monsterManager = (this.scene as any).monsterManager;
        if (!monsterManager) return;
        
        const monsters = monsterManager.getAliveMonsters();
        for (const monster of monsters) {
            const monsterPos = monster.getPosition();
            const distance = this.getDistanceToPoint(this.x, this.y, monsterPos.x, monsterPos.y);
            
            if (distance <= this.R_SENSE) {
                this.sensedMonsters.push(monster);
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
            return distance <= this.R_MONSTER_THREAT;
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
            
            if (distance < minDistance && distance <= this.R_MONSTER_THREAT) {
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
        
        // 尝试分配新的建造任务
        const buildingManager = (this.scene as any).buildingManager;
        if (buildingManager) {
            const assignedTask = buildingManager.tryAssignBuildingTask(this.id);
            if (assignedTask) {
                this.targetBuildId = assignedTask.id;
                console.log(`[Dwarf ${this.id}] 分配到建造任务: ${assignedTask.productName}`);
                return true;
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
     * 获取目标资源
     */
    private getTargetResource(): any {
        if (!this.targetResourceId) return null;
        
        // 从感知到的资源中查找目标资源
        const match3Grid = (this.scene as any).match3Grid;
        if (!match3Grid) return null;
        
        const droppedResources = match3Grid.getDroppedResources();
        return droppedResources.find(r => r.id === this.targetResourceId);
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
     * 获取矮人位置
     */
    public getPosition(): { x: number; y: number } {
        return { x: this.x, y: this.y };
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
        this.y = this.GROUND_Y; // 忽略y参数，始终在地面
        this.sprite.setPosition(this.x, this.y);
    }

    /**
     * 销毁矮人
     */
    public destroy(): void {
        this.scene.events.off('building-purchased', this.handleBuildingPurchased, this);
        
        // 释放资源认领
        if (this.targetResourceId) {
            const resource = this.getTargetResource();
            if (resource) {
                resource.releaseClaim();
            }
        }
        
        // 释放建筑锁
        if (this.targetBuildId) {
            const worldTaskMgr = WorldTaskManager.getInstance();
            worldTaskMgr.releaseBuildSiteLock(this.targetBuildId);
        }
        
        this.sprite.destroy();
        
        console.log(`Dwarf ${this.id} destroyed`);
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