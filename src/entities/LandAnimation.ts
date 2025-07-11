/**
 * 地面动画实体
 * 处理地面微风动画效果
 */
export class LandAnimation {
    private scene: Phaser.Scene;
    private staticLandSprite: Phaser.GameObjects.Image;
    private animationSprite: Phaser.GameObjects.Sprite;
    private windTimer: number = 0;
    private isAnimating: boolean = false;
    
    // 微风动画配置
    private readonly WIND_INTERVAL_MIN = 15000; // 最少15秒
    private readonly WIND_INTERVAL_MAX = 25000; // 最多25秒
    private nextWindTime: number;
    
    constructor(scene: Phaser.Scene, x: number, y: number) {
        this.scene = scene;
        
        // 设置下次微风时间
        this.nextWindTime = this.getRandomWindInterval();
        
        this.createSprites(x, y);
        this.createWindAnimation();
        
        console.log(`LandAnimation created at (${x}, ${y}), next wind in ${this.nextWindTime}ms`);
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
            
            // 创建动画精灵（初始隐藏）
            if (this.scene.textures.exists('land_wind_1')) {
                this.animationSprite = this.scene.add.sprite(x, y, 'land_wind_1');
                this.animationSprite.setOrigin(0, 0);
                this.animationSprite.setVisible(false);
                
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
                    repeat: 0 // 播放一次
                });
                
                console.log(`Created land wind animation with ${windFrames.length} frames`);
            } else {
                console.warn('No wind animation frames found');
            }
        }
    }
    
    /**
     * 更新动画逻辑
     */
    public update(delta: number): void {
        if (this.isAnimating) return;
        
        // 更新微风计时器
        this.windTimer += delta;
        
        // 检查是否到了播放微风的时间
        if (this.windTimer >= this.nextWindTime) {
            this.playWindAnimation();
        }
    }
    
    /**
     * 播放微风动画
     */
    private playWindAnimation(): void {
        if (!this.animationSprite || this.isAnimating) return;
        
        const animKey = 'land_wind_animation';
        
        if (this.scene.anims.exists(animKey)) {
            this.isAnimating = true;
            
            // 隐藏静态地面，显示动画精灵
            this.staticLandSprite.setVisible(false);
            this.animationSprite.setVisible(true);
            
            // 播放微风动画
            this.animationSprite.play(animKey);
            
            // 监听动画完成事件
            this.animationSprite.once('animationcomplete', this.onWindAnimationComplete, this);
            
            console.log('Playing wind animation');
            
        } else {
            console.warn('Wind animation not found, skipping');
            this.resetWindTimer();
        }
    }
    
    /**
     * 微风动画完成回调
     */
    private onWindAnimationComplete(): void {
        this.isAnimating = false;
        
        // 隐藏动画精灵，显示静态地面
        this.animationSprite.setVisible(false);
        this.staticLandSprite.setVisible(true);
        
        // 重置计时器，准备下次微风
        this.resetWindTimer();
        
        console.log(`Wind animation completed, next wind in ${this.nextWindTime}ms`);
    }
    
    /**
     * 重置微风计时器
     */
    private resetWindTimer(): void {
        this.windTimer = 0;
        this.nextWindTime = this.getRandomWindInterval();
    }
    
    /**
     * 获取随机微风间隔时间
     */
    private getRandomWindInterval(): number {
        return this.WIND_INTERVAL_MIN + Math.random() * (this.WIND_INTERVAL_MAX - this.WIND_INTERVAL_MIN);
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
        if (!this.isAnimating) {
            this.windTimer = this.nextWindTime;
            this.playWindAnimation();
        }
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