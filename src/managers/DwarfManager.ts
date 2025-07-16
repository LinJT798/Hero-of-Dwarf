import { Dwarf, DwarfState, TaskType, TaskPriority, DwarfTask } from '../entities/Dwarf';
import { WorldTaskManager } from './WorldTaskManager';

/**
 * 矮人管理器 - 支持新状态机架构
 * 负责管理所有矮人NPC的创建和协调
 * 集成WorldTaskManager进行资源管理
 */
export class DwarfManager {
    private scene: Phaser.Scene;
    private container: Phaser.GameObjects.Container;
    private dwarfs: Map<string, Dwarf> = new Map();
    private nextDwarfId = 1;
    private worldTaskMgr!: WorldTaskManager;
    
    // 矮人生成配置 (基于Figma设计调整)
    private readonly MAX_DWARFS = 3;
    private readonly SPAWN_POSITIONS = [
        { x: 100, y: 789 },  // 地面位置 (y=789是land的上边界)
        { x: 200, y: 789 },  
        { x: 300, y: 789 }   
    ];

    constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
        this.scene = scene;
        this.container = container;
        
        this.initialize();
    }

    /**
     * 初始化矮人管理器
     */
    private initialize(): void {
        this.worldTaskMgr = WorldTaskManager.getInstance();
        this.setupEventListeners();
        this.spawnInitialDwarfs();
        
        console.log('DwarfManager initialized with new state machine');
    }

    /**
     * 设置事件监听
     */
    private setupEventListeners(): void {
        this.scene.events.on('resource-landed', this.handleResourceLanded, this);
        this.scene.events.on('building-purchased', this.handleBuildingRequest, this);
        this.scene.events.on('dwarf-killed', this.handleDwarfKilled, this);
        
        // resource-drop事件已废弃，资源现在直接在ResourceDropSystem中注册
    }

    /**
     * 生成初始矮人
     */
    private spawnInitialDwarfs(): void {
        for (let i = 0; i < this.MAX_DWARFS; i++) {
            this.spawnDwarf(this.SPAWN_POSITIONS[i]);
        }
    }

    /**
     * 生成矮人
     */
    private spawnDwarf(position: { x: number; y: number }): Dwarf {
        const dwarfId = `dwarf_${this.nextDwarfId++}`;
        const dwarf = new Dwarf(this.scene, dwarfId, position.x, position.y);
        
        // 添加矮人精灵到容器
        const dwarfSprite = dwarf.getSprite();
        if (dwarfSprite) {
            this.container.add(dwarfSprite);
        }
        
        // 添加血条到容器
        const healthBarObjects = dwarf.getHealthBarObjects();
        healthBarObjects.forEach(obj => {
            this.container.add(obj);
        });
        
        this.dwarfs.set(dwarfId, dwarf);
        
        console.log(`Spawned dwarf: ${dwarfId} at (${position.x}, ${position.y})`);
        return dwarf;
    }


    /**
     * 处理资源落地事件（资源到达地面后）
     */
    private handleResourceLanded(data: { resourceType: string; position: any; resource: any }): void {
        console.log('[DwarfManager] 资源已落地并稳定:', data.resourceType, data.position);
        
        // 资源已经在ResourceDropSystem中注册到WorldTaskManager，这里不需要重复注册
        // 只需要通知矮人们有新资源可以收集
    }
    
    /**
     * 处理矮人死亡事件
     */
    private handleDwarfKilled(data: { dwarfId: string; dwarf: any; position: { x: number; y: number } }): void {
        console.log(`[DwarfManager] 处理矮人死亡: ${data.dwarfId}`);
        
        const dwarf = this.dwarfs.get(data.dwarfId);
        if (dwarf) {
            // 只从Map中移除，不立即销毁
            // 让矮人自己在死亡动画播放完成后销毁
            this.dwarfs.delete(data.dwarfId);
            
            console.log(`[DwarfManager] 矮人 ${data.dwarfId} 已从管理器中移除，等待其自行销毁`);
            
            // 不再重新生成矮人
            console.log(`[DwarfManager] 剩余矮人数量: ${this.dwarfs.size}`);
            
            // 如果所有矮人都死亡，可以触发游戏失败事件
            if (this.dwarfs.size === 0) {
                console.log('[DwarfManager] 所有矮人都已死亡！');
                this.scene.events.emit('all-dwarfs-dead');
            }
        }
    }
    
    /**
     * 处理资源掉落事件（已废弃）
     */
    private handleResourceDrop(data: { resourceType: string; position: any; resource: any }): void {
        // 此方法已废弃，资源现在在ResourceDropSystem中管理
        console.warn('[DwarfManager] handleResourceDrop已废弃，不应该被调用');
    }

    /**
     * 处理建造请求事件
     */
    private handleBuildingRequest(data: { productId: string; productType: string; productName: string }): void {
        // 当前版本建筑由BuildingManager自动处理
        // 这里可以添加矮人参与建造的逻辑
        console.log(`DwarfManager received building request: ${data.productName}`);
        
        // 可以在这里分配建造任务给空闲的矮人
        // const availableDwarf = this.findIdleDwarf();
        // if (availableDwarf) {
        //     availableDwarf.assignBuildingTask(data.productType, buildingPosition);
        // }
    }


    /**
     * 寻找空闲的矮人
     */
    private findIdleDwarf(): Dwarf | null {
        for (const dwarf of this.dwarfs.values()) {
            if (dwarf.isIdle()) {
                return dwarf;
            }
        }
        return null;
    }

    /**
     * 获取所有空闲矮人
     */
    public getIdleDwarfs(): Dwarf[] {
        return Array.from(this.dwarfs.values()).filter(dwarf => dwarf.isIdle());
    }

    /**
     * 获取所有忙碌矮人
     */
    public getBusyDwarfs(): Dwarf[] {
        return Array.from(this.dwarfs.values()).filter(dwarf => !dwarf.isIdle());
    }

    /**
     * 计算两点之间的距离
     */
    private getDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 分配特定任务给矮人
     */
    public assignTaskToDwarf(dwarfId: string, taskType: TaskType, targetPosition: { x: number; y: number }, additionalData?: any): boolean {
        const dwarf = this.dwarfs.get(dwarfId);
        if (!dwarf || !dwarf.isIdle()) {
            return false;
        }

        switch (taskType) {
            case TaskType.COLLECT_RESOURCE:
                if (additionalData?.resourceType) {
                    dwarf.assignCollectionTask(additionalData.resourceType, targetPosition);
                    return true;
                }
                break;
            case TaskType.BUILD_STRUCTURE:
                if (additionalData?.buildingType) {
                    dwarf.assignBuildingTask(additionalData.buildingType, targetPosition);
                    return true;
                }
                break;
        }

        return false;
    }

    /**
     * 获取矮人状态统计
     */
    public getDwarfStats(): { [key: string]: number } {
        const stats: { [key: string]: number } = {};
        
        // 初始化所有状态计数
        Object.values(DwarfState).forEach(state => {
            stats[state] = 0;
        });
        
        // 统计每个状态的矮人数量
        this.dwarfs.forEach(dwarf => {
            const state = dwarf.getState();
            stats[state]++;
        });
        
        return stats;
    }

    /**
     * 获取所有矮人
     */
    public getAllDwarfs(): Dwarf[] {
        return Array.from(this.dwarfs.values());
    }

    /**
     * 获取矮人数量
     */
    public getDwarfCount(): number {
        return this.dwarfs.size;
    }

    /**
     * 移除矮人
     */
    public removeDwarf(dwarfId: string): boolean {
        const dwarf = this.dwarfs.get(dwarfId);
        if (!dwarf) {
            return false;
        }

        dwarf.destroy();
        this.dwarfs.delete(dwarfId);
        
        console.log(`Removed dwarf: ${dwarfId}`);
        return true;
    }

    /**
     * 添加新矮人
     */
    public addDwarf(position: { x: number; y: number }): Dwarf | null {
        if (this.dwarfs.size >= this.MAX_DWARFS) {
            console.warn('Cannot add more dwarfs, max limit reached');
            return null;
        }

        return this.spawnDwarf(position);
    }

    /**
     * 更新所有矮人和任务管理器
     */
    public update(delta: number): void {
        // 更新WorldTaskManager
        this.worldTaskMgr.update(delta);
        
        // 更新所有矮人，并移除死亡的矮人
        const deadDwarfs: string[] = [];
        this.dwarfs.forEach((dwarf, id) => {
            if (dwarf.isAlive()) {
                dwarf.update(delta);
            } else {
                // 记录死亡的矮人ID
                deadDwarfs.push(id);
            }
        });
        
        // 清理死亡的矮人（如果死亡事件没有正确触发的备用方案）
        deadDwarfs.forEach(id => {
            const dwarf = this.dwarfs.get(id);
            if (dwarf) {
                console.warn(`[DwarfManager] 发现死亡矮人 ${id} 未被正确清理，从管理器中移除`);
                this.dwarfs.delete(id);
                // 不调用destroy，让矮人自己在死亡动画播放完成后销毁
            }
        });
        
        // 自动清理已收集的资源
        this.cleanupCollectedResources();
    }


    /**
     * 获取矮人管理器状态信息（调试用）
     */
    public getStatusInfo(): string {
        const stats = this.getDwarfStats();
        const parts: string[] = [];
        
        parts.push(`矮人总数: ${this.getDwarfCount()}`);
        parts.push(`空闲: ${stats[DwarfState.IDLE] || 0}`);
        parts.push(`收集: ${stats[DwarfState.GATHER] || 0}`);
        parts.push(`交付: ${stats[DwarfState.DELIVER] || 0}`);
        parts.push(`建造: ${stats[DwarfState.BUILD] || 0}`);
        parts.push(`战斗: ${stats[DwarfState.COMBAT] || 0}`);
        
        // 添加WorldTaskManager状态信息
        parts.push(`任务系统: ${this.worldTaskMgr.getStatusInfo()}`);
        
        return parts.join(', ');
    }

    /**
     * 清理已收集的资源
     */
    private cleanupCollectedResources(): void {
        const match3Grid = (this.scene as any).match3Grid;
        if (!match3Grid) return;
        
        const droppedResources = match3Grid.getDroppedResources();
        for (const resource of droppedResources) {
            if (resource.getIsCollected()) {
                // 从WorldTaskManager中移除已收集的资源
                const resourceId = resource.id || this.generateResourceId(resource);
                this.worldTaskMgr.removeResource(resourceId);
            }
        }
    }
    
    /**
     * 生成资源ID（用于清理）
     */
    private generateResourceId(resource: any): string {
        const pos = resource.getPosition();
        return `resource_${Math.round(pos.x)}_${Math.round(pos.y)}`;
    }
    
    /**
     * 销毁管理器
     */
    public destroy(): void {
        this.scene.events.off('resource-landed', this.handleResourceLanded, this);
        this.scene.events.off('building-purchased', this.handleBuildingRequest, this);
        this.scene.events.off('dwarf-killed', this.handleDwarfKilled, this);
        // resource-drop事件已废弃
        
        // 清理WorldTaskManager
        this.worldTaskMgr.clear();
        
        this.dwarfs.forEach(dwarf => {
            dwarf.destroy();
        });
        
        this.dwarfs.clear();
        console.log('DwarfManager destroyed');
    }
}