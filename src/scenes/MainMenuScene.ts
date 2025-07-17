import { Scene } from 'phaser';
import { AssetManager } from '../systems/AssetManager';
import { audioManager } from '../systems/AudioManager';
import { configManager } from '../systems/ConfigManager';

/**
 * 主菜单场景
 * 游戏的起始界面，包含标题和开始按钮
 */
export class MainMenuScene extends Scene {
    private assetManager!: AssetManager;
    private titleContainer!: Phaser.GameObjects.Container;
    private buttonContainer!: Phaser.GameObjects.Container;
    
    // 布局配置 (严格按照Figma设计)
    private readonly GAME_WIDTH = 1280;
    private readonly GAME_HEIGHT = 832;
    
    // 背景配置 (Figma: back 1280×853px)
    private readonly BACKGROUND_WIDTH = 1280;
    private readonly BACKGROUND_HEIGHT = 853;
    
    // 标题配置 (Figma: title 597×398px)
    private readonly TITLE_WIDTH = 597;
    private readonly TITLE_HEIGHT = 398;
    
    // 开始按钮配置 (Figma: start 303×202px)
    private readonly START_BUTTON_WIDTH = 303;
    private readonly START_BUTTON_HEIGHT = 202;
    
    constructor() {
        super({ key: 'MainMenuScene' });
    }

    async preload() {
        // 初始化资源管理器
        this.assetManager = new AssetManager(this);
        
        // 加载主菜单相关资源
        await this.assetManager.loadBaseAssets();
    }

    create() {
        console.log('MainMenuScene created');
        
        // 创建背景
        this.createBackground();
        
        // 创建标题
        this.createTitle();
        
        // 创建开始按钮
        this.createStartButton();
        
        // 设置事件监听
        this.setupEventListeners();
        
        // 开始浮现动画
        this.startFadeInAnimations();
        
        // 初始化音频系统并播放BGM（非侵入式）
        this.initializeAudioSystemWithDelay();
        
        console.log('Main menu initialized successfully');
    }

    private createBackground() {
        // 创建背景容器
        const backgroundContainer = this.add.container(0, 0);
        
        // 主背景 (白色背景)
        const background = this.add.rectangle(
            0, 0,
            this.BACKGROUND_WIDTH,
            this.BACKGROUND_HEIGHT,
            0xffffff
        );
        background.setOrigin(0, 0);
        backgroundContainer.add(background);
        
        // 如果有背景图片资源，优先使用
        if (this.textures.exists('menu-background')) {
            const bgImage = this.add.image(0, 0, 'menu-background');
            bgImage.setOrigin(0, 0);
            bgImage.setDisplaySize(this.BACKGROUND_WIDTH, this.BACKGROUND_HEIGHT);
            backgroundContainer.add(bgImage);
        }
    }

    private createTitle() {
        // 计算标题居中位置
        const titleX = (this.GAME_WIDTH - this.TITLE_WIDTH) / 2;
        const titleY = 100; // 距离顶部100px
        
        // 标题容器
        const titleContainer = this.add.container(titleX, titleY);
        
        // 初始状态：完全透明
        titleContainer.setAlpha(0);
        
        // 如果有标题图片资源，优先使用
        if (this.textures.exists('game-title')) {
            const titleImage = this.add.image(
                this.TITLE_WIDTH / 2,
                this.TITLE_HEIGHT / 2,
                'game-title'
            );
            titleImage.setDisplaySize(this.TITLE_WIDTH, this.TITLE_HEIGHT);
            titleContainer.add(titleImage);
        } else {
            // 使用文字标题（无背景）
            const mainTitle = this.add.text(
                this.TITLE_WIDTH / 2,
                this.TITLE_HEIGHT / 2 - 40,
                'Magic Same Game',
                {
                    fontSize: '48px',
                    color: '#FFFFFF',
                    fontFamily: 'Arial',
                    align: 'center',
                    stroke: '#000000',
                    strokeThickness: 4
                }
            );
            mainTitle.setOrigin(0.5, 0.5);
            titleContainer.add(mainTitle);
            
            // 副标题
            const subtitle = this.add.text(
                this.TITLE_WIDTH / 2,
                this.TITLE_HEIGHT / 2 + 40,
                '连连看塔防游戏',
                {
                    fontSize: '32px',
                    color: '#FFFF00',
                    fontFamily: 'Arial',
                    align: 'center',
                    stroke: '#000000',
                    strokeThickness: 2
                }
            );
            subtitle.setOrigin(0.5, 0.5);
            titleContainer.add(subtitle);
        }
        
        // 保存标题容器的引用，用于动画
        this.titleContainer = titleContainer;
    }

    private createStartButton() {
        // 计算开始按钮居中位置
        const buttonX = (this.GAME_WIDTH - this.START_BUTTON_WIDTH) / 2;
        const buttonY = this.GAME_HEIGHT - this.START_BUTTON_HEIGHT - 100; // 距离底部100px
        
        // 开始按钮容器
        const buttonContainer = this.add.container(buttonX, buttonY);
        
        // 初始状态：完全透明
        buttonContainer.setAlpha(0);
        
        // 创建按钮图片或文字
        let buttonElement: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
        
        // 计算70%缩放后的尺寸
        const scaledWidth = this.START_BUTTON_WIDTH * 0.7;
        const scaledHeight = this.START_BUTTON_HEIGHT * 0.7;
        
        // 如果有按钮图片资源，优先使用
        if (this.textures.exists('start-button')) {
            buttonElement = this.add.image(
                this.START_BUTTON_WIDTH / 2,
                this.START_BUTTON_HEIGHT / 2,
                'start-button'
            );
            buttonElement.setDisplaySize(scaledWidth, scaledHeight);
            buttonContainer.add(buttonElement);
        } else {
            // 使用文字按钮（无背景）
            buttonElement = this.add.text(
                this.START_BUTTON_WIDTH / 2,
                this.START_BUTTON_HEIGHT / 2,
                'START GAME\n开始游戏',
                {
                    fontSize: '28px',
                    color: '#FFFFFF',
                    fontFamily: 'Arial',
                    align: 'center',
                    stroke: '#000000',
                    strokeThickness: 3
                }
            );
            buttonElement.setOrigin(0.5, 0.5);
            buttonContainer.add(buttonElement);
        }
        
        // 设置按钮交互 - 使用缩小后的按钮区域
        const interactiveX = (this.START_BUTTON_WIDTH - scaledWidth) / 2;
        const interactiveY = (this.START_BUTTON_HEIGHT - scaledHeight) / 2;
        buttonContainer.setSize(scaledWidth, scaledHeight);
        buttonContainer.setInteractive(new Phaser.Geom.Rectangle(interactiveX, interactiveY, scaledWidth, scaledHeight), Phaser.Geom.Rectangle.Contains);
        
        // 鼠标悬停效果
        buttonContainer.on('pointerover', () => {
            buttonContainer.setScale(1.05);
            
            // 播放悬停音效
            if (this.sound.get('button-hover')) {
                this.sound.play('button-hover', { volume: 0.5 });
            }
        });
        
        buttonContainer.on('pointerout', () => {
            buttonContainer.setScale(1.0);
        });
        
        // 点击效果
        buttonContainer.on('pointerdown', () => {
            buttonContainer.setScale(0.95);
        });
        
        buttonContainer.on('pointerup', () => {
            buttonContainer.setScale(1.05);
            
            // 播放点击音效
            if (this.sound.get('button-click')) {
                this.sound.play('button-click', { volume: 0.7 });
            }
            
            // 延迟后切换到游戏场景
            this.time.delayedCall(200, () => {
                this.startGame();
            });
        });
        
        // 保存按钮容器的引用，用于动画
        this.buttonContainer = buttonContainer;
    }

    private setupEventListeners() {
        // 监听键盘输入
        this.input.keyboard?.on('keydown', this.handleKeyDown, this);
        
        // 监听窗口大小变化
        this.scale.on('resize', this.handleResize, this);
    }

    private handleKeyDown(event: KeyboardEvent) {
        // 按回车键开始游戏
        if (event.code === 'Enter' || event.code === 'Space') {
            this.startGame();
        }
    }

    private handleResize() {
        // 处理窗口大小变化
        console.log('Main menu window resized');
    }

    private startFadeInAnimations() {
        // 标题浮现动画 - 1秒内完成
        this.tweens.add({
            targets: this.titleContainer,
            alpha: 1,
            duration: 1000,
            ease: 'Power2.easeOut',
            onComplete: () => {
                // 标题浮现完成后，开始按钮浮现动画
                this.tweens.add({
                    targets: this.buttonContainer,
                    alpha: 1,
                    duration: 1000,
                    ease: 'Power2.easeOut'
                });
            }
        });
    }

    /**
     * 初始化音频系统（带延迟，等待音频加载完成）
     */
    private initializeAudioSystemWithDelay(): void {
        try {
            // 延迟更长时间，确保音频文件完全加载
            this.time.delayedCall(2000, () => {
                // 加载音频配置
                configManager.loadConfig('game/audio.json').then(() => {
                    const audioConfig = configManager.getAudioConfig();
                    if (audioConfig) {
                        audioManager.initialize(this, audioConfig);
                        console.log('[MainMenuScene] Audio system initialized');
                        
                        // 播放首页BGM
                        this.time.delayedCall(500, () => {
                            this.playMenuBGM();
                        });
                    }
                }).catch(error => {
                    console.warn('[MainMenuScene] Failed to load audio config:', error);
                });
            });
        } catch (error) {
            console.warn('[MainMenuScene] Failed to initialize audio system:', error);
        }
    }
    
    /**
     * 播放首页BGM
     */
    private playMenuBGM(): void {
        try {
            audioManager.playBGM('menu_bgm');
            console.log('[MainMenuScene] Menu BGM started');
        } catch (error) {
            console.warn('[MainMenuScene] Failed to play menu BGM:', error);
        }
    }
    
    /**
     * 用户交互后播放音频
     */
    private enableAudioOnInteraction(): void {
        // 监听用户的第一次交互
        const playAudioOnce = () => {
            this.playMenuBGM();
            // 移除监听器，只需要播放一次
            this.input.off('pointerdown', playAudioOnce);
            this.input.keyboard?.off('keydown', playAudioOnce);
        };
        
        this.input.on('pointerdown', playAudioOnce);
        this.input.keyboard?.on('keydown', playAudioOnce);
    }
    
    /**
     * 停止首页BGM
     */
    private stopMenuBGM(): void {
        try {
            audioManager.stopBGM();
            console.log('[MainMenuScene] Menu BGM stopped');
        } catch (error) {
            console.warn('[MainMenuScene] Failed to stop menu BGM:', error);
        }
    }

    private startGame() {
        console.log('Starting game...');
        
        // 停止首页BGM
        this.stopMenuBGM();
        
        // 直接切换到游戏场景
        this.scene.start('MainGameScene');
    }
    
    /**
     * 场景关闭时的清理
     */
    shutdown() {
        // 停止首页BGM
        this.stopMenuBGM();
        
        // 移除事件监听
        this.input.keyboard?.off('keydown', this.handleKeyDown, this);
        this.scale.off('resize', this.handleResize, this);
        
        console.log('[MainMenuScene] Scene shutdown');
    }
}