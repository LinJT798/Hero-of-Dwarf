import { resourceManager } from '../managers/ResourceManager';
import { configManager } from '../systems/ConfigManager';
import { BuildingFactory } from '../factories/BuildingFactory';

/**
 * 商店商品接口
 */
export interface ShopProduct {
    id: string;
    type: string;
    buildingType?: string;
    unitType?: string;
    name: string;
    cost: { [key: string]: number };
    weight: number;
    purchased: boolean;
}

/**
 * 商店系统
 * 管理商店的商品显示、购买和刷新
 */
export class Shop {
    private scene: Phaser.Scene;
    private container: Phaser.GameObjects.Container;
    private currentProducts: ShopProduct[] = [];
    private productSlots: ShopSlot[] = [];
    private productPool: ShopProduct[] = [];
    private buildingFactory: BuildingFactory;
    
    // 商店配置 (严格按照Figma设计)
    private slotCount: number = 2;
    private slotWidth: number = 190; // Figma: 190×96px
    private slotHeight: number = 96;
    private slotPositions: Array<{ x: number; y: number }> = [];
    private iconSize: { width: number; height: number } = { width: 85, height: 85 };
    private resourceIconSize: { width: number; height: number } = { width: 22, height: 22 };
    private priceTextSize: number = 24;

    constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
        this.scene = scene;
        this.container = container;
        this.buildingFactory = new BuildingFactory(scene);
        
        this.initialize();
    }

    /**
     * 初始化商店
     */
    private async initialize(): Promise<void> {
        await this.loadShopConfig();
        this.createProductSlots();
        this.refreshShop();
        
        console.log('Shop initialized');
    }

    /**
     * 加载商店配置
     */
    private async loadShopConfig(): Promise<void> {
        try {
            const config = await configManager.loadConfig('game/shop.json');
            
            // 加载布局配置
            if (config.shopLayout) {
                const layout = config.shopLayout;
                this.slotPositions = layout.slots || [
                    { x: 115, y: 81 },
                    { x: 115, y: 204 }
                ];
                this.slotCount = Math.min(this.slotPositions.length, config.shop_settings?.slot_count || 2);
                this.iconSize = layout.iconSize || { width: 85, height: 85 };
                this.resourceIconSize = layout.resourceIconSize || { width: 22, height: 22 };
                this.priceTextSize = layout.priceTextSize || 24;
            } else {
                // 使用默认Figma位置
                this.slotPositions = [
                    { x: 115, y: 81 },
                    { x: 115, y: 204 }
                ];
            }
            
            // 加载商品配置
            this.productPool = config.products || [];
            
            // 为每个商品添加实际的建筑配置信息
            this.productPool = this.productPool.map(product => {
                const buildingConfig = this.buildingFactory.getBuildingConfig(product.buildingType || product.type);
                if (buildingConfig) {
                    // 使用建筑配置中的显示名称
                    product.name = buildingConfig.displayName;
                }
                return product;
            });
            
        } catch (error) {
            console.warn('Failed to load shop config, using defaults');
            this.productPool = this.getDefaultProducts();
        }
    }

    /**
     * 获取默认商品
     */
    private getDefaultProducts(): ShopProduct[] {
        return [
            {
                id: 'arrow_tower_1',
                type: 'arrow_tower',
                name: '弓箭塔',
                cost: { wood: 2, stone: 1, gold: 1 },
                weight: 10,
                purchased: false
            },
            {
                id: 'arrow_tower_2',
                type: 'arrow_tower',
                name: '弓箭塔',
                cost: { wood: 3, stone: 2 },
                weight: 8,
                purchased: false
            },
            {
                id: 'arrow_tower_3',
                type: 'arrow_tower',
                name: '弓箭塔',
                cost: { wood: 1, stone: 3, gold: 2 },
                weight: 6,
                purchased: false
            }
        ];
    }

    /**
     * 创建商品槽位
     */
    private createProductSlots(): void {
        this.productSlots = [];
        
        for (let i = 0; i < this.slotCount; i++) {
            const slot = new ShopSlot(
                this.scene,
                this.slotPositions[i].x,
                this.slotPositions[i].y,
                this.slotWidth,
                this.slotHeight,
                i,
                this.iconSize,
                this.resourceIconSize,
                this.priceTextSize
            );
            
            // 设置购买回调
            slot.onPurchase = (slotIndex: number) => {
                this.handlePurchase(slotIndex);
            };
            
            this.productSlots.push(slot);
            this.container.add(slot.getDisplayObjects());
        }
    }

    /**
     * 刷新商店
     */
    private refreshShop(): void {
        // 从商品池中随机选择商品
        const selectedProducts = this.selectRandomProducts();
        
        // 更新槽位显示
        for (let i = 0; i < this.slotCount; i++) {
            const product = selectedProducts[i] || null;
            this.productSlots[i].setProduct(product);
        }
        
        this.currentProducts = selectedProducts;
        console.log('Shop refreshed with products:', selectedProducts.map(p => p.name));
    }

    /**
     * 随机选择商品
     */
    private selectRandomProducts(): ShopProduct[] {
        const availableProducts = this.productPool.filter(p => !p.purchased);
        const selected: ShopProduct[] = [];
        
        // 使用权重随机选择
        for (let i = 0; i < this.slotCount && availableProducts.length > 0; i++) {
            const randomProduct = this.selectWeightedRandom(availableProducts);
            if (randomProduct) {
                selected.push({ ...randomProduct }); // 创建副本
                // 从可用商品中移除，避免重复选择
                const index = availableProducts.indexOf(randomProduct);
                availableProducts.splice(index, 1);
            }
        }
        
        return selected;
    }

    /**
     * 权重随机选择
     */
    private selectWeightedRandom(products: ShopProduct[]): ShopProduct | null {
        if (products.length === 0) return null;
        
        const totalWeight = products.reduce((sum, p) => sum + p.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const product of products) {
            random -= product.weight;
            if (random <= 0) {
                return product;
            }
        }
        
        return products[0]; // 备用选择
    }

    /**
     * 处理购买
     */
    private handlePurchase(slotIndex: number): void {
        const product = this.currentProducts[slotIndex];
        if (!product || product.purchased) {
            return;
        }

        // 检查资源是否足够
        if (!resourceManager.hasEnoughResources(product.cost)) {
            console.log('Not enough resources for', product.name);
            return;
        }

        // 消费资源
        if (resourceManager.consumeResources(product.cost)) {
            // 标记为已购买
            product.purchased = true;
            this.productSlots[slotIndex].setPurchased(true);
            
            // 根据商品类型触发不同的事件
            if (product.buildingType) {
                // 建筑类型商品
                this.scene.events.emit('building-purchased', {
                    productId: product.id,
                    productType: product.buildingType,
                    productName: product.name
                });
                
                // 触发地基放置事件（这是建造流程的开始）
                this.scene.events.emit('building-foundation-place', {
                    productId: product.id,
                    productType: product.buildingType,
                    productName: product.name
                });
                
                console.log(`Purchased building ${product.name} for`, product.cost);
            } else if (product.unitType) {
                // 单位类型商品
                console.log(`[Shop] Emitting unit-purchased event for ${product.name}`);
                this.scene.events.emit('unit-purchased', {
                    productId: product.id,
                    unitType: product.unitType,
                    productName: product.name
                });
                
                console.log(`Purchased unit ${product.name} for`, product.cost);
            }
            
            // 检查是否需要刷新商店
            this.checkForRefresh();
        }
    }

    /**
     * 检查是否需要刷新商店
     */
    private checkForRefresh(): void {
        const allPurchased = this.currentProducts.every(p => p.purchased);
        
        if (allPurchased) {
            // 延迟刷新，给玩家时间看到购买结果
            this.scene.time.delayedCall(1000, () => {
                this.refreshShop();
            });
        }
    }

    /**
     * 获取当前商品
     */
    public getCurrentProducts(): ShopProduct[] {
        return [...this.currentProducts];
    }

    /**
     * 手动刷新商店（调试用）
     */
    public forceRefresh(): void {
        // 重置所有商品的购买状态
        this.currentProducts.forEach(p => p.purchased = false);
        this.refreshShop();
    }

    /**
     * 销毁商店
     */
    public destroy(): void {
        this.productSlots.forEach(slot => slot.destroy());
        this.productSlots = [];
        this.currentProducts = [];
    }
}

/**
 * 商店槽位类
 */
class ShopSlot {
    private scene: Phaser.Scene;
    private x: number;
    private y: number;
    private width: number;
    private height: number;
    private slotIndex: number;
    
    private container: Phaser.GameObjects.Container;
    private background: Phaser.GameObjects.Rectangle;
    private icon: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | null = null;
    private nameText: Phaser.GameObjects.Text;
    private costText: Phaser.GameObjects.Text;
    private purchasedOverlay: Phaser.GameObjects.Rectangle | null = null;
    private purchasedText: Phaser.GameObjects.Text | null = null;
    
    // Figma资源成本显示组件
    private resourceIcons: Phaser.GameObjects.Image[] = [];
    private priceTexts: Phaser.GameObjects.Text[] = [];
    
    public onPurchase: ((slotIndex: number) => void) | null = null;
    
    private currentProduct: ShopProduct | null = null;
    
    // 配置尺寸
    private iconSize: { width: number; height: number };
    private resourceIconSize: { width: number; height: number };
    private priceTextSize: number;

    constructor(
        scene: Phaser.Scene, 
        x: number, 
        y: number, 
        width: number, 
        height: number, 
        slotIndex: number,
        iconSize: { width: number; height: number } = { width: 85, height: 85 },
        resourceIconSize: { width: number; height: number } = { width: 22, height: 22 },
        priceTextSize: number = 24
    ) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.slotIndex = slotIndex;
        this.iconSize = iconSize;
        this.resourceIconSize = resourceIconSize;
        this.priceTextSize = priceTextSize;
        
        this.createDisplay();
    }

    /**
     * 创建显示对象 (严格按照Figma store组设计)
     */
    private createDisplay(): void {
        // 使用绝对位置，不使用container偏移
        this.container = this.scene.add.container(0, 0);
        
        // building3背景 (Figma: 189×96px, 颜色#FFD1AB)
        this.background = this.scene.add.rectangle(
            this.x, this.y, 
            189, 96, 
            0xFFD1AB
        );
        this.background.setOrigin(0, 0);
        this.background.setInteractive();
        this.container.add(this.background);
        
        // archer_icon (Figma: 85×85px) - 左侧居中
        // 不创建灰色占位符，等待实际图标
        // this.icon 将在 setProduct 时创建
        
        // 删除商品名称文本 - Figma中没有
        this.nameText = this.scene.add.text(0, 0, '', { fontSize: '1px' });
        this.nameText.setVisible(false);
        
        // 删除成本信息文本 - 用具体的资源图标和数字替代
        this.costText = this.scene.add.text(0, 0, '', { fontSize: '1px' });
        this.costText.setVisible(false);
        
        // 按照Figma添加资源图标和价格 - 稍后在setProduct中动态创建
        
        // 点击事件
        this.background.on('pointerdown', () => {
            if (this.onPurchase && this.currentProduct && !this.currentProduct.purchased) {
                this.onPurchase(this.slotIndex);
            }
        });
        
        // 悬停效果
        this.background.on('pointerover', () => {
            if (this.currentProduct && !this.currentProduct.purchased) {
                this.background.setFillStyle(0xFFE1BB);
            }
        });
        
        this.background.on('pointerout', () => {
            if (this.currentProduct && !this.currentProduct.purchased) {
                this.background.setFillStyle(0xFFD1AB);
            }
        });
    }

    /**
     * 设置商品 (严格按照Figma store组布局)
     */
    public setProduct(product: ShopProduct | null): void {
        this.currentProduct = product;
        
        // 清理旧的资源显示
        this.clearResourceDisplay();
        
        if (product) {
            // 尝试加载商品图标
            // 特殊处理：arrow_tower 使用 archer_icon
            const productType = product.buildingType || product.unitType || product.type;
            let textureKey = productType === 'arrow_tower' ? 'archer_icon' : `${productType}_icon`;
            
            console.log(`[ShopSlot] Setting product ${productType}, looking for texture: ${textureKey}`);
            console.log(`[ShopSlot] Texture exists: ${this.scene.textures.exists(textureKey)}`);
            
            // 计算图标位置
            const iconX = this.x + 10;
            const iconY = this.y + 5;
            
            // 如果已有图标，先销毁
            if (this.icon) {
                this.icon.destroy();
                this.icon = null;
            }
            
            if (this.scene.textures.exists(textureKey)) {
                // 创建图标图像
                this.icon = this.scene.add.image(iconX, iconY, textureKey);
                this.icon.setOrigin(0, 0);
                this.icon.setDisplaySize(this.iconSize.width, this.iconSize.height);
                this.container.add(this.icon);
                console.log(`[ShopSlot] Icon created successfully at (${iconX}, ${iconY})`);
            } else {
                console.warn(`[ShopSlot] Texture ${textureKey} not found, no icon will be displayed`);
                // 可以选择创建一个占位符或留空
                // this.icon = this.scene.add.rectangle(iconX, iconY, this.iconSize.width, this.iconSize.height, 0xCCCCCC);
                // this.icon.setOrigin(0, 0);
                // this.container.add(this.icon);
            }
            
            this.createResourceDisplay(product.cost);
            this.setPurchased(product.purchased);
        } else {
            // 如果没有商品，隐藏或销毁图标
            if (this.icon) {
                this.icon.destroy();
                this.icon = null;
            }
            this.setPurchased(false);
        }
    }
    
    /**
     * 清理资源显示
     */
    private clearResourceDisplay(): void {
        this.resourceIcons.forEach(icon => icon.destroy());
        this.priceTexts.forEach(text => text.destroy());
        this.resourceIcons = [];
        this.priceTexts = [];
    }
    
    /**
     * 创建资源显示 (按照Figma store组: coin_store, wood_store, stone_store + 价格文本)
     */
    private createResourceDisplay(cost: { [key: string]: number }): void {
        const resourceEntries = Object.entries(cost);
        
        // Figma中显示3个资源成本，垂直排列在右侧
        resourceEntries.slice(0, 3).forEach(([resourceType, amount], index) => {
            // 资源图标和价格水平排列，垂直间距
            const iconX = this.x + 105;
            const iconY = this.y + 15 + index * 25; // 垂直间距25px
            
            // 创建资源图标 (使用原始资源缩放到配置尺寸)
            const resourceIcon = this.scene.add.image(iconX, iconY, this.getResourceImageKey(resourceType));
            resourceIcon.setOrigin(0, 0);
            resourceIcon.setDisplaySize(
                this.resourceIconSize.width, 
                resourceType === 'stone' ? this.resourceIconSize.height - 1 : this.resourceIconSize.height
            );
            this.resourceIcons.push(resourceIcon);
            this.container.add(resourceIcon);
            
            // 价格文本 - 在图标右侧
            const priceText = this.scene.add.text(
                iconX + this.resourceIconSize.width + 3, 
                iconY + this.resourceIconSize.height / 2,
                amount.toString(),
                {
                    fontSize: `${this.priceTextSize}px`,
                    color: '#000000',
                    fontFamily: 'Abyssinica SIL'
                }
            );
            priceText.setOrigin(0, 0.5);
            this.priceTexts.push(priceText);
            this.container.add(priceText);
        });
    }
    
    /**
     * 获取资源图像键名
     */
    private getResourceImageKey(resourceType: string): string {
        const keyMap: { [key: string]: string } = {
            'gold': 'coin',
            'wood': 'wood', 
            'stone': 'stone',
            'mithril': 'mithril',
            'food': 'food'
        };
        return keyMap[resourceType] || 'coin';
    }


    /**
     * 设置购买状态 (按照Figma设计)
     */
    public setPurchased(purchased: boolean): void {
        if (purchased) {
            // 已售出遮罩 (Figma: 189×96px, 半透明灰色rgba(92, 88, 84, 0.4))
            if (!this.purchasedOverlay) {
                this.purchasedOverlay = this.scene.add.rectangle(
                    this.x, this.y, 
                    this.width, this.height, 
                    0x5C5854, 0.4
                );
                this.purchasedOverlay.setOrigin(0, 0);
                this.container.add(this.purchasedOverlay);
                
                // "Sold"文本 (Figma: Abyssinica SIL, 48px, 白色#FFFFFF, 居中)
                this.purchasedText = this.scene.add.text(
                    this.x + this.width/2, 
                    this.y + this.height/2, 
                    'Sold', 
                    {
                        fontSize: '24px', // 调整为适合的大小
                        color: '#FFFFFF',
                        fontFamily: 'Arial', // 替代Abyssinica SIL
                        fontStyle: 'bold'
                    }
                );
                this.purchasedText.setOrigin(0.5);
                this.container.add(this.purchasedText);
            }
            
            this.purchasedOverlay.setVisible(true);
            this.purchasedText!.setVisible(true);
        } else {
            // 隐藏已购买遮罩
            if (this.purchasedOverlay) {
                this.purchasedOverlay.setVisible(false);
                this.purchasedText!.setVisible(false);
            }
        }
    }

    /**
     * 获取显示对象
     */
    public getDisplayObjects(): Phaser.GameObjects.GameObject[] {
        return [this.container];
    }

    /**
     * 销毁槽位
     */
    public destroy(): void {
        this.clearResourceDisplay();
        this.container.destroy();
    }
}