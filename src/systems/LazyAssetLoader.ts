/**
 * 延迟资源加载器
 * 按需加载资源，减少初始加载时间
 */
export class LazyAssetLoader {
    private scene: Phaser.Scene;
    private loadingAssets: Set<string> = new Set();
    private loadedAssets: Set<string> = new Set();
    private loadQueue: Map<string, () => Promise<void>> = new Map();
    
    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }
    
    /**
     * 预加载核心资源（必须的资源）
     */
    async loadCoreAssets(): Promise<void> {
        console.log('[LazyAssetLoader] Loading core assets...');
        
        const coreAssets = [
            // 基础UI
            { key: 'game_frame', path: 'assets/images/game_frame.png' },
            { key: 'store', path: 'assets/images/store.png' },
            { key: 'cube_frame', path: 'assets/images/cube_frame.png' },
            
            // 背景
            { key: 'back_sky', path: 'assets/images/back_sky.png' },
            { key: 'back_land', path: 'assets/images/back_land.png' },
            
            // 基础资源图标（小文件）
            { key: 'coin', path: 'assets/images/coin.png' },
            { key: 'wood', path: 'assets/images/wood.png' },
            { key: 'stone', path: 'assets/images/stone.png' },
            { key: 'mithril', path: 'assets/images/mithril.png' },
            { key: 'food', path: 'assets/images/food.png' },
            
            // 连连看方块
            { key: 'dirt', path: 'assets/images/dirt.png' },
            { key: 'grass', path: 'assets/images/grass.png' },
            { key: 'lava', path: 'assets/images/lava.png' },
            { key: 'sand', path: 'assets/images/sand.png' }
        ];
        
        // 加载核心资源
        for (const asset of coreAssets) {
            if (!this.isLoaded(asset.key)) {
                this.scene.load.image(asset.key, asset.path);
            }
        }
        
        return new Promise((resolve) => {
            this.scene.load.once('complete', () => {
                console.log('[LazyAssetLoader] Core assets loaded');
                resolve();
            });
            this.scene.load.start();
        });
    }
    
    /**
     * 延迟加载矮人动画（当需要时）
     */
    async loadDwarfAnimations(animationType: 'walk' | 'idle1' | 'idle2' | 'attack' | 'death'): Promise<void> {
        const key = `dwarf_${animationType}`;
        if (this.isLoaded(key) || this.loadingAssets.has(key)) {
            return;
        }
        
        console.log(`[LazyAssetLoader] Loading dwarf ${animationType} animation...`);
        this.loadingAssets.add(key);
        
        // 获取优化后的帧数
        const frameCount = this.getOptimizedFrameCount('dwarf', animationType);
        const basePath = `assets/animations/dwarf/${animationType}`;
        
        // 加载动画帧
        for (let i = 1; i <= frameCount; i++) {
            const frameKey = `${key}_${i}`;
            this.scene.load.image(frameKey, `${basePath}/processed_frame_${i}.png`);
        }
        
        return new Promise((resolve) => {
            this.scene.load.once('complete', () => {
                this.loadedAssets.add(key);
                this.loadingAssets.delete(key);
                console.log(`[LazyAssetLoader] Dwarf ${animationType} animation loaded`);
                resolve();
            });
            this.scene.load.start();
        });
    }
    
    /**
     * 延迟加载哥布林动画
     */
    async loadGoblinAnimations(animationType: 'walk' | 'idle' | 'attack' | 'death'): Promise<void> {
        const key = `goblin_${animationType}`;
        if (this.isLoaded(key) || this.loadingAssets.has(key)) {
            return;
        }
        
        console.log(`[LazyAssetLoader] Loading goblin ${animationType} animation...`);
        this.loadingAssets.add(key);
        
        const frameCount = this.getOptimizedFrameCount('goblin', animationType);
        const basePath = `assets/animations/goblin/${animationType}`;
        
        for (let i = 1; i <= frameCount; i++) {
            const frameKey = `${key}_${i}`;
            this.scene.load.image(frameKey, `${basePath}/processed_frame_${i}.png`);
        }
        
        return new Promise((resolve) => {
            this.scene.load.once('complete', () => {
                this.loadedAssets.add(key);
                this.loadingAssets.delete(key);
                console.log(`[LazyAssetLoader] Goblin ${animationType} animation loaded`);
                resolve();
            });
            this.scene.load.start();
        });
    }
    
    /**
     * 延迟加载建筑动画
     */
    async loadBuildingAnimations(buildingType: string, animationType: string): Promise<void> {
        const key = `${buildingType}_${animationType}`;
        if (this.isLoaded(key) || this.loadingAssets.has(key)) {
            return;
        }
        
        console.log(`[LazyAssetLoader] Loading ${buildingType} ${animationType} animation...`);
        this.loadingAssets.add(key);
        
        const frameCount = this.getOptimizedFrameCount(buildingType, animationType);
        const basePath = `assets/animations/${buildingType}/${animationType}`;
        
        for (let i = 1; i <= frameCount; i++) {
            const frameKey = `${key}_${i}`;
            this.scene.load.image(frameKey, `${basePath}/processed_frame_${i}.png`);
        }
        
        return new Promise((resolve) => {
            this.scene.load.once('complete', () => {
                this.loadedAssets.add(key);
                this.loadingAssets.delete(key);
                resolve();
            });
            this.scene.load.start();
        });
    }
    
    /**
     * 批量预加载资源（带进度回调）
     */
    async preloadAssets(assets: string[], onProgress?: (progress: number) => void): Promise<void> {
        const total = assets.length;
        let loaded = 0;
        
        for (const asset of assets) {
            // 根据资源类型调用相应的加载方法
            if (asset.startsWith('dwarf_')) {
                const animType = asset.split('_')[1] as any;
                await this.loadDwarfAnimations(animType);
            } else if (asset.startsWith('goblin_')) {
                const animType = asset.split('_')[1] as any;
                await this.loadGoblinAnimations(animType);
            }
            
            loaded++;
            if (onProgress) {
                onProgress(loaded / total);
            }
        }
    }
    
    /**
     * 获取优化后的帧数（减少后的帧数）
     */
    private getOptimizedFrameCount(unitType: string, animationType: string): number {
        // 优化后的帧数配置
        const frameConfigs: Record<string, Record<string, number>> = {
            dwarf: {
                walk: 34,      // 原101帧，每3帧取1
                idle1: 26,     // 原101帧，每4帧取1
                idle2: 26,     // 原101帧，每4帧取1
                attack: 34,    // 原101帧，每3帧取1
                death: 51      // 原101帧，每2帧取1
            },
            goblin: {
                walk: 34,      // 原101帧，每3帧取1
                idle: 26,      // 原101帧，每4帧取1
                attack: 34,    // 原101帧，每3帧取1
                death: 51      // 原101帧，每2帧取1
            },
            arrow_tower: {
                idle: 21,      // 原101帧，每5帧取1
                attack: 34     // 原101帧，每3帧取1
            }
        };
        
        return frameConfigs[unitType]?.[animationType] || 101;
    }
    
    /**
     * 检查资源是否已加载
     */
    private isLoaded(key: string): boolean {
        return this.loadedAssets.has(key);
    }
    
    /**
     * 清理未使用的资源
     */
    cleanupUnusedAssets(activeKeys: Set<string>): void {
        const keysToRemove: string[] = [];
        
        this.loadedAssets.forEach(key => {
            if (!activeKeys.has(key)) {
                keysToRemove.push(key);
            }
        });
        
        keysToRemove.forEach(key => {
            // 清理纹理缓存
            if (key.includes('_')) {
                const frameCount = this.getOptimizedFrameCount(
                    key.split('_')[0],
                    key.split('_')[1]
                );
                
                for (let i = 1; i <= frameCount; i++) {
                    const frameKey = `${key}_${i}`;
                    if (this.scene.textures.exists(frameKey)) {
                        this.scene.textures.remove(frameKey);
                    }
                }
            }
            
            this.loadedAssets.delete(key);
        });
        
        if (keysToRemove.length > 0) {
            console.log(`[LazyAssetLoader] Cleaned up ${keysToRemove.length} unused assets`);
        }
    }
}