/**
 * 地面动画实体
 * 处理地面微风动画效果
 */
export class LandAnimation {
    private scene: Phaser.Scene;
    private staticLandSprite: Phaser.GameObjects.Image;
    private animationSprite: Phaser.GameObjects.Sprite;
    // 动画一直播放，不需要间隔配置
    
    constructor(scene: Phaser.Scene, x: number, y: number) {
        this.scene = scene;
        
        this.createSprites(x, y);
        this.createWindAnimation();
        
        // 立即开始播放动画
        this.startContinuousAnimation();
        
        console.log(`LandAnimation created at (${x}, ${y}), continuous animation started`);
    }
    
    /**
     * 创建静态和动画精灵
     */
    private createSprites(x: number, y: number): void {
        try {
            // 创建静态地面精灵（默认显示）
            this.staticLandSprite = this.scene.add.image(x, y, 'back_land');
            this.staticLandSprite.setOrigin(0, 0);
            this.staticLandSprite.setVisible(true);
            
            // 创建动画精灵（直接显示）
            if (this.scene.textures.exists('land_wind_1')) {
                this.animationSprite = this.scene.add.sprite(x, y, 'land_wind_1');
                this.animationSprite.setOrigin(0, 0);
                this.animationSprite.setVisible(true);
                
                // 隐藏静态精灵，因为我们要一直播放动画
                this.staticLandSprite.setVisible(false);
                
                console.log('Land animation sprites created successfully');
            } else {
                console.warn('Land wind animation frames not found, using static land only');
            }
        } catch (error) {
            console.error('Error creating LandAnimation sprites:', error);
        }
    }
    
    /**
     * 创建微风动画
     */
    private createWindAnimation(): void {
        if (!this.animationSprite) return;
        
        const animsManager = this.scene.anims;
        const animKey = 'land_wind_animation';
        
        if (!animsManager.exists(animKey)) {
            // 创建101帧微风动画
            const windFrames = [];
            
            for (let i = 1; i <= 101; i++) {
                const frameKey = `land_wind_${i}`;
                if (this.scene.textures.exists(frameKey)) {
                    windFrames.push({ key: frameKey });
                }
            }
            
            if (windFrames.length > 0) {
                animsManager.create({
                    key: animKey,
                    frames: windFrames,
                    frameRate: 20, // 20fps统一帧率
                    repeat: -1 // 无限循环
                });
                
                console.log(`Created land wind animation with ${windFrames.length} frames`);
            } else {
                console.warn('No wind animation frames found');
            }
        }
    }
    
    /**
     * 开始连续播放动画
     */
    private startContinuousAnimation(): void {
        if (!this.animationSprite) return;
        
        const animKey = 'land_wind_animation';
        
        if (this.scene.anims.exists(animKey)) {
            // 播放无限循环的动画
            this.animationSprite.play(animKey);
            console.log('Started continuous land animation');
        }
    }
    
    /**
     * 更新动画逻辑
     */
    public update(delta: number): void {
        // 动画已经在无限循环，不需要额外的更新逻辑
    }
    
    
    
    /**
     * 获取静态地面精灵（用于添加到容器）
     */
    public getStaticSprite(): Phaser.GameObjects.Image {
        return this.staticLandSprite;
    }
    
    /**
     * 获取动画精灵（用于添加到容器）
     */
    public getAnimationSprite(): Phaser.GameObjects.Sprite | null {
        return this.animationSprite || null;
    }
    
    /**
     * 强制触发微风动画（调试用）
     */
    public triggerWindAnimation(): void {
        // 动画已经在持续播放，此方法不再需要
        console.log('Animation is already playing continuously');
    }
    
    /**
     * 销毁地面动画
     */
    public destroy(): void {
        if (this.staticLandSprite) {
            this.staticLandSprite.destroy();
        }
        
        if (this.animationSprite) {
            this.animationSprite.destroy();
        }
        
        console.log('LandAnimation destroyed');
    }
}