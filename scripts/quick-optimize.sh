#!/bin/bash

# 快速优化脚本 - 减少动画帧数和压缩图片

echo "开始快速优化资源..."

# 创建优化后的目录
mkdir -p public/assets/animations-optimized

# 函数：优化单个动画目录
optimize_animation_dir() {
    local src_dir=$1
    local dest_dir=$2
    local keep_every_n=$3
    
    echo "处理: $src_dir"
    
    # 创建目标目录
    mkdir -p "$dest_dir"
    
    # 获取所有帧文件
    frames=($(ls "$src_dir"/processed_frame_*.png 2>/dev/null | sort -V))
    
    if [ ${#frames[@]} -eq 0 ]; then
        echo "  没有找到动画帧"
        return
    fi
    
    echo "  原始帧数: ${#frames[@]}"
    
    # 复制保留的帧
    local new_frame_num=1
    for ((i=0; i<${#frames[@]}; i+=$keep_every_n)); do
        # 也保留最后一帧
        if [ $i -eq $((${#frames[@]} - 1)) ] || [ $((i % keep_every_n)) -eq 0 ]; then
            cp "${frames[$i]}" "$dest_dir/processed_frame_${new_frame_num}.png"
            ((new_frame_num++))
        fi
    done
    
    # 确保最后一帧被保留
    if [ $((${#frames[@]} % keep_every_n)) -ne 0 ]; then
        cp "${frames[-1]}" "$dest_dir/processed_frame_${new_frame_num}.png"
    fi
    
    echo "  优化后帧数: $new_frame_num"
}

# 优化矮人动画
echo -e "\n=== 优化矮人动画 ==="
optimize_animation_dir "public/assets/animations/dwarf/walk" "public/assets/animations-optimized/dwarf/walk" 3
optimize_animation_dir "public/assets/animations/dwarf/idle1" "public/assets/animations-optimized/dwarf/idle1" 4
optimize_animation_dir "public/assets/animations/dwarf/idle2" "public/assets/animations-optimized/dwarf/idle2" 4
optimize_animation_dir "public/assets/animations/dwarf/attack" "public/assets/animations-optimized/dwarf/attack" 3
optimize_animation_dir "public/assets/animations/dwarf/death" "public/assets/animations-optimized/dwarf/death" 2

# 优化哥布林动画
echo -e "\n=== 优化哥布林动画 ==="
optimize_animation_dir "public/assets/animations/goblin/walk" "public/assets/animations-optimized/goblin/walk" 3
optimize_animation_dir "public/assets/animations/goblin/idle" "public/assets/animations-optimized/goblin/idle" 4
optimize_animation_dir "public/assets/animations/goblin/attack" "public/assets/animations-optimized/goblin/attack" 3
optimize_animation_dir "public/assets/animations/goblin/death" "public/assets/animations-optimized/goblin/death" 2

# 优化箭塔动画
echo -e "\n=== 优化箭塔动画 ==="
optimize_animation_dir "public/assets/animations/arrow_tower/idle" "public/assets/animations-optimized/arrow_tower/idle" 5
optimize_animation_dir "public/assets/animations/arrow_tower/attack" "public/assets/animations-optimized/arrow_tower/attack" 3

echo -e "\n优化完成！"
echo "优化后的文件在: public/assets/animations-optimized/"
echo "你可以手动替换原目录或修改代码使用新目录"