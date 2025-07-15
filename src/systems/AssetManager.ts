/**
 * 简化的资源管理器
 * 用于Demo版本的资源加载和管理
 */
export class AssetManager {
    private scene: Phaser.Scene;
    private loadedAssets: Set<string> = new Set();
    private loadingAssets: Set<string> = new Set();

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    /**
     * 加载图片资源
     * @param key 资源key
     * @param path 图片路径
     */
    loadImage(key: string, path: string): void {
        if (this.isAssetLoaded(key) || this.loadingAssets.has(key)) {
            return;
        }

        this.loadingAssets.add(key);
        this.scene.load.image(key, path);
    }

    /**
     * 加载精灵表
     * @param key 资源key
     * @param path 精灵表路径
     * @param frameConfig 帧配置
     */
    loadSpritesheet(key: string, path: string, frameConfig: { frameWidth: number; frameHeight: number; }): void {
        if (this.isAssetLoaded(key) || this.loadingAssets.has(key)) {
            return;
        }

        this.loadingAssets.add(key);
        this.scene.load.spritesheet(key, path, frameConfig);
    }

    /**
     * 加载多帧动画（从文件夹中的单独图片）
     * @param baseKey 基础资源key
     * @param folderPath 文件夹路径
     * @param frameCount 帧数
     * @param fileExtension 文件扩展名，默认为'png'
     * @param namePattern 文件命名模式，默认为'processed_frame_'
     */
    loadFrameSequence(baseKey: string, folderPath: string, frameCount: number, fileExtension: string = 'png', namePattern: string = 'processed_frame_'): void {
        for (let i = 1; i <= frameCount; i++) {
            const frameKey = `${baseKey}_${i}`;
            const framePath = `${folderPath}/${namePattern}${i}.${fileExtension}`;
            
            if (!this.isAssetLoaded(frameKey) && !this.loadingAssets.has(frameKey)) {
                this.loadingAssets.add(frameKey);
                this.scene.load.image(frameKey, framePath);
            }
        }
    }

    /**
     * 加载音频资源
     * @param key 资源key
     * @param path 音频路径
     */
    loadAudio(key: string, path: string): void {
        if (this.isAssetLoaded(key) || this.loadingAssets.has(key)) {
            return;
        }

        this.loadingAssets.add(key);
        this.scene.load.audio(key, path);
    }

    /**
     * 批量加载资源
     * @param assets 资源配置数组
     */
    loadAssets(assets: AssetConfig[]): Promise<void> {
        return new Promise((resolve, reject) => {
            // 添加资源到加载队列
            assets.forEach(asset => {
                switch (asset.type) {
                    case 'image':
                        this.loadImage(asset.key, asset.path);
                        break;
                    case 'spritesheet':
                        this.loadSpritesheet(asset.key, asset.path, asset.frameConfig!);
                        break;
                    case 'audio':
                        this.loadAudio(asset.key, asset.path);
                        break;
                    case 'frameSequence':
                        this.loadFrameSequence(asset.key, asset.path, asset.frameCount!, asset.fileExtension, asset.namePattern);
                        break;
                }
            });

            // 设置加载完成回调
            this.scene.load.once('complete', () => {
                this.loadingAssets.forEach(key => {
                    this.loadedAssets.add(key);
                });
                this.loadingAssets.clear();
                console.log('Assets loaded:', assets.length);
                resolve();
            });

            // 设置加载错误回调 - 只记录错误，不中断加载
            this.scene.load.on('loaderror', (file: any) => {
                console.warn(`Failed to load asset: ${file.key}, continuing with other assets...`);
                // 不reject，让其他资源继续加载
            });

            // 开始加载
            this.scene.load.start();
        });
    }

    /**
     * 获取纹理资源
     * @param key 资源key
     * @returns 纹理对象
     */
    getTexture(key: string): Phaser.Textures.Texture | null {
        if (this.scene.textures.exists(key)) {
            return this.scene.textures.get(key);
        }
        return null;
    }

    /**
     * 获取音频资源
     * @param key 资源key
     * @returns 音频对象
     */
    getAudio(key: string): any {
        if (this.scene.cache.audio.exists(key)) {
            return this.scene.cache.audio.get(key);
        }
        return null;
    }

    /**
     * 检查资源是否已加载
     * @param key 资源key
     * @returns 是否已加载
     */
    isAssetLoaded(key: string): boolean {
        return this.loadedAssets.has(key) || this.scene.textures.exists(key);
    }

    /**
     * 获取加载进度
     * @returns 加载进度 (0-1)
     */
    getLoadProgress(): number {
        return this.scene.load.progress;
    }

    /**
     * 预加载Figma图片资源
     */
    async loadBaseAssets(): Promise<void> {
        const figmaAssets: AssetConfig[] = [
            // 主菜单资源 (允许加载失败)
            { key: 'menu-background', type: 'image', path: '/assets/images/menu-background.png' },
            { key: 'game-title', type: 'image', path: '/assets/images/game-title.png' },
            { key: 'start-button', type: 'image', path: '/assets/images/start-button.png' },
            
            // 主菜单音效 (允许加载失败)
            { key: 'button-click', type: 'audio', path: '/assets/audio/button-click.wav' },
            { key: 'button-hover', type: 'audio', path: '/assets/audio/button-hover.wav' },
            
            // 背景图片
            { key: 'back_sky', type: 'image', path: '/assets/images/back_sky.png' },
            { key: 'back_land', type: 'image', path: '/assets/images/back_land.png' },
            { key: 'game_frame', type: 'image', path: '/assets/images/game_frame.png' },
            
            // 商店相关图片
            { key: 'store', type: 'image', path: '/assets/images/store.png' },
            { key: 'archer_icon', type: 'image', path: '/assets/images/archer_icon.png' },
            { key: 'building1', type: 'image', path: '/assets/images/building1.png' },
            { key: 'building2', type: 'image', path: '/assets/images/building2.png' },
            { key: 'building3', type: 'image', path: '/assets/images/building3.png' },
            
            // 建筑图片
            { key: 'castle', type: 'image', path: '/assets/images/castle.png' },
            { key: 'archer_building', type: 'image', path: '/assets/images/archer_building.png' },
            
            // UI图片
            { key: 'coin_store', type: 'image', path: '/assets/images/coin_store.png' },
            { key: 'coin_game', type: 'image', path: '/assets/images/coin_game.png' },
            { key: 'cube_frame', type: 'image', path: '/assets/images/cube_frame.png' },
            
            // 原始资源图片 (用于商店和信息面板)
            { key: 'coin', type: 'image', path: '/assets/images/coin.png' },
            { key: 'wood', type: 'image', path: '/assets/images/wood.png' },
            { key: 'stone', type: 'image', path: '/assets/images/stone.png' },
            { key: 'mithril', type: 'image', path: '/assets/images/mithril.png' },
            { key: 'food', type: 'image', path: '/assets/images/food.png' },
            
            // 非资源方块图片 (可消除但不掉落资源)
            { key: 'dirt', type: 'image', path: '/assets/images/dirt.png' },
            { key: 'grass', type: 'image', path: '/assets/images/grass.png' },
            { key: 'lava', type: 'image', path: '/assets/images/lava.png' },
            { key: 'sand', type: 'image', path: '/assets/images/sand.png' },
            
            // 角色图片
            { key: 'dwarf_character', type: 'image', path: '/assets/images/processed_frame_1 1.png' },
            
            // 矮人动画 (101帧序列，processed_frame_x命名)
            { key: 'dwarf_walk', type: 'frameSequence', path: '/assets/animations/dwarf/walk', frameCount: 101, fileExtension: 'png', namePattern: 'processed_frame_' },
            
            // 矮人待机动画 (两套，各101帧)
            { key: 'dwarf_idle1', type: 'frameSequence', path: '/assets/animations/dwarf/idle1', frameCount: 101, fileExtension: 'png', namePattern: 'processed_frame_' },
            { key: 'dwarf_idle2', type: 'frameSequence', path: '/assets/animations/dwarf/idle2', frameCount: 101, fileExtension: 'png', namePattern: 'processed_frame_' },
            
            // 矮人建造动画 (73帧，20fps)
            { key: 'dwarf_build', type: 'frameSequence', path: '/assets/animations/dwarf/build', frameCount: 73, fileExtension: 'png', namePattern: 'processed_frame_' },
            
            // 建筑相关资源
            { key: 'foundation', type: 'image', path: '/assets/images/foundation.png' },
            
            // 弓箭塔建造动画 (100帧，20fps)
            { key: 'arrow_tower_build', type: 'frameSequence', path: '/assets/animations/buildings/arrow_tower/build', frameCount: 100, fileExtension: 'png', namePattern: 'processed_frame_' },
            
            // 弓箭塔待机动画 (101帧，20fps)
            { key: 'arrow_tower_idle', type: 'frameSequence', path: '/assets/animations/arrow_tower/idle', frameCount: 101, fileExtension: 'png', namePattern: 'processed_frame_' },
            
            // 哥布林动画 (101帧，20fps)
            { key: 'goblin_walk', type: 'frameSequence', path: '/assets/animations/goblin/walk', frameCount: 101, fileExtension: 'png', namePattern: 'processed_frame_' },
            { key: 'goblin_attack', type: 'frameSequence', path: '/assets/animations/goblin/attack', frameCount: 101, fileExtension: 'png', namePattern: 'processed_frame_' },
            { key: 'goblin_death', type: 'frameSequence', path: '/assets/animations/goblin/death', frameCount: 101, fileExtension: 'png', namePattern: 'processed_frame_' },
            
            // 地面微风动画 (101帧，20fps)
            { key: 'land_wind', type: 'frameSequence', path: '/assets/animations/backgrounds/land/wind', frameCount: 101, fileExtension: 'png', namePattern: 'processed_frame_' },
            
            // 连连看区域
            { key: 'map', type: 'image', path: '/assets/images/map.png' },
            { key: 'land', type: 'image', path: '/assets/images/land.png' }
        ];

        try {
            await this.loadAssets(figmaAssets);
            console.log('Figma assets loaded successfully');
        } catch (error) {
            console.warn('Failed to load some Figma assets, creating fallback textures:', error);
            this.createDemoTextures();
        }
    }

    /**
     * 创建临时颜色纹理
     * @param key 纹理key
     * @param color 颜色
     * @param width 宽度
     * @param height 高度
     */
    createColorTexture(key: string, color: string, width: number = 32, height: number = 32): void {
        if (this.scene.textures.exists(key)) {
            return;
        }

        const graphics = this.scene.add.graphics();
        graphics.fillStyle(parseInt(color.replace('#', '0x')));
        graphics.fillRect(0, 0, width, height);
        graphics.generateTexture(key, width, height);
        graphics.destroy();
        
        this.loadedAssets.add(key);
    }

    /**
     * 创建Demo所需的临时纹理
     */
    createDemoTextures(): void {
        // 连连看资源纹理
        this.createColorTexture('gold', '#FFD700', 48, 48);
        this.createColorTexture('wood', '#8B4513', 48, 48);
        this.createColorTexture('stone', '#696969', 48, 48);
        this.createColorTexture('mithril', '#C0C0C0', 48, 48);
        this.createColorTexture('food', '#32CD32', 48, 48);
        
        // 如果cube_frame不存在，创建一个临时的选中框纹理
        if (!this.scene.textures.exists('cube_frame')) {
            this.createColorTexture('cube_frame', '#FFFF00', 50, 51);
        }

        // UI纹理
        this.createColorTexture('grid_cell', '#F0F0F0', 51, 51);
        this.createColorTexture('selected_cell', '#FFFF00', 51, 51);
        this.createColorTexture('shop_panel', '#8B4513', 277, 495);
        this.createColorTexture('building_slot', '#FFD1AB', 189, 96);
        this.createColorTexture('ground', '#D9D9D9', 1280, 17);
        
        // 建筑纹理
        this.createColorTexture('arrow_tower', '#654321', 60, 60);
        this.createColorTexture('tower_foundation', '#A0A0A0', 60, 60);
        
        // 怪物纹理
        this.createColorTexture('basic_monster', '#FF0000', 40, 40);
        
        // 矮人纹理
        this.createColorTexture('dwarf', '#0000FF', 32, 32);
        
        // 城堡纹理
        this.createColorTexture('castle', '#800080', 100, 100);
    }

    /**
     * 释放资源
     * @param keys 要释放的资源keys
     */
    disposeAssets(keys: string[]): void {
        keys.forEach(key => {
            if (this.scene.textures.exists(key)) {
                this.scene.textures.remove(key);
            }
            if (this.scene.cache.audio.exists(key)) {
                this.scene.cache.audio.remove(key);
            }
            this.loadedAssets.delete(key);
        });
    }
}

// 资源配置接口
export interface AssetConfig {
    key: string;
    type: 'image' | 'spritesheet' | 'audio' | 'frameSequence';
    path: string;
    frameConfig?: { frameWidth: number; frameHeight: number; };
    frameCount?: number;
    fileExtension?: string;
    namePattern?: string;
}