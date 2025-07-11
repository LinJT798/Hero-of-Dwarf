/**
 * 建筑建造动画实体
 * 处理建筑的建造过程动画
 */
export class BuildingConstruction {
    private scene: Phaser.Scene;
    private sprite!: Phaser.GameObjects.Sprite;
    private taskId: string;
    private buildingType: string;
    private position: { x: number; y: number };
    private isAnimating: boolean = false;
    
    constructor(
        scene: Phaser.Scene, 
        taskId: string, 
        buildingType: string, 
        position: { x: number; y: number }
    ) {
        this.scene = scene;
        this.taskId = taskId;
        this.buildingType = buildingType;
        this.position = position;
        
        this.createAnimationSprite();
        this.createAnimations();
        
        // 监听建造开始事件
        this.scene.events.on('start-building-animation', this.handleStartAnimation, this);
    }
    
    /**
     * 创建动画精灵
     */
    private createAnimationSprite(): void {
        try {
            // 使用第一帧作为初始图像
            if (this.buildingType === 'arrow_tower' && this.scene.textures.exists('arrow_tower_build_1')) {
                this.sprite = this.scene.add.sprite(this.position.x, this.position.y, 'arrow_tower_build_1');
                this.sprite.setOrigin(0, 0); // 与建筑一致，左上角对齐
                this.sprite.setVisible(false); // 初始隐藏
                
                // 与建筑大小一致
                this.sprite.setDisplaySize(162, 162);
                
                console.log(`BuildingConstruction created for ${this.buildingType} at (${this.position.x}, ${this.position.y})`);
            } else {
                console.warn(`No animation frames found for building type: ${this.buildingType}, texture exists: ${this.scene.textures.exists('arrow_tower_build_1')}`);
                
                // 创建一个备用精灵以防止错误
                this.sprite = this.scene.add.sprite(this.position.x, this.position.y, 'foundation');
                this.sprite.setOrigin(0, 0);
                this.sprite.setVisible(false);
                this.sprite.setDisplaySize(162, 162);
            }
        } catch (error) {
            console.error('Error creating BuildingConstruction sprite:', error);
            // 创建最简单的备用精灵
            this.sprite = this.scene.add.sprite(this.position.x, this.position.y, 'foundation');
            this.sprite.setOrigin(0, 0);
            this.sprite.setVisible(false);
        }
    }
    
    /**
     * 创建建造动画
     */
    private createAnimations(): void {
        const animsManager = this.scene.anims;
        const animKey = `${this.buildingType}_build_${this.taskId}`;
        
        if (!animsManager.exists(animKey) && this.buildingType === 'arrow_tower') {
            // 创建弓箭塔建造动画
            const buildFrames = [];
            for (let i = 1; i <= 100; i++) {
                if (this.scene.textures.exists(`arrow_tower_build_${i}`)) {
                    buildFrames.push({ key: `arrow_tower_build_${i}` });
                }
            }
            
            if (buildFrames.length > 0) {
                animsManager.create({
                    key: animKey,
                    frames: buildFrames,
                    frameRate: 20, // 20fps统一帧率
                    repeat: 0 // 不循环，播放一次
                });
                
                console.log(`Created building animation: ${animKey} with ${buildFrames.length} frames`);
            }
        }
    }
    
    /**
     * 处理建造动画开始事件
     */
    private handleStartAnimation(data: { taskId: string; buildingType: string; position: { x: number; y: number } }): void {
        if (data.taskId === this.taskId && data.buildingType === this.buildingType) {
            this.startBuildAnimation();
        }
    }
    
    /**
     * 开始建造动画
     */
    private startBuildAnimation(): void {
        if (!this.sprite || this.isAnimating) return;
        
        this.isAnimating = true;
        this.sprite.setVisible(true);
        
        const animKey = `${this.buildingType}_build_${this.taskId}`;
        
        if (this.scene.anims.exists(animKey)) {
            // 播放建造动画
            this.sprite.play(animKey);
            
            // 监听动画完成事件
            this.sprite.on('animationcomplete', this.onAnimationComplete, this);
            
            console.log(`Started building animation for ${this.buildingType} (${this.taskId})`);
        } else {
            console.warn(`Animation not found: ${animKey}`);
            // 如果没有动画，直接完成建造
            this.onAnimationComplete();
        }
    }
    
    /**
     * 动画完成回调
     */
    private onAnimationComplete(): void {
        this.isAnimating = false;
        
        // 通知BuildingManager建造完成
        const buildingManager = (this.scene as any).buildingManager;
        if (buildingManager) {
            buildingManager.completeBuilding(this.taskId);
        }
        
        // 通知矮人建造完成
        this.scene.events.emit('building-animation-complete', {
            taskId: this.taskId,
            buildingType: this.buildingType
        });
        
        console.log(`Building animation completed for ${this.buildingType} (${this.taskId})`);
        
        // 销毁动画精灵
        this.destroy();
    }
    
    /**
     * 获取精灵对象
     */
    public getSprite(): Phaser.GameObjects.Sprite | null {
        return this.sprite || null;
    }
    
    /**
     * 销毁建造动画
     */
    public destroy(): void {
        if (this.sprite) {
            this.sprite.destroy();
        }
        
        // 移除事件监听
        this.scene.events.off('start-building-animation', this.handleStartAnimation, this);
        
        console.log(`BuildingConstruction destroyed for ${this.taskId}`);
    }
}