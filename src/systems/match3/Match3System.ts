import { Match3Grid } from '@/entities/match3/Match3Grid';
import { ResourceDropSystem } from './ResourceDropSystem';
import { Match3EventBus } from './Match3EventBus';
import { WorldTaskManager } from '@/managers/WorldTaskManager';

/**
 * 连连看系统主控制器
 * 协调网格、资源掉落和事件处理
 */
export class Match3System {
    private static instance: Match3System | null = null;
    
    private scene: Phaser.Scene;
    private container: Phaser.GameObjects.Container;
    private grid: Match3Grid | null = null;
    private resourceDropSystem: ResourceDropSystem | null = null;
    private eventBus: Match3EventBus;
    private worldTaskManager: WorldTaskManager;
    
    private constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
        this.scene = scene;
        this.container = container;
        this.eventBus = new Match3EventBus();
        this.worldTaskManager = WorldTaskManager.getInstance();
    }
    
    /**
     * 获取单例实例
     */
    public static getInstance(scene?: Phaser.Scene, container?: Phaser.GameObjects.Container): Match3System {
        if (!Match3System.instance) {
            if (!scene || !container) {
                throw new Error('Match3System: 首次初始化需要提供scene和container');
            }
            Match3System.instance = new Match3System(scene, container);
        }
        return Match3System.instance;
    }
    
    /**
     * 初始化系统
     */
    public initialize(): void {
        console.log('[Match3System] 初始化连连看系统');
        
        // 初始化资源掉落系统
        this.resourceDropSystem = new ResourceDropSystem(this.scene, this.container, this.worldTaskManager);
        
        // 初始化网格
        this.grid = new Match3Grid(
            this.scene, 
            this.container,
            this.eventBus,
            this.resourceDropSystem
        );
        
        // 设置事件监听
        this.setupEventListeners();
        
        console.log('[Match3System] 系统初始化完成');
    }
    
    /**
     * 设置事件监听
     */
    private setupEventListeners(): void {
        // 监听匹配成功事件
        this.eventBus.on('match-success', (data: any) => {
            console.log('[Match3System] 匹配成功:', data);
            // 通知场景层
            this.scene.events.emit('match3-match-success', data);
        });
        
        // 监听资源可收集事件
        this.eventBus.on('resource-available-for-collection', (data: any) => {
            console.log('[Match3System] 资源可收集:', data);
            // 事件已经在ResourceDropSystem中直接触发，这里不需要重复
        });
        
        // 监听网格刷新事件
        this.eventBus.on('grid-refreshed', () => {
            console.log('[Match3System] 网格已刷新');
            this.scene.events.emit('grid-refreshed');
        });
    }
    
    /**
     * 更新系统
     */
    public update(delta: number): void {
        // 更新资源掉落系统
        if (this.resourceDropSystem) {
            this.resourceDropSystem.update(delta);
        }
    }
    
    /**
     * 获取网格状态（用于调试）
     */
    public getGridState(): any {
        return this.grid?.getGridState() || null;
    }
    
    /**
     * 获取掉落资源数量（用于调试）
     */
    public getDroppedResourceCount(): number {
        return this.resourceDropSystem?.getResourceCount() || 0;
    }
    
    /**
     * 销毁系统
     */
    public destroy(): void {
        console.log('[Match3System] 销毁系统');
        
        // 移除事件监听
        this.eventBus.removeAllListeners();
        
        // 销毁子系统
        if (this.grid) {
            this.grid.destroy();
            this.grid = null;
        }
        
        if (this.resourceDropSystem) {
            this.resourceDropSystem.destroy();
            this.resourceDropSystem = null;
        }
        
        // 清除单例
        Match3System.instance = null;
    }
}