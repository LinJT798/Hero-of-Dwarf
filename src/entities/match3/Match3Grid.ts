import { Match3Cell } from './Match3Cell';
import { Match3EventBus } from '@/systems/match3/Match3EventBus';
import { ResourceDropSystem } from '@/systems/match3/ResourceDropSystem';
import { PathFinder } from '@/utils/match3/PathFinder';

/**
 * 新版连连看网格管理器
 * 只负责网格逻辑，不直接管理掉落资源
 */
export class Match3Grid {
    private scene: Phaser.Scene;
    private container: Phaser.GameObjects.Container;
    private eventBus: Match3EventBus;
    private resourceDropSystem: ResourceDropSystem;
    
    // 网格
    private grid: Match3Cell[][] = [];
    private selectedCells: Match3Cell[] = [];
    private pathFinder!: PathFinder;
    private pathLine: Phaser.GameObjects.Graphics | null = null;
    
    // 网格配置 (严格按照Figma设计)
    private readonly GRID_WIDTH = 9;  // 9列
    private readonly GRID_HEIGHT = 7; // 7行
    private readonly CELL_SIZE = 51;  // 单元格尺寸: 51×51px
    private readonly GRID_X = 469;    // Figma: map位置(469,90)
    private readonly GRID_Y = 90;
    
    // 可掉落的资源类型
    private readonly RESOURCE_TYPES = ['gold', 'wood', 'stone', 'mithril', 'food'];
    
    // 非资源方块类型（可消除但不掉落资源）
    private readonly NON_RESOURCE_TYPES = ['dirt', 'grass', 'lava', 'sand'];
    
    // 所有方块类型
    private readonly ALL_BLOCK_TYPES = [...this.RESOURCE_TYPES, ...this.NON_RESOURCE_TYPES];
    
    constructor(
        scene: Phaser.Scene,
        container: Phaser.GameObjects.Container,
        eventBus: Match3EventBus,
        resourceDropSystem: ResourceDropSystem
    ) {
        this.scene = scene;
        this.container = container;
        this.eventBus = eventBus;
        this.resourceDropSystem = resourceDropSystem;
        
        this.initialize();
    }
    
    /**
     * 初始化网格
     */
    private initialize(): void {
        this.createGrid();
        this.fillRandomResources();
        this.pathFinder = new PathFinder(this.grid);
        console.log('[Match3Grid] 网格初始化完成');
    }
    
    /**
     * 创建网格
     */
    private createGrid(): void {
        for (let row = 0; row < this.GRID_HEIGHT; row++) {
            this.grid[row] = [];
            
            for (let col = 0; col < this.GRID_WIDTH; col++) {
                const x = this.GRID_X + col * this.CELL_SIZE;
                const y = this.GRID_Y + row * this.CELL_SIZE;
                
                const cell = new Match3Cell(this.scene, this.container, row, col, x, y, this.CELL_SIZE);
                cell.setClickCallback(this.handleCellClick.bind(this));
                
                this.grid[row][col] = cell;
            }
        }
    }
    
    /**
     * 随机填充资源
     */
    private fillRandomResources(): void {
        const totalCells = this.GRID_WIDTH * this.GRID_HEIGHT; // 63
        const blocks: (string | null)[] = [];
        
        // 分配方案：9种方块，确保每种都是偶数个
        // 5种资源：各8个 = 40个
        // 4种非资源：各5个 = 20个  
        // 再加2个随机资源 = 62个方块 + 1个空格 = 63
        
        // 添加资源方块
        for (const resourceType of this.RESOURCE_TYPES) {
            for (let j = 0; j < 8; j++) {
                blocks.push(resourceType);
            }
        }
        
        // 添加非资源方块
        for (const nonResourceType of this.NON_RESOURCE_TYPES) {
            for (let j = 0; j < 5; j++) {
                blocks.push(nonResourceType);
            }
        }
        
        // 再添加2个随机资源确保总数为62
        blocks.push(this.RESOURCE_TYPES[0]); // gold
        blocks.push(this.RESOURCE_TYPES[0]); // gold
        
        // 添加一个空格
        blocks.push(null);
        
        // Fisher-Yates洗牌
        for (let i = blocks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
        }
        
        // 填充到网格
        let index = 0;
        for (let row = 0; row < this.GRID_HEIGHT; row++) {
            for (let col = 0; col < this.GRID_WIDTH; col++) {
                this.grid[row][col].setResource(blocks[index++]);
            }
        }
        
        console.log('[Match3Grid] 方块填充完成');
    }
    
    /**
     * 处理单元格点击
     */
    private handleCellClick(cell: Match3Cell): void {
        if (cell.isEmpty) return;
        
        // 触发点击事件
        this.eventBus.emit('cell-clicked', { cell });
        
        if (cell.isSelected) {
            // 取消选中
            cell.setSelected(false);
            this.removeFromSelection(cell);
            this.eventBus.emit('cell-deselected', { cell });
        } else {
            // 选中
            cell.setSelected(true);
            this.selectedCells.push(cell);
            this.eventBus.emit('cell-selected', { cell });
            
            // 检查匹配
            this.checkForMatch();
        }
    }
    
    /**
     * 从选中列表移除
     */
    private removeFromSelection(cell: Match3Cell): void {
        const index = this.selectedCells.indexOf(cell);
        if (index > -1) {
            this.selectedCells.splice(index, 1);
        }
    }
    
    /**
     * 检查匹配
     */
    private checkForMatch(): void {
        if (this.selectedCells.length === 2) {
            const [cell1, cell2] = this.selectedCells;
            
            // 触发尝试匹配事件
            this.eventBus.emit('match-attempted', { cell1, cell2 });
            
            // 检查资源类型
            if (cell1.resourceType === cell2.resourceType) {
                // 检查路径
                const path = this.pathFinder.findPath(cell1, cell2);
                if (path) {
                    // 匹配成功
                    this.showConnectionPath(path);
                    this.eventBus.emit('match-success', { cell1, cell2, path });
                    
                    // 延迟消除，让玩家看到路径
                    this.scene.time.delayedCall(300, () => {
                        this.eliminateCells([cell1, cell2]);
                    });
                } else {
                    // 无法连接
                    this.eventBus.emit('match-failed', { cell1, cell2 });
                    this.clearSelection();
                }
            } else {
                // 资源类型不同
                this.eventBus.emit('match-failed', { cell1, cell2 });
                this.clearSelection();
            }
        } else if (this.selectedCells.length > 2) {
            // 超过两个，清除所有
            this.clearSelection();
        }
    }
    
    /**
     * 显示连接路径
     */
    private showConnectionPath(path: { x: number; y: number }[]): void {
        this.clearPathLine();
        
        this.pathLine = this.scene.add.graphics();
        this.pathLine.lineStyle(3, 0xFF0000, 0.8);
        this.pathLine.setDepth(20);
        
        if (path.length >= 2) {
            this.pathLine.beginPath();
            this.pathLine.moveTo(path[0].x, path[0].y);
            
            for (let i = 1; i < path.length; i++) {
                this.pathLine.lineTo(path[i].x, path[i].y);
            }
            
            this.pathLine.strokePath();
        }
        
        this.container.add(this.pathLine);
        
        // 自动清除
        this.scene.time.delayedCall(500, () => {
            this.clearPathLine();
        });
    }
    
    /**
     * 清除路径线
     */
    private clearPathLine(): void {
        if (this.pathLine) {
            this.pathLine.destroy();
            this.pathLine = null;
        }
    }
    
    /**
     * 消除单元格
     */
    private eliminateCells(cells: Match3Cell[]): void {
        const blockType = cells[0].resourceType;
        
        // 判断是否是可掉落的资源类型
        const isResource = this.RESOURCE_TYPES.includes(blockType);
        
        // 只有资源类型才创建掉落资源
        if (isResource) {
            for (const cell of cells) {
                const pos = cell.getCenterPosition();
                const resourceId = this.resourceDropSystem.createResource(pos.x, pos.y, cell.resourceType);
                
                // 触发资源创建事件
                this.eventBus.emit('resource-created', {
                    id: resourceId,
                    resourceType: cell.resourceType,
                    position: pos
                });
            }
        }
        
        // 清空单元格
        for (const cell of cells) {
            cell.setResource(null);
        }
        
        // 触发消除事件
        this.eventBus.emit('cells-eliminated', { 
            cells, 
            blockType,
            isResource 
        });
        
        // 清空选中列表
        this.selectedCells = [];
        
        // 检查是否需要刷新
        this.checkForRefresh();
    }
    
    /**
     * 清除所有选择
     */
    private clearSelection(): void {
        for (const cell of this.selectedCells) {
            cell.setSelected(false);
        }
        this.selectedCells = [];
        this.clearPathLine();
    }
    
    /**
     * 检查是否需要刷新网格
     */
    private checkForRefresh(): void {
        let emptyCount = 0;
        
        for (let row = 0; row < this.GRID_HEIGHT; row++) {
            for (let col = 0; col < this.GRID_WIDTH; col++) {
                if (this.grid[row][col].isEmpty) {
                    emptyCount++;
                }
            }
        }
        
        // 所有格子都空了，刷新
        if (emptyCount === this.GRID_WIDTH * this.GRID_HEIGHT) {
            this.refreshGrid();
        }
    }
    
    /**
     * 刷新网格
     */
    private refreshGrid(): void {
        console.log('[Match3Grid] 刷新网格');
        this.fillRandomResources();
        this.eventBus.emit('grid-refreshed', undefined);
    }
    
    /**
     * 获取网格状态
     */
    public getGridState(): any {
        const state: any = {
            width: this.GRID_WIDTH,
            height: this.GRID_HEIGHT,
            cells: []
        };
        
        for (let row = 0; row < this.GRID_HEIGHT; row++) {
            state.cells[row] = [];
            for (let col = 0; col < this.GRID_WIDTH; col++) {
                const cell = this.grid[row][col];
                state.cells[row][col] = {
                    resourceType: cell.resourceType,
                    isEmpty: cell.isEmpty,
                    isSelected: cell.isSelected
                };
            }
        }
        
        return state;
    }
    
    /**
     * 销毁网格
     */
    public destroy(): void {
        this.clearPathLine();
        
        for (let row = 0; row < this.GRID_HEIGHT; row++) {
            for (let col = 0; col < this.GRID_WIDTH; col++) {
                this.grid[row][col].destroy();
            }
        }
        
        this.grid = [];
        this.selectedCells = [];
    }
}