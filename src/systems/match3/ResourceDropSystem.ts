import { WorldTaskManager } from '@/managers/WorldTaskManager';

/**
 * 资源状态枚举
 */
export enum ResourceState {
    FALLING = 'falling',      // 掉落中
    LANDED = 'landed',        // 已落地但未稳定
    STABLE = 'stable',        // 稳定可收集
    COLLECTED = 'collected',  // 已被收集
    DESTROYED = 'destroyed'   // 已销毁
}

/**
 * 掉落资源数据
 */
export interface DroppedResourceData {
    id: string;
    resourceType: string;
    sprite: Phaser.GameObjects.Image;
    state: ResourceState;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    hasLanded: boolean;
    stableTime: number;  // 稳定持续时间
}

/**
 * 资源掉落系统
 * 统一管理所有掉落资源的物理模拟和生命周期
 */
export class ResourceDropSystem {
    private scene: Phaser.Scene;
    private container: Phaser.GameObjects.Container;
    private worldTaskManager: WorldTaskManager;
    private resources: Map<string, DroppedResourceData> = new Map();
    
    // 物理参数
    private readonly GRAVITY = 800;              // 重力加速度 (像素/秒²)
    private readonly BOUNCE_DECAY = 0.5;         // 反弹衰减系数
    private readonly GROUND_Y = 789;             // 地面Y坐标
    private readonly RESOURCE_SIZE = 30;         // 资源大小
    private readonly STABLE_THRESHOLD = 100;     // 稳定判断阈值（毫秒）
    private readonly MIN_VELOCITY = 2;           // 最小速度阈值
    
    constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container, worldTaskManager: WorldTaskManager) {
        this.scene = scene;
        this.container = container;
        this.worldTaskManager = worldTaskManager;
    }
    
    /**
     * 创建掉落资源
     */
    public createResource(x: number, y: number, resourceType: string): string {
        // 生成唯一ID
        const id = `resource_${x.toFixed(0)}_${y.toFixed(0)}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 创建精灵
        const resourceKey = resourceType === 'gold' ? 'coin' : resourceType;
        const sprite = this.scene.add.image(x, y, resourceKey);
        sprite.setDisplaySize(this.RESOURCE_SIZE, this.RESOURCE_SIZE);
        sprite.setDepth(5);
        this.container.add(sprite);
        
        // 创建资源数据
        const resource: DroppedResourceData = {
            id,
            resourceType,
            sprite,
            state: ResourceState.FALLING,
            position: { x, y },
            velocity: {
                x: (Math.random() - 0.5) * 50,  // 随机水平速度 (-25 到 25)
                y: 0                             // 初始垂直速度为0
            },
            hasLanded: false,
            stableTime: 0
        };
        
        this.resources.set(id, resource);
        
        console.log(`[ResourceDropSystem] 创建资源 - ID: ${id}, 类型: ${resourceType}, 位置: (${x.toFixed(0)}, ${y.toFixed(0)})`);
        
        return id;
    }
    
    /**
     * 更新所有资源
     */
    public update(delta: number): void {
        const deltaSeconds = delta / 1000;
        
        for (const [id, resource] of this.resources) {
            if (resource.state === ResourceState.FALLING || resource.state === ResourceState.LANDED) {
                this.updatePhysics(resource, deltaSeconds, delta);
            }
        }
    }
    
    /**
     * 更新资源物理
     */
    private updatePhysics(resource: DroppedResourceData, deltaSeconds: number, deltaMs: number): void {
        // 应用重力
        resource.velocity.y += this.GRAVITY * deltaSeconds;
        
        // 更新位置
        const newX = resource.position.x + resource.velocity.x * deltaSeconds;
        const newY = resource.position.y + resource.velocity.y * deltaSeconds;
        
        resource.position.x = newX;
        resource.sprite.setX(newX);
        
        const targetY = this.GROUND_Y - this.RESOURCE_SIZE / 2;
        
        // 检查是否碰到地面
        if (newY >= targetY) {
            resource.position.y = targetY;
            resource.sprite.setY(targetY);
            
            if (!resource.hasLanded) {
                // 第一次落地
                resource.hasLanded = true;
                resource.state = ResourceState.LANDED;
                resource.velocity.y = -Math.abs(resource.velocity.y) * this.BOUNCE_DECAY;
                resource.velocity.x = (Math.random() - 0.5) * 30;
                console.log(`[ResourceDropSystem] 资源落地 - ID: ${resource.id}`);
            } else if (Math.abs(resource.velocity.y) > 50) {
                // 后续反弹
                resource.velocity.y = -Math.abs(resource.velocity.y) * this.BOUNCE_DECAY;
                resource.velocity.x *= 0.8;
            } else {
                // 停止垂直运动
                resource.velocity.y = 0;
                resource.velocity.x *= 0.8;
                
                // 检查是否稳定
                if (Math.abs(resource.velocity.x) < this.MIN_VELOCITY) {
                    resource.velocity.x = 0;
                    
                    // 累计稳定时间
                    resource.stableTime += deltaMs;
                    
                    // 达到稳定阈值
                    if (resource.stableTime >= this.STABLE_THRESHOLD && resource.state !== ResourceState.STABLE) {
                        resource.state = ResourceState.STABLE;
                        this.onResourceStable(resource);
                    }
                } else {
                    // 仍在移动，重置稳定时间
                    resource.stableTime = 0;
                }
            }
        } else {
            resource.position.y = newY;
            resource.sprite.setY(newY);
            // 在空中，重置稳定时间
            resource.stableTime = 0;
        }
    }
    
    /**
     * 资源稳定时的处理
     */
    private onResourceStable(resource: DroppedResourceData): void {
        console.log(`[ResourceDropSystem] 资源稳定 - ID: ${resource.id}, 类型: ${resource.resourceType}, 位置: (${resource.position.x.toFixed(0)}, ${resource.position.y.toFixed(0)})`);
        
        // 创建兼容的资源对象
        const compatibleResource = {
            id: resource.id,
            resourceType: resource.resourceType,
            position: { ...resource.position },
            claimedBy: null as string | null,
            claimTime: 0,
            hasLanded: true,
            
            // 位置和类型方法
            getPosition: () => ({ ...resource.position }),
            getResourceType: () => resource.resourceType,
            getIsCollected: () => resource.state === ResourceState.COLLECTED,
            
            // 稳定性检查
            isStable: () => resource.state === ResourceState.STABLE,
            
            // 认领机制
            claim: (dwarfId: string) => {
                if (resource.state === ResourceState.STABLE && !compatibleResource.claimedBy) {
                    compatibleResource.claimedBy = dwarfId;
                    compatibleResource.claimTime = Date.now();
                    console.log(`[ResourceDropSystem] 资源被认领 - ID: ${resource.id}, 矮人: ${dwarfId}`);
                    return true;
                }
                return false;
            },
            
            isClaimed: () => compatibleResource.claimedBy !== null,
            
            releaseClaim: () => {
                if (compatibleResource.claimedBy) {
                    console.log(`[ResourceDropSystem] 释放认领 - ID: ${resource.id}, 之前被: ${compatibleResource.claimedBy}`);
                    compatibleResource.claimedBy = null;
                    compatibleResource.claimTime = 0;
                }
            },
            
            // 收集方法
            collect: () => {
                if (resource.state === ResourceState.STABLE) {
                    resource.state = ResourceState.COLLECTED;
                    console.log(`[ResourceDropSystem] 资源被收集 - ID: ${resource.id}`);
                    // 延迟销毁，让动画有时间播放
                    this.scene.time.delayedCall(100, () => {
                        this.destroyResource(resource.id);
                    });
                    return true;
                }
                return false;
            },
            
            // 精灵引用（Dwarf可能需要）
            sprite: resource.sprite
        };
        
        // 注册到世界任务管理器
        this.worldTaskManager.registerResource(compatibleResource as any);
        
        // 触发可收集事件（修改为resource-landed以兼容现有系统）
        this.scene.events.emit('resource-landed', {
            resourceType: resource.resourceType,
            position: { ...resource.position },
            resource: compatibleResource
        });
    }
    
    /**
     * 销毁资源
     */
    public destroyResource(id: string): void {
        const resource = this.resources.get(id);
        if (!resource) return;
        
        // 从世界任务管理器移除
        this.worldTaskManager.removeResource(id);
        
        // 销毁精灵
        if (resource.sprite) {
            this.container.remove(resource.sprite);
            resource.sprite.destroy();
        }
        
        // 标记为已销毁并移除
        resource.state = ResourceState.DESTROYED;
        this.resources.delete(id);
        
        console.log(`[ResourceDropSystem] 资源已销毁 - ID: ${id}`);
    }
    
    /**
     * 获取资源数量
     */
    public getResourceCount(): number {
        return this.resources.size;
    }
    
    /**
     * 获取所有资源状态（用于调试）
     */
    public getAllResourceStates(): { id: string; type: string; state: ResourceState; position: { x: number; y: number } }[] {
        const states: any[] = [];
        for (const [id, resource] of this.resources) {
            states.push({
                id,
                type: resource.resourceType,
                state: resource.state,
                position: { ...resource.position }
            });
        }
        return states;
    }
    
    /**
     * 销毁系统
     */
    public destroy(): void {
        // 销毁所有资源
        const ids = Array.from(this.resources.keys());
        for (const id of ids) {
            this.destroyResource(id);
        }
        
        this.resources.clear();
    }
}