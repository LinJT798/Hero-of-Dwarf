import { BuildingConstruction } from '../entities/BuildingConstruction';
import { CombatUnit, CombatAttributes, CombatUtils } from '../interfaces/CombatUnit';
import { configManager } from '../systems/ConfigManager';
import { BuildingConfig } from '../types/config/BuildingConfig';
import { BuildingFactory } from '../factories/BuildingFactory';

/**
 * 建筑管理器
 * 管理建筑的放置、状态和销毁
 */
export class BuildingManager {
    private scene: Phaser.Scene;
    private container: Phaser.GameObjects.Container;
    private buildings: Map<string, Building> = new Map();
    private buildingPositions: BuildingPosition[] = [];
    private nextBuildingId = 1;
    private buildingFactory: BuildingFactory;
    
    // 地基管理
    private foundations: Map<string, Phaser.GameObjects.Image> = new Map();
    private buildingTasks: Map<string, BuildingTask> = new Map();
    
    // 建造动画管理
    private buildingConstructions: Map<string, BuildingConstruction> = new Map();

    constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
        this.scene = scene;
        this.container = container;
        this.buildingFactory = new BuildingFactory(scene);
        
        this.initializeBuildingPositions();
        this.setupEventListeners();
    }

    /**
     * 初始化建筑位置
     */
    private initializeBuildingPositions(): void {
        const layoutConfig = this.buildingFactory.getBuildingLayoutConfig();
        
        if (!layoutConfig) {
            console.warn('Building layout config not found, using defaults');
            // 使用默认值
            const startX = 209;
            const xIncrement = 107;
            const buildingY = 630;
            const maxSlots = 8;
            
            for (let i = 0; i < maxSlots; i++) {
                this.buildingPositions.push({
                    id: i,
                    x: startX + (i * xIncrement),
                    y: buildingY,
                    occupied: false,
                    buildingId: null
                });
            }
        } else {
            // 使用配置值
            const { startX, increment, y } = layoutConfig.positions;
            const maxSlots = layoutConfig.maxSlots;
            
            for (let i = 0; i < maxSlots; i++) {
                this.buildingPositions.push({
                    id: i,
                    x: startX + (i * increment),
                    y: y,
                    occupied: false,
                    buildingId: null
                });
            }
        }

        console.log(`Initialized ${this.buildingPositions.length} building positions`);
    }

    /**
     * 设置事件监听
     */
    private setupEventListeners(): void {
        // 移除 place-building 监听，建筑只能通过地基→建造流程创建
        // this.scene.events.on('place-building', this.handlePlaceBuilding, this);
        this.scene.events.on('building-foundation-place', this.handleFoundationPlace, this);
    }

    /**
     * 处理建筑放置
     */
    private handlePlaceBuilding(data: { buildingType: string; buildingId: string }): void {
        const position = this.findNextAvailablePosition();
        
        if (position) {
            this.placeBuilding(data.buildingType, data.buildingId, position);
        } else {
            console.warn('No available position for building');
        }
    }

    /**
     * 查找下一个可用位置 (从左到右填充)
     */
    private findNextAvailablePosition(): BuildingPosition | null {
        // 建筑位置已经按从左到右的顺序排列，直接找第一个空位
        return this.buildingPositions.find(pos => !pos.occupied) || null;
    }

    /**
     * 放置建筑
     */
    private placeBuilding(buildingType: string, buildingId: string, position: BuildingPosition): void {
        const building = new Building(
            this.scene,
            `building_${this.nextBuildingId++}`,
            buildingType,
            buildingId,
            position.x,
            position.y
        );

        // 标记位置为已占用
        position.occupied = true;
        position.buildingId = building.id;

        // 添加到管理器
        this.buildings.set(building.id, building);
        
        // 添加到容器
        this.container.add(building.getSprite());

        console.log(`Placed ${buildingType} at position (${position.x}, ${position.y})`);
    }

    /**
     * 移除建筑
     */
    public removeBuilding(buildingId: string): void {
        const building = this.buildings.get(buildingId);
        if (!building) return;

        // 释放位置
        const position = this.buildingPositions.find(pos => pos.buildingId === buildingId);
        if (position) {
            position.occupied = false;
            position.buildingId = null;
        }

        // 销毁建筑
        building.destroy();
        this.buildings.delete(buildingId);

        console.log(`Removed building: ${buildingId}`);
    }

    /**
     * 获取所有建筑
     */
    public getAllBuildings(): Building[] {
        return Array.from(this.buildings.values());
    }

    /**
     * 获取指定类型的建筑
     */
    public getBuildingsByType(buildingType: string): Building[] {
        return this.getAllBuildings().filter(building => building.buildingType === buildingType);
    }

    /**
     * 处理地基放置（购买后立即显示地基）
     */
    private handleFoundationPlace(data: { productId: string; productType: string; productName: string }): void {
        console.log(`[BuildingManager] handleFoundationPlace called for ${data.productName}`);
        const position = this.findNextAvailablePosition();
        
        if (position) {
            // 创建地基
            this.createFoundation(data, position);
            
            // 创建建造任务
            const taskId = `build_${this.nextBuildingId++}`;
            const buildingTask: BuildingTask = {
                id: taskId,
                productType: data.productType,
                productName: data.productName,
                position: position,
                status: 'waiting_for_dwarf'
            };
            
            this.buildingTasks.set(taskId, buildingTask);
            console.log(`[BuildingManager] Created building task ${taskId}, total tasks: ${this.buildingTasks.size}`);
            
            // 标记位置为已占用
            position.occupied = true;
            position.buildingId = taskId;
            
            // 触发建造任务事件，让矮人系统知道有建造工作
            this.scene.events.emit('building-task-created', buildingTask);
            
            console.log(`[BuildingManager] Foundation placed for ${data.productName} at (${position.x}, ${position.y})`);
        } else {
            console.warn('[BuildingManager] No available position for foundation');
        }
    }
    
    /**
     * 创建地基
     */
    private createFoundation(data: { productType: string; productName: string }, position: BuildingPosition): void {
        const layoutConfig = this.buildingFactory.getBuildingLayoutConfig();
        const foundationSize = layoutConfig?.foundationSize || { width: 162, height: 162 };
        
        const foundation = this.scene.add.image(position.x, position.y, 'foundation');
        foundation.setOrigin(0, 0); // 与建筑一致，左上角对齐
        foundation.setDisplaySize(foundationSize.width, foundationSize.height);
        
        this.container.add(foundation);
        this.foundations.set(`${position.x}_${position.y}`, foundation);
        
        console.log(`Foundation created at (${position.x}, ${position.y}) with size 162x162`);
    }
    
    /**
     * 开始建造（矮人到达位置后调用）
     */
    public startBuilding(taskId: string): void {
        const task = this.buildingTasks.get(taskId);
        if (!task || task.status !== 'waiting_for_dwarf') {
            console.warn(`Invalid building task: ${taskId}`);
            return;
        }
        
        task.status = 'building';
        
        // 创建建造动画实体
        const buildingConstruction = new BuildingConstruction(
            this.scene,
            taskId,
            task.productType,
            task.position
        );
        
        this.buildingConstructions.set(taskId, buildingConstruction);
        
        const sprite = buildingConstruction.getSprite();
        if (sprite) {
            this.container.add(sprite);
        } else {
            console.warn('BuildingConstruction sprite is null, skipping add to container');
        }
        
        console.log(`Started building ${task.productName} at (${task.position.x}, ${task.position.y})`);
        
        // 触发建造开始事件
        this.scene.events.emit('building-construction-start', task);
    }
    
    /**
     * 完成建造（建造动画完成后调用）
     */
    public completeBuilding(taskId: string): void {
        const task = this.buildingTasks.get(taskId);
        if (!task || task.status !== 'building') {
            console.warn(`Invalid building task for completion: ${taskId}`);
            return;
        }
        
        // 移除地基
        const foundationKey = `${task.position.x}_${task.position.y}`;
        const foundation = this.foundations.get(foundationKey);
        if (foundation) {
            foundation.destroy();
            this.foundations.delete(foundationKey);
        }
        
        // 清理建造动画
        const buildingConstruction = this.buildingConstructions.get(taskId);
        if (buildingConstruction) {
            buildingConstruction.destroy();
            this.buildingConstructions.delete(taskId);
        }
        
        // 创建完成的建筑
        const building = new Building(
            this.scene,
            taskId,
            task.productType,
            task.productType, // 使用productType作为buildingId
            task.position.x,
            task.position.y
        );
        
        // 添加到管理器
        this.buildings.set(building.id, building);
        this.container.add(building.getSprite());
        
        // 添加血条到容器
        const healthBarObjects = building.getHealthBarObjects();
        healthBarObjects.forEach(obj => this.container.add(obj));
        
        // 清理任务
        this.buildingTasks.delete(taskId);
        
        // 通知矮人系统建造完成
        this.scene.events.emit('building-completed', {
            taskId: taskId,
            buildingType: task.productType
        });
        
        console.log(`Completed building ${task.productName} at (${task.position.x}, ${task.position.y})`);
    }
    
    /**
     * 获取所有建造任务
     */
    public getBuildingTasks(): BuildingTask[] {
        return Array.from(this.buildingTasks.values());
    }
    
    /**
     * 尝试分配建造任务给矮人
     */
    public tryAssignBuildingTask(dwarfId: string): BuildingTask | null {
        // 查找未分配的建造任务
        const availableTask = Array.from(this.buildingTasks.values()).find(task => 
            task.status === 'waiting_for_dwarf' && !task.assignedDwarfId
        );
        
        if (availableTask) {
            availableTask.assignedDwarfId = dwarfId;
            console.log(`Building task ${availableTask.id} assigned to dwarf ${dwarfId}`);
            return availableTask;
        }
        
        return null;
    }
    
    /**
     * 释放矮人的建造任务分配
     */
    public releaseBuildingTask(taskId: string, dwarfId: string): void {
        const task = this.buildingTasks.get(taskId);
        if (task && task.assignedDwarfId === dwarfId) {
            task.assignedDwarfId = undefined;
            console.log(`Building task ${taskId} released by dwarf ${dwarfId}`);
        }
    }
    
    /**
     * 更新所有建筑
     */
    public update(delta: number, monsters: CombatUnit[] = []): void {
        this.buildings.forEach(building => {
            building.update(delta, monsters);
        });
    }
    
    /**
     * 获取所有建筑作为战斗单位
     */
    public getBuildingsAsCombatUnits(): CombatUnit[] {
        return Array.from(this.buildings.values()).filter(building => building.isAlive());
    }

    /**
     * 销毁管理器
     */
    public destroy(): void {
        this.scene.events.off('place-building', this.handlePlaceBuilding, this);
        
        this.buildings.forEach(building => {
            building.destroy();
        });
        
        this.buildings.clear();
        this.buildingPositions = [];
    }
}

/**
 * 建筑位置接口
 */
interface BuildingPosition {
    id: number;
    x: number;
    y: number;
    occupied: boolean;
    buildingId: string | null;
}

/**
 * 建筑类
 */
class Building implements CombatUnit {
    public id: string;
    public buildingType: string;
    public productId: string;
    public x: number;
    public y: number;
    
    private scene: Phaser.Scene;
    private sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
    private healthBar: Phaser.GameObjects.Rectangle | null = null;
    private healthBarBg: Phaser.GameObjects.Rectangle | null = null;
    private nameText: Phaser.GameObjects.Text;
    
    // 建筑属性
    private isDestroyed: boolean = false;
    
    // 战斗属性
    private combatAttributes: CombatAttributes;
    
    // 攻击系统
    private lastAttackTime: number = 0;
    private currentTarget: CombatUnit | null = null;
    
    // Idle动画系统
    private isPlayingIdleAnimation: boolean = false;
    private idleAnimationTimer: number = 0;
    private idleStaticDuration: number = 0; // 静止状态的持续时间
    private idleAnimationChance: number;
    private idleStaticDurationMin: number;
    private idleStaticDurationMax: number;
    private idleAnimationDecided: boolean = false; // 是否已经决定了当前的idle行为
    
    // 建筑配置
    private buildingConfig: BuildingConfig | null = null;
    private buildingSize: { width: number; height: number };
    private projectileConfig: any = null;
    
    // 死亡动画相关
    private isDying: boolean = false;
    private deathAnimationTimer: number = 0;
    private deathAnimationDuration: number = 5000; // 5秒播放完成
    private buildAnimationFrameCount: number = 100; // 建造动画总帧数

    constructor(scene: Phaser.Scene, id: string, buildingType: string, productId: string, x: number, y: number) {
        this.scene = scene;
        this.id = id;
        this.buildingType = buildingType;
        this.productId = productId;
        this.x = x;
        this.y = y;
        
        // 先加载配置
        this.loadBuildingConfig();
        
        this.createSprite();
    }

    /**
     * 创建精灵 (使用Figma图片)
     */
    private createSprite(): void {
        // 使用配置的建筑尺寸
        const buildingWidth = this.buildingSize?.width || 162;
        const buildingHeight = this.buildingSize?.height || 162;
        
        // 使用实际的建筑图像
        if (this.buildingType === 'arrow_tower') {
            // 使用Sprite以支持动画
            this.sprite = this.scene.add.sprite(this.x, this.y, 'archer_building');
            this.sprite.setOrigin(0, 0);
            this.sprite.setDisplaySize(buildingWidth, buildingHeight);
            
            // 创建idle动画
            this.createIdleAnimation();
        } else {
            // 其他建筑类型使用矩形（未来可以添加更多建筑图像）
            this.sprite = this.scene.add.rectangle(
                this.x, this.y, 
                buildingWidth, buildingHeight, 
                0x654321
            );
            this.sprite.setOrigin(0, 0);
            this.sprite.setStrokeStyle(2, 0x000000);
        }

        // Figma中没有建筑名称显示，创建隐藏文本以兼容现有代码
        this.nameText = this.scene.add.text(0, 0, '', { fontSize: '1px' });
        this.nameText.setVisible(false);

        // 创建血条
        this.createHealthBar();
    }

    /**
     * 加载建筑配置
     */
    private loadBuildingConfig(): void {
        const buildingsConfig = configManager.getBuildingsConfig();
        const factory = new BuildingFactory(this.scene);
        
        if (buildingsConfig && buildingsConfig.buildings[this.buildingType]) {
            this.buildingConfig = buildingsConfig.buildings[this.buildingType];
            
            // 战斗属性
            this.combatAttributes = { ...this.buildingConfig.combat };
            
            // 建筑尺寸
            this.buildingSize = { ...this.buildingConfig.size };
            
            // 投射物配置
            this.projectileConfig = this.buildingConfig.projectile || null;
            
            // Idle动画配置
            if (this.buildingConfig.animations?.idle) {
                const idleConfig = this.buildingConfig.animations.idle;
                this.idleAnimationChance = idleConfig.chance;
                this.idleStaticDurationMin = idleConfig.staticDurationMin;
                this.idleStaticDurationMax = idleConfig.staticDurationMax;
            } else {
                this.idleAnimationChance = 0.5;
                this.idleStaticDurationMin = 2000;
                this.idleStaticDurationMax = 4000;
            }
            
            console.log(`Building config loaded for ${this.buildingType}: health=${this.combatAttributes.health}, range=${this.combatAttributes.range}`);
        } else {
            console.warn(`Building config not found for type: ${this.buildingType}, using defaults`);
            this.loadDefaultConfig();
        }
    }
    
    /**
     * 加载默认配置
     */
    private loadDefaultConfig(): void {
        this.combatAttributes = {
            health: 200,
            maxHealth: 200,
            attack: 25,
            range: 500,
            attackSpeed: 1000,
            armor: 10
        };
        
        this.buildingSize = { width: 162, height: 162 };
        this.idleAnimationChance = 0.5;
        this.idleStaticDurationMin = 2000;
        this.idleStaticDurationMax = 4000;
    }

    /**
     * 创建idle动画
     */
    private createIdleAnimation(): void {
        const animsManager = this.scene.anims;
        const animKey = `${this.buildingType}_idle`;
        
        if (!animsManager.exists(animKey) && this.buildingType === 'arrow_tower') {
            // 创建弓箭塔idle动画
            const idleFrames = [];
            for (let i = 1; i <= 101; i++) {
                if (this.scene.textures.exists(`arrow_tower_idle_${i}`)) {
                    idleFrames.push({ key: `arrow_tower_idle_${i}` });
                }
            }
            
            if (idleFrames.length > 0) {
                animsManager.create({
                    key: animKey,
                    frames: idleFrames,
                    frameRate: 4, // 调整为4fps (22帧 ÷ 5秒)
                    repeat: 0 // 播放一次
                });
                
                console.log(`Created building idle animation: ${animKey} with ${idleFrames.length} frames`);
            }
        }
    }
    
    /**
     * 播放动画（统一处理Sprite类型检查）
     */
    private playAnimation(animKey: string): void {
        if (this.sprite instanceof Phaser.GameObjects.Sprite) {
            this.sprite.play(animKey);
            
            // 弓箭塔idle动画需要特殊处理，因为动画帧尺寸不同
            if (animKey === 'arrow_tower_idle') {
                // 动画帧是720x720，静态图是538x538
                // 使用setDisplaySize而不是setScale，这样更一致
                this.sprite.setDisplaySize(162, 162);
                
                // 如果动画内容在帧中的位置不同，可能需要调整原点或位置
                // 暂时保持原点(0,0)不变，观察效果
            }
        }
    }
    
    /**
     * 停止动画
     */
    private stopAnimation(): void {
        if (this.sprite instanceof Phaser.GameObjects.Sprite) {
            this.sprite.stop();
            // 恢复到默认纹理
            this.sprite.setTexture('archer_building');
            // 确保尺寸恢复为162x162
            this.sprite.setDisplaySize(162, 162);
        }
    }
    
    /**
     * 更新idle动画逻辑
     */
    private updateIdleAnimation(delta: number): void {
        // 只有在没有攻击目标时才检查idle动画
        if (this.currentTarget || this.isDestroyed) return;
        
        // 如果还没有决定idle行为，立即决定
        if (!this.idleAnimationDecided) {
            this.decideIdleAnimation();
            return;
        }
        
        // 如果正在播放动画，等待动画完成（动画完成会在事件中处理）
        if (this.isPlayingIdleAnimation) {
            return;
        }
        
        // 如果在静止状态，计时
        this.idleAnimationTimer += delta;
        if (this.idleAnimationTimer >= this.idleStaticDuration) {
            // 静止时间结束，重新决定
            this.idleAnimationDecided = false;
            this.idleAnimationTimer = 0;
        }
    }
    
    /**
     * 决定idle动画行为
     */
    private decideIdleAnimation(): void {
        this.idleAnimationDecided = true;
        
        // 随机决定是播放动画还是静止
        if (Math.random() < this.idleAnimationChance) {
            // 播放动画
            this.startIdleAnimation();
        } else {
            // 静止时间从配置读取
            this.idleStaticDuration = this.idleStaticDurationMin + Math.random() * (this.idleStaticDurationMax - this.idleStaticDurationMin);
            this.idleAnimationTimer = 0;
            this.isPlayingIdleAnimation = false;
            console.log(`Building ${this.id} will stay static for ${(this.idleStaticDuration/1000).toFixed(1)}s`);
        }
    }
    
    /**
     * 开始播放idle动画
     */
    private startIdleAnimation(): void {
        if (this.buildingType === 'arrow_tower' && !this.isPlayingIdleAnimation) {
            const animKey = `${this.buildingType}_idle`;
            if (this.scene.anims.exists(animKey) && this.sprite instanceof Phaser.GameObjects.Sprite) {
                this.playAnimation(animKey);
                this.isPlayingIdleAnimation = true;
                
                // 监听动画完成事件
                this.sprite.once('animationcomplete', (animation: any) => {
                    console.log(`Building ${this.id} idle animation completed: ${animation.key}`);
                    this.isPlayingIdleAnimation = false;
                    this.idleAnimationDecided = false; // 重新决定下一个行为
                });
                
                console.log(`Building ${this.id} started idle animation`);
            }
        }
    }
    
    /**
     * 停止播放idle动画
     */
    private stopIdleAnimation(): void {
        if (this.isPlayingIdleAnimation && this.sprite instanceof Phaser.GameObjects.Sprite) {
            this.sprite.off('animationcomplete'); // 移除动画完成监听器
            this.stopAnimation();
            this.isPlayingIdleAnimation = false;
            console.log(`Building ${this.id} stopped idle animation`);
        }
    }

    /**
     * 创建血条
     */
    private createHealthBar(): void {
        const barWidth = 80;
        const adjustedWidth = barWidth * 0.6; // 缩短40%
        const barHeight = 6;
        const barOffsetY = -85; // 建筑上方
        
        // 计算血条位置（建筑中心上方）
        const buildingWidth = this.buildingSize?.width || 162;
        const buildingHeight = this.buildingSize?.height || 162;
        const barX = this.x + buildingWidth / 2 - adjustedWidth / 2; // 调整x位置使血条居中
        const barY = this.y + buildingHeight / 2 + barOffsetY;
        
        // 背景（带黑色描边）
        this.healthBarBg = this.scene.add.rectangle(barX, barY, adjustedWidth, barHeight, 0x000000);
        this.healthBarBg.setOrigin(0, 0.5); // 左边对齐
        this.healthBarBg.setStrokeStyle(1, 0x000000); // 1像素黑色描边
        
        // 血条（绿色）
        this.healthBar = this.scene.add.rectangle(barX, barY, adjustedWidth, barHeight, 0x00FF00);
        this.healthBar.setOrigin(0, 0.5); // 左边对齐
    }

    /**
     * 获取建筑显示名称
     */
    private getBuildingDisplayName(): string {
        const names: { [key: string]: string } = {
            'arrow_tower': '弓箭塔',
            'magic_tower': '魔法塔',
            'cannon_tower': '炮塔'
        };
        return names[this.buildingType] || this.buildingType;
    }

    /**
     * 更新血条
     */
    private updateHealthBar(): void {
        if (!this.healthBar || !this.healthBarBg) return;

        const healthRatio = this.combatAttributes.health / this.combatAttributes.maxHealth;
        const barWidth = 80;
        const adjustedWidth = barWidth * 0.6; // 缩短40%
        const barHeight = 6;
        
        // 更新血条宽度（从右往左缩）
        this.healthBar.setDisplaySize(adjustedWidth * healthRatio, barHeight);
        
        // 更新血条颜色
        let color = 0x00FF00; // 绿色
        if (healthRatio <= 0.25) {
            color = 0xFF0000; // 红色
        } else if (healthRatio <= 0.5) {
            color = 0xFFFF00; // 黄色
        }
        
        this.healthBar.setFillStyle(color);
        
        // 确保血条位置正确（建筑中心上方）
        const buildingWidth = this.buildingSize?.width || 162;
        const buildingHeight = this.buildingSize?.height || 162;
        const barX = this.x + buildingWidth / 2 - adjustedWidth / 2; // 调整x位置使血条居中
        const barY = this.y + buildingHeight / 2 - 85;
        
        this.healthBar.setPosition(barX, barY);
        this.healthBarBg.setPosition(barX, barY);
    }

    /**
     * 受到伤害
     */
    public takeDamage(damage: number): void {
        if (this.isDestroyed || this.isDying) return;

        this.combatAttributes.health = Math.max(0, this.combatAttributes.health - damage);
        this.updateHealthBar();

        if (this.combatAttributes.health <= 0) {
            this.die();
        }
    }

    /**
     * 建筑死亡处理
     */
    private die(): void {
        if (this.isDying) return;
        
        this.isDying = true;
        this.combatAttributes.health = 0;
        
        console.log(`Building ${this.id} (${this.buildingType}) is dying`);
        
        // 立即销毁血条
        if (this.healthBar) {
            this.healthBar.destroy();
            this.healthBar = null;
        }
        if (this.healthBarBg) {
            this.healthBarBg.destroy();
            this.healthBarBg = null;
        }
        
        // 如果是弓箭塔，播放倒放的建造动画
        if (this.buildingType === 'arrow_tower' && this.sprite instanceof Phaser.GameObjects.Sprite) {
            this.playDeathAnimation();
        } else {
            // 其他建筑直接等待5秒后销毁
            this.deathAnimationTimer = 0;
        }
        
        // 触发建筑死亡事件
        this.scene.events.emit('building-destroyed', {
            buildingId: this.id,
            buildingType: this.buildingType,
            position: { x: this.x, y: this.y }
        });
    }
    
    /**
     * 播放死亡动画（倒放建造动画）
     */
    private playDeathAnimation(): void {
        if (!(this.sprite instanceof Phaser.GameObjects.Sprite)) return;
        
        const sprite = this.sprite;
        
        // 停止当前动画
        sprite.stop();
        
        // 创建倒放的建造动画
        const animKey = `${this.buildingType}_death_${this.id}`;
        
        if (!this.scene.anims.exists(animKey)) {
            // 收集建造动画的帧
            const buildFrames = [];
            for (let i = 1; i <= this.buildAnimationFrameCount; i++) {
                if (this.scene.textures.exists(`${this.buildingType}_build_${i}`)) {
                    buildFrames.push({ key: `${this.buildingType}_build_${i}` });
                }
            }
            
            // 倒序排列帧
            buildFrames.reverse();
            
            if (buildFrames.length > 0) {
                this.scene.anims.create({
                    key: animKey,
                    frames: buildFrames,
                    frameRate: 20, // 20fps (建造动画未优化，保持原帧率)
                    repeat: 0 // 播放一次
                });
                
                console.log(`Created death animation for ${this.buildingType} with ${buildFrames.length} frames`);
            }
        }
        
        // 播放死亡动画
        if (this.scene.anims.exists(animKey)) {
            sprite.play(animKey);
            
            // 监听动画完成
            sprite.once('animationcomplete', () => {
                console.log(`Building ${this.id} death animation completed`);
                // 动画完成后开始5秒计时
                this.deathAnimationTimer = 0;
            });
        } else {
            // 如果没有动画，直接开始计时
            this.deathAnimationTimer = 0;
        }
    }

    /**
     * 更新建筑
     */
    public update(delta: number, monsters: CombatUnit[] = []): void {
        if (this.isDestroyed) return;
        
        // 如果正在死亡，更新死亡计时器
        if (this.isDying) {
            this.updateDeathState(delta);
            return;
        }

        // 更新攻击逻辑
        this.updateAttackLogic(monsters);
        
        // 更新idle动画
        this.updateIdleAnimation(delta);
        
        // 更新血条位置（以防动画改变了位置）
        this.updateHealthBar();
    }
    
    /**
     * 更新死亡状态
     */
    private updateDeathState(delta: number): void {
        this.deathAnimationTimer += delta;
        
        // 检查是否到达销毁时间
        if (this.deathAnimationTimer >= this.deathAnimationDuration) {
            console.log(`Building ${this.id} death timer completed, destroying`);
            this.destroy();
        }
    }

    /**
     * 更新攻击逻辑
     */
    private updateAttackLogic(monsters: CombatUnit[]): void {
        if (this.buildingType !== 'arrow_tower') return; // 只有弓箭塔可以攻击

        const currentTime = Date.now();
        
        // 寻找范围内的目标
        if (!this.currentTarget || !this.isTargetValid(this.currentTarget)) {
            this.currentTarget = this.findNearestTarget(monsters);
            
            // 找到新目标时停止idle动画并重置状态
            if (this.currentTarget) {
                if (this.isPlayingIdleAnimation) {
                    this.stopIdleAnimation();
                }
                this.idleAnimationDecided = false;
                this.idleAnimationTimer = 0;
            }
        }

        // 执行攻击
        if (this.currentTarget && this.canAttackNow(currentTime)) {
            this.attackTarget(this.currentTarget);
            this.lastAttackTime = currentTime;
        }
    }

    /**
     * 寻找最近的目标
     */
    private findNearestTarget(monsters: CombatUnit[]): CombatUnit | null {
        let nearestTarget: CombatUnit | null = null;
        let minDistance = Infinity;

        monsters.forEach(monster => {
            if (!monster.isAlive()) return;

            const distance = CombatUtils.getDistance(this.getPosition(), monster.getPosition());
            if (distance <= this.combatAttributes.range && distance < minDistance) {
                minDistance = distance;
                nearestTarget = monster;
            }
        });

        return nearestTarget;
    }

    /**
     * 检查目标是否有效
     */
    private isTargetValid(target: CombatUnit): boolean {
        if (!target || !target.isAlive()) return false;
        
        const distance = CombatUtils.getDistance(this.getPosition(), target.getPosition());
        return distance <= this.combatAttributes.range;
    }

    /**
     * 检查是否可以攻击
     */
    private canAttackNow(currentTime: number): boolean {
        return currentTime - this.lastAttackTime >= this.combatAttributes.attackSpeed;
    }

    /**
     * 攻击目标
     */
    public attackTarget(target: CombatUnit): void {
        if (!this.canAttack(target)) return;

        const damage = CombatUtils.calculateDamage(
            this.combatAttributes.attack,
            target.getCombatAttributes().armor
        );

        console.log(`Building ${this.id} attacks target for ${damage} damage`);
        
        // 创建攻击特效
        this.createAttackEffect(target);
        
        // 对目标造成伤害
        target.takeDamage(damage);
    }

    /**
     * 创建攻击特效
     */
    private createAttackEffect(target: CombatUnit): void {
        const targetPos = target.getPosition();
        
        // 计算正确的弓箭射出位置
        // 弓箭塔尺寸：162x162px，origin(0,0)
        // 射出位置：x轴中间，y轴上界往下39px
        const arrowStartX = this.x + 81; // 弓箭塔宽度的一半 (162/2)
        const arrowStartY = this.y + 39; // 弓箭塔上界往下39px
        
        // 创建箭矢特效 - 使用箭矢图片资源
        let arrow: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
        
        if (this.scene.textures.exists('arrow')) {
            // 使用箭矢图片，从配置读取尺寸
            arrow = this.scene.add.image(arrowStartX, arrowStartY, 'arrow');
            const projectileSize = this.projectileConfig?.size || { width: 49, height: 13 };
            arrow.setDisplaySize(projectileSize.width, projectileSize.height);
            arrow.setOrigin(0.5, 0.5);
            
            // 初始角度设为0，后续会在抛物线动画中动态调整
            arrow.setRotation(0);
        } else {
            // 如果图片不存在，使用备用的矩形
            arrow = this.scene.add.rectangle(arrowStartX, arrowStartY, 3, 15, 0xFFFF00);
            console.warn('Arrow image not found, using fallback rectangle');
        }
        
        // 计算抛物线飞行参数
        const flightTime = this.projectileConfig?.flightTime || 1600;
        const flightData = this.calculateParabolicFlight(
            { x: arrowStartX, y: arrowStartY },
            target,
            flightTime
        );
        
        // 创建抛物线飞行动画
        this.createParabolicAnimation(arrow, flightData, target, flightTime);
    }
    
    /**
     * 计算抛物线飞行参数
     */
    private calculateParabolicFlight(
        startPos: { x: number; y: number }, 
        target: CombatUnit, 
        flightTime: number
    ): { targetPos: { x: number; y: number }; arcHeight: number } {
        // 预测目标在箭矢落地时的位置
        const targetPos = this.predictTargetPosition(target, flightTime);
        
        // 计算抛物线的最高点
        const distance = CombatUtils.getDistance(startPos, targetPos);
        const arcHeightFactor = this.projectileConfig?.arcHeightFactor || 0.3;
        const minArcHeight = this.projectileConfig?.minArcHeight || 50;
        const arcHeight = Math.max(minArcHeight, distance * arcHeightFactor);
        
        return {
            targetPos,
            arcHeight
        };
    }
    
    /**
     * 预测目标在指定时间后的位置
     */
    private predictTargetPosition(target: CombatUnit, flightTime: number): { x: number; y: number } {
        const currentPos = target.getPosition();
        
        // 如果目标是哥布林，预测其移动位置
        if ('getState' in target) {
            const goblin = target as any;
            const state = goblin.getState();
            
            if (state === 'moving') {
                // 哥布林向左移动，速度为50像素/秒
                const moveSpeed = 50;
                const timeInSeconds = flightTime / 1000;
                const predictedX = currentPos.x - (moveSpeed * timeInSeconds);
                
                // 调整为瞄准哥布林中心（哥布林高度79px，底部中心对齐）
                return {
                    x: predictedX,
                    y: currentPos.y - 39.5 // 哥布林高度的一半
                };
            }
        }
        
        // 对于其他目标或静止状态，也需要调整到中心位置
        // 假设是哥布林，调整为中心
        if ('getSprite' in target) {
            // 哥布林高度79px，底部中心对齐
            return {
                x: currentPos.x,
                y: currentPos.y - 39.5
            };
        }
        
        // 其他目标返回当前位置
        return currentPos;
    }
    
    /**
     * 创建抛物线动画
     */
    private createParabolicAnimation(
        arrow: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle,
        flightData: { targetPos: { x: number; y: number }; arcHeight: number },
        target: CombatUnit,
        flightTime: number = 1600
    ): void {
        const startPos = { x: arrow.x, y: arrow.y };
        const { targetPos, arcHeight } = flightData;
        
        // 计算抛物线中点
        const midX = (startPos.x + targetPos.x) / 2;
        const midY = Math.min(startPos.y, targetPos.y) - arcHeight;
        
        // 创建路径点
        const path = new Phaser.Curves.QuadraticBezier(
            new Phaser.Math.Vector2(startPos.x, startPos.y),
            new Phaser.Math.Vector2(midX, midY),
            new Phaser.Math.Vector2(targetPos.x, targetPos.y)
        );
        
        // 动画进度
        let t = 0;
        let lastPos = { x: startPos.x, y: startPos.y };
        
        // 使用自定义更新函数实现抛物线飞行
        const tween = this.scene.tweens.add({
            targets: { progress: 0 },
            progress: 1,
            duration: flightTime, // 飞行时间从配置读取
            ease: 'Sine.easeInOut', // 加减速效果
            onUpdate: (tween) => {
                t = tween.getValue();
                
                // 根据贝塞尔曲线获取当前位置
                const currentPos = path.getPoint(t);
                arrow.setPosition(currentPos.x, currentPos.y);
                
                // 计算箭矢旋转角度（朝向飞行方向）
                if (arrow instanceof Phaser.GameObjects.Image) {
                    const angle = Phaser.Math.Angle.Between(
                        lastPos.x, lastPos.y,
                        currentPos.x, currentPos.y
                    );
                    arrow.setRotation(angle);
                }
                
                lastPos = { x: currentPos.x, y: currentPos.y };
            },
            onComplete: () => {
                // 检查目标是否仍然存活并在合理范围内
                if (target.isAlive()) {
                    const finalTargetPos = target.getPosition();
                    const hitDistance = CombatUtils.getDistance(
                        { x: arrow.x, y: arrow.y },
                        finalTargetPos
                    );
                    
                    // 如果箭矢落点在目标附近，则命中
                    const hitRadius = this.projectileConfig?.hitRadius || 50;
                    if (hitDistance <= hitRadius) {
                        // 创建命中特效
                        const hitEffect = this.scene.add.rectangle(
                            finalTargetPos.x, finalTargetPos.y, 
                            20, 20, 0xFF0000, 0.7
                        );
                        
                        this.scene.tweens.add({
                            targets: hitEffect,
                            alpha: 0,
                            scaleX: 2,
                            scaleY: 2,
                            duration: 300,
                            ease: 'Power2',
                            onComplete: () => {
                                hitEffect.destroy();
                            }
                        });
                        
                        console.log(`Arrow hit target at distance ${hitDistance.toFixed(1)} pixels`);
                    } else {
                        console.log(`Arrow missed target by ${hitDistance.toFixed(1)} pixels`);
                    }
                }
                
                arrow.destroy();
            }
        });
    }

    /**
     * 获取精灵对象
     */
    public getSprite(): Phaser.GameObjects.GameObject {
        return this.sprite;
    }
    
    /**
     * 获取血条对象（用于添加到容器）
     */
    public getHealthBarObjects(): Phaser.GameObjects.GameObject[] {
        const objects: Phaser.GameObjects.GameObject[] = [];
        if (this.healthBarBg) objects.push(this.healthBarBg);
        if (this.healthBar) objects.push(this.healthBar);
        return objects;
    }

    /**
     * 检查是否被摧毁
     */
    public getIsDestroyed(): boolean {
        return this.isDestroyed;
    }

    // ===== CombatUnit接口实现 =====
    
    public getCombatAttributes(): CombatAttributes {
        return { ...this.combatAttributes };
    }
    
    public getPosition(): { x: number; y: number } {
        // 返回建筑底部中心点，这样更接近地面上的单位
        const width = this.buildingSize?.width || 162;
        const height = this.buildingSize?.height || 162;
        return { 
            x: this.x + width / 2, 
            y: this.y + height 
        };
    }
    
    public isAlive(): boolean {
        return !this.isDestroyed && !this.isDying && this.combatAttributes.health > 0;
    }
    
    public canAttack(target: CombatUnit): boolean {
        return this.isAlive() && 
               target.isAlive() && 
               CombatUtils.isInRange(this, target);
    }
    
    public getCollisionBounds(): { x: number; y: number; width: number; height: number } {
        const width = this.buildingSize?.width || 162;
        const height = this.buildingSize?.height || 162;
        return {
            x: this.x,
            y: this.y,
            width: width,
            height: height
        };
    }

    /**
     * 销毁建筑
     */
    public destroy(): void {
        this.isDestroyed = true;
        
        // 播放销毁动画
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0,
            scaleX: 0,
            scaleY: 0,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                this.sprite.destroy();
                this.nameText.destroy();
                if (this.healthBar) {
                    this.healthBar.destroy();
                    this.healthBar = null;
                }
                if (this.healthBarBg) {
                    this.healthBarBg.destroy();
                    this.healthBarBg = null;
                }
            }
        });

        console.log(`Building ${this.id} destroyed`);
    }
}

// 建造任务接口
interface BuildingTask {
    id: string;
    productType: string;
    productName: string;
    position: BuildingPosition;
    status: 'waiting_for_dwarf' | 'building' | 'completed';
    assignedDwarfId?: string; // 分配给哪个矮人
}