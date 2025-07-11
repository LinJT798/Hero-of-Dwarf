/**
 * 全局任务管理器 - WorldTaskMgr
 * 管理资源锁定、建筑锁定和TTL回收机制
 * 实现去中心化CAS锁机制
 */
export class WorldTaskManager {
    private static instance: WorldTaskManager;
    private resources: Map<string, ResourceNode> = new Map();
    private buildSites: Map<string, BuildSite> = new Map();
    
    // 配置参数
    private readonly BASE_TTL = 10000; // 10秒基础TTL (ms)
    private readonly UPDATE_INTERVAL = 100; // 100ms更新间隔
    
    private lastUpdate: number = 0;

    private constructor() {}

    static getInstance(): WorldTaskManager {
        if (!WorldTaskManager.instance) {
            WorldTaskManager.instance = new WorldTaskManager();
        }
        return WorldTaskManager.instance;
    }

    /**
     * 更新任务管理器 - TTL递减与回收
     */
    public update(delta: number): void {
        this.lastUpdate += delta;
        
        if (this.lastUpdate >= this.UPDATE_INTERVAL) {
            this.updateResourceTTL(this.lastUpdate);
            this.updateBuildSiteTTL(this.lastUpdate);
            this.lastUpdate = 0;
        }
    }

    // =================== 资源任务分配系统 ===================

    /**
     * 注册资源节点
     */
    public registerResource(resource: any): void {
        // 如果资源没有id，生成一个
        if (!resource.id) {
            resource.id = this.generateResourceId(resource);
        }
        
        const resourceNode: ResourceNode = {
            id: resource.id,
            position: resource.getPosition(),
            claimedBy: null,
            claimTTL: 0,
            resourceRef: resource
        };
        
        this.resources.set(resourceNode.id, resourceNode);
        console.log(`[WorldTaskMgr] 注册资源: ${resourceNode.id}`);
    }

    /**
     * 尝试锁定资源 - CAS操作
     */
    public tryLockResource(resourceId: string, dwarfId: string): boolean {
        const resource = this.resources.get(resourceId);
        if (!resource) {
            console.log(`[WorldTaskMgr] 尝试锁定资源 ${resourceId} 失败：资源不存在于管理器中`);
            console.log(`[WorldTaskMgr] 当前注册的资源ID列表: ${Array.from(this.resources.keys()).join(', ')}`);
            return false;
        }

        // 原子性CAS操作 - 只有当前未被锁定时才能锁定
        if (resource.claimedBy === null) {
            resource.claimedBy = dwarfId;
            resource.claimTTL = this.BASE_TTL;
            
            console.log(`[WorldTaskMgr] 资源 ${resourceId} 被矮人 ${dwarfId} 锁定`);
            return true;
        }
        
        console.log(`[WorldTaskMgr] 资源 ${resourceId} 已被 ${resource.claimedBy} 锁定`);
        return false;
    }

    /**
     * 释放资源锁定
     */
    public releaseResourceLock(resourceId: string): void {
        const resource = this.resources.get(resourceId);
        if (resource) {
            const previousOwner = resource.claimedBy;
            resource.claimedBy = null;
            resource.claimTTL = 0;
            
            if (previousOwner) {
                console.log(`[WorldTaskMgr] 资源 ${resourceId} 的锁定被释放 (之前被 ${previousOwner} 锁定)`);
            }
        }
    }

    /**
     * 移除资源节点
     */
    public removeResource(resourceId: string): void {
        this.resources.delete(resourceId);
        console.log(`[WorldTaskMgr] 移除资源: ${resourceId}`);
    }

    /**
     * 获取可用资源列表
     */
    public getAvailableResources(): ResourceNode[] {
        return Array.from(this.resources.values())
            .filter(resource => 
                resource.claimedBy === null && 
                resource.resourceRef && 
                !resource.resourceRef.getIsCollected() &&
                resource.resourceRef.isStable()
            );
    }

    /**
     * 根据ID获取资源
     */
    public getResourceById(resourceId: string): any {
        const resource = this.resources.get(resourceId);
        return resource ? resource.resourceRef : null;
    }

    /**
     * 更新资源TTL
     */
    private updateResourceTTL(delta: number): void {
        for (const [resourceId, resource] of this.resources.entries()) {
            if (resource.claimedBy !== null) {
                resource.claimTTL -= delta;
                
                // TTL过期，自动释放锁定
                if (resource.claimTTL <= 0) {
                    console.log(`[WorldTaskMgr] 资源 ${resourceId} TTL过期，自动释放锁定 (之前被 ${resource.claimedBy} 锁定)`);
                    resource.claimedBy = null;
                    resource.claimTTL = 0;
                }
            }
            
            // 如果资源已被收集或不存在，移除节点
            if (!resource.resourceRef || resource.resourceRef.getIsCollected()) {
                this.resources.delete(resourceId);
                console.log(`[WorldTaskMgr] 自动移除已收集的资源: ${resourceId}`);
            }
        }
    }

    // =================== 建筑任务分配系统 ===================

    /**
     * 注册建筑地点
     */
    public registerBuildSite(buildSite: any): void {
        const buildSiteNode: BuildSite = {
            id: buildSite.id || this.generateBuildSiteId(buildSite),
            position: buildSite.getPosition(),
            isCompleted: buildSite.isCompleted || false,
            claimedBy: null,
            claimTTL: 0,
            progress: buildSite.progress || 0,
            buildSiteRef: buildSite
        };
        
        this.buildSites.set(buildSiteNode.id, buildSiteNode);
        console.log(`[WorldTaskMgr] 注册建筑地点: ${buildSiteNode.id}`);
    }

    /**
     * 尝试锁定建筑地点 - CAS操作
     */
    public tryLockBuildSite(buildSiteId: string, dwarfId: string): boolean {
        const buildSite = this.buildSites.get(buildSiteId);
        if (!buildSite) return false;

        // 原子性CAS操作 - 只有当前未被锁定且未完成时才能锁定
        if (buildSite.claimedBy === null && !buildSite.isCompleted) {
            buildSite.claimedBy = dwarfId;
            buildSite.claimTTL = this.BASE_TTL;
            
            console.log(`[WorldTaskMgr] 建筑地点 ${buildSiteId} 被矮人 ${dwarfId} 锁定`);
            return true;
        }
        
        return false;
    }

    /**
     * 释放建筑地点锁定
     */
    public releaseBuildSiteLock(buildSiteId: string): void {
        const buildSite = this.buildSites.get(buildSiteId);
        if (buildSite) {
            const previousOwner = buildSite.claimedBy;
            buildSite.claimedBy = null;
            buildSite.claimTTL = 0;
            
            if (previousOwner) {
                console.log(`[WorldTaskMgr] 建筑地点 ${buildSiteId} 的锁定被释放 (之前被 ${previousOwner} 锁定)`);
            }
        }
    }

    /**
     * 标记建筑地点为完成
     */
    public completeBuildSite(buildSiteId: string): void {
        const buildSite = this.buildSites.get(buildSiteId);
        if (buildSite) {
            buildSite.isCompleted = true;
            buildSite.progress = 1.0;
            buildSite.claimedBy = null;
            buildSite.claimTTL = 0;
            
            console.log(`[WorldTaskMgr] 建筑地点 ${buildSiteId} 已完成`);
        }
    }

    /**
     * 获取可用建筑地点列表
     */
    public getBuildSites(): BuildSite[] {
        return Array.from(this.buildSites.values());
    }

    /**
     * 根据ID获取建筑地点
     */
    public getBuildSiteById(buildSiteId: string): BuildSite | null {
        return this.buildSites.get(buildSiteId) || null;
    }

    /**
     * 更新建筑地点TTL
     */
    private updateBuildSiteTTL(delta: number): void {
        for (const [buildSiteId, buildSite] of this.buildSites.entries()) {
            if (buildSite.claimedBy !== null) {
                buildSite.claimTTL -= delta;
                
                // TTL过期，自动释放锁定
                if (buildSite.claimTTL <= 0) {
                    console.log(`[WorldTaskMgr] 建筑地点 ${buildSiteId} TTL过期，自动释放锁定 (之前被 ${buildSite.claimedBy} 锁定)`);
                    buildSite.claimedBy = null;
                    buildSite.claimTTL = 0;
                }
            }
        }
    }

    // =================== 辅助方法 ===================

    /**
     * 生成资源ID
     */
    private generateResourceId(resource: any): string {
        const pos = resource.getPosition();
        return `resource_${Math.round(pos.x)}_${Math.round(pos.y)}_${Date.now()}`;
    }

    /**
     * 生成建筑地点ID
     */
    private generateBuildSiteId(buildSite: any): string {
        const pos = buildSite.getPosition();
        return `buildsite_${Math.round(pos.x)}_${Math.round(pos.y)}_${Date.now()}`;
    }

    /**
     * 获取系统状态信息（调试用）
     */
    public getStatusInfo(): string {
        const resourceCount = this.resources.size;
        const lockedResources = Array.from(this.resources.values()).filter(r => r.claimedBy !== null).length;
        const buildSiteCount = this.buildSites.size;
        const lockedBuildSites = Array.from(this.buildSites.values()).filter(b => b.claimedBy !== null).length;
        
        return `资源: ${resourceCount} (锁定: ${lockedResources}), 建筑: ${buildSiteCount} (锁定: ${lockedBuildSites})`;
    }

    /**
     * 清理所有数据
     */
    public clear(): void {
        this.resources.clear();
        this.buildSites.clear();
        console.log(`[WorldTaskMgr] 清理所有任务数据`);
    }
}

/**
 * 资源节点接口
 */
export interface ResourceNode {
    id: string;
    position: { x: number; y: number };
    claimedBy: string | null;
    claimTTL: number;
    resourceRef: any; // 对实际资源对象的引用
}

/**
 * 建筑地点接口
 */
export interface BuildSite {
    id: string;
    position: { x: number; y: number };
    isCompleted: boolean;
    claimedBy: string | null;
    claimTTL: number;
    progress: number; // 0.0 - 1.0
    buildSiteRef: any; // 对实际建筑地点对象的引用
}