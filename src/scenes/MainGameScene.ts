import { Scene } from 'phaser';
import { AssetManager } from '../systems/AssetManager';
import { configManager } from '../systems/ConfigManager';
import { Match3System } from '../systems/match3/Match3System';
import { resourceManager } from '../managers/ResourceManager';
import { Shop } from '../entities/Shop';
import { BuildingManager } from '../managers/BuildingManager';
import { DwarfManager } from '../managers/DwarfManager';
import { MonsterManager } from '../managers/MonsterManager';
import { NewMonsterManager } from '../managers/NewMonsterManager';
import { GameStateManager } from '../systems/GameStateManager';
import { LandAnimation } from '../entities/LandAnimation';

/**
 * 主游戏场景
 * 负责整个游戏的核心逻辑和UI管理
 */
export class MainGameScene extends Scene {
    private assetManager!: AssetManager;
    private match3System!: Match3System;
    private shop!: Shop;
    public buildingManager!: BuildingManager;
    private dwarfManager!: DwarfManager;
    private monsterManager!: MonsterManager;
    private newMonsterManager!: NewMonsterManager;
    private gameStateManager!: GameStateManager;
    private landAnimation!: LandAnimation;
    
    // UI区域
    private backgroundContainer!: Phaser.GameObjects.Container;
    private match3Container!: Phaser.GameObjects.Container;
    private shopContainer!: Phaser.GameObjects.Container;
    private groundContainer!: Phaser.GameObjects.Container;
    private buildingContainer!: Phaser.GameObjects.Container;  // 建筑层
    private characterContainer!: Phaser.GameObjects.Container;  // 角色层（矮人、怪物）
    private topLayerContainer!: Phaser.GameObjects.Container;  // 顶层容器，用于掉落资源
    
    // 资源显示
    private resourceDisplays: Map<string, Phaser.GameObjects.Text> = new Map();
    
    // 游戏区域尺寸 (严格按照Figma设计)
    private readonly GAME_WIDTH = 1280;
    private readonly GAME_HEIGHT = 832;
    
    // 连连看区域配置 (Figma: map 459×357px, 位置(469,90))
    private readonly MATCH3_X = 469;
    private readonly MATCH3_Y = 90;
    private readonly MATCH3_WIDTH = 459;
    private readonly MATCH3_HEIGHT = 357;
    private readonly CELL_SIZE = 51; // 单元格尺寸: 51×51px
    
    // 商店区域配置 (Figma: store 277×495px, 位置(71,-5))
    private readonly SHOP_X = 71;
    private readonly SHOP_Y = -5;
    private readonly SHOP_WIDTH = 277;
    private readonly SHOP_HEIGHT = 495;
    
    // 商店槽位配置 (Figma: 190×96px)
    private readonly SHOP_SLOT_WIDTH = 190;
    private readonly SHOP_SLOT_HEIGHT = 96;
    private readonly SHOP_SLOT_POSITIONS = [
        { x: 115, y: 81 },   // 位置1
        { x: 115, y: 204 },  // 位置2
        { x: 115, y: 327 }   // 位置3 (预留)
    ];
    
    // 地面区域配置 (Figma: land 1280×17px, 位置(-7,789))
    private readonly GROUND_X = -7;
    private readonly GROUND_Y = 789;
    private readonly GROUND_WIDTH = 1280;
    private readonly GROUND_HEIGHT = 17;
    
    // 城堡配置 (Figma: castle 460×384px, 位置(-221,405))
    private readonly CASTLE_X = -221;
    private readonly CASTLE_Y = 405;
    private readonly CASTLE_WIDTH = 460;
    private readonly CASTLE_HEIGHT = 384;
    
    // 弓箭塔配置 (Figma: archer_building 162×162px, 位置(213,534))
    private readonly ARCHER_BUILDING_X = 213;
    private readonly ARCHER_BUILDING_Y = 534;
    private readonly ARCHER_BUILDING_WIDTH = 162;
    private readonly ARCHER_BUILDING_HEIGHT = 162;
    
    // 侧边栏配置 (Figma: 170×304px, 位置(1120,0))
    private readonly SIDEBAR_X = 1120;
    private readonly SIDEBAR_Y = 0;
    private readonly SIDEBAR_WIDTH = 170;
    private readonly SIDEBAR_HEIGHT = 304;

    constructor() {
        super({ key: 'MainGameScene' });
    }

    async preload() {
        // 初始化资源管理器
        this.assetManager = new AssetManager(this);
        
        // 加载Figma图片资源
        await this.assetManager.loadBaseAssets();
        
        // 不显示加载进度
    }

    create() {
        console.log('MainGameScene created');
        
        // 初始化配置
        this.initializeConfigs();
        
        // 创建背景
        this.createBackground();
        
        // 创建顶层容器（必须在创建游戏区域之前，以便Match3System可以使用）
        this.topLayerContainer = this.add.container(0, 0);
        this.topLayerContainer.setDepth(9999);  // 确保在最顶层
        
        // 创建游戏区域
        this.createGameAreas();
        
        // 创建UI
        this.createUI();
        
        // 设置事件监听
        this.setupEventListeners();
        
        // 确保顶层容器真的在最上层
        this.children.bringToTop(this.topLayerContainer);
        
        console.log('Game initialized successfully');
    }

    private async initializeConfigs() {
        try {
            // 加载基础配置
            await configManager.loadConfigs([
                'game/match3.json',
                'game/tower.json',
                'game/monster.json',
                'game/shop.json'
            ]);
            console.log('Configs loaded successfully');
        } catch (error) {
            console.warn('Failed to load configs, using defaults:', error);
        }
    }

    private createBackground() {
        this.backgroundContainer = this.add.container(0, 0);
        
        // 天空背景 (Figma: back_sky 1280×832px, 位置(0,0))
        if (this.textures.exists('back_sky')) {
            const skyBackground = this.add.image(0, 0, 'back_sky');
            skyBackground.setOrigin(0, 0);
            skyBackground.setDisplaySize(1280, 832);
            this.backgroundContainer.add(skyBackground);
        }
        
        // 地面背景动画 (Figma: back_land 1280×747px, 位置(0,141)) - 向上移动15px
        this.landAnimation = new LandAnimation(this, 0, 126);
        
        // 设置地面精灵的尺寸
        const staticSprite = this.landAnimation.getStaticSprite();
        staticSprite.setDisplaySize(1280, 747);
        this.backgroundContainer.add(staticSprite);
        
        const animationSprite = this.landAnimation.getAnimationSprite();
        if (animationSprite) {
            animationSprite.setDisplaySize(1280, 747);
            this.backgroundContainer.add(animationSprite);
        }
        
        // 游戏框架 (Figma: game_frame 649×533px, 位置(376,0))
        if (this.textures.exists('game_frame')) {
            const gameFrame = this.add.image(376, 0, 'game_frame');
            gameFrame.setOrigin(0, 0);
            gameFrame.setDisplaySize(649, 533);
            this.backgroundContainer.add(gameFrame);
        }
        
        // 内容区域 (Figma: Rectangle 1, 552×472px, 位置(423,28), 颜色#663B14)
        const contentArea = this.add.rectangle(
            423, 28,
            552, 472,
            0x663B14
        );
        contentArea.setOrigin(0, 0);
        this.backgroundContainer.add(contentArea);
    }

    private createGameAreas() {
        // 创建连连看区域
        this.createMatch3Area();
        
        // 创建商店区域
        this.createShopArea();
        
        // 创建地面区域
        this.createGroundArea();
    }

    private createMatch3Area() {
        // 连连看区域容器
        this.match3Container = this.add.container(0, 0);
        
        // map只是位置和大小参考，不需要显示
        // 连连看区域: 459×357px, 位置(469,90)
        
        // 创建网格
        this.createMatch3Grid();
        
        console.log('Match3 area created');
    }

    private createMatch3Grid() {
        // 创建新的Match3系统，传入顶层容器用于资源显示
        this.match3System = Match3System.getInstance(this, this.match3Container, this.topLayerContainer);
        this.match3System.initialize();
        
        console.log('Match3 system created');
    }

    private createShopArea() {
        // 商店区域 (使用Figma图片: store 277×495px, 位置(71,-5))
        this.shopContainer = this.add.container(0, 0);
        
        // 商店背景 (使用实际图片)
        const shopBackground = this.add.image(
            this.SHOP_X,
            this.SHOP_Y,
            'store'
        );
        shopBackground.setOrigin(0, 0);
        shopBackground.setDisplaySize(this.SHOP_WIDTH, this.SHOP_HEIGHT);
        this.shopContainer.add(shopBackground);
        
        // 创建商品栏位
        this.createShopSlots();
        
        console.log('Shop area created');
    }

    private createShopSlots() {
        // 创建商店系统
        this.shop = new Shop(this, this.shopContainer);
        
        console.log('Shop system created');
    }

    private createGroundArea() {
        // 创建各个层级容器
        this.groundContainer = this.add.container(0, 0);
        this.buildingContainer = this.add.container(0, 0);
        this.characterContainer = this.add.container(0, 0);
        
        // 设置容器深度，确保正确的层级关系
        this.groundContainer.setDepth(0);    // 地面层最后面
        this.buildingContainer.setDepth(50); // 建筑层中间
        this.characterContainer.setDepth(100); // 角色层最前面
        
        // land只是地面参考线，不需要显示
        // 地面位置在y=789
        
        // 城堡 (使用Figma图片: castle 460×384px, 位置(-221,405))
        if (this.textures.exists('castle')) {
            const castle = this.add.image(
                this.CASTLE_X,
                this.CASTLE_Y,
                'castle'
            );
            castle.setOrigin(0, 0);
            castle.setDisplaySize(this.CASTLE_WIDTH, this.CASTLE_HEIGHT);
            this.groundContainer.add(castle);
        } else {
            // 如果城堡图片加载失败，使用备用矩形
            console.warn('Castle image not loaded, using fallback');
            const castle = this.add.rectangle(
                this.CASTLE_X,
                this.CASTLE_Y,
                this.CASTLE_WIDTH,
                this.CASTLE_HEIGHT,
                0x800080
            );
            castle.setOrigin(0, 0);
            castle.setStrokeStyle(2, 0x000000);
            this.groundContainer.add(castle);
        }
        
        // 创建建筑管理器（使用建筑容器）
        this.buildingManager = new BuildingManager(this, this.buildingContainer);
        
        // 创建矮人管理器（使用角色容器）
        this.dwarfManager = new DwarfManager(this, this.characterContainer);
        
        // 创建怪物管理器（使用角色容器）
        this.monsterManager = new MonsterManager(this, this.characterContainer);
        
        // 创建新怪物管理器（哥布林系统）
        this.newMonsterManager = new NewMonsterManager(this, this.characterContainer);
        
        // 创建游戏状态管理器
        this.gameStateManager = new GameStateManager(this);
        
        console.log('Ground area created');
    }

    private createUI() {
        // 创建侧边栏
        this.createSidebar();
        
        // 创建资源显示
        this.createResourceDisplay();
        
        // 创建游戏信息显示
        this.createGameInfo();
    }

    private createSidebar() {
        // 严格按照Figma information组: 使用store.png作为背景 (170×304px)
        const informationBackground = this.add.image(
            this.SIDEBAR_X,
            this.SIDEBAR_Y,
            'store'
        );
        informationBackground.setOrigin(0, 0);
        informationBackground.setDisplaySize(170, 304);
        
        // 删除标题 - Figma中没有"游戏信息"标题
    }

    private createResourceDisplay() {
        // 严格按照Figma information组布局
        const resourceTypes = ['gold', 'wood', 'stone', 'food', 'mithril'];
        const correctNames = ['金币', '木头', '石头', '食物', '秘银'];
        
        // Figma精确坐标：x=1134, y分别是46、85、124、163、202
        const figmaYPositions = [46, 85, 124, 163, 202];
        const iconX = 1154; // 整体向右移动20px
        
        resourceTypes.forEach((type, index) => {
            const iconY = figmaYPositions[index];
            
            // 资源图标 (Figma: 34×34px，food是34×33px)
            const iconHeight = (type === 'food') ? 33 : 34;
            const iconKey = type === 'gold' ? 'coin' : type;
            const resourceIcon = this.add.image(iconX, iconY, iconKey);
            resourceIcon.setOrigin(0, 0);
            resourceIcon.setDisplaySize(34, iconHeight);
            
            // 资源名称文本 (Figma: 46×15px, 16px字体, 居中对齐)
            // 假设文本在图标右侧，保持相对位置
            const nameText = this.add.text(
                iconX + 40, // 图标右侧40px
                iconY,
                correctNames[index],
                {
                    fontSize: '16px',
                    color: '#FFFFFF', // 白色文字
                    fontFamily: 'Abyssinica SIL',
                    align: 'center',
                    fixedWidth: 46
                }
            );
            nameText.setOrigin(0, 0);
            
            // 资源数量文本 (Figma: 46×15px, 16px字体, 居中对齐)
            const currentAmount = resourceManager.getResource(type);
            const count = this.add.text(
                iconX + 40, // 与名称对齐
                iconY + 17, // 名称下方
                currentAmount.toString(),
                {
                    fontSize: '16px',
                    color: '#FFFFFF', // 白色文字
                    fontFamily: 'Abyssinica SIL',
                    align: 'center',
                    fixedWidth: 46
                }
            );
            count.setOrigin(0, 0);
            
            // 保存显示对象的引用
            this.resourceDisplays.set(type, count);
        });
    }

    private createGameInfo() {
        // Figma中没有游戏信息显示，删除所有内容
    }

    private setupEventListeners() {
        // 监听窗口大小变化
        this.scale.on('resize', this.handleResize, this);
        
        // 监听键盘输入
        this.input.keyboard?.on('keydown', this.handleKeyDown, this);
        
        // 监听连连看相关事件
        this.events.on('resource-drop', this.handleResourceDrop, this);
        this.events.on('grid-refreshed', this.handleGridRefreshed, this);
        
        // 监听商店相关事件
        this.events.on('building-purchased', this.handleBuildingPurchased, this);
        
        // 监听资源变化
        resourceManager.addListener(this.handleResourceChange.bind(this));
    }

    private handleResize() {
        // 处理窗口大小变化
        console.log('Window resized');
    }

    private handleKeyDown(event: KeyboardEvent) {
        // 处理键盘输入
        if (event.code === 'Space') {
            console.log('Space key pressed');
        }
        
        // 测试用快捷键
        if (event.code === 'KeyR') {
            // 添加测试资源
            resourceManager.addResource('wood', 5);
            resourceManager.addResource('stone', 3);
            resourceManager.addResource('gold', 2);
            console.log('Added test resources');
        }
        
        if (event.code === 'KeyS') {
            // 刷新商店
            this.shop.forceRefresh();
            console.log('Shop refreshed');
        }
        
        if (event.code === 'KeyD') {
            // 显示矮人状态信息
            if (this.dwarfManager) {
                console.log('Dwarf Status:', this.dwarfManager.getStatusInfo());
                console.log('Dwarf Stats:', this.dwarfManager.getDwarfStats());
            }
        }
        
        if (event.code === 'KeyM') {
            // 开始怪物波次
            if (this.newMonsterManager) {
                this.newMonsterManager.forceNextWave();
                console.log('Wave Status:', this.newMonsterManager.getWaveStats());
            }
        }
        
        if (event.code === 'KeyV') {
            // 触发胜利（调试用）
            if (this.gameStateManager) {
                this.gameStateManager.forceVictory();
            }
        }
        
        if (event.code === 'KeyB') {
            // 触发失败（调试用）
            if (this.gameStateManager) {
                this.gameStateManager.forceDefeat();
            }
        }
        
        if (event.code === 'KeyT') {
            // 测试Match3系统
            if (this.match3System) {
                console.log('Match3 System Status:');
                console.log('- Grid State:', this.match3System.getGridState());
                console.log('- Dropped Resources:', this.match3System.getDroppedResourceCount());
            }
        }
        
        if (event.code === 'Escape') {
            // 返回主菜单
            this.returnToMainMenu();
        }
    }

    private handleResourceDrop(data: { resourceType: string; position: any }) {
        // 这个事件现在不再使用，因为Match3Grid直接创建DroppedResource对象
        // 保留这个方法以防其他地方调用
        console.log(`Resource drop event (deprecated):`, data.resourceType);
    }

    private handleGridRefreshed() {
        console.log('Grid refreshed');
        
        // 可以在这里添加网格刷新的特效
    }

    private createDropAnimation(resourceType: string, startPosition: any) {
        // 这个方法现在不再使用，因为Match3Grid直接创建DroppedResource对象
        // DroppedResource类已经包含了真实的资源图片和物理效果
        console.log('createDropAnimation is deprecated');
    }

    private updateResourceCount(resourceType: string, amount: number) {
        // 使用ResourceManager管理资源
        resourceManager.addResource(resourceType, amount);
    }

    private handleResourceChange(resources: Map<string, number>) {
        // 更新资源显示
        resources.forEach((amount, type) => {
            const display = this.resourceDisplays.get(type);
            if (display) {
                display.setText(amount.toString());
            }
        });
    }

    private handleBuildingPurchased(data: { productId: string; productType: string; productName: string }) {
        console.log(`Building purchased: ${data.productName} (${data.productType})`);
        
        // 不再触发 place-building 事件，因为建筑应该通过地基→建造流程创建
        // 建筑的创建已经由 building-foundation-place 事件处理
    }

    private showLoadingProgress() {
        // 完全移除加载进度显示
    }

    private getRandomResourceType(): string {
        const types = ['gold', 'wood', 'stone', 'mithril', 'food'];
        return types[Math.floor(Math.random() * types.length)];
    }

    private getResourceColor(type: string): number {
        const colors: { [key: string]: number } = {
            'gold': 0xFFD700,
            'wood': 0x8B4513,
            'stone': 0x696969,
            'mithril': 0xC0C0C0,
            'food': 0x32CD32
        };
        return colors[type] || 0xFFFFFF;
    }

    update(time: number, delta: number) {
        // 检查游戏是否结束
        if (this.gameStateManager && this.gameStateManager.isGameOver()) {
            return; // 游戏结束时停止更新
        }
        
        // 游戏主循环
        // 更新Match3系统
        if (this.match3System) {
            this.match3System.update(delta);
        }
        
        // 更新怪物管理器
        if (this.monsterManager) {
            this.monsterManager.update(delta);
        }
        
        // 更新新怪物管理器
        if (this.newMonsterManager) {
            // 更新目标列表
            const buildings = this.buildingManager ? this.buildingManager.getBuildingsAsCombatUnits() : [];
            const dwarfs = this.dwarfManager ? this.dwarfManager.getAllDwarfs() : [];
            this.newMonsterManager.setTargets(buildings, dwarfs);
            
            this.newMonsterManager.update(delta);
        }
        
        // 更新建筑管理器（传递怪物列表用于攻击）
        if (this.buildingManager && this.newMonsterManager) {
            const monsters = this.newMonsterManager.getAliveGoblins();
            this.buildingManager.update(delta, monsters);
        }
        
        // 更新矮人管理器
        if (this.dwarfManager) {
            this.dwarfManager.update(delta);
        }
        
        // 更新地面动画
        if (this.landAnimation) {
            this.landAnimation.update(delta);
        }
    }
    
    private returnToMainMenu() {
        console.log('Returning to main menu...');
        
        // 直接切换到主菜单场景
        this.scene.start('MainMenuScene');
    }
}