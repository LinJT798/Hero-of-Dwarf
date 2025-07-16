import { WaveConfig } from '../types/config/WaveConfig';

/**
 * 波次进度条组件
 * 类似植物大战僵尸的进度条，显示关卡时间进度和波次指示图标
 */
export class WaveProgressBar {
    private scene: Phaser.Scene;
    private container!: Phaser.GameObjects.Container;
    
    // 背景配置
    private backgroundX: number;
    private backgroundY: number;
    private backgroundWidth: number;
    private backgroundHeight: number;
    private backgroundTexture: string;
    
    // 填充区域配置
    private fillX: number;
    private fillY: number;
    private fillWidth: number;
    private fillHeight: number;
    private fillColor: number;
    
    // 进度条组件
    private background!: Phaser.GameObjects.Image;
    private progressFill!: Phaser.GameObjects.Rectangle;
    private progressMask!: Phaser.GameObjects.Graphics;
    
    // 波次图标
    private waveIcons: Phaser.GameObjects.Image[] = [];
    private iconY: number;
    private iconSize: number;
    private normalIconTexture: string;
    private hardIconTexture: string;
    
    // 时间系统
    private totalTime: number = 0;
    private currentTime: number = 0;
    private waves: WaveConfig[] = [];
    
    constructor(
        scene: Phaser.Scene,
        backgroundX: number,
        backgroundY: number,
        backgroundWidth: number,
        backgroundHeight: number,
        fillX: number,
        fillY: number,
        fillWidth: number,
        fillHeight: number,
        backgroundTexture: string,
        fillColor: number,
        iconY: number,
        iconSize: number,
        normalIconTexture: string,
        hardIconTexture: string
    ) {
        this.scene = scene;
        this.backgroundX = backgroundX;
        this.backgroundY = backgroundY;
        this.backgroundWidth = backgroundWidth;
        this.backgroundHeight = backgroundHeight;
        this.fillX = fillX;
        this.fillY = fillY;
        this.fillWidth = fillWidth;
        this.fillHeight = fillHeight;
        this.backgroundTexture = backgroundTexture;
        this.fillColor = fillColor;
        this.iconY = iconY;
        this.iconSize = iconSize;
        this.normalIconTexture = normalIconTexture;
        this.hardIconTexture = hardIconTexture;
        
        this.createProgressBar();
    }
    
    /**
     * 创建进度条视觉组件
     */
    private createProgressBar(): void {
        // 创建容器，使用绝对定位
        this.container = this.scene.add.container(0, 0);
        this.container.setDepth(1000); // 设置较高的深度，确保在顶层
        
        // 创建背景
        this.background = this.scene.add.image(this.backgroundX, this.backgroundY, this.backgroundTexture);
        this.background.setOrigin(0, 0);
        
        // 获取原始尺寸和设置显示尺寸
        const originalWidth = this.background.width;
        const originalHeight = this.background.height;
        this.background.setDisplaySize(this.backgroundWidth, this.backgroundHeight);
        
        console.log(`[WaveProgressBar] Background original size: ${originalWidth}x${originalHeight}, display size: ${this.backgroundWidth}x${this.backgroundHeight}`);
        
        this.container.add(this.background);
        
        // 创建进度填充（在指定的填充区域）
        this.progressFill = this.scene.add.rectangle(this.fillX, this.fillY, this.fillWidth, this.fillHeight, this.fillColor);
        this.progressFill.setOrigin(0, 0);
        this.container.add(this.progressFill);
        
        
        // 创建遮罩以实现进度效果（基于填充区域）
        this.progressMask = this.scene.add.graphics();
        this.progressMask.fillStyle(0xffffff);
        
        // 初始宽度为0
        this.progressMask.fillRect(this.fillX, this.fillY, 0, this.fillHeight);
        this.progressFill.setMask(this.progressMask.createGeometryMask());
        
        console.log(`[WaveProgressBar] Progress fill created with color 0x${this.fillColor.toString(16)}`);
        console.log(`[WaveProgressBar] Initial mask rect at (${this.fillX}, ${this.fillY}) with width 0`);
        
        console.log(`[WaveProgressBar] Created background at (${this.backgroundX}, ${this.backgroundY}) size ${this.backgroundWidth}x${this.backgroundHeight}`);
        console.log(`[WaveProgressBar] Created fill area at (${this.fillX}, ${this.fillY}) size ${this.fillWidth}x${this.fillHeight}`);
        console.log(`[WaveProgressBar] Background texture exists: ${this.scene.textures.exists(this.backgroundTexture)}`);
        console.log(`[WaveProgressBar] Icon Y position: ${this.iconY}, Icon size: ${this.iconSize}`);
    }
    
    /**
     * 设置波次数据并创建图标
     */
    public setWaves(waves: WaveConfig[]): void {
        console.log(`[WaveProgressBar] setWaves called with ${waves.length} waves`);
        this.waves = waves;
        
        // 计算总时间
        this.totalTime = waves.reduce((sum, wave) => sum + (wave.delayFromPrevious || 0), 0);
        
        console.log(`[WaveProgressBar] Waves:`, waves);
        console.log(`[WaveProgressBar] Total time calculated: ${this.totalTime}ms`);
        
        // 清除旧图标
        this.clearWaveIcons();
        
        // 创建新图标
        this.createWaveIcons();
        
        console.log(`[WaveProgressBar] Set ${waves.length} waves, total time: ${this.totalTime}ms`);
    }
    
    /**
     * 创建波次图标
     */
    private createWaveIcons(): void {
        let accumulatedTime = 0;
        
        this.waves.forEach((wave, index) => {
            accumulatedTime += wave.delayFromPrevious;
            
            // 计算图标在进度条填充区域上的X位置
            const progressRatio = accumulatedTime / this.totalTime;
            const iconX = this.fillX + progressRatio * this.fillWidth;
            
            // 选择图标纹理
            const iconTexture = wave.waveType === 'hard' ? this.hardIconTexture : this.normalIconTexture;
            
            // 检查纹理是否存在
            if (!this.scene.textures.exists(iconTexture)) {
                console.error(`[WaveProgressBar] Icon texture '${iconTexture}' not found for wave ${wave.waveNumber}`);
                return; // 跳过这个波次的图标
            }
            
            // 创建图标
            const icon = this.scene.add.image(iconX, this.iconY, iconTexture);
            icon.setOrigin(0.5, 0.5);
            icon.setDisplaySize(this.iconSize, this.iconSize);
            
            // 添加到容器
            this.container.add(icon);
            this.waveIcons.push(icon);
            
            console.log(`[WaveProgressBar] Wave ${wave.waveNumber} (${wave.waveType}) icon at x=${iconX.toFixed(1)}, y=${this.iconY}, time=${accumulatedTime}ms`);
        });
    }
    
    /**
     * 清除波次图标
     */
    private clearWaveIcons(): void {
        this.waveIcons.forEach(icon => icon.destroy());
        this.waveIcons = [];
    }
    
    /**
     * 更新进度条
     */
    public updateProgress(currentTime: number): void {
        this.currentTime = Math.min(currentTime, this.totalTime);
        
        // 计算进度比例
        const progressRatio = this.currentTime / this.totalTime;
        const progressWidth = progressRatio * this.fillWidth;
        
        // 更新遮罩（基于填充区域）
        this.progressMask.clear();
        this.progressMask.fillStyle(0xffffff);
        this.progressMask.fillRect(this.fillX, this.fillY, progressWidth, this.fillHeight);
        
        // 可选：添加调试信息
        if (currentTime % 1000 < 16) { // 每秒打印一次
            console.log(`[WaveProgressBar] Progress: ${(progressRatio * 100).toFixed(1)}% (${this.currentTime}ms / ${this.totalTime}ms)`);
        }
    }
    
    /**
     * 获取当前进度比例
     */
    public getProgressRatio(): number {
        return this.totalTime > 0 ? this.currentTime / this.totalTime : 0;
    }
    
    /**
     * 获取总时间
     */
    public getTotalTime(): number {
        return this.totalTime;
    }
    
    /**
     * 获取当前时间
     */
    public getCurrentTime(): number {
        return this.currentTime;
    }
    
    /**
     * 重置进度条
     */
    public reset(): void {
        this.currentTime = 0;
        this.updateProgress(0);
    }
    
    /**
     * 设置显示状态
     */
    public setVisible(visible: boolean): void {
        this.container.setVisible(visible);
    }
    
    /**
     * 获取容器对象
     */
    public getContainer(): Phaser.GameObjects.Container {
        return this.container;
    }
    
    /**
     * 销毁进度条
     */
    public destroy(): void {
        this.clearWaveIcons();
        this.progressMask.destroy();
        this.container.destroy();
        console.log('[WaveProgressBar] Destroyed');
    }
}