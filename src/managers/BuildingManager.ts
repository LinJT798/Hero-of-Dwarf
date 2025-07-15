import { BuildingConstruction } from '../entities/BuildingConstruction';

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
    
    // 地基管理
    private foundations: Map<string, Phaser.GameObjects.Image> = new Map();
    private buildingTasks: Map<string, BuildingTask> = new Map();
    
    // 建造动画管理
    private buildingConstructions: Map<string, BuildingConstruction> = new Map();

    constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
        this.scene = scene;
        this.container = container;
        
        this.initializeBuildingPositions();
        this.setupEventListeners();
    }

    /**
     * 初始化建筑位置 (8个建筑栏位，从左到右排列)
     * 第一个x=209，后续每个+107，一共8个
     */
    private initializeBuildingPositions(): void {
        const startX = 209;
        const xIncrement = 107;
        const buildingY = 630; // 建筑y坐标
        
        const buildingPositions = [];
        for (let i = 0; i < 8; i++) {
            buildingPositions.push({
                x: startX + (i * xIncrement),
                y: buildingY
            });
        }

        buildingPositions.forEach((pos, i) => {
            this.buildingPositions.push({
                id: i,
                x: pos.x,
                y: pos.y,
                occupied: false,
                buildingId: null
            });
        });

        console.log(`Initialized ${buildingPositions.length} building positions: x从${startX}开始，每个+${xIncrement}`);
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
        const foundation = this.scene.add.image(position.x, position.y, 'foundation');
        foundation.setOrigin(0, 0); // 与建筑一致，左上角对齐
        foundation.setDisplaySize(162, 162); // 与弓箭塔建筑一样的大小
        
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
    public update(delta: number, monsters: any[] = []): void {
        this.buildings.forEach(building => {
            building.update(delta, monsters);
        });
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
class Building {
    public id: string;
    public buildingType: string;
    public productId: string;
    public x: number;
    public y: number;
    
    private scene: Phaser.Scene;
    private sprite: Phaser.GameObjects.Rectangle;
    private healthBar: Phaser.GameObjects.Rectangle | null = null;
    private nameText: Phaser.GameObjects.Text;
    
    // 建筑属性
    private health: number = 100;
    private maxHealth: number = 100;
    private isDestroyed: boolean = false;
    
    // 攻击属性
    private attackDamage: number = 20;
    private attackRange: number = 150;
    private attackSpeed: number = 1000; // 攻击间隔（毫秒）
    private lastAttackTime: number = 0;
    private currentTarget: any = null;

    constructor(scene: Phaser.Scene, id: string, buildingType: string, productId: string, x: number, y: number) {
        this.scene = scene;
        this.id = id;
        this.buildingType = buildingType;
        this.productId = productId;
        this.x = x;
        this.y = y;
        
        this.createSprite();
        this.loadBuildingConfig();
    }

    /**
     * 创建精灵 (使用Figma图片)
     */
    private createSprite(): void {
        // 弓箭塔主体 (使用Figma图片: archer_building 162×162px)
        const buildingSize = this.buildingType === 'arrow_tower' ? 162 : 60;
        
        // 使用实际的弓箭塔图像 (Figma: archer_building 162×162px)
        if (this.buildingType === 'arrow_tower') {
            const archerImage = this.scene.add.image(this.x, this.y, 'archer_building');
            archerImage.setOrigin(0, 0);
            archerImage.setDisplaySize(buildingSize, buildingSize);
            this.sprite = archerImage as any; // 类型转换以兼容现有代码
        } else {
            // 其他建筑类型使用矩形
            this.sprite = this.scene.add.rectangle(
                this.x, this.y, 
                buildingSize, buildingSize, 
                0x654321
            );
            this.sprite.setOrigin(0, 0);
            this.sprite.setStrokeStyle(2, 0x000000);
        }

        // Figma中没有建筑名称显示，创建隐藏文本以兼容现有代码
        this.nameText = this.scene.add.text(0, 0, '', { fontSize: '1px' });
        this.nameText.setVisible(false);

        // Figma中没有血条显示
    }

    /**
     * 加载建筑配置
     */
    private async loadBuildingConfig(): Promise<void> {
        try {
            // 这里可以加载建筑的具体配置
            // 暂时使用默认值
            this.health = 100;
            this.maxHealth = 100;
        } catch (error) {
            console.warn('Failed to load building config');
        }
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
        if (this.healthBar) {
            this.healthBar.destroy();
        }

        const healthRatio = this.health / this.maxHealth;
        const barWidth = 50;
        const barHeight = 4;
        
        // 背景
        const healthBg = this.scene.add.rectangle(this.x, this.y - 35, barWidth, barHeight, 0x000000);
        
        // 血条
        this.healthBar = this.scene.add.rectangle(
            this.x - barWidth/2 + (barWidth * healthRatio)/2, 
            this.y - 35, 
            barWidth * healthRatio, 
            barHeight, 
            healthRatio > 0.5 ? 0x00FF00 : healthRatio > 0.25 ? 0xFFFF00 : 0xFF0000
        );
    }

    /**
     * 受到伤害
     */
    public takeDamage(damage: number): void {
        if (this.isDestroyed) return;

        this.health = Math.max(0, this.health - damage);
        this.updateHealthBar();

        if (this.health <= 0) {
            this.destroy();
        }
    }

    /**
     * 更新建筑
     */
    public update(delta: number, monsters: any[] = []): void {
        if (this.isDestroyed) return;

        // 更新攻击逻辑
        this.updateAttackLogic(monsters);
    }

    /**
     * 更新攻击逻辑
     */
    private updateAttackLogic(monsters: any[]): void {
        if (this.buildingType !== 'arrow_tower') return; // 只有弓箭塔可以攻击

        const currentTime = Date.now();
        
        // 寻找范围内的目标
        if (!this.currentTarget || !this.isTargetValid(this.currentTarget)) {
            this.currentTarget = this.findNearestTarget(monsters);
        }

        // 执行攻击
        if (this.currentTarget && this.canAttack(currentTime)) {
            this.attackTarget(this.currentTarget);
            this.lastAttackTime = currentTime;
        }
    }

    /**
     * 寻找最近的目标
     */
    private findNearestTarget(monsters: any[]): any {
        let nearestTarget = null;
        let minDistance = Infinity;

        monsters.forEach(monster => {
            if (!monster.isAlive()) return;

            const distance = this.getDistanceToTarget(monster);
            if (distance <= this.attackRange && distance < minDistance) {
                minDistance = distance;
                nearestTarget = monster;
            }
        });

        return nearestTarget;
    }

    /**
     * 检查目标是否有效
     */
    private isTargetValid(target: any): boolean {
        if (!target || !target.isAlive()) return false;
        
        const distance = this.getDistanceToTarget(target);
        return distance <= this.attackRange;
    }

    /**
     * 计算到目标的距离
     */
    private getDistanceToTarget(target: any): number {
        const targetPos = target.getPosition();
        const dx = targetPos.x - this.x;
        const dy = targetPos.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 检查是否可以攻击
     */
    private canAttack(currentTime: number): boolean {
        return currentTime - this.lastAttackTime >= this.attackSpeed;
    }

    /**
     * 攻击目标
     */
    private attackTarget(target: any): void {
        if (!target || !target.isAlive()) return;

        console.log(`Building ${this.id} attacks monster ${target.id} for ${this.attackDamage} damage`);
        
        // 创建攻击特效
        this.createAttackEffect(target);
        
        // 对目标造成伤害
        target.takeDamage(this.attackDamage);
    }

    /**
     * 创建攻击特效
     */
    private createAttackEffect(target: any): void {
        const targetPos = target.getPosition();
        
        // 创建箭矢特效
        const arrow = this.scene.add.rectangle(this.x, this.y, 3, 15, 0xFFFF00);
        
        // 箭矢飞行动画
        this.scene.tweens.add({
            targets: arrow,
            x: targetPos.x,
            y: targetPos.y,
            duration: 200,
            ease: 'Linear',
            onComplete: () => {
                // 创建命中特效
                const hitEffect = this.scene.add.rectangle(targetPos.x, targetPos.y, 20, 20, 0xFF0000, 0.7);
                
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
     * 获取位置
     */
    public getPosition(): { x: number; y: number } {
        return { x: this.x, y: this.y };
    }

    /**
     * 检查是否被摧毁
     */
    public getIsDestroyed(): boolean {
        return this.isDestroyed;
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