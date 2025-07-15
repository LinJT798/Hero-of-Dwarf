/**
 * 战斗单位通用属性接口
 * 适用于所有具有战斗能力的单位（怪物、矮人、建筑物）
 */
export interface CombatAttributes {
    health: number;        // 当前生命值
    maxHealth: number;     // 最大生命值
    attack: number;        // 攻击力
    range: number;         // 攻击范围（像素）
    attackSpeed: number;   // 攻击速度（毫秒间隔）
    armor: number;         // 护甲值
}

/**
 * 战斗单位接口
 */
export interface CombatUnit {
    // 属性
    getCombatAttributes(): CombatAttributes;
    
    // 位置
    getPosition(): { x: number; y: number };
    
    // 生命状态
    isAlive(): boolean;
    
    // 战斗方法
    takeDamage(damage: number): void;
    canAttack(target: CombatUnit): boolean;
    attackTarget(target: CombatUnit): void;
    
    // 碰撞检测
    getCollisionBounds(): { x: number; y: number; width: number; height: number };
}

/**
 * 伤害计算工具
 */
export class CombatUtils {
    /**
     * 计算实际伤害
     * @param attackPower 攻击力
     * @param armor 护甲值
     * @returns 实际伤害（最小为1）
     */
    static calculateDamage(attackPower: number, armor: number): number {
        const damage = attackPower - armor;
        return Math.max(1, damage); // 最小伤害为1
    }
    
    /**
     * 计算两点之间的距离
     */
    static getDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * 检查目标是否在攻击范围内
     */
    static isInRange(attacker: CombatUnit, target: CombatUnit): boolean {
        const distance = this.getDistance(attacker.getPosition(), target.getPosition());
        return distance <= attacker.getCombatAttributes().range;
    }
}