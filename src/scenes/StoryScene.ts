import { Scene } from 'phaser';
import { AssetManager, AssetConfig } from '../systems/AssetManager';
import { configManager } from '../systems/ConfigManager';
import { audioManager } from '../systems/AudioManager';

/**
 * 故事背景场景
 * 显示8页故事内容，每页包含图片和文字
 */
export class StoryScene extends Scene {
    private assetManager!: AssetManager;
    private storyConfig: any;
    private currentPage: number = 1;
    private totalPages: number = 8;
    
    // UI元素
    private bookBackground!: Phaser.GameObjects.Image;
    private storyImage!: Phaser.GameObjects.Image;
    private storyText!: Phaser.GameObjects.Text;
    private nextButton!: Phaser.GameObjects.Text;
    private pageContainer!: Phaser.GameObjects.Container;
    
    // 布局配置 (严格按照Figma参数)
    private readonly SCREEN_WIDTH = 1280;
    private readonly SCREEN_HEIGHT = 832;
    private readonly BOOK_WIDTH = 1024;
    private readonly BOOK_HEIGHT = 1024;
    private readonly PICTURE_WIDTH = 289;
    private readonly PICTURE_HEIGHT = 433;
    private readonly TEXT_WIDTH = 278;
    private readonly TEXT_HEIGHT = 306;
    private readonly NEXT_BUTTON_WIDTH = 94;
    private readonly NEXT_BUTTON_HEIGHT = 40;
    
    // 基于书本布局推断的位置坐标
    private readonly BOOK_X = 640; // 屏幕中心
    private readonly BOOK_Y = 416; // 屏幕中心
    private readonly PICTURE_X = 455; // 书本左侧，向左移动5px
    private readonly PICTURE_Y = 350; // 书本上半部
    private readonly TEXT_X = 838; // 文字位置x坐标，向右移动130px
    private readonly TEXT_Y = 166; // 文字位置y坐标
    private readonly NEXT_BUTTON_X = 900; // 书本右下角
    private readonly NEXT_BUTTON_Y = 650; // 书本下部
    
    constructor() {
        super({ key: 'StoryScene' });
    }

    preload() {
        // 初始化资源管理器
        this.assetManager = new AssetManager(this);
        
        // 同步加载故事相关资源
        this.loadStoryAssetsSync();
        
        // 异步加载故事配置（不阻塞场景创建）
        this.loadStoryConfigAsync();
    }

    create() {
        console.log('StoryScene created');
        
        // 创建背景
        this.createBackground();
        
        // 创建书本背景
        this.createBookBackground();
        
        // 创建页面容器
        this.pageContainer = this.add.container(0, 0);
        
        // 确保故事配置已加载
        if (!this.storyConfig) {
            console.warn('Story config not loaded, using defaults');
            this.createDefaultStoryConfig();
        }
        
        // 显示第一页
        this.showPage(1);
        
        // 设置输入监听
        this.setupInputListeners();
    }

    /**
     * 同步加载故事相关资源
     */
    private loadStoryAssetsSync(): void {
        const storyAssets: AssetConfig[] = [
            // 书本背景
            { key: 'story-book-bg', type: 'image', path: 'assets/images/story-book-bg.png' },
            
            // 8页故事图片
            { key: 'story-page-1', type: 'image', path: 'assets/images/page-1.png' },
            { key: 'story-page-2', type: 'image', path: 'assets/images/page-2.png' },
            { key: 'story-page-3', type: 'image', path: 'assets/images/page-3.png' },
            { key: 'story-page-4', type: 'image', path: 'assets/images/page-4.png' },
            { key: 'story-page-5', type: 'image', path: 'assets/images/page-5.png' },
            { key: 'story-page-6', type: 'image', path: 'assets/images/page-6.png' },
            { key: 'story-page-7', type: 'image', path: 'assets/images/page-7.png' },
            { key: 'story-page-8', type: 'image', path: 'assets/images/page-8.png' }
        ];
        
        // 使用Phaser的同步加载方式
        storyAssets.forEach(asset => {
            this.assetManager.loadImage(asset.key, asset.path);
        });
    }

    /**
     * 异步加载故事配置
     */
    private async loadStoryConfigAsync(): Promise<void> {
        try {
            const response = await fetch('/configs/game/story.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.storyConfig = await response.json();
            console.log('Story config loaded:', this.storyConfig);
        } catch (error) {
            console.warn('Failed to load story config, using defaults:', error);
            this.createDefaultStoryConfig();
        }
    }

    /**
     * 创建默认故事配置
     */
    private createDefaultStoryConfig(): void {
        this.storyConfig = {
            pages: [
                { text: "矮人们一直在地下过着与世无争的生活" },
                { text: "直到有一天，邪恶的哥布林大军来袭" },
                { text: "它们要摧毁矮人们的家园" },
                { text: "矮人们决定拿起武器保卫家园" },
                { text: "但是哥布林数量太多了" },
                { text: "聪明的矮人们想出了一个办法" },
                { text: "他们利用连连看游戏收集资源" },
                { text: "然后建造防御塔来抵御哥布林" }
            ]
        };
    }

    /**
     * 创建背景
     */
    private createBackground(): void {
        // 创建深灰色背景 (rgb(12, 12, 12))
        this.add.rectangle(
            this.SCREEN_WIDTH / 2,
            this.SCREEN_HEIGHT / 2,
            this.SCREEN_WIDTH,
            this.SCREEN_HEIGHT,
            0x0C0C0C
        );
    }

    /**
     * 创建书本背景
     */
    private createBookBackground(): void {
        // 创建书本背景
        this.bookBackground = this.add.image(this.BOOK_X, this.BOOK_Y, 'story-book-bg');
        this.bookBackground.setDisplaySize(this.BOOK_WIDTH, this.BOOK_HEIGHT);
        this.bookBackground.setOrigin(0.5);
        
        // 如果书本背景图片不存在，创建一个临时的
        if (!this.textures.exists('story-book-bg')) {
            this.createTempBookBackground();
        }
    }

    /**
     * 创建临时书本背景
     */
    private createTempBookBackground(): void {
        const graphics = this.add.graphics();
        graphics.fillStyle(0xF5F5DC); // 米色
        graphics.fillRect(0, 0, this.BOOK_WIDTH, this.BOOK_HEIGHT);
        
        // 添加书本边框
        graphics.lineStyle(4, 0x8B4513); // 棕色边框
        graphics.strokeRect(0, 0, this.BOOK_WIDTH, this.BOOK_HEIGHT);
        
        // 添加中间分隔线
        graphics.moveTo(this.BOOK_WIDTH / 2, 0);
        graphics.lineTo(this.BOOK_WIDTH / 2, this.BOOK_HEIGHT);
        graphics.strokePath();
        
        graphics.generateTexture('story-book-bg', this.BOOK_WIDTH, this.BOOK_HEIGHT);
        graphics.destroy();
        
        // 重新创建背景
        this.bookBackground.setTexture('story-book-bg');
    }

    /**
     * 显示指定页面
     */
    private showPage(pageNumber: number): void {
        if (pageNumber < 1 || pageNumber > this.totalPages) return;
        
        this.currentPage = pageNumber;
        
        // 清除之前的页面内容
        this.pageContainer.removeAll(true);
        
        // 确保故事配置存在
        if (!this.storyConfig || !this.storyConfig.pages) {
            console.error('Story config or pages not available');
            this.createDefaultStoryConfig();
        }
        
        // 获取当前页面配置
        const pageConfig = this.storyConfig.pages[pageNumber - 1];
        if (!pageConfig) {
            console.error(`Page config not found for page ${pageNumber}`);
            return;
        }
        
        // 创建故事图片
        this.createStoryImage(pageNumber);
        
        // 创建故事文字
        this.createStoryText(pageConfig.text);
        
        // 创建Next按钮
        this.createNextButton();
        
        console.log(`Showing page ${pageNumber}/${this.totalPages}`);
    }

    /**
     * 创建故事图片
     */
    private createStoryImage(pageNumber: number): void {
        const imageKey = `story-page-${pageNumber}`;
        
        this.storyImage = this.add.image(this.PICTURE_X, this.PICTURE_Y, imageKey);
        this.storyImage.setDisplaySize(this.PICTURE_WIDTH, this.PICTURE_HEIGHT);
        this.storyImage.setOrigin(0.5);
        
        // 如果图片不存在，创建一个临时的占位图
        if (!this.textures.exists(imageKey)) {
            this.createTempStoryImage(imageKey, pageNumber);
            this.storyImage.setTexture(imageKey);
        }
        
        this.pageContainer.add(this.storyImage);
    }

    /**
     * 创建临时故事图片
     */
    private createTempStoryImage(imageKey: string, pageNumber: number): void {
        const graphics = this.add.graphics();
        graphics.fillStyle(0xDDDDDD); // 浅灰色
        graphics.fillRect(0, 0, this.PICTURE_WIDTH, this.PICTURE_HEIGHT);
        
        // 添加边框
        graphics.lineStyle(2, 0x666666);
        graphics.strokeRect(0, 0, this.PICTURE_WIDTH, this.PICTURE_HEIGHT);
        
        graphics.generateTexture(imageKey, this.PICTURE_WIDTH, this.PICTURE_HEIGHT);
        graphics.destroy();
        
        // 添加页码文字
        const pageText = this.add.text(
            this.PICTURE_X,
            this.PICTURE_Y,
            `图片 ${pageNumber}`,
            {
                fontSize: '24px',
                color: '#666666',
                fontFamily: 'Arial'
            }
        );
        pageText.setOrigin(0.5);
        this.pageContainer.add(pageText);
    }

    /**
     * 创建故事文字
     */
    private createStoryText(text: string): void {
        this.storyText = this.add.text(
            this.TEXT_X,
            this.TEXT_Y,
            text,
            {
                fontSize: '24px',
                color: '#000000',
                fontFamily: 'Arial',
                align: 'left',
                wordWrap: { width: this.TEXT_WIDTH, useAdvancedWrap: true }
            }
        );
        this.storyText.setOrigin(0.5);
        this.pageContainer.add(this.storyText);
    }

    /**
     * 创建Next按钮
     */
    private createNextButton(): void {
        // 根据当前页面决定按钮文字
        const buttonText = this.currentPage === this.totalPages ? 'Start Game' : 'Next';
        
        this.nextButton = this.add.text(
            this.NEXT_BUTTON_X,
            this.NEXT_BUTTON_Y,
            buttonText,
            {
                fontSize: '24px',
                color: '#000000',
                fontFamily: 'Microsoft Sans Serif',
                backgroundColor: '#FFFFFF',
                padding: { x: 10, y: 5 }
            }
        );
        this.nextButton.setOrigin(0.5);
        this.nextButton.setInteractive();
        
        // 添加悬停效果
        this.nextButton.on('pointerover', () => {
            this.nextButton.setStyle({ backgroundColor: '#CCCCCC' });
        });
        
        this.nextButton.on('pointerout', () => {
            this.nextButton.setStyle({ backgroundColor: '#FFFFFF' });
        });
        
        // 添加点击事件
        this.nextButton.on('pointerdown', () => {
            this.handleNextButtonClick();
        });
        
        this.pageContainer.add(this.nextButton);
    }

    /**
     * 处理Next按钮点击
     */
    private handleNextButtonClick(): void {
        if (this.currentPage < this.totalPages) {
            // 切换到下一页
            this.showPage(this.currentPage + 1);
        } else {
            // 最后一页，进入游戏
            this.startGame();
        }
    }

    /**
     * 开始游戏
     */
    private startGame(): void {
        console.log('Story completed, starting game...');
        this.scene.start('MainGameScene');
    }

    /**
     * 设置输入监听
     */
    private setupInputListeners(): void {
        // 键盘监听
        this.input.keyboard?.on('keydown-SPACE', () => {
            this.handleNextButtonClick();
        });
        
        this.input.keyboard?.on('keydown-ESC', () => {
            // 返回主菜单
            this.scene.start('MainMenuScene');
        });
    }

    /**
     * 销毁场景时的清理
     */
    public shutdown(): void {
        console.log('StoryScene shutdown');
        // 清理资源
        if (this.pageContainer) {
            this.pageContainer.destroy();
        }
    }
}