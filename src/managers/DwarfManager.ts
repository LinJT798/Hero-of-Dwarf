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
        
        // 监听资源掉落事件，自动注册到WorldTaskManager
        this.scene.events.on('resource-drop', this.handleResourceDrop, this);
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
        
        this.dwarfs.set(dwarfId, dwarf);
        
        console.log(`Spawned dwarf: ${dwarfId}`);
        return dwarf;
    }


    /**
     * 处理资源落地事件（资源到达地面后）
     */
    private handleResourceLanded(data: { resourceType: string; position: any; resource: any }): void {
        console.log('Resource landed:', data.resourceType, data.position);
        
        // 注册资源到WorldTaskManager
        if (data.resource && data.resource.isStable()) {
            this.worldTaskMgr.registerResource(data.resource);
        }
    }
    
    /**
     * 处理资源掉落事件
     */
    private handleResourceDrop(data: { resourceType: string; position: any; resource: any }): void {
        console.log(`[DwarfManager] 收到资源掉落事件: ${data.resourceType} at (${data.position.x}, ${data.position.y})`);
        
        // 立即注册资源，WorldTaskManager会处理稳定性检查
        if (data.resource) {
            this.worldTaskMgr.registerResource(data.resource);
            console.log(`[DwarfManager] 立即注册掉落资源: ${data.resourceType} with ID: ${data.resource.id}`);
        }
        
        // 额外的延迟检查，确保资源稳定后可以被感知
        setTimeout(() => {
            if (data.resource && data.resource.isStable()) {
                console.log(`[DwarfManager] 确认资源已稳定: ${data.resourceType} ID: ${data.resource.id}`);
            }
        }, 2000); // 2秒后确认
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
        
        // 更新所有矮人
        this.dwarfs.forEach(dwarf => {
            dwarf.update(delta);
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
        this.scene.events.off('resource-drop', this.handleResourceDrop, this);
        
        // 清理WorldTaskManager
        this.worldTaskMgr.clear();
        
        this.dwarfs.forEach(dwarf => {
            dwarf.destroy();
        });
        
        this.dwarfs.clear();
        console.log('DwarfManager destroyed');
    }
}