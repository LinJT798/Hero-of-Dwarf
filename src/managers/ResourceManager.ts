/**
 * 资源管理器
 * 管理游戏中的各种资源（金币、木头、石头、秘银、食物）
 */
export class ResourceManager {
    private static instance: ResourceManager;
    private resources: Map<string, number> = new Map();
    private listeners: ((resources: Map<string, number>) => void)[] = [];
    
    // 资源类型定义
    public static readonly RESOURCE_TYPES = ['gold', 'wood', 'stone', 'mithril', 'food'];
    
    private constructor() {
        this.initializeResources();
    }

    static getInstance(): ResourceManager {
        if (!ResourceManager.instance) {
            ResourceManager.instance = new ResourceManager();
        }
        return ResourceManager.instance;
    }

    /**
     * 初始化资源
     */
    private initializeResources(): void {
        ResourceManager.RESOURCE_TYPES.forEach(type => {
            this.resources.set(type, 0);
        });
        console.log('ResourceManager initialized');
    }

    /**
     * 获取指定资源的数量
     * @param resourceType 资源类型
     * @returns 资源数量
     */
    public getResource(resourceType: string): number {
        return this.resources.get(resourceType) || 0;
    }

    /**
     * 添加资源
     * @param resourceType 资源类型
     * @param amount 数量
     */
    public addResource(resourceType: string, amount: number): void {
        if (!this.resources.has(resourceType)) {
            console.warn(`Unknown resource type: ${resourceType}`);
            return;
        }

        const currentAmount = this.resources.get(resourceType) || 0;
        const newAmount = Math.max(0, currentAmount + amount);
        this.resources.set(resourceType, newAmount);
        
        console.log(`Added ${amount} ${resourceType}, total: ${newAmount}`);
        this.notifyListeners();
    }

    /**
     * 消费资源
     * @param resourceType 资源类型
     * @param amount 数量
     * @returns 是否成功消费
     */
    public consumeResource(resourceType: string, amount: number): boolean {
        if (!this.resources.has(resourceType)) {
            console.warn(`Unknown resource type: ${resourceType}`);
            return false;
        }

        const currentAmount = this.resources.get(resourceType) || 0;
        if (currentAmount < amount) {
            console.warn(`Not enough ${resourceType}: need ${amount}, have ${currentAmount}`);
            return false;
        }

        this.resources.set(resourceType, currentAmount - amount);
        console.log(`Consumed ${amount} ${resourceType}, remaining: ${currentAmount - amount}`);
        this.notifyListeners();
        return true;
    }

    /**
     * 批量消费资源
     * @param costs 资源成本对象 {resourceType: amount}
     * @returns 是否成功消费
     */
    public consumeResources(costs: { [key: string]: number }): boolean {
        // 先检查是否有足够的资源
        for (const [resourceType, amount] of Object.entries(costs)) {
            if (!this.hasEnoughResource(resourceType, amount)) {
                console.warn(`Not enough resources for purchase`);
                return false;
            }
        }

        // 执行消费
        for (const [resourceType, amount] of Object.entries(costs)) {
            this.consumeResource(resourceType, amount);
        }

        return true;
    }

    /**
     * 检查是否有足够的资源
     * @param resourceType 资源类型
     * @param amount 数量
     * @returns 是否足够
     */
    public hasEnoughResource(resourceType: string, amount: number): boolean {
        const currentAmount = this.resources.get(resourceType) || 0;
        return currentAmount >= amount;
    }

    /**
     * 检查是否有足够的资源（批量）
     * @param costs 资源成本对象
     * @returns 是否足够
     */
    public hasEnoughResources(costs: { [key: string]: number }): boolean {
        for (const [resourceType, amount] of Object.entries(costs)) {
            if (!this.hasEnoughResource(resourceType, amount)) {
                return false;
            }
        }
        return true;
    }

    /**
     * 获取指定资源的数量
     * @param resourceType 资源类型
     * @returns 资源数量
     */
    public getResourceAmount(resourceType: string): number {
        return this.resources.get(resourceType) || 0;
    }

    /**
     * 获取所有资源
     * @returns 资源映射
     */
    public getAllResources(): Map<string, number> {
        return new Map(this.resources);
    }

    /**
     * 设置资源数量（主要用于调试）
     * @param resourceType 资源类型
     * @param amount 数量
     */
    public setResourceAmount(resourceType: string, amount: number): void {
        if (!this.resources.has(resourceType)) {
            console.warn(`Unknown resource type: ${resourceType}`);
            return;
        }

        this.resources.set(resourceType, Math.max(0, amount));
        console.log(`Set ${resourceType} to ${amount}`);
        this.notifyListeners();
    }

    /**
     * 重置所有资源
     */
    public resetResources(): void {
        ResourceManager.RESOURCE_TYPES.forEach(type => {
            this.resources.set(type, 0);
        });
        console.log('All resources reset');
        this.notifyListeners();
    }

    /**
     * 添加资源变化监听器
     * @param listener 监听器函数
     */
    public addListener(listener: (resources: Map<string, number>) => void): void {
        this.listeners.push(listener);
    }

    /**
     * 移除资源变化监听器
     * @param listener 监听器函数
     */
    public removeListener(listener: (resources: Map<string, number>) => void): void {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * 通知所有监听器
     */
    private notifyListeners(): void {
        const resourcesCopy = this.getAllResources();
        this.listeners.forEach(listener => {
            try {
                listener(resourcesCopy);
            } catch (error) {
                console.error('Error in resource listener:', error);
            }
        });
    }

    /**
     * 获取资源显示名称
     * @param resourceType 资源类型
     * @returns 显示名称
     */
    public getResourceDisplayName(resourceType: string): string {
        const names: { [key: string]: string } = {
            'gold': '金币',
            'wood': '木头',
            'stone': '石头',
            'mithril': '秘银',
            'food': '食物'
        };
        return names[resourceType] || resourceType;
    }

    /**
     * 获取资源显示颜色
     * @param resourceType 资源类型
     * @returns 颜色值
     */
    public getResourceColor(resourceType: string): number {
        const colors: { [key: string]: number } = {
            'gold': 0xFFD700,
            'wood': 0x8B4513,
            'stone': 0x696969,
            'mithril': 0xC0C0C0,
            'food': 0x32CD32
        };
        return colors[resourceType] || 0xFFFFFF;
    }

    /**
     * 获取当前资源状态的字符串表示（调试用）
     */
    public getResourcesString(): string {
        const parts: string[] = [];
        this.resources.forEach((amount, type) => {
            parts.push(`${this.getResourceDisplayName(type)}: ${amount}`);
        });
        return parts.join(', ');
    }
}

// 导出单例实例
export const resourceManager = ResourceManager.getInstance();