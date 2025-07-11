/**
 * 连连看单元格类
 * 表示连连看网格中的一个单元格
 */
export class Match3Cell {
    public row: number;
    public col: number;
    public resourceType: string;
    public isSelected: boolean = false;
    public isEmpty: boolean = false;
    public sprite: Phaser.GameObjects.Rectangle;
    public resourceSprite: Phaser.GameObjects.Image | null = null;
    public selectionFrame: Phaser.GameObjects.Image | null = null;
    public textLabel: Phaser.GameObjects.Text | null = null;

    constructor(
        scene: Phaser.Scene,
        row: number,
        col: number,
        x: number,
        y: number,
        size: number,
        resourceType: string
    ) {
        this.row = row;
        this.col = col;
        this.resourceType = resourceType;

        // 创建单元格背景矩形
        this.sprite = scene.add.rectangle(x, y, size, size);
        this.sprite.setOrigin(0, 0); // 使用绝对位置
        this.sprite.setStrokeStyle(1, 0x000000); // 1px黑色边框
        this.sprite.setFillStyle(0xFFFFFF, 0); // 透明填充
        this.sprite.setInteractive();

        // 创建资源图标 (居中显示在单元格内)
        this.createResourceSprite(scene, x + size/2, y + size/2);

        // 设置点击事件
        this.sprite.on('pointerdown', () => {
            this.toggleSelection();
        });

        // 设置悬停效果
        this.sprite.on('pointerover', () => {
            if (!this.isSelected && !this.isEmpty) {
                this.sprite.setStrokeStyle(2, 0x000000); // 加粗边框
            }
        });

        this.sprite.on('pointerout', () => {
            if (!this.isSelected && !this.isEmpty) {
                this.sprite.setStrokeStyle(1, 0x000000); // 恢复边框
            }
        });
    }

    private createResourceSprite(scene: Phaser.Scene, x: number, y: number): void {
        if (this.isEmpty) return;

        // 使用真实资源图片 (34x34px)
        const resourceKey = this.resourceType === 'gold' ? 'coin' : this.resourceType;
        this.resourceSprite = scene.add.image(x, y, resourceKey);
        this.resourceSprite.setOrigin(0.5); // 居中显示
        this.resourceSprite.setDisplaySize(34, 34); // 确保尺寸为34x34
        this.resourceSprite.setDepth(1); // 确保资源图片在背景之上
    }

    private getResourceColor(type: string): number {
        const colors: { [key: string]: number } = {
            'gold': 0xFFD700,
            'wood': 0x8B4513,
            'stone': 0x696969,
            'mithril': 0xC0C0C0,
            'food': 0x32CD32
        };
        return colors[type] || 0xFFFFFF;
    }

    private getResourceText(type: string): string {
        const texts: { [key: string]: string } = {
            'gold': '金',
            'wood': '木',
            'stone': '石',
            'mithril': '银',
            'food': '食'
        };
        return texts[type] || '?';
    }

    /**
     * 切换选中状态
     */
    public toggleSelection(): void {
        if (this.isEmpty) return;

        this.isSelected = !this.isSelected;
        this.updateVisual();
        
        // 触发选中事件
        this.sprite.scene.events.emit('cell-selected', this);
    }

    /**
     * 设置选中状态
     */
    public setSelected(selected: boolean): void {
        if (this.isEmpty) return;

        this.isSelected = selected;
        this.updateVisual();
    }

    /**
     * 更新视觉效果 (使用Figma的cube_frame选择框)
     */
    private updateVisual(): void {
        if (this.isEmpty) {
            // 空单元格不显示资源
            if (this.resourceSprite) {
                this.resourceSprite.setVisible(false);
            }
            if (this.selectionFrame) {
                this.selectionFrame.setVisible(false);
            }
            return;
        }

        if (this.isSelected) {
            // 显示选择框 (使用Figma的cube_frame图片)
            if (!this.selectionFrame) {
                // cube_frame覆盖整个格子
                this.selectionFrame = this.sprite.scene.add.image(
                    this.sprite.x + 25.5, // 居中显示 (51/2 = 25.5)
                    this.sprite.y + 25.5,
                    'cube_frame'
                );
                this.selectionFrame.setDisplaySize(50, 51); // Figma尺寸: 50×51px
                this.selectionFrame.setDepth(10); // 确保选中框在最上层
                
                // 触发事件让Grid将选中框添加到容器
                this.sprite.scene.events.emit('selection-frame-created', this);
            }
            this.selectionFrame.setVisible(true);
        } else {
            // 隐藏选择框
            if (this.selectionFrame) {
                this.selectionFrame.setVisible(false);
            }
        }
    }

    /**
     * 消除单元格
     */
    public eliminate(): void {
        this.isEmpty = true;
        this.isSelected = false;
        
        // 隐藏资源图标和文字
        if (this.resourceSprite) {
            this.resourceSprite.setVisible(false);
        }
        if (this.textLabel) {
            this.textLabel.setVisible(false);
        }
        
        this.updateVisual();
        
        // 触发消除事件
        this.sprite.scene.events.emit('cell-eliminated', this);
    }

    /**
     * 重新生成资源
     */
    public regenerate(newResourceType: string): void {
        this.resourceType = newResourceType;
        this.isEmpty = false;
        this.isSelected = false;

        // 重新创建资源图标
        if (this.resourceSprite) {
            this.resourceSprite.destroy();
        }
        if (this.textLabel) {
            this.textLabel.destroy();
            this.textLabel = null;
        }
        
        const x = this.sprite.x + this.sprite.width / 2;
        const y = this.sprite.y + this.sprite.height / 2;
        this.createResourceSprite(this.sprite.scene, x, y);
        
        this.updateVisual();
    }

    /**
     * 获取位置信息
     */
    public getPosition(): { row: number; col: number; x: number; y: number } {
        return {
            row: this.row,
            col: this.col,
            x: this.sprite.x,
            y: this.sprite.y
        };
    }

    /**
     * 销毁单元格
     */
    public destroy(): void {
        this.sprite.destroy();
        if (this.resourceSprite) {
            this.resourceSprite.destroy();
        }
        if (this.selectionFrame) {
            this.selectionFrame.destroy();
        }
        if (this.textLabel) {
            this.textLabel.destroy();
        }
    }
}