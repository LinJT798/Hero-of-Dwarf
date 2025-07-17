/**
 * 音频配置类型定义
 */
export interface AudioConfig {
    music: {
        [key: string]: string;  // 音乐文件路径映射
    };
    soundEffects: {
        [key: string]: string;  // 音效文件路径映射
    };
    volumes: {
        music: number;          // 音乐音量 (0-1)
        soundEffects: number;   // 音效音量 (0-1)
    };
}

/**
 * 音频事件类型
 */
export type AudioEventType = 'music' | 'sfx';

/**
 * 音频播放配置
 */
export interface AudioPlayConfig {
    key: string;
    volume?: number;
    loop?: boolean;
    delay?: number;
}

/**
 * 音频管理器状态
 */
export interface AudioManagerState {
    isInitialized: boolean;
    currentBGM: string | null;
    musicVolume: number;
    sfxVolume: number;
}