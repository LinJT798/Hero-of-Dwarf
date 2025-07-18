import { Match3Cell } from './Match3Cell';
import { Match3EventBus } from '@/systems/match3/Match3EventBus';
import { ResourceDropSystem } from '@/systems/match3/ResourceDropSystem';
import { PathFinder } from '@/utils/match3/PathFinder';
import { configManager } from '@/systems/ConfigManager';

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
    
    // 网格配置
    private gridWidth: number = 9;
    private gridHeight: number = 7;
    private cellSize: number = 51;
    private gridX: number = 469;
    private gridY: number = 90;
    
    // 方块类型配置
    private resourceTypes: string[] = [];
    private nonResourceTypes: string[] = [];
    private blockDistribution: any = {};
    private useSmartDistribution: boolean = true;
    
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
        
        // 从配置加载参数
        this.loadConfig();
        
        this.initialize();
    }
    
    /**
     * 从配置文件加载参数
     */
    private loadConfig(): void {
        const match3Config = configManager.getConfig('game_match3');
        
        // 网格尺寸
        this.gridWidth = match3Config?.gridWidth || 9;
        this.gridHeight = match3Config?.gridHeight || 7;
        this.cellSize = match3Config?.cellSize || 51;
        this.gridX = match3Config?.position?.x || 469;
        this.gridY = match3Config?.position?.y || 90;
        
        // 方块类型
        this.resourceTypes = match3Config?.resourceTypes || ['gold', 'wood', 'stone', 'mithril', 'food'];
        this.nonResourceTypes = match3Config?.nonResourceTypes || ['dirt', 'grass', 'lava', 'sand'];
        this.blockDistribution = match3Config?.blockDistribution || {
            resources: { gold: 10, wood: 8, stone: 8, mithril: 8, food: 8 },
            nonResources: { dirt: 5, grass: 5, lava: 5, sand: 5 },
            emptySpaces: 1
        };
        this.useSmartDistribution = match3Config?.useSmartDistribution ?? true;
        
        console.log('[Match3Grid] 配置加载完成:', {
            gridSize: `${this.gridWidth}x${this.gridHeight}`,
            resources: this.resourceTypes,
            nonResources: this.nonResourceTypes,
            distribution: this.blockDistribution,
            useSmartDistribution: this.useSmartDistribution
        });
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
        for (let row = 0; row < this.gridHeight; row++) {
            this.grid[row] = [];
            
            for (let col = 0; col < this.gridWidth; col++) {
                const x = this.gridX + col * this.cellSize;
                const y = this.gridY + row * this.cellSize;
                
                const cell = new Match3Cell(this.scene, this.container, row, col, x, y, this.cellSize);
                cell.setClickCallback(this.handleCellClick.bind(this));
                
                this.grid[row][col] = cell;
            }
        }
    }
    
    /**
     * 随机填充资源
     */
    private fillRandomResources(): void {
        const totalCells = this.gridWidth * this.gridHeight;
        const blocks: (string | null)[] = [];
        
        // 调试：打印配置的分布
        console.log('[Match3Grid] 使用的方块分布配置:', this.blockDistribution);
        
        // 根据配置添加资源方块
        if (this.blockDistribution.resources) {
            for (const [resourceType, count] of Object.entries(this.blockDistribution.resources)) {
                console.log(`[Match3Grid] 添加资源 ${resourceType}: ${count}个`);
                for (let i = 0; i < (count as number); i++) {
                    blocks.push(resourceType);
                }
            }
        }
        
        // 根据配置添加非资源方块
        if (this.blockDistribution.nonResources) {
            for (const [nonResourceType, count] of Object.entries(this.blockDistribution.nonResources)) {
                console.log(`[Match3Grid] 添加非资源 ${nonResourceType}: ${count}个`);
                for (let i = 0; i < (count as number); i++) {
                    blocks.push(nonResourceType);
                }
            }
        }
        
        // 添加空格
        const emptySpaces = this.blockDistribution.emptySpaces || 1;
        for (let i = 0; i < emptySpaces; i++) {
            blocks.push(null);
        }
        
        // 验证总数
        if (blocks.length !== totalCells) {
            console.warn(`[Match3Grid] 方块总数不匹配! 期望: ${totalCells}, 实际: ${blocks.length}`);
            // 如果方块不够，补充空格
            while (blocks.length < totalCells) {
                blocks.push(null);
            }
            // 如果方块太多，移除多余的
            while (blocks.length > totalCells) {
                blocks.pop();
            }
        }
        
        // 根据配置决定使用哪种分布算法
        if (this.useSmartDistribution) {
            this.distributeBlocksSmart(blocks);
        } else {
            // 使用简单的随机分布
            for (let i = blocks.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
            }
            
            let index = 0;
            for (let row = 0; row < this.gridHeight; row++) {
                for (let col = 0; col < this.gridWidth; col++) {
                    this.grid[row][col].setResource(blocks[index++]);
                }
            }
        }
        
        // 统计实际生成的方块
        const blockCounts: { [key: string]: number } = {};
        for (let row = 0; row < this.gridHeight; row++) {
            for (let col = 0; col < this.gridWidth; col++) {
                const resourceType = this.grid[row][col].resourceType || 'empty';
                blockCounts[resourceType] = (blockCounts[resourceType] || 0) + 1;
            }
        }
        console.log('[Match3Grid] 方块填充完成，实际分布:', blockCounts);
    }
    
    /**
     * 智能分布方块，避免相同类型聚集
     */
    private distributeBlocksSmart(blocks: (string | null)[]): void {
        // 先进行初始洗牌
        for (let i = blocks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
        }
        
        // 创建临时网格来存放结果
        const tempGrid: (string | null)[][] = [];
        for (let row = 0; row < this.gridHeight; row++) {
            tempGrid[row] = new Array(this.gridWidth).fill(null);
        }
        
        // 尝试智能放置，最多重试整个网格3次
        let retries = 0;
        while (retries < 3) {
            const success = this.trySmartPlacement(blocks.slice(), tempGrid);
            if (success) {
                // 成功放置，应用到实际网格
                for (let row = 0; row < this.gridHeight; row++) {
                    for (let col = 0; col < this.gridWidth; col++) {
                        this.grid[row][col].setResource(tempGrid[row][col]);
                    }
                }
                return;
            }
            retries++;
            // 清空临时网格，准备重试
            for (let row = 0; row < this.gridHeight; row++) {
                tempGrid[row].fill(null);
            }
        }
        
        // 如果智能放置失败，使用随机放置
        console.log('[Match3Grid] 智能分布失败，使用随机分布');
        let index = 0;
        for (let row = 0; row < this.gridHeight; row++) {
            for (let col = 0; col < this.gridWidth; col++) {
                this.grid[row][col].setResource(blocks[index++]);
            }
        }
    }
    
    /**
     * 尝试智能放置方块
     */
    private trySmartPlacement(blocks: (string | null)[], tempGrid: (string | null)[][]): boolean {
        const positions: { row: number; col: number }[] = [];
        
        // 收集所有位置
        for (let row = 0; row < this.gridHeight; row++) {
            for (let col = 0; col < this.gridWidth; col++) {
                positions.push({ row, col });
            }
        }
        
        // 随机打乱位置顺序
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        
        // 按类型分组方块
        const blocksByType = new Map<string | null, number>();
        for (const block of blocks) {
            blocksByType.set(block, (blocksByType.get(block) || 0) + 1);
        }
        
        // 将方块按数量从多到少排序
        const sortedTypes = Array.from(blocksByType.entries())
            .sort((a, b) => b[1] - a[1]);
        
        // 依次放置每种类型的方块
        let posIndex = 0;
        for (const [blockType, count] of sortedTypes) {
            let placed = 0;
            let attempts = 0;
            
            while (placed < count && attempts < positions.length * 2) {
                const pos = positions[posIndex % positions.length];
                
                if (tempGrid[pos.row][pos.col] === null && 
                    this.isGoodPosition(tempGrid, pos.row, pos.col, blockType)) {
                    tempGrid[pos.row][pos.col] = blockType;
                    placed++;
                }
                
                posIndex++;
                attempts++;
            }
            
            // 如果某种类型的方块无法全部放置，则放置失败
            if (placed < count) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 检查位置是否适合放置特定类型的方块
     */
    private isGoodPosition(grid: (string | null)[][], row: number, col: number, blockType: string | null): boolean {
        // 空格总是可以放置
        if (blockType === null) {
            return true;
        }
        
        // 检查相邻位置
        const neighbors = [
            { r: row - 1, c: col },     // 上
            { r: row + 1, c: col },     // 下
            { r: row, c: col - 1 },     // 左
            { r: row, c: col + 1 }      // 右
        ];
        
        let sameTypeCount = 0;
        for (const neighbor of neighbors) {
            if (neighbor.r >= 0 && neighbor.r < this.gridHeight &&
                neighbor.c >= 0 && neighbor.c < this.gridWidth) {
                if (grid[neighbor.r][neighbor.c] === blockType) {
                    sameTypeCount++;
                }
            }
        }
        
        // 如果已经有2个或更多相同类型的邻居，不适合放置
        return sameTypeCount < 2;
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
        const isResource = this.resourceTypes.includes(blockType);
        
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
            resourceType: blockType
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
        
        for (let row = 0; row < this.gridHeight; row++) {
            for (let col = 0; col < this.gridWidth; col++) {
                if (this.grid[row][col].isEmpty) {
                    emptyCount++;
                }
            }
        }
        
        // 所有格子都空了，刷新
        if (emptyCount === this.gridWidth * this.gridHeight) {
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
            width: this.gridWidth,
            height: this.gridHeight,
            cells: []
        };
        
        for (let row = 0; row < this.gridHeight; row++) {
            state.cells[row] = [];
            for (let col = 0; col < this.gridWidth; col++) {
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
        
        for (let row = 0; row < this.gridHeight; row++) {
            for (let col = 0; col < this.gridWidth; col++) {
                this.grid[row][col].destroy();
            }
        }
        
        this.grid = [];
        this.selectedCells = [];
    }
}