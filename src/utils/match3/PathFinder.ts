import { Match3Cell } from '@/entities/match3/Match3Cell';

/**
 * BFS状态节点
 */
interface PathNode {
    row: number;
    col: number;
    dir: number;      // -1表示初始状态，0-3表示四个方向
    turns: number;    // 拐弯次数
    parent: PathNode | null;
}

/**
 * 优化的连连看路径查找器
 * 使用BFS算法实现经典连连看的路径查找（最多2个转角）
 */
export class PathFinder {
    private grid: Match3Cell[][];
    private gridWidth: number;
    private gridHeight: number;
    private readonly CELL_SIZE = 51;
    
    // 方向定义：上、右、下、左
    private readonly DIRECTIONS = [
        { dx: 0, dy: -1, dir: 0 }, // 上
        { dx: 1, dy: 0, dir: 1 },  // 右
        { dx: 0, dy: 1, dir: 2 },  // 下
        { dx: -1, dy: 0, dir: 3 }  // 左
    ];
    
    // 网格位置偏移（用于转换到屏幕坐标）
    private readonly GRID_OFFSET_X = 469;
    private readonly GRID_OFFSET_Y = 90;
    
    constructor(grid: Match3Cell[][]) {
        this.grid = grid;
        this.gridHeight = grid.length;
        this.gridWidth = grid[0]?.length || 0;
    }
    
    /**
     * 查找两个单元格之间的连接路径
     * @returns 路径上的点（屏幕坐标），如果无法连接则返回null
     */
    public findPath(cell1: Match3Cell, cell2: Match3Cell): { x: number; y: number }[] | null {
        // 基本验证
        if (!this.isValidConnection(cell1, cell2)) {
            return null;
        }
        
        const pos1 = cell1.getPosition();
        const pos2 = cell2.getPosition();
        
        // BFS查找路径
        const pathNodes = this.bfsSearch(pos1.row, pos1.col, pos2.row, pos2.col);
        
        if (!pathNodes) {
            return null;
        }
        
        // 转换为屏幕坐标
        return this.convertToScreenCoordinates(pathNodes);
    }
    
    /**
     * 检查两个单元格是否可以连接（基本验证）
     */
    private isValidConnection(cell1: Match3Cell, cell2: Match3Cell): boolean {
        // 不能是同一个单元格
        if (cell1 === cell2) {
            return false;
        }
        
        // 必须是相同的资源类型
        if (cell1.resourceType !== cell2.resourceType) {
            return false;
        }
        
        // 都不能是空的
        if (cell1.isEmpty || cell2.isEmpty) {
            return false;
        }
        
        return true;
    }
    
    /**
     * BFS搜索路径
     */
    private bfsSearch(startRow: number, startCol: number, endRow: number, endCol: number): PathNode[] | null {
        const queue: PathNode[] = [];
        const visited = new Map<string, number>();
        
        // 初始节点
        const startNode: PathNode = {
            row: startRow,
            col: startCol,
            dir: -1,
            turns: -1,
            parent: null
        };
        queue.push(startNode);
        
        while (queue.length > 0) {
            const current = queue.shift()!;
            
            // 到达目标
            if (current.row === endRow && current.col === endCol) {
                return this.reconstructPath(current);
            }
            
            // 尝试四个方向
            for (let i = 0; i < 4; i++) {
                const { dx, dy, dir } = this.DIRECTIONS[i];
                const newRow = current.row + dy;
                const newCol = current.col + dx;
                
                // 计算转弯次数
                let newTurns = current.turns;
                if (current.dir !== -1 && current.dir !== dir) {
                    newTurns++;
                }
                
                // 超过2次转弯，剪枝
                if (newTurns > 2) {
                    continue;
                }
                
                // 检查位置是否可通过
                if (!this.canPass(newRow, newCol, endRow, endCol)) {
                    continue;
                }
                
                // 检查是否已访问过（或找到更优路径）
                const stateKey = `${newRow},${newCol},${dir}`;
                const prevTurns = visited.get(stateKey);
                if (prevTurns !== undefined && prevTurns <= newTurns) {
                    continue;
                }
                visited.set(stateKey, newTurns);
                
                // 加入队列
                const newNode: PathNode = {
                    row: newRow,
                    col: newCol,
                    dir: dir,
                    turns: newTurns,
                    parent: current
                };
                queue.push(newNode);
            }
        }
        
        return null;
    }
    
    /**
     * 检查位置是否可通过
     */
    private canPass(row: number, col: number, targetRow: number, targetCol: number): boolean {
        // 边界外可以通过（允许绕边）
        if (row < -1 || row > this.gridHeight || col < -1 || col > this.gridWidth) {
            return false; // 但不能太远
        }
        
        if (row < 0 || row >= this.gridHeight || col < 0 || col >= this.gridWidth) {
            return true; // 边界外一格可以通过
        }
        
        // 目标点始终可以通过
        if (row === targetRow && col === targetCol) {
            return true;
        }
        
        // 空格可以通过
        return this.grid[row][col].isEmpty;
    }
    
    /**
     * 重建路径
     */
    private reconstructPath(endNode: PathNode): PathNode[] {
        const path: PathNode[] = [];
        let current: PathNode | null = endNode;
        
        while (current !== null) {
            path.unshift({
                row: current.row,
                col: current.col,
                dir: current.dir,
                turns: current.turns,
                parent: null // 简化返回数据
            });
            current = current.parent;
        }
        
        return path;
    }
    
    /**
     * 将网格坐标转换为屏幕坐标
     */
    private convertToScreenCoordinates(pathNodes: PathNode[]): { x: number; y: number }[] {
        return pathNodes.map(node => ({
            x: node.col * this.CELL_SIZE + this.CELL_SIZE / 2 + this.GRID_OFFSET_X,
            y: node.row * this.CELL_SIZE + this.CELL_SIZE / 2 + this.GRID_OFFSET_Y
        }));
    }
    
    /**
     * 更新网格引用（当网格刷新时调用）
     */
    public updateGrid(grid: Match3Cell[][]): void {
        this.grid = grid;
        this.gridHeight = grid.length;
        this.gridWidth = grid[0]?.length || 0;
    }
}