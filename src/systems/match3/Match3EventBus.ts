/**
 * Match3系统事件定义
 */
export interface Match3Events {
    // 单元格事件
    'cell-clicked': { cell: any };
    'cell-selected': { cell: any };
    'cell-deselected': { cell: any };
    
    // 匹配事件
    'match-attempted': { cell1: any; cell2: any };
    'match-success': { cell1: any; cell2: any; path: { x: number; y: number }[] };
    'match-failed': { cell1: any; cell2: any };
    
    // 消除事件
    'cells-eliminated': { cells: any[]; resourceType: string };
    
    // 资源事件
    'resource-created': { id: string; resourceType: string; position: { x: number; y: number } };
    'resource-available-for-collection': { 
        resourceType: string; 
        position: { x: number; y: number };
        resource: any;
    };
    
    // 网格事件
    'grid-refreshed': void;
}

/**
 * Match3事件总线
 * 使用类型安全的事件系统
 */
export class Match3EventBus {
    private events: Map<keyof Match3Events, Set<Function>> = new Map();
    
    /**
     * 监听事件
     */
    public on<K extends keyof Match3Events>(
        event: K,
        handler: (data: Match3Events[K]) => void
    ): void {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event)!.add(handler);
    }
    
    /**
     * 取消监听事件
     */
    public off<K extends keyof Match3Events>(
        event: K,
        handler: (data: Match3Events[K]) => void
    ): void {
        const handlers = this.events.get(event);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.events.delete(event);
            }
        }
    }
    
    /**
     * 触发事件
     */
    public emit<K extends keyof Match3Events>(
        event: K,
        data: Match3Events[K]
    ): void {
        const handlers = this.events.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`[Match3EventBus] 事件处理器错误 - 事件: ${event}`, error);
                }
            });
        }
    }
    
    /**
     * 移除所有监听器
     */
    public removeAllListeners(): void {
        this.events.clear();
    }
    
    /**
     * 获取事件监听器数量（用于调试）
     */
    public getListenerCount(event?: keyof Match3Events): number {
        if (event) {
            return this.events.get(event)?.size || 0;
        }
        
        let total = 0;
        for (const handlers of this.events.values()) {
            total += handlers.size;
        }
        return total;
    }
}