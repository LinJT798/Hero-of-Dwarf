import { CombatUnit, CombatAttributes, CombatUtils } from '../interfaces/CombatUnit';
import { configManager } from '../systems/ConfigManager';
import { UnitConfig } from '../types/config/UnitConfig';

/**
 * 哥布林状态枚举
 */
export enum GoblinState {
    MOVING = 'moving',
    ATTACKING = 'attacking',
    DEAD = 'dead'
}

/**
 * 哥布林实体类
 * 实现3状态状态机：移动、攻击、死亡
 */
export class Goblin implements CombatUnit {
    public id: string;
    private scene: Phaser.Scene;
    private sprite: Phaser.GameObjects.Sprite;
    private healthBar: Phaser.GameObjects.Rectangle | null = null;
    private healthBarBg: Phaser.GameObjects.Rectangle | null = null;
    
    // 位置和移动
    private x: number;
    private y: number;
    private groundY: number;
    private moveSpeed: number;
    
    // 状态机
    private state: GoblinState = GoblinState.MOVING;
    private isDestroyed: boolean = false;
    
    // 战斗属性
    private combatAttributes: CombatAttributes;
    
    // 攻击系统
    private currentTarget: CombatUnit | null = null;
    private lastAttackTime: number = 0;
    
    // 死亡计时器
    private deathTimer: number = 0;
    private deathDuration: number;
    
    // 单位配置
    private unitConfig: UnitConfig | null = null;
    
    // 显示配置
    private goblinSize: number;
    private healthBarWidth: number;
    private healthBarHeight: number;
    private healthBarOffsetY: number;
    
    // 目标检测
    private targetBuildings: any[] = [];
    private targetDwarfs: any[] = [];
    
    constructor(scene: Phaser.Scene, id: string, x: number) {
        this.scene = scene;
        this.id = id;
        this.x = x;
        
        // 加载配置
        this.loadConfig();
        
        // 设置Y坐标为配置中的地面高度
        this.y = this.groundY;
        
        this.createSprite();
        this.createAnimations();
        this.createHealthBar();
        
        console.log(`Goblin ${this.id} created at (${x}, ${this.y}) with config-based attributes`);
    }
    
    /**
     * 从配置加载哥布林属性
     */
    private loadConfig(): void {
        const unitsConfig = configManager.getUnitsConfig();
        
        console.log(`[Goblin] Loading config, unitsConfig:`, unitsConfig);
        
        if (unitsConfig && unitsConfig.units && unitsConfig.units.goblin) {
            this.unitConfig = unitsConfig.units.goblin;
            
            // 战斗属性
            this.combatAttributes = { ...this.unitConfig.combat };
            
            // 移动属性
            this.moveSpeed = this.unitConfig.movement.speed;
            this.groundY = this.unitConfig.movement.groundY;
            
            // AI属性
            this.deathDuration = this.unitConfig.ai.deathDuration || 20000;
            
            // 显示属性
            this.goblinSize = this.unitConfig.display.size;
            this.healthBarWidth = this.unitConfig.display.healthBar.width;
            this.healthBarHeight = this.unitConfig.display.healthBar.height;
            this.healthBarOffsetY = this.unitConfig.display.healthBar.offsetY;
            
            console.log(`Goblin config loaded: health=${this.combatAttributes.health}, speed=${this.moveSpeed}, size=${this.goblinSize}`);
        } else {
            console.warn('Goblin config not found, using defaults');
            this.loadDefaultConfig();
        }
    }
    
    /**
     * 加载默认配置
     */
    private loadDefaultConfig(): void {
        this.combatAttributes = {
            health: 100,
            maxHealth: 100,
            attack: 20,
            range: 50,
            attackSpeed: 1500,
            armor: 5
        };
        
        this.moveSpeed = 50;
        this.groundY = 789;
        this.deathDuration = 20000;
        this.goblinSize = 79;
        this.healthBarWidth = 60;
        this.healthBarHeight = 4;
        this.healthBarOffsetY = -85;
    }
    
    /**
     * 创建精灵
     */
    private createSprite(): void {
        // 使用第一帧作为默认纹理
        this.sprite = this.scene.add.sprite(this.x, this.y, 'goblin_walk_1');
        this.sprite.setOrigin(0.5, 1); // 底部中心对齐
        this.sprite.setDisplaySize(this.goblinSize, this.goblinSize); // 使用配置的尺寸
        
        // 水平反转精灵（如果配置中指定）
        if (this.unitConfig?.display.flipX) {
            this.sprite.setFlipX(true);
        }
        
        console.log(`Goblin sprite created with size ${this.goblinSize}x${this.goblinSize} at (${this.x}, ${this.y})${this.unitConfig?.display.flipX ? ', flipped horizontally' : ''}`);
    }
    
    /**
     * 创建动画
     */
    private createAnimations(): void {
        const animsManager = this.scene.anims;
        
        // 移动动画
        if (!animsManager.exists('goblin_walk')) {
            const walkFrames = [];
            for (let i = 1; i <= 101; i++) {
                if (this.scene.textures.exists(`goblin_walk_${i}`)) {
                    walkFrames.push({ key: `goblin_walk_${i}` });
                }
            }
            
            if (walkFrames.length > 0) {
                animsManager.create({
                    key: 'goblin_walk',
                    frames: walkFrames,
                    frameRate: 20,
                    repeat: -1 // 循环播放
                });
                console.log(`Created goblin walk animation with ${walkFrames.length} frames`);
            }
        }
        
        // 攻击动画
        if (!animsManager.exists('goblin_attack')) {
            const attackFrames = [];
            for (let i = 1; i <= 101; i++) {
                if (this.scene.textures.exists(`goblin_attack_${i}`)) {
                    attackFrames.push({ key: `goblin_attack_${i}` });
                }
            }
            
            if (attackFrames.length > 0) {
                animsManager.create({
                    key: 'goblin_attack',
                    frames: attackFrames,
                    frameRate: 20,
                    repeat: 0 // 播放一次
                });
                console.log(`Created goblin attack animation with ${attackFrames.length} frames`);
            }
        }
        
        // 死亡动画
        if (!animsManager.exists('goblin_death')) {
            const deathFrames = [];
            for (let i = 1; i <= 101; i++) {
                if (this.scene.textures.exists(`goblin_death_${i}`)) {
                    deathFrames.push({ key: `goblin_death_${i}` });
                }
            }
            
            if (deathFrames.length > 0) {
                animsManager.create({
                    key: 'goblin_death',
                    frames: deathFrames,
                    frameRate: 20,
                    repeat: 0 // 播放一次
                });
                console.log(`Created goblin death animation with ${deathFrames.length} frames`);
            }
        }
        
        // 默认播放移动动画
        this.sprite.play('goblin_walk');
    }
    
    /**
     * 获取血条对象（供管理器添加到容器）
     */
    public getHealthBarObjects(): Phaser.GameObjects.GameObject[] {
        const objects: Phaser.GameObjects.GameObject[] = [];
        if (this.healthBarBg) objects.push(this.healthBarBg);
        if (this.healthBar) objects.push(this.healthBar);
        return objects;
    }
    
    /**
     * 创建血条
     */
    private createHealthBar(): void {
        const barY = this.y + this.healthBarOffsetY; // 精灵上方
        
        // 背景
        this.healthBarBg = this.scene.add.rectangle(this.x, barY, this.healthBarWidth, this.healthBarHeight, 0x000000);
        this.healthBarBg.setOrigin(0.5, 0.5);
        
        // 血条
        this.healthBar = this.scene.add.rectangle(this.x, barY, this.healthBarWidth, this.healthBarHeight, 0x00FF00);
        this.healthBar.setOrigin(0.5, 0.5);
    }
    
    /**
     * 更新血条
     */
    private updateHealthBar(): void {
        if (!this.healthBar || !this.healthBarBg) return;
        
        const healthRatio = this.combatAttributes.health / this.combatAttributes.maxHealth;
        
        // 更新血条宽度
        this.healthBar.setDisplaySize(this.healthBarWidth * healthRatio, this.healthBarHeight);
        
        // 更新血条颜色
        let color = 0x00FF00; // 绿色
        if (healthRatio < 0.5) {
            color = 0xFFFF00; // 黄色
        }
        if (healthRatio < 0.25) {
            color = 0xFF0000; // 红色
        }
        
        this.healthBar.setFillStyle(color);
        
        // 更新血条位置
        const barY = this.y + this.healthBarOffsetY;
        this.healthBar.setPosition(this.x, barY);
        this.healthBarBg.setPosition(this.x, barY);
    }
    
    /**
     * 播放动画
     */
    private playAnimation(animKey: string): void {
        if (this.sprite && this.scene.anims.exists(animKey)) {
            this.sprite.play(animKey);
        }
    }
    
    /**
     * 更新状态机
     */
    private updateStateMachine(delta: number): void {
        switch (this.state) {
            case GoblinState.MOVING:
                this.updateMovingState(delta);
                break;
            case GoblinState.ATTACKING:
                this.updateAttackingState(delta);
                break;
            case GoblinState.DEAD:
                this.updateDeadState(delta);
                break;
        }
    }
    
    /**
     * 更新移动状态
     */
    private updateMovingState(delta: number): void {
        // 检查是否有攻击目标
        this.findTargets();
        
        if (this.currentTarget) {
            // 有目标，切换到攻击状态
            this.state = GoblinState.ATTACKING;
            this.playAnimation('goblin_attack');
            console.log(`Goblin ${this.id} found target, switching to attack state`);
            return;
        }
        
        // 继续移动
        this.x -= this.moveSpeed * (delta / 1000);
        this.sprite.setPosition(this.x, this.y);
        
        // 检查是否到达左边界
        if (this.x < -50) {
            // 到达左边界，触发城堡攻击事件
            // 先触发事件，再销毁，并传递必要的信息而不是整个对象
            this.scene.events.emit('castle-attacked', { 
                goblinId: this.id,
                goblinType: 'goblin',
                position: { x: this.x, y: this.y }
            });
            
            // 延迟销毁，确保事件处理器能正确处理
            this.scene.time.delayedCall(100, () => {
                this.destroy();
            });
        }
    }
    
    /**
     * 更新攻击状态
     */
    private updateAttackingState(delta: number): void {
        // 检查目标是否仍然有效
        if (!this.currentTarget || !this.currentTarget.isAlive() || 
            !CombatUtils.isInRange(this, this.currentTarget)) {
            // 目标无效，重新寻找目标
            this.findTargets();
            
            if (!this.currentTarget) {
                // 没有目标，切换回移动状态
                this.state = GoblinState.MOVING;
                this.playAnimation('goblin_walk');
                console.log(`Goblin ${this.id} lost target, switching to moving state`);
                return;
            }
        }
        
        // 尝试攻击
        const currentTime = Date.now();
        if (currentTime - this.lastAttackTime >= this.combatAttributes.attackSpeed) {
            this.attackTarget(this.currentTarget);
            this.lastAttackTime = currentTime;
        }
    }
    
    /**
     * 更新死亡状态
     */
    private updateDeadState(delta: number): void {
        this.deathTimer += delta;
        
        if (this.deathTimer >= this.deathDuration) {
            // 死亡时间结束，销毁哥布林
            this.destroy();
        }
    }
    
    /**
     * 寻找攻击目标
     */
    private findTargets(): void {
        this.currentTarget = null;
        
        // 优先攻击建筑物
        const nearestBuilding = this.findNearestTarget(this.targetBuildings);
        if (nearestBuilding) {
            this.currentTarget = nearestBuilding;
            return;
        }
        
        // 然后攻击矮人
        const nearestDwarf = this.findNearestTarget(this.targetDwarfs);
        if (nearestDwarf) {
            this.currentTarget = nearestDwarf;
        }
    }
    
    /**
     * 在目标列表中寻找最近的目标
     */
    private findNearestTarget(targets: CombatUnit[]): CombatUnit | null {
        let nearestTarget: CombatUnit | null = null;
        let minDistance = Infinity;
        
        for (const target of targets) {
            if (!target.isAlive()) continue;
            
            const distance = CombatUtils.getDistance(this.getPosition(), target.getPosition());
            if (distance <= this.combatAttributes.range && distance < minDistance) {
                minDistance = distance;
                nearestTarget = target;
            }
        }
        
        return nearestTarget;
    }
    
    /**
     * 设置目标列表（由MonsterManager调用）
     */
    public setTargets(buildings: any[], dwarfs: any[]): void {
        this.targetBuildings = buildings;
        this.targetDwarfs = dwarfs;
    }
    
    /**
     * 主更新方法
     */
    public update(delta: number): void {
        if (this.isDestroyed) return;
        
        this.updateStateMachine(delta);
        this.updateHealthBar();
    }
    
    // ===== CombatUnit接口实现 =====
    
    public getCombatAttributes(): CombatAttributes {
        return { ...this.combatAttributes };
    }
    
    public getPosition(): { x: number; y: number } {
        return { x: this.x, y: this.y };
    }
    
    public isAlive(): boolean {
        return this.state !== GoblinState.DEAD && !this.isDestroyed;
    }
    
    public takeDamage(damage: number): void {
        if (this.state === GoblinState.DEAD || this.isDestroyed) return;
        
        this.combatAttributes.health = Math.max(0, this.combatAttributes.health - damage);
        console.log(`Goblin ${this.id} took ${damage} damage, health: ${this.combatAttributes.health}`);
        
        if (this.combatAttributes.health <= 0) {
            this.die();
        }
    }
    
    public canAttack(target: CombatUnit): boolean {
        return this.isAlive() && 
               target.isAlive() && 
               CombatUtils.isInRange(this, target);
    }
    
    public attackTarget(target: CombatUnit): void {
        if (!this.canAttack(target)) return;
        
        const damage = CombatUtils.calculateDamage(
            this.combatAttributes.attack, 
            target.getCombatAttributes().armor
        );
        
        target.takeDamage(damage);
        console.log(`Goblin ${this.id} attacks target for ${damage} damage`);
    }
    
    public getCollisionBounds(): { x: number; y: number; width: number; height: number } {
        const halfSize = this.goblinSize / 2;
        return {
            x: this.x - halfSize,
            y: this.y - this.goblinSize,
            width: this.goblinSize,
            height: this.goblinSize
        };
    }
    
    /**
     * 死亡处理
     */
    private die(): void {
        if (this.state === GoblinState.DEAD) return;
        
        this.state = GoblinState.DEAD;
        this.currentTarget = null;
        this.deathTimer = 0;
        
        // 播放死亡动画
        this.playAnimation('goblin_death');
        
        // 触发死亡事件
        this.scene.events.emit('goblin-killed', { 
            goblin: this, 
            position: this.getPosition() 
        });
        
        console.log(`Goblin ${this.id} died`);
    }
    
    /**
     * 获取精灵对象
     */
    public getSprite(): Phaser.GameObjects.Sprite {
        return this.sprite;
    }
    
    /**
     * 获取当前状态
     */
    public getState(): GoblinState {
        return this.state;
    }
    
    /**
     * 销毁哥布林
     */
    public destroy(): void {
        if (this.isDestroyed) return;
        
        this.isDestroyed = true;
        
        // 销毁精灵和血条
        if (this.sprite) {
            this.sprite.destroy();
        }
        if (this.healthBar) {
            this.healthBar.destroy();
        }
        if (this.healthBarBg) {
            this.healthBarBg.destroy();
        }
        
        console.log(`Goblin ${this.id} destroyed`);
    }
}