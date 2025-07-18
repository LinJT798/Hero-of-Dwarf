import { Game } from 'phaser';
import { MainMenuScene } from './scenes/MainMenuScene';
import { StoryScene } from './scenes/StoryScene';
import { MainGameScene } from './scenes/MainGameScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1280,
    height: 832,
    parent: 'game-container',
    backgroundColor: '#2c3e50',
    scene: [MainMenuScene, StoryScene, MainGameScene],
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    render: {
        pixelArt: false,
        antialias: true,
        antialiasGL: false,
        mipmapFilter: 'LINEAR',
        desynchronized: true
    }
};

// 创建游戏实例
const game = new Game(config);

// 全局游戏实例，用于调试
(window as any).game = game;