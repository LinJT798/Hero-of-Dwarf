import { Scene } from 'phaser';
import { LazyAssetLoader } from '../systems/LazyAssetLoader';

/**
 * 预加载场景
 * 显示加载进度并加载核心资源
 */
export class PreloadScene extends Scene {
    private lazyLoader!: LazyAssetLoader;
    private progressBar!: Phaser.GameObjects.Rectangle;
    private progressBarBg!: Phaser.GameObjects.Rectangle;
    private loadingText!: Phaser.GameObjects.Text;
    private percentText!: Phaser.GameObjects.Text;
    private assetText!: Phaser.GameObjects.Text;
    
    constructor() {
        super({ key: 'PreloadScene' });
    }
    
    preload() {
        // 初始化延迟加载器
        this.lazyLoader = new LazyAssetLoader(this);
        
        // 创建加载界面
        this.createLoadingScreen();
        
        // 设置加载事件监听
        this.setupLoadEvents();
        
        // 只加载最基础的资源
        this.loadMinimalAssets();
    }
    
    create() {
        console.log('[PreloadScene] Basic assets loaded, starting game...');
        
        // 添加点击继续提示
        const continueText = this.add.text(
            640, 500,
            '点击继续',
            {
                fontSize: '24px',
                color: '#ffffff',
                fontFamily: 'Arial'
            }
        );
        continueText.setOrigin(0.5);
        
        // 闪烁动画
        this.tweens.add({
            targets: continueText,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            repeat: -1
        });
        
        // 点击或按键继续
        this.input.once('pointerdown', () => this.startGame());
        this.input.keyboard?.once('keydown', () => this.startGame());
    }
    
    /**
     * 创建加载界面
     */
    private createLoadingScreen(): void {
        const centerX = 640;
        const centerY = 416;
        
        // 背景
        this.add.rectangle(centerX, centerY, 1280, 832, 0x0c0c0c);
        
        // 游戏标题
        const title = this.add.text(
            centerX, centerY - 150,
            'Magic Same Game',
            {
                fontSize: '48px',
                color: '#ffffff',
                fontFamily: 'Arial',
                fontStyle: 'bold'
            }
        );
        title.setOrigin(0.5);
        
        // 副标题
        const subtitle = this.add.text(
            centerX, centerY - 90,
            '连连看塔防游戏',
            {
                fontSize: '32px',
                color: '#ffff00',
                fontFamily: 'Arial'
            }
        );
        subtitle.setOrigin(0.5);
        
        // 加载文字
        this.loadingText = this.add.text(
            centerX, centerY - 20,
            '加载中...',
            {
                fontSize: '20px',
                color: '#ffffff',
                fontFamily: 'Arial'
            }
        );
        this.loadingText.setOrigin(0.5);
        
        // 进度条背景
        this.progressBarBg = this.add.rectangle(
            centerX, centerY + 30,
            400, 30,
            0x222222
        );
        this.progressBarBg.setStrokeStyle(2, 0x666666);
        
        // 进度条
        this.progressBar = this.add.rectangle(
            centerX - 198, centerY + 30,
            0, 26,
            0x00ff00
        );
        this.progressBar.setOrigin(0, 0.5);
        
        // 百分比文字
        this.percentText = this.add.text(
            centerX, centerY + 30,
            '0%',
            {
                fontSize: '16px',
                color: '#ffffff',
                fontFamily: 'Arial'
            }
        );
        this.percentText.setOrigin(0.5);
        this.percentText.setDepth(1);
        
        // 当前加载资源文字
        this.assetText = this.add.text(
            centerX, centerY + 70,
            '',
            {
                fontSize: '14px',
                color: '#aaaaaa',
                fontFamily: 'Arial'
            }
        );
        this.assetText.setOrigin(0.5);
        
        // 优化提示
        const tipText = this.add.text(
            centerX, centerY + 150,
            '首次加载可能需要一些时间，请耐心等待...',
            {
                fontSize: '14px',
                color: '#666666',
                fontFamily: 'Arial'
            }
        );
        tipText.setOrigin(0.5);
    }
    
    /**
     * 设置加载事件监听
     */
    private setupLoadEvents(): void {
        this.load.on('progress', (value: number) => {
            // 更新进度条
            this.progressBar.width = 396 * value;
            
            // 更新百分比
            const percent = Math.floor(value * 100);
            this.percentText.setText(`${percent}%`);
            
            // 更新加载文字
            if (percent < 30) {
                this.loadingText.setText('加载核心资源...');
            } else if (percent < 60) {
                this.loadingText.setText('加载游戏界面...');
            } else if (percent < 90) {
                this.loadingText.setText('加载游戏资源...');
            } else {
                this.loadingText.setText('即将完成...');
            }
        });
        
        this.load.on('fileprogress', (file: any) => {
            // 显示当前加载的文件
            const fileName = file.key || '';
            if (fileName.length > 30) {
                this.assetText.setText('加载: ' + fileName.substring(0, 27) + '...');
            } else {
                this.assetText.setText('加载: ' + fileName);
            }
        });
        
        this.load.on('complete', () => {
            console.log('[PreloadScene] All assets loaded');
            this.loadingText.setText('加载完成！');
            this.assetText.setText('');
            
            // 进度条变色
            this.progressBar.fillColor = 0x00ff00;
        });
    }
    
    /**
     * 只加载最少的必需资源
     */
    private loadMinimalAssets(): void {
        // 主菜单资源（非必需的可以跳过）
        this.load.image('menu-background', 'assets/images/menu-background.png');
        this.load.image('game-title', 'assets/images/game-title.png');
        this.load.image('start-button', 'assets/images/start-button.png');
        
        // 故事场景资源（可以延迟加载）
        // this.load.image('story-book-bg', 'assets/images/story-book-bg.png');
        
        // 核心游戏资源
        this.load.image('game_frame', 'assets/images/game_frame.png');
        this.load.image('back_sky', 'assets/images/back_sky.png');
        this.load.image('back_land', 'assets/images/back_land.png');
        this.load.image('store', 'assets/images/store.png');
        this.load.image('cube_frame', 'assets/images/cube_frame.png');
        
        // 基础资源图标
        this.load.image('coin', 'assets/images/coin.png');
        this.load.image('wood', 'assets/images/wood.png');
        this.load.image('stone', 'assets/images/stone.png');
        this.load.image('mithril', 'assets/images/mithril.png');
        this.load.image('food', 'assets/images/food.png');
        
        // 连连看方块
        this.load.image('dirt', 'assets/images/dirt.png');
        this.load.image('grass', 'assets/images/grass.png');
        this.load.image('lava', 'assets/images/lava.png');
        this.load.image('sand', 'assets/images/sand.png');
        
        // 商店图标（小文件）
        this.load.image('archer_icon', 'assets/images/archer_icon.png');
        this.load.image('dwarf_icon', 'assets/images/dwarf_icon.png');
        
        // 建筑基础图片
        this.load.image('foundation', 'assets/images/foundation.png');
        this.load.image('archer_building', 'assets/images/archer_building.png');
        
        // 音频文件（可选，可以延迟加载）
        // this.load.audio('menu_bgm', 'assets/audio/music/menu_bgm.mp3');
        
        console.log('[PreloadScene] Loading minimal assets...');
    }
    
    /**
     * 开始游戏
     */
    private startGame(): void {
        // 淡出效果
        this.cameras.main.fadeOut(500, 0, 0, 0);
        
        this.cameras.main.once('camerafadeoutcomplete', () => {
            // 启动主菜单
            this.scene.start('MainMenuScene');
        });
    }
}