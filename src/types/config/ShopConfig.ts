/**
 * 商店配置类型定义
 */

export interface ShopSettingsConfig {
    slot_count: number;
    auto_refresh: boolean;
    refresh_on_all_purchased: boolean;
    refresh_delay: number;
    position: {
        x: number;
        y: number;
    };
}

export interface ShopSlotConfig {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ShopLayoutConfig {
    slots: ShopSlotConfig[];
    iconSize: {
        width: number;
        height: number;
    };
    resourceIconSize: {
        width: number;
        height: number;
    };
    priceTextSize: number;
}

export interface ShopProductConfig {
    id: string;
    buildingType: string;
    name: string;
    cost: { [resourceType: string]: number };
    weight: number;
    minWave: number;
}

export interface ShopConfigFile {
    shop_settings: ShopSettingsConfig;
    shopLayout: ShopLayoutConfig;
    products: ShopProductConfig[];
}