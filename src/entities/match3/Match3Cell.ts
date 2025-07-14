/**
 * 单元格点击回调
 */
export type CellClickCallback = (cell: Match3Cell) => void;

/**
 * 新版连连看单元格类
 * 纯粹的单元格数据和显示，不处理事件发射
 */
export class Match3Cell {
    private scene: Phaser.Scene;
    
    // 位置信息
    public readonly row: number;
    public readonly col: number;
    private x: number;
    private y: number;
    private size: number;
    
    // 状态
    public resourceType: string = '';
    public isEmpty: boolean = true;
    public isSelected: boolean = false;
    
    // 显示对象
    private background: Phaser.GameObjects.Rectangle;
    private resourceSprite: Phaser.GameObjects.Image | null = null;
    private selectionFrame: Phaser.GameObjects.Image | null = null;
    
    // 回调
    private onClickCallback: CellClickCallback | null = null;
    
    constructor(
        scene: Phaser.Scene,
        row: number,
        col: number,
        x: number,
        y: number,
        size: number
    ) {
        this.scene = scene;
        this.row = row;
        this.col = col;
        this.x = x;
        this.y = y;
        this.size = size;
        
        // 创建背景
        this.background = scene.add.rectangle(x, y, size, size);
        this.background.setOrigin(0, 0);
        this.background.setStrokeStyle(1, 0x000000);
        this.background.setFillStyle(0xFFFFFF, 0);
        this.background.setInteractive();
        
        // 设置交互
        this.setupInteraction();
    }
    
    /**
     * 设置交互
     */
    private setupInteraction(): void {
        // 点击事件
        this.background.on('pointerdown', () => {
            if (!this.isEmpty && this.onClickCallback) {
                this.onClickCallback(this);
            }
        });
        
        // 悬停效果
        this.background.on('pointerover', () => {
            if (!this.isEmpty && !this.isSelected) {
                this.background.setStrokeStyle(2, 0x000000);
            }
        });
        
        this.background.on('pointerout', () => {
            if (!this.isEmpty && !this.isSelected) {
                this.background.setStrokeStyle(1, 0x000000);
            }
        });
    }
    
    /**
     * 设置点击回调
     */
    public setClickCallback(callback: CellClickCallback | null): void {
        this.onClickCallback = callback;
    }
    
    /**
     * 设置资源类型
     */
    public setResource(resourceType: string | null): void {
        // 清理旧资源
        if (this.resourceSprite) {
            this.resourceSprite.destroy();
            this.resourceSprite = null;
        }
        
        if (resourceType === null) {
            // 设置为空格
            this.resourceType = '';
            this.isEmpty = true;
        } else {
            // 设置新资源
            this.resourceType = resourceType;
            this.isEmpty = false;
            
            // 创建资源图标
            const resourceKey = resourceType === 'gold' ? 'coin' : resourceType;
            this.resourceSprite = this.scene.add.image(
                this.x + this.size / 2,
                this.y + this.size / 2,
                resourceKey
            );
            this.resourceSprite.setOrigin(0.5);
            this.resourceSprite.setDisplaySize(34, 34);
            this.resourceSprite.setDepth(1);
        }
        
        // 重置选中状态
        this.setSelected(false);
    }
    
    /**
     * 设置选中状态
     */
    public setSelected(selected: boolean): void {
        if (this.isEmpty) {
            selected = false;
        }
        
        this.isSelected = selected;
        
        // 更新选中框
        if (selected) {
            if (!this.selectionFrame) {
                this.selectionFrame = this.scene.add.image(
                    this.x + this.size / 2,
                    this.y + this.size / 2,
                    'cube_frame'
                );
                this.selectionFrame.setDisplaySize(50, 51);
                this.selectionFrame.setDepth(10);
            }
            this.selectionFrame.setVisible(true);
        } else {
            if (this.selectionFrame) {
                this.selectionFrame.setVisible(false);
            }
        }
        
        // 更新边框
        if (!this.isEmpty) {
            this.background.setStrokeStyle(selected ? 2 : 1, 0x000000);
        }
    }
    
    /**
     * 获取位置信息
     */
    public getPosition(): { row: number; col: number; x: number; y: number } {
        return {
            row: this.row,
            col: this.col,
            x: this.x,
            y: this.y
        };
    }
    
    /**
     * 获取中心位置（用于资源掉落）
     */
    public getCenterPosition(): { x: number; y: number } {
        return {
            x: this.x + this.size / 2,
            y: this.y + this.size / 2
        };
    }
    
    /**
     * 添加到容器
     */
    public addToContainer(container: Phaser.GameObjects.Container): void {
        container.add(this.background);
        if (this.resourceSprite) {
            container.add(this.resourceSprite);
        }
        if (this.selectionFrame) {
            container.add(this.selectionFrame);
        }
    }
    
    /**
     * 销毁单元格
     */
    public destroy(): void {
        this.onClickCallback = null;
        
        if (this.background) {
            this.background.destroy();
        }
        
        if (this.resourceSprite) {
            this.resourceSprite.destroy();
        }
        
        if (this.selectionFrame) {
            this.selectionFrame.destroy();
        }
    }
}