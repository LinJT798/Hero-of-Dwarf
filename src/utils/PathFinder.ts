import { Match3Cell } from '../entities/Match3Cell';

/**
 * 连连看路径查找器
 * 使用BFS算法实现经典连连看的路径查找（最多2个转角）
 */
export class PathFinder {
    private grid: Match3Cell[][];
    private gridWidth: number;
    private gridHeight: number;
    private cellSize: number = 51; // 单元格大小
    
    // 方向定义：上、右、下、左
    private readonly DIRECTIONS = [
        { dx: 0, dy: -1, dir: 0 }, // 上
        { dx: 1, dy: 0, dir: 1 },  // 右
        { dx: 0, dy: 1, dir: 2 },  // 下
        { dx: -1, dy: 0, dir: 3 }  // 左
    ];

    constructor(grid: Match3Cell[][]) {
        this.grid = grid;
        this.gridHeight = grid.length;
        this.gridWidth = grid[0]?.length || 0;
    }

    /**
     * 检查两个单元格是否可以连接
     */
    public canConnect(cell1: Match3Cell, cell2: Match3Cell): boolean {
        // 检查基本条件
        if (!this.isValidConnection(cell1, cell2)) {
            return false;
        }

        // 尝试找到连接路径
        return this.findPath(cell1, cell2) !== null;
    }

    /**
     * 查找连接路径
     * 使用BFS算法查找最多两次拐弯的路径
     */
    public findPath(cell1: Match3Cell, cell2: Match3Cell): { x: number; y: number }[] | null {
        if (!this.isValidConnection(cell1, cell2)) {
            return null;
        }

        const pos1 = cell1.getPosition();
        const pos2 = cell2.getPosition();
        
        // 使用BFS查找路径
        const path = this.bfsPathFind(pos1.row, pos1.col, pos2.row, pos2.col);
        
        if (!path) {
            return null;
        }
        
        // 将网格坐标转换为像素坐标
        return path.map(p => ({
            x: p.col * this.cellSize + this.cellSize / 2 + 469, // 469是网格的起始位置
            y: p.row * this.cellSize + this.cellSize / 2 + 90   // 90是网格的起始位置
        }));
    }

    /**
     * 检查连接的基本有效性
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

        // 两个单元格都不能是空的
        if (cell1.isEmpty || cell2.isEmpty) {
            return false;
        }

        return true;
    }
    
    /**
     * BFS路径查找算法
     * 返回路径上的所有点（包括起点和终点）
     */
    private bfsPathFind(startRow: number, startCol: number, endRow: number, endCol: number): {row: number, col: number}[] | null {
        // 状态定义：[row, col, direction, turns, parent]
        interface State {
            row: number;
            col: number;
            dir: number; // -1表示初始状态，0-3表示四个方向
            turns: number; // 拐弯次数
            parent: State | null; // 父节点，用于重建路径
        }
        
        // 队列
        const queue: State[] = [];
        // 访问记录：[row][col][dir] => 最少拐弯次数
        const visited: Map<string, number> = new Map();
        
        // 初始状态
        const startState: State = {
            row: startRow,
            col: startCol,
            dir: -1,
            turns: -1, // 第一步不算拐弯
            parent: null
        };
        queue.push(startState);
        
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
                
                // 计算新的拐弯次数
                let newTurns = current.turns;
                if (current.dir !== -1 && current.dir !== dir) {
                    newTurns++;
                }
                
                // 剪枝：拐弯次数超过2
                if (newTurns > 2) {
                    continue;
                }
                
                // 检查新位置是否可通过
                if (!this.canPass(newRow, newCol, endRow, endCol)) {
                    continue;
                }
                
                // 检查是否已经访问过（且当前路径更优）
                const stateKey = `${newRow},${newCol},${dir}`;
                const prevTurns = visited.get(stateKey);
                if (prevTurns !== undefined && prevTurns <= newTurns) {
                    continue;
                }
                visited.set(stateKey, newTurns);
                
                // 加入队列
                queue.push({
                    row: newRow,
                    col: newCol,
                    dir: dir,
                    turns: newTurns,
                    parent: current
                });
            }
        }
        
        return null; // 没有找到路径
    }
    
    /**
     * 检查位置是否可通过
     */
    private canPass(row: number, col: number, targetRow: number, targetCol: number): boolean {
        // 边界外可以通过（允许出界拐弯）
        if (row < -1 || row > this.gridHeight || col < -1 || col > this.gridWidth) {
            return false; // 但不能太远
        }
        
        if (row < 0 || row >= this.gridHeight || col < 0 || col >= this.gridWidth) {
            return true; // 边界外一格可以通过
        }
        
        // 目标点可以通过
        if (row === targetRow && col === targetCol) {
            return true;
        }
        
        // 空格可以通过
        return this.grid[row][col].isEmpty;
    }
    
    /**
     * 重建路径
     */
    private reconstructPath(endState: any): {row: number, col: number}[] {
        const path: {row: number, col: number}[] = [];
        let current = endState;
        
        while (current !== null) {
            path.unshift({ row: current.row, col: current.col });
            current = current.parent;
        }
        
        return path;
    }
}