#!/bin/bash

# 清理重复和未使用的资源文件

echo "开始清理资源文件..."

# 1. 删除重复的 sprites 目录（空目录）
echo -e "\n=== 清理空的 sprites 目录 ==="
find public/assets/animations -name "sprites" -type d -empty -print -delete

# 2. 删除重复的 buildings 目录下的 arrow_tower（如果是空的）
echo -e "\n=== 清理重复的建筑目录 ==="
if [ -d "public/assets/animations/buildings/arrow_tower" ] && [ -z "$(ls -A public/assets/animations/buildings/arrow_tower)" ]; then
    echo "删除空目录: public/assets/animations/buildings/arrow_tower"
    rmdir public/assets/animations/buildings/arrow_tower
fi

# 3. 删除测试和临时文件
echo -e "\n=== 清理测试和临时文件 ==="
find public/assets -name "*.txt" -print -delete
find public/assets -name ".DS_Store" -print -delete
find public/assets -name "Thumbs.db" -print -delete

# 4. 查找可能的重复图片（根据文件大小）
echo -e "\n=== 查找可能的重复图片 ==="
echo "以下文件大小相同，可能是重复的："
find public/assets/images -name "*.png" -exec ls -l {} \; | awk '{print $5, $9}' | sort -n | uniq -d -w 10

# 5. 统计资源使用情况
echo -e "\n=== 资源统计 ==="
echo "动画帧文件数量："
find public/assets/animations -name "processed_frame_*.png" | wc -l

echo -e "\n各动画目录帧数："
for dir in public/assets/animations/*/; do
    if [ -d "$dir" ]; then
        for subdir in "$dir"*/; do
            if [ -d "$subdir" ]; then
                count=$(find "$subdir" -name "processed_frame_*.png" 2>/dev/null | wc -l)
                if [ $count -gt 0 ]; then
                    echo "$subdir: $count 帧"
                fi
            fi
        done
    fi
done

echo -e "\n图片文件大小统计："
du -sh public/assets/images/
du -sh public/assets/animations/

# 6. 查找未使用的图片（需要手动确认）
echo -e "\n=== 可能未使用的图片（需要手动确认）==="
echo "以下图片文件名看起来可能是临时或测试文件："
find public/assets/images -name "*test*" -o -name "*temp*" -o -name "*copy*" -o -name "*-1.png" -o -name "*-2.png" | sort

echo -e "\n清理完成！"
echo "注意：某些文件需要手动确认后再删除，以免误删重要资源。"