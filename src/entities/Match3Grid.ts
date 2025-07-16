import { Match3Cell } from './Match3Cell';
import { PathFinder } from '../utils/PathFinder';
import { DroppedResource } from './DroppedResource';

/**
 * 连连看网格管理器
 * 管理整个7x9的连连看网格
 */
export class Match3Grid {
    private scene: Phaser.Scene;
    private container: Phaser.GameObjects.Container;
    private grid: Match3Cell[][] = [];
    private selectedCells: Match3Cell[] = [];
    private pathFinder!: PathFinder;
    private pathLine: Phaser.GameObjects.Graphics | null = null;
    private droppedResources: DroppedResource[] = [];
    
    // 网格配置 (严格按照Figma设计)
    private readonly GRID_WIDTH = 9;  // 9列
    private readonly GRID_HEIGHT = 7; // 7行
    private readonly CELL_SIZE = 51;  // 单元格尺寸: 51×51px
    private readonly GRID_X = 469;    // Figma: map位置(469,90)
    private readonly GRID_Y = 90;
    
    // 资源类型
    private readonly RESOURCE_TYPES = ['gold', 'wood', 'stone', 'mithril', 'food'];

    constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
        this.scene = scene;
        this.container = container;
        
        this.initialize();
        this.setupEventListeners();
    }

    /**
     * 初始化网格
     */
    private initialize(): void {
        this.createGrid();
        this.fillRandomResources();
        this.pathFinder = new PathFinder(this.grid);
        console.log('Match3Grid initialized');
    }

    /**
     * 创建网格
     */
    private createGrid(): void {
        this.grid = [];
        
        for (let row = 0; row < this.GRID_HEIGHT; row++) {
            this.grid[row] = [];
            
            for (let col = 0; col < this.GRID_WIDTH; col++) {
                // 使用绝对位置 (Figma网格起始位置 + 偏移)
                const x = this.GRID_X + col * this.CELL_SIZE;
                const y = this.GRID_Y + row * this.CELL_SIZE;
                
                // 创建空的单元格，稍后填充资源
                const cell = new Match3Cell(
                    this.scene,
                    row,
                    col,
                    x,
                    y,
                    this.CELL_SIZE,
                    'gold' // 临时资源类型
                );
                
                this.grid[row][col] = cell;
                // 将所有元素添加到容器中
                this.container.add(cell.sprite);
                if (cell.resourceSprite) {
                    this.container.add(cell.resourceSprite);
                }
                if (cell.selectionFrame) {
                    this.container.add(cell.selectionFrame);
                }
            }
        }
    }

    /**
     * 随机填充资源（确保每种类型都是偦数个）
     */
    private fillRandomResources(): void {
        const totalCells = this.GRID_WIDTH * this.GRID_HEIGHT; // 9 * 7 = 63
        const usableCells = totalCells - 1; // 62个，留一个空格
        
        const resourceCount = this.RESOURCE_TYPES.length; // 5种资源
        
        // 创建资源数组，确保每种资源都是偦数个
        const resources: (string | null)[] = [];
        
        // 计算每种资源的数量
        // 62个格子，5种资源
        // 分配方案：4种各12个，1种14个，总计62个
        const distribution = [12, 12, 12, 12, 14]; // 总和 = 62
        
        // 按照分配方案创建资源
        for (let i = 0; i < resourceCount; i++) {
            for (let j = 0; j < distribution[i]; j++) {
                resources.push(this.RESOURCE_TYPES[i]);
            }
        }
        
        // 添加一个空格
        resources.push(null);
        
        // 打乱数组（Fisher-Yates洗牌算法）
        for (let i = resources.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [resources[i], resources[j]] = [resources[j], resources[i]];
        }
        
        // 填充到网格
        let index = 0;
        for (let row = 0; row < this.GRID_HEIGHT; row++) {
            for (let col = 0; col < this.GRID_WIDTH; col++) {
                const cell = this.grid[row][col];
                const resource = resources[index++];
                
                if (resource === null) {
                    // 空格：清空这个单元格
                    if (cell.resourceSprite) {
                        cell.resourceSprite.destroy();
                        cell.resourceSprite = null;
                    }
                    if (cell.textLabel) {
                        cell.textLabel.destroy();
                        cell.textLabel = null;
                    }
                    cell.isEmpty = true;
                    cell.resourceType = '';
                } else {
                    // 正常资源
                    cell.regenerate(resource);
                    
                    // 添加新创建的精灵到容器
                    if (cell.resourceSprite && !this.container.exists(cell.resourceSprite)) {
                        this.container.add(cell.resourceSprite);
                    }
                    if (cell.textLabel && !this.container.exists(cell.textLabel)) {
                        this.container.add(cell.textLabel);
                    }
                }
            }
        }
        
        // 调试：打印每种资源的数量
        const counts: { [key: string]: number } = {};
        this.RESOURCE_TYPES.forEach(type => counts[type] = 0);
        resources.forEach(type => {
            if (type !== null) counts[type]++;
        });
        console.log('资源分布:', counts, '空格数:', resources.filter(r => r === null).length);
    }

    /**
     * 获取随机资源类型
     */
    private getRandomResourceType(): string {
        return this.RESOURCE_TYPES[Math.floor(Math.random() * this.RESOURCE_TYPES.length)];
    }

    /**
     * 设置事件监听器
     */
    private setupEventListeners(): void {
        this.scene.events.on('cell-selected', this.handleCellSelected, this);
        this.scene.events.on('cell-eliminated', this.handleCellEliminated, this);
        this.scene.events.on('selection-frame-created', this.handleSelectionFrameCreated, this);
    }

    /**
     * 处理选中框创建事件
     */
    private handleSelectionFrameCreated(cell: Match3Cell): void {
        if (cell.selectionFrame && !this.container.exists(cell.selectionFrame)) {
            this.container.add(cell.selectionFrame);
        }
    }

    /**
     * 处理单元格选中事件
     */
    private handleCellSelected(cell: Match3Cell): void {
        if (cell.isSelected) {
            // 添加到选中列表
            this.selectedCells.push(cell);
        } else {
            // 从选中列表移除
            const index = this.selectedCells.indexOf(cell);
            if (index > -1) {
                this.selectedCells.splice(index, 1);
            }
        }

        // 检查是否可以消除
        this.checkForMatches();
    }

    /**
     * 处理单元格消除事件
     */
    private handleCellEliminated(cell: Match3Cell): void {
        // 移除已消除的单元格从选中列表
        const index = this.selectedCells.indexOf(cell);
        if (index > -1) {
            this.selectedCells.splice(index, 1);
        }

        // 不再触发resource-drop事件，因为我们在eliminateCells中创建DroppedResource
        // 这样避免重复掉落
    }

    /**
     * 检查匹配和消除
     */
    private checkForMatches(): void {
        if (this.selectedCells.length === 2) {
            const [cell1, cell2] = this.selectedCells;
            
            // 检查是否是相同资源类型
            if (cell1.resourceType === cell2.resourceType) {
                // 检查是否可以连接
                if (this.canConnect(cell1, cell2)) {
                    // 显示连接路径
                    this.showConnectionPath(cell1, cell2);
                    
                    // 执行消除
                    this.eliminateCells([cell1, cell2]);
                } else {
                    // 无法连接，取消选中
                    this.clearSelection();
                }
            } else {
                // 不同资源类型，取消选中
                this.clearSelection();
            }
        } else if (this.selectedCells.length > 2) {
            // 超过两个选中，清除所有选择
            this.clearSelection();
        }
    }

    /**
     * 检查两个单元格是否可以连接
     */
    private canConnect(cell1: Match3Cell, cell2: Match3Cell): boolean {
        return this.pathFinder.canConnect(cell1, cell2);
    }

    /**
     * 消除单元格
     */
    private eliminateCells(cells: Match3Cell[]): void {
        // 在消除前生成掉落资源
        if (cells.length === 2) {
            this.createDroppedResource(cells[0], cells[1]);
        }
        
        cells.forEach(cell => {
            cell.eliminate();
        });

        this.selectedCells = [];
        
        // 检查是否需要刷新网格
        this.checkForRefresh();
        
        console.log(`Eliminated ${cells.length} cells`);
    }

    /**
     * 创建掉落资源
     */
    private createDroppedResource(cell1: Match3Cell, cell2: Match3Cell): void {
        const pos1 = cell1.getPosition();
        const pos2 = cell2.getPosition();
        
        // 为每个消除的块创建一个掉落资源
        // 第一个资源
        const resource1 = new DroppedResource(
            this.scene,
            pos1.x + this.CELL_SIZE / 2,
            pos1.y + this.CELL_SIZE / 2,
            cell1.resourceType
        );
        this.droppedResources.push(resource1);
        console.log(`[Match3Grid] 创建资源1 - 类型: ${cell1.resourceType}, 位置: (${pos1.x + this.CELL_SIZE / 2}, ${pos1.y + this.CELL_SIZE / 2})`);
        
        // 第二个资源
        const resource2 = new DroppedResource(
            this.scene,
            pos2.x + this.CELL_SIZE / 2,
            pos2.y + this.CELL_SIZE / 2,
            cell2.resourceType
        );
        this.droppedResources.push(resource2);
        console.log(`[Match3Grid] 创建资源2 - 类型: ${cell2.resourceType}, 位置: (${pos2.x + this.CELL_SIZE / 2}, ${pos2.y + this.CELL_SIZE / 2})`);
        
        console.log(`[Match3Grid] 当前资源总数: ${this.droppedResources.length}`);
    }

    /**
     * 显示连接路径
     */
    private showConnectionPath(cell1: Match3Cell, cell2: Match3Cell): void {
        const path = this.pathFinder.findPath(cell1, cell2);
        if (!path) return;

        // 清除之前的路径线
        this.clearPathLine();

        // 创建新的路径线
        this.pathLine = this.scene.add.graphics();
        this.pathLine.lineStyle(3, 0xFF0000, 0.8);
        this.pathLine.setDepth(20); // 确保线条在最上层

        // 绘制路径
        if (path.length >= 2) {
            this.pathLine.beginPath();
            this.pathLine.moveTo(path[0].x, path[0].y);
            
            for (let i = 1; i < path.length; i++) {
                this.pathLine.lineTo(path[i].x, path[i].y);
            }
            
            this.pathLine.strokePath();
        }

        this.container.add(this.pathLine);

        // 短暂显示后自动清除
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
     * 清除所有选择
     */
    private clearSelection(): void {
        this.selectedCells.forEach(cell => {
            cell.setSelected(false);
        });
        this.selectedCells = [];
        this.clearPathLine();
    }

    /**
     * 检查是否需要刷新网格
     */
    private checkForRefresh(): void {
        const emptyCells = this.getEmptyCells();
        
        // 如果所有单元格都被消除，刷新整个网格
        if (emptyCells.length === this.GRID_WIDTH * this.GRID_HEIGHT) {
            this.refreshGrid();
        }
    }

    /**
     * 获取空的单元格列表
     */
    private getEmptyCells(): Match3Cell[] {
        const emptyCells: Match3Cell[] = [];
        
        for (let row = 0; row < this.GRID_HEIGHT; row++) {
            for (let col = 0; col < this.GRID_WIDTH; col++) {
                if (this.grid[row][col].isEmpty) {
                    emptyCells.push(this.grid[row][col]);
                }
            }
        }
        
        return emptyCells;
    }

    /**
     * 刷新整个网格
     */
    private refreshGrid(): void {
        console.log('Refreshing grid...');
        
        // 使用同样的逻辑确保每种类型都是偶数个
        this.fillRandomResources();
        
        this.scene.events.emit('grid-refreshed');
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
     * 获取指定位置的单元格
     */
    public getCell(row: number, col: number): Match3Cell | null {
        if (row >= 0 && row < this.GRID_HEIGHT && col >= 0 && col < this.GRID_WIDTH) {
            return this.grid[row][col];
        }
        return null;
    }

    /**
     * 更新逻辑（主要用于更新掉落资源）
     */
    public update(delta: number): void {
        // 更新所有掉落资源
        for (let i = this.droppedResources.length - 1; i >= 0; i--) {
            const resource = this.droppedResources[i];
            const stillFalling = resource.update(delta);
            
            if (!stillFalling && !resource.getIsCollected()) {
                // 资源已落地，通知事件系统
                const pos = resource.getPosition();
                console.log(`[Match3Grid] 资源落地 - 类型: ${resource.getResourceType()}, 位置: (${pos.x}, ${pos.y})`);
                this.scene.events.emit('resource-landed', {
                    resourceType: resource.getResourceType(),
                    position: resource.getPosition(),
                    resource: resource
                });
            }
            
            // 移除已收集的资源
            if (resource.getIsCollected()) {
                resource.destroy();
                this.droppedResources.splice(i, 1);
            }
        }
    }

    /**
     * 获取所有掉落资源
     */
    public getDroppedResources(): DroppedResource[] {
        return this.droppedResources;
    }

    /**
     * 销毁网格
     */
    public destroy(): void {
        // 移除事件监听器
        this.scene.events.off('cell-selected', this.handleCellSelected, this);
        this.scene.events.off('cell-eliminated', this.handleCellEliminated, this);
        this.scene.events.off('selection-frame-created', this.handleSelectionFrameCreated, this);

        // 清除路径线
        this.clearPathLine();

        // 销毁所有单元格
        for (let row = 0; row < this.GRID_HEIGHT; row++) {
            for (let col = 0; col < this.GRID_WIDTH; col++) {
                this.grid[row][col].destroy();
            }
        }

        this.grid = [];
        this.selectedCells = [];
    }
}