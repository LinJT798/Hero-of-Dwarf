/**
 * 游戏状态管理器
 * 负责管理游戏的胜利、失败条件和状态转换
 */
export class GameStateManager {
    private scene: Phaser.Scene;
    private gameState: GameState = GameState.PLAYING;
    
    // 城堡生命值
    private castleHealth: number = 100;
    private maxCastleHealth: number = 100;
    
    // 关卡进度
    private currentLevel: number = 1;
    private score: number = 0;
    
    // UI元素
    private castleHealthBar: Phaser.GameObjects.Rectangle | null = null;
    private castleHealthBackground: Phaser.GameObjects.Rectangle | null = null;
    private castleHealthText: Phaser.GameObjects.Text | null = null;
    private gameOverScreen: Phaser.GameObjects.Container | null = null;
    
    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.initialize();
    }

    /**
     * 初始化游戏状态管理器
     */
    private initialize(): void {
        this.setupEventListeners();
        this.createCastleHealthUI();
        
        console.log('GameStateManager initialized');
    }

    /**
     * 设置事件监听
     */
    private setupEventListeners(): void {
        this.scene.events.on('castle-damage', this.handleCastleDamage, this);
        this.scene.events.on('monster-killed', this.handleMonsterKilled, this);
        this.scene.events.on('wave-completed', this.handleWaveCompleted, this);
        this.scene.events.on('all-waves-completed', this.handleAllWavesCompleted, this);
        this.scene.events.on('monster-reward', this.handleMonsterReward, this);
    }

    /**
     * 创建城堡血量UI (已禁用)
     */
    private createCastleHealthUI(): void {
        // 不再显示城堡血条，怪物到达左边界直接失败
    }

    /**
     * 处理城堡受到伤害 (直接失败)
     */
    private handleCastleDamage(data: { damage: number }): void {
        if (this.gameState !== GameState.PLAYING) return;

        console.log(`Monster reached the left border! Game Over!`);
        
        // 怪物到达左边界直接游戏失败
        this.triggerGameOver();
    }

    /**
     * 处理怪物死亡
     */
    private handleMonsterKilled(data: { monsterId: string; monsterType: string; position: any }): void {
        if (this.gameState !== GameState.PLAYING) return;

        // 根据怪物类型给予分数奖励
        const scoreRewards: { [key: string]: number } = {
            'basic_monster': 10,
            'strong_monster': 25,
            'fast_monster': 15
        };

        const reward = scoreRewards[data.monsterType] || 10;
        this.addScore(reward);
    }

    /**
     * 处理怪物奖励
     */
    private handleMonsterReward(data: { monsterType: string; position: any }): void {
        // 可以在这里添加额外的奖励逻辑，比如掉落资源
        // 目前暂时不实现
    }

    /**
     * 处理波次完成
     */
    private handleWaveCompleted(data: { wave: number; monstersKilled: number }): void {
        if (this.gameState !== GameState.PLAYING) return;

        console.log(`Wave ${data.wave} completed! Monsters killed: ${data.monstersKilled}`);
        
        // 波次完成奖励
        this.addScore(data.wave * 50); // 每波奖励基础分数
        
        // 显示波次完成消息
        this.showWaveCompletedMessage(data.wave);
    }

    /**
     * 处理所有波次完成
     */
    private handleAllWavesCompleted(data: { totalWaves: number }): void {
        if (this.gameState !== GameState.PLAYING) return;

        console.log(`All ${data.totalWaves} waves completed!`);
        this.triggerVictory();
    }

    /**
     * 触发游戏胜利
     */
    private triggerVictory(): void {
        this.gameState = GameState.VICTORY;
        
        // 胜利奖励分数
        this.addScore(this.castleHealth * 5); // 剩余血量奖励
        this.addScore(1000); // 胜利奖励
        
        console.log('VICTORY! All waves defeated!');
        this.showGameOverScreen(true);
    }

    /**
     * 触发游戏失败
     */
    private triggerGameOver(): void {
        this.gameState = GameState.DEFEAT;
        
        console.log('GAME OVER! Castle destroyed!');
        this.showGameOverScreen(false);
    }

    /**
     * 显示游戏结束界面
     */
    private showGameOverScreen(isVictory: boolean): void {
        if (this.gameOverScreen) {
            this.gameOverScreen.destroy();
        }

        this.gameOverScreen = this.scene.add.container(640, 416); // 屏幕中心

        // 背景
        const background = this.scene.add.rectangle(0, 0, 600, 400, 0x000000, 0.8);
        this.gameOverScreen.add(background);

        // 标题
        const title = this.scene.add.text(0, -150, isVictory ? '胜利!' : '失败!', {
            fontSize: '48px',
            color: isVictory ? '#00FF00' : '#FF0000',
            fontStyle: 'bold'
        });
        title.setOrigin(0.5);
        this.gameOverScreen.add(title);

        // 分数显示
        const scoreText = this.scene.add.text(0, -80, `最终分数: ${this.score}`, {
            fontSize: '24px',
            color: '#FFFFFF'
        });
        scoreText.setOrigin(0.5);
        this.gameOverScreen.add(scoreText);

        // 城堡状态
        const castleText = this.scene.add.text(0, -40, `城堡血量: ${this.castleHealth}/${this.maxCastleHealth}`, {
            fontSize: '18px',
            color: '#FFFFFF'
        });
        castleText.setOrigin(0.5);
        this.gameOverScreen.add(castleText);

        // 重新开始按钮
        const restartButton = this.scene.add.rectangle(0, 50, 200, 60, 0x4CAF50);
        restartButton.setStrokeStyle(3, 0xFFFFFF);
        restartButton.setInteractive();
        
        const restartText = this.scene.add.text(0, 50, '重新开始', {
            fontSize: '20px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        });
        restartText.setOrigin(0.5);

        restartButton.on('pointerdown', () => {
            this.restartGame();
        });

        restartButton.on('pointerover', () => {
            restartButton.setFillStyle(0x66BB6A);
        });

        restartButton.on('pointerout', () => {
            restartButton.setFillStyle(0x4CAF50);
        });

        this.gameOverScreen.add([restartButton, restartText]);

        // 游戏统计信息
        if (isVictory) {
            const victoryMessage = this.scene.add.text(0, -10, '成功防守了所有怪物波次!', {
                fontSize: '16px',
                color: '#FFFF00'
            });
            victoryMessage.setOrigin(0.5);
            this.gameOverScreen.add(victoryMessage);
        } else {
            const defeatMessage = this.scene.add.text(0, -10, '城堡被摧毁了...', {
                fontSize: '16px',
                color: '#FF8888'
            });
            defeatMessage.setOrigin(0.5);
            this.gameOverScreen.add(defeatMessage);
        }
    }

    /**
     * 显示波次完成消息
     */
    private showWaveCompletedMessage(wave: number): void {
        const message = this.scene.add.text(640, 200, `第 ${wave} 波完成!`, {
            fontSize: '32px',
            color: '#00FF00',
            fontStyle: 'bold',
            backgroundColor: '#000000',
            padding: { x: 20, y: 10 }
        });
        message.setOrigin(0.5);

        // 动画效果
        this.scene.tweens.add({
            targets: message,
            alpha: 0,
            y: 150,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                message.destroy();
            }
        });
    }

    /**
     * 更新城堡血量UI (已禁用)
     */
    private updateCastleHealthUI(): void {
        // 不再显示城堡血条
    }

    /**
     * 添加分数
     */
    private addScore(points: number): void {
        this.score += points;
        console.log(`Score +${points}, Total: ${this.score}`);
        
        // 触发分数更新事件
        this.scene.events.emit('score-updated', {
            score: this.score,
            points: points
        });
    }

    /**
     * 重新开始游戏
     */
    private restartGame(): void {
        console.log('Restarting game...');
        
        // 重置状态
        this.gameState = GameState.PLAYING;
        this.castleHealth = this.maxCastleHealth;
        this.score = 0;
        
        // 隐藏游戏结束界面
        if (this.gameOverScreen) {
            this.gameOverScreen.destroy();
            this.gameOverScreen = null;
        }
        
        // 更新UI
        this.updateCastleHealthUI();
        
        // 触发重启事件
        this.scene.events.emit('game-restarted');
        
        // 重新启动场景
        this.scene.scene.restart();
    }

    /**
     * 获取当前游戏状态
     */
    public getGameState(): GameState {
        return this.gameState;
    }

    /**
     * 获取城堡血量
     */
    public getCastleHealth(): number {
        return this.castleHealth;
    }

    /**
     * 获取当前分数
     */
    public getScore(): number {
        return this.score;
    }

    /**
     * 检查游戏是否结束
     */
    public isGameOver(): boolean {
        return this.gameState === GameState.VICTORY || this.gameState === GameState.DEFEAT;
    }

    /**
     * 手动触发游戏胜利（调试用）
     */
    public forceVictory(): void {
        this.triggerVictory();
    }

    /**
     * 手动触发游戏失败（调试用）
     */
    public forceDefeat(): void {
        this.triggerGameOver();
    }

    /**
     * 销毁游戏状态管理器
     */
    public destroy(): void {
        this.scene.events.off('castle-damage', this.handleCastleDamage, this);
        this.scene.events.off('monster-killed', this.handleMonsterKilled, this);
        this.scene.events.off('wave-completed', this.handleWaveCompleted, this);
        this.scene.events.off('all-waves-completed', this.handleAllWavesCompleted, this);
        this.scene.events.off('monster-reward', this.handleMonsterReward, this);
        
        if (this.gameOverScreen) {
            this.gameOverScreen.destroy();
        }
        
        console.log('GameStateManager destroyed');
    }
}

/**
 * 游戏状态枚举
 */
export enum GameState {
    PLAYING = 'playing',
    VICTORY = 'victory',
    DEFEAT = 'defeat',
    PAUSED = 'paused'
}