/**
 * 音频管理器 - 单例模式
 * 管理背景音乐和音效的播放
 */
export class AudioManager {
    private static instance: AudioManager;
    private scene: Phaser.Scene | null = null;
    private isInitialized: boolean = false;
    
    // 音频配置
    private audioConfig: any = null;
    
    // 当前播放的BGM
    private currentBGM: Phaser.Sound.BaseSound | null = null;
    private currentBGMKey: string | null = null;
    
    // 重试计数器
    private retryCount: Map<string, number> = new Map();
    
    // 音频缓存
    private audioCache: Map<string, Phaser.Sound.BaseSound> = new Map();
    
    // 音量设置
    private musicVolume: number = 0.7;
    private sfxVolume: number = 0.8;
    
    private constructor() {
        // 私有构造函数，防止直接实例化
    }
    
    /**
     * 获取单例实例
     */
    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }
    
    /**
     * 初始化音频管理器
     */
    public initialize(scene: Phaser.Scene, audioConfig: any): void {
        this.scene = scene;
        this.audioConfig = audioConfig;
        this.isInitialized = true;
        
        // 设置音量
        if (audioConfig.volumes) {
            this.musicVolume = audioConfig.volumes.music || 0.7;
            this.sfxVolume = audioConfig.volumes.soundEffects || 0.8;
        }
        
        console.log('[AudioManager] Initialized with config:', audioConfig);
    }
    
    /**
     * 播放背景音乐
     */
    public playBGM(key: string): void {
        if (!this.isInitialized || !this.scene || !this.audioConfig) {
            console.warn('[AudioManager] Not initialized, cannot play BGM');
            return;
        }
        
        // 如果已经在播放相同的BGM，则不重复播放
        if (this.currentBGMKey === key && this.currentBGM?.isPlaying) {
            console.log(`[AudioManager] BGM '${key}' is already playing`);
            return;
        }
        
        // 停止当前BGM
        this.stopBGM();
        
        // 检查配置中是否有该BGM
        const bgmPath = this.audioConfig.music?.[key];
        if (!bgmPath) {
            console.warn(`[AudioManager] BGM '${key}' not found in config`);
            return;
        }
        
        // 检查音频是否已加载
        const audioExists = this.scene.cache.audio.exists(key);
        const allAudioKeys = Array.from(this.scene.cache.audio.entries.keys());
        
        if (!audioExists) {
            console.warn(`[AudioManager] Audio '${key}' not loaded`);
            console.log(`[AudioManager] Available audio keys:`, allAudioKeys);
            console.log(`[AudioManager] Total audio cache entries:`, this.scene.cache.audio.entries.size);
            
            // 尝试等待一下再重试 (最多重试3次)
            const currentRetries = this.retryCount.get(key) || 0;
            if (currentRetries < 3) {
                this.retryCount.set(key, currentRetries + 1);
                this.scene.time.delayedCall(1000, () => {
                    console.log(`[AudioManager] Retrying BGM '${key}' after 1 second... (attempt ${currentRetries + 1}/3)`);
                    this.playBGM(key);
                });
            } else {
                console.error(`[AudioManager] Failed to load BGM '${key}' after 3 attempts`);
            }
            return;
        } else {
            console.log(`[AudioManager] Audio '${key}' found in cache`);
        }
        
        // 从缓存获取或创建音频对象
        let bgm = this.audioCache.get(key);
        if (!bgm) {
            bgm = this.scene.sound.add(key, {
                loop: true,
                volume: this.musicVolume
            });
            this.audioCache.set(key, bgm);
        }
        
        // 播放BGM
        bgm.play();
        this.currentBGM = bgm;
        this.currentBGMKey = key;
        
        console.log(`[AudioManager] Playing BGM: ${key}`);
    }
    
    /**
     * 停止背景音乐
     */
    public stopBGM(): void {
        if (this.currentBGM) {
            this.currentBGM.stop();
            this.currentBGM = null;
            this.currentBGMKey = null;
            console.log('[AudioManager] BGM stopped');
        }
    }
    
    /**
     * 播放音效
     */
    public playSFX(key: string): void {
        if (!this.isInitialized || !this.scene || !this.audioConfig) {
            console.warn('[AudioManager] Not initialized, cannot play SFX');
            return;
        }
        
        // 检查配置中是否有该音效
        const sfxPath = this.audioConfig.soundEffects?.[key];
        if (!sfxPath) {
            console.warn(`[AudioManager] SFX '${key}' not found in config`);
            return;
        }
        
        // 检查音频是否已加载
        if (!this.scene.cache.audio.exists(key)) {
            console.warn(`[AudioManager] Audio '${key}' not loaded`);
            return;
        }
        
        // 从缓存获取或创建音频对象
        let sfx = this.audioCache.get(key);
        if (!sfx) {
            sfx = this.scene.sound.add(key, {
                loop: false,
                volume: this.sfxVolume
            });
            this.audioCache.set(key, sfx);
        }
        
        // 播放音效
        sfx.play();
        console.log(`[AudioManager] Playing SFX: ${key}`);
    }
    
    /**
     * 设置音乐音量
     */
    public setMusicVolume(volume: number): void {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.currentBGM) {
            // 使用 Phaser 音频的正确方法设置音量
            (this.currentBGM as any).setVolume(this.musicVolume);
        }
        console.log(`[AudioManager] Music volume set to: ${this.musicVolume}`);
    }
    
    /**
     * 设置音效音量
     */
    public setSFXVolume(volume: number): void {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        console.log(`[AudioManager] SFX volume set to: ${this.sfxVolume}`);
    }
    
    /**
     * 获取音乐音量
     */
    public getMusicVolume(): number {
        return this.musicVolume;
    }
    
    /**
     * 获取音效音量
     */
    public getSFXVolume(): number {
        return this.sfxVolume;
    }
    
    /**
     * 暂停当前BGM
     */
    public pauseBGM(): void {
        if (this.currentBGM && this.currentBGM.isPlaying) {
            this.currentBGM.pause();
            console.log('[AudioManager] BGM paused');
        }
    }
    
    /**
     * 恢复当前BGM
     */
    public resumeBGM(): void {
        if (this.currentBGM && this.currentBGM.isPaused) {
            this.currentBGM.resume();
            console.log('[AudioManager] BGM resumed');
        }
    }
    
    /**
     * 清理音频缓存
     */
    public clearCache(): void {
        this.audioCache.forEach((audio, key) => {
            if (audio && audio.destroy) {
                audio.destroy();
            }
        });
        this.audioCache.clear();
        this.currentBGM = null;
        this.currentBGMKey = null;
        console.log('[AudioManager] Cache cleared');
    }
    
    /**
     * 销毁音频管理器
     */
    public destroy(): void {
        this.stopBGM();
        this.clearCache();
        this.scene = null;
        this.audioConfig = null;
        this.isInitialized = false;
        console.log('[AudioManager] Destroyed');
    }
}

// 导出单例实例
export const audioManager = AudioManager.getInstance();