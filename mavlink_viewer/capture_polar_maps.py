#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从Python版本捕获极地投影地图作为静态背景图
使用cartopy生成高质量的极地地图背景
"""

import os
import sys
import matplotlib
matplotlib.use('Agg')  # 使用非GUI后端
import matplotlib.pyplot as plt
from pathlib import Path

try:
    import cartopy.crs as ccrs
    import cartopy.feature as cfeature
    HAVE_CARTOPY = True
except ImportError:
    print("❌ 错误: 需要安装cartopy")
    print("   pip install cartopy")
    sys.exit(1)


def generate_polar_map(hemisphere='north', output_file='polar_north.png', dpi=300):
    """
    生成极地投影地图背景图
    
    Args:
        hemisphere: 'north' 或 'south'
        output_file: 输出文件名
        dpi: 分辨率（越高越清晰，但文件越大）
    """
    print(f"\n{'='*60}")
    print(f"🗺️  生成{'北极' if hemisphere == 'north' else '南极'}投影地图")
    print(f"{'='*60}")
    print(f"半球: {hemisphere}")
    print(f"输出: {output_file}")
    print(f"DPI: {dpi}")
    print(f"{'='*60}\n")
    
    # 创建大图（高分辨率）
    fig = plt.figure(figsize=(12, 12), dpi=dpi)
    
    # 配置投影
    if hemisphere == 'north':
        proj = ccrs.NorthPolarStereo()
        extent = [-180, 180, 50, 90]  # 北纬50度以上
        title = '北极极地投影 (EPSG:3413)'
    else:
        proj = ccrs.SouthPolarStereo()
        extent = [-180, 180, -90, -50]  # 南纬50度以下
        title = '南极极地投影 (EPSG:3031)'
    
    geo_crs = ccrs.PlateCarree()
    
    # 创建地图
    ax = fig.add_subplot(1, 1, 1, projection=proj)
    ax.set_extent(extent, crs=geo_crs)
    
    print("🎨 添加地理要素...")
    
    # 添加海洋
    try:
        ax.add_feature(cfeature.OCEAN, zorder=0, facecolor='#a5bfdd')
        print("  ✓ 海洋")
    except Exception as e:
        print(f"  ✗ 海洋: {e}")
    
    # 添加陆地
    try:
        ax.add_feature(cfeature.LAND, zorder=1, facecolor='#f0e6d2', edgecolor='#8b7355')
        print("  ✓ 陆地")
    except Exception as e:
        print(f"  ✗ 陆地: {e}")
    
    # 添加海岸线
    try:
        ax.add_feature(cfeature.COASTLINE, zorder=2, edgecolor='#8b7355', linewidth=0.5)
        print("  ✓ 海岸线")
    except Exception as e:
        print(f"  ✗ 海岸线: {e}")
    
    # 添加国界
    try:
        ax.add_feature(cfeature.BORDERS, zorder=2, edgecolor='#999999', 
                      linewidth=0.3, linestyle='--', alpha=0.7)
        print("  ✓ 国界")
    except Exception as e:
        print(f"  ✗ 国界: {e}")
    
    # 添加冰川（极地特有）
    try:
        if hemisphere == 'north':
            # 北极冰川
            ax.add_feature(cfeature.NaturalEarthFeature(
                'physical', 'glaciated_areas', '110m',
                facecolor='#e0f0ff', edgecolor='#b0d0ff', linewidth=0.3
            ), zorder=3)
            print("  ✓ 冰川")
    except Exception as e:
        print(f"  ✗ 冰川: {e}")
    
    # 添加网格线
    print("  ✓ 网格线")
    gl = ax.gridlines(
        crs=geo_crs,
        draw_labels=True,
        linewidth=1,
        color='#666666',
        alpha=0.5,
        linestyle='--'
    )
    
    # 添加标题（可选，可以在Electron中添加）
    # ax.set_title(title, fontsize=16, fontweight='bold', pad=20)
    
    # 保存高质量图片
    print(f"\n💾 保存图片...")
    plt.savefig(
        output_file,
        dpi=dpi,
        bbox_inches='tight',
        pad_inches=0.1,
        facecolor='white',
        edgecolor='none',
        transparent=False
    )
    plt.close()
    
    # 检查文件
    file_size = Path(output_file).stat().st_size / 1024 / 1024  # MB
    print(f"✅ 完成! 文件大小: {file_size:.2f} MB")
    print(f"   位置: {Path(output_file).absolute()}\n")


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='从cartopy生成极地投影地图背景',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 生成北极地图（默认300 DPI）
  python capture_polar_maps.py --hemisphere north
  
  # 生成南极地图（高分辨率）
  python capture_polar_maps.py --hemisphere south --dpi 600
  
  # 生成两个半球
  python capture_polar_maps.py --hemisphere both
  
  # 快速预览（低分辨率）
  python capture_polar_maps.py --hemisphere both --dpi 150

DPI建议:
  - 150: 快速预览（小文件）
  - 300: 标准质量（推荐）
  - 600: 高质量（大文件）
  - 1200: 打印质量（非常大）
        """
    )
    
    parser.add_argument(
        '--hemisphere',
        choices=['north', 'south', 'both'],
        default='both',
        help='半球选择: north(北极), south(南极), both(两者)'
    )
    
    parser.add_argument(
        '--dpi',
        type=int,
        default=300,
        help='图片DPI（分辨率），默认300'
    )
    
    parser.add_argument(
        '--output-dir',
        default='static',
        help='输出目录'
    )
    
    args = parser.parse_args()
    
    # 创建输出目录
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True)
    
    print(f"\n{'='*60}")
    print(f"🎨 极地地图背景生成器")
    print(f"{'='*60}")
    print(f"输出目录: {output_dir.absolute()}")
    print(f"分辨率: {args.dpi} DPI")
    print(f"{'='*60}\n")
    
    try:
        # 生成北极地图
        if args.hemisphere in ['north', 'both']:
            output_file = output_dir / 'polar_north.png'
            generate_polar_map(
                hemisphere='north',
                output_file=str(output_file),
                dpi=args.dpi
            )
        
        # 生成南极地图
        if args.hemisphere in ['south', 'both']:
            output_file = output_dir / 'polar_south.png'
            generate_polar_map(
                hemisphere='south',
                output_file=str(output_file),
                dpi=args.dpi
            )
        
        print("\n" + "="*60)
        print("🎉 全部完成!")
        print("="*60)
        print(f"\n生成的地图位于: {output_dir.absolute()}")
        print("\n下一步:")
        print("  1. 查看生成的PNG图片")
        print("  2. 将图片复制到项目的 src/renderer/assets/ 目录")
        print("  3. 在PolarMapView组件中使用这些图片作为背景")
        print("\n使用提示:")
        print("  - 图片可以作为Canvas背景")
        print("  - 在上面叠加轨迹线")
        print("  - 保持交互性（缩放、平移）\n")
        
    except Exception as e:
        print(f"\n❌ 错误: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
