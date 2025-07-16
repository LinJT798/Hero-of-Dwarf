/**
 * 波次配置类型定义
 */

export interface WaveSettingsConfig {
    maxWaves: number;
    waveCompleteDelay: number;
    spawnPosition: {
        x: number;
        y: number;
    };
}

export interface MonsterSpawnConfig {
    type: string;
    count: number;
    spawnInterval: number;
}

export interface WaveConfig {
    waveNumber: number;
    waveType: 'normal' | 'hard';
    delayFromPrevious: number;
    monsters: MonsterSpawnConfig[];
}

export interface WavesConfigFile {
    waveSettings: WaveSettingsConfig;
    waves: WaveConfig[];
}