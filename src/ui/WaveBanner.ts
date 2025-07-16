/**
 * 波次提示横幅系统
 * 显示新波次来临的动画提示
 */
export class WaveBanner {
    private scene: Phaser.Scene;
    private banner: Phaser.GameObjects.Image | null = null;
    private isAnimating: boolean = false;
    
    // 动画配置
    private readonly DISPLAY_WIDTH = 733;
    private readonly DISPLAY_HEIGHT = 412;
    private readonly TARGET_X = 640;  // 屏幕中心 (1280/2)
    private readonly TARGET_Y = 416;  // 屏幕中心 (832/2)
    private readonly ENTER_DURATION = 2000;
    private readonly STAY_DURATION = 1000;
    private readonly EXIT_DURATION = 2000;
    
    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }
    
    /**
     * 显示波次提示
     * @param waveType 'normal' 或 'hard'
     * @param waveNumber 波次号
     */
    public showWaveBanner(waveType: 'normal' | 'hard', waveNumber: number): void {
        if (this.isAnimating) {
            console.warn('Wave banner animation already in progress');
            return;
        }
        
        // 确定使用的图片资源
        const textureKey = waveType === 'normal' ? 'wave_normal_banner' : 'wave_hard_banner';
        
        // 检查资源是否存在
        if (!this.scene.textures.exists(textureKey)) {
            console.error(`Wave banner texture not found: ${textureKey}`);
            return;
        }
        
        // 创建横幅图片
        const startX = -this.DISPLAY_WIDTH / 2; // 从屏幕左侧外开始
        this.banner = this.scene.add.image(startX, this.TARGET_Y, textureKey);
        
        // 设置中心对齐
        this.banner.setOrigin(0.5, 0.5);
        
        // 设置显示尺寸
        this.banner.setDisplaySize(this.DISPLAY_WIDTH, this.DISPLAY_HEIGHT);
        
        // 设置深度，确保显示在最上层
        this.banner.setDepth(1000);
        
        // 设置动画状态
        this.isAnimating = true;
        
        console.log(`Showing ${waveType} wave banner for wave ${waveNumber}`);
        
        // 创建进入动画
        this.createEnterAnimation();
    }
    
    /**
     * 创建进入动画
     */
    private createEnterAnimation(): void {
        if (!this.banner) return;
        
        // 进入动画：从左侧滑入到目标位置
        this.scene.tweens.add({
            targets: this.banner,
            x: this.TARGET_X,
            duration: this.ENTER_DURATION,
            ease: 'Power2.easeOut',
            onComplete: () => {
                this.createStayAnimation();
            }
        });
    }
    
    /**
     * 创建停留动画
     */
    private createStayAnimation(): void {
        if (!this.banner) return;
        
        // 停留期间不做任何动效，静止显示
        this.scene.time.delayedCall(this.STAY_DURATION, () => {
            this.createExitAnimation();
        });
    }
    
    /**
     * 创建退出动画
     */
    private createExitAnimation(): void {
        if (!this.banner) return;
        
        const endX = 1280 + this.DISPLAY_WIDTH / 2; // 移动到屏幕右侧外
        
        // 退出动画：从当前位置滑出到右侧
        this.scene.tweens.add({
            targets: this.banner,
            x: endX,
            duration: this.EXIT_DURATION,
            ease: 'Power2.easeIn',
            onComplete: () => {
                this.cleanup();
            }
        });
    }
    
    /**
     * 清理资源
     */
    private cleanup(): void {
        if (this.banner) {
            this.banner.destroy();
            this.banner = null;
        }
        this.isAnimating = false;
        
        console.log('Wave banner animation completed');
    }
    
    /**
     * 强制停止当前动画
     */
    public forceStop(): void {
        if (this.banner) {
            // 停止所有相关的补间动画
            this.scene.tweens.killTweensOf(this.banner);
            this.cleanup();
        }
    }
    
    /**
     * 检查是否正在播放动画
     */
    public isPlaying(): boolean {
        return this.isAnimating;
    }
}