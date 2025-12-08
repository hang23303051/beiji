#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
极地投影瓦片下载工具

下载EPSG:3413(北极)和EPSG:3031(南极)投影的地图瓦片
用于MAVLink Viewer的离线极地地图显示
"""

import os
import sys
import time
import requests
from pathlib import Path
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed


class PolarTileDownloader:
    """极地瓦片下载器"""
    
    def __init__(self, projection='north', max_zoom=4, output_dir='tiles_polar'):
        """
        初始化下载器
        
        Args:
            projection: 'north' (北极) 或 'south' (南极)
            max_zoom: 最大缩放级别 (0-8, 推荐0-4)
            output_dir: 输出目录
        """
        self.projection = projection
        self.max_zoom = max_zoom
        self.output_dir = Path(output_dir)
        
        # 极地瓦片服务器URL
        if projection == 'north':
            # EPSG:3413 - 北极
            self.base_url = "https://tiles.arcticconnect.ca/osm_3413/{z}/{x}/{y}.png"
            self.epsg_code = "EPSG:3413"
            self.name = "北极"
        else:
            # EPSG:3031 - 南极
            self.base_url = "https://tiles.arcticconnect.ca/osm_3031/{z}/{x}/{y}.png"
            self.epsg_code = "EPSG:3031"
            self.name = "南极"
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'MAVLink-Viewer/1.0 (Polar Tile Downloader)'
        })
        
        # 禁用SSL验证（解决证书问题）
        self.session.verify = False
        
        # 配置代理（如果有）
        # 自动检测系统代理
        self.session.trust_env = True
        
        # 统计信息
        self.downloaded = 0
        self.failed = 0
        self.skipped = 0
        self.total = 0
    
    def calculate_tile_count(self):
        """计算需要下载的瓦片总数"""
        count = 0
        for z in range(self.max_zoom + 1):
            tiles_per_side = 2 ** z
            count += tiles_per_side * tiles_per_side
        return count
    
    def download_tile(self, z: int, x: int, y: int, retry=3, force=False) -> bool:
        """
        下载单个瓦片
        
        Args:
            z: 缩放级别
            x: X坐标
            y: Y坐标
            retry: 重试次数
            
        Returns:
            是否成功
        """
        # 构建文件路径
        tile_path = self.output_dir / str(z) / str(x) / f"{y}.png"
        
        # 如果文件已存在且大小>0，跳过（除非强制重新下载）
        if not force and tile_path.exists() and tile_path.stat().st_size > 0:
            self.skipped += 1
            return True
        
        # 创建目录
        tile_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 构建URL
        url = self.base_url.format(z=z, x=x, y=y)
        
        # 下载
        for attempt in range(retry):
            try:
                response = self.session.get(url, timeout=30)
                
                if response.status_code == 200:
                    # 保存瓦片
                    with open(tile_path, 'wb') as f:
                        f.write(response.content)
                    
                    self.downloaded += 1
                    return True
                    
                elif response.status_code == 404:
                    # 瓦片不存在（可能超出范围）
                    self.skipped += 1
                    return False
                    
                else:
                    if attempt < retry - 1:
                        time.sleep(1)
                        continue
                    else:
                        print(f"❌ 下载失败 [{z}/{x}/{y}]: HTTP {response.status_code}")
                        self.failed += 1
                        return False
                        
            except Exception as e:
                if attempt < retry - 1:
                    time.sleep(2)
                    continue
                else:
                    print(f"❌ 下载错误 [{z}/{x}/{y}]: {str(e)}")
                    self.failed += 1
                    return False
        
        return False
    
    def download_zoom_level(self, zoom: int, max_workers=8, force=False):
        """
        下载指定缩放级别的所有瓦片
        
        Args:
            zoom: 缩放级别
            max_workers: 并发线程数
        """
        tiles_per_side = 2 ** zoom
        total_tiles = tiles_per_side * tiles_per_side
        
        print(f"\n{'='*60}")
        print(f"📥 下载 {self.name} 瓦片 - 级别 {zoom}")
        print(f"   瓦片数量: {total_tiles}")
        print(f"   投影: {self.epsg_code}")
        print(f"{'='*60}\n")
        
        # 生成所有瓦片坐标
        tasks = []
        for x in range(tiles_per_side):
            for y in range(tiles_per_side):
                tasks.append((zoom, x, y))
        
        # 并发下载
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(self.download_tile, z, x, y, force=force): (z, x, y)
                for z, x, y in tasks
            }
            
            completed = 0
            for future in as_completed(futures):
                completed += 1
                if completed % 10 == 0 or completed == total_tiles:
                    progress = completed / total_tiles * 100
                    print(f"进度: {completed}/{total_tiles} ({progress:.1f}%) - "
                          f"成功:{self.downloaded} 跳过:{self.skipped} 失败:{self.failed}", 
                          end='\r')
        
        print()  # 换行
    
    def download_all(self, max_workers=8, force=False):
        """
        下载所有级别的瓦片
        
        Args:
            max_workers: 并发线程数
        """
        self.total = self.calculate_tile_count()
        
        print(f"\n{'='*60}")
        print(f"🗺️  极地瓦片下载器")
        print(f"{'='*60}")
        print(f"投影: {self.epsg_code} ({self.name})")
        print(f"缩放级别: 0 - {self.max_zoom}")
        print(f"预计瓦片数: {self.total}")
        print(f"输出目录: {self.output_dir}")
        print(f"并发线程: {max_workers}")
        print(f"{'='*60}\n")
        
        start_time = time.time()
        
        # 逐级下载
        for zoom in range(self.max_zoom + 1):
            self.download_zoom_level(zoom, max_workers, force=force)
            time.sleep(0.5)  # 避免服务器过载
        
        # 统计信息
        elapsed = time.time() - start_time
        print(f"\n{'='*60}")
        print(f"✅ 下载完成!")
        print(f"{'='*60}")
        print(f"总耗时: {elapsed:.1f} 秒")
        print(f"下载成功: {self.downloaded}")
        print(f"跳过: {self.skipped}")
        print(f"失败: {self.failed}")
        print(f"总计: {self.downloaded + self.skipped + self.failed}")
        print(f"{'='*60}\n")


def main():
    """主函数"""
    import argparse
    import warnings
    
    # 禁用SSL警告
    warnings.filterwarnings('ignore', message='Unverified HTTPS request')
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    parser = argparse.ArgumentParser(
        description='下载极地投影地图瓦片',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 下载北极瓦片 (0-4级)
  python download_polar_tiles.py --projection north --max-zoom 4
  
  # 下载南极瓦片 (0-3级)
  python download_polar_tiles.py --projection south --max-zoom 3
  
  # 下载两个半球
  python download_polar_tiles.py --projection both --max-zoom 4
  
注意:
  - 级别越高，瓦片数量指数增长
  - 级别0: 1个瓦片
  - 级别1: 4个瓦片
  - 级别2: 16个瓦片
  - 级别3: 64个瓦片
  - 级别4: 256个瓦片
  - 级别5: 1024个瓦片 (不推荐)
        """
    )
    
    parser.add_argument(
        '--projection',
        choices=['north', 'south', 'both'],
        default='north',
        help='投影类型: north(北极), south(南极), both(两者)'
    )
    
    parser.add_argument(
        '--max-zoom',
        type=int,
        default=4,
        help='最大缩放级别 (0-8, 推荐0-4)'
    )
    
    parser.add_argument(
        '--output-dir',
        default='tiles_polar',
        help='输出目录'
    )
    
    parser.add_argument(
        '--workers',
        type=int,
        default=8,
        help='并发下载线程数'
    )
    
    parser.add_argument(
        '--force',
        action='store_true',
        help='强制重新下载（忽略已存在的文件）'
    )
    
    args = parser.parse_args()
    
    # 显示重要提示
    print("\n" + "="*60)
    print("⚠️  重要提示")
    print("="*60)
    print("✓ SSL证书验证已禁用（解决证书问题）")
    print("✓ 自动使用系统代理配置")
    print("✓ 如果有VPN，请确保已启动")
    print("="*60 + "\n")
    
    # 检查缩放级别
    if args.max_zoom > 5:
        print("⚠️  警告: 缩放级别过高可能需要很长时间!")
        print(f"   级别 {args.max_zoom} 需要下载 {2**(2*args.max_zoom)} 个瓦片")
        response = input("   是否继续? (y/N): ")
        if response.lower() != 'y':
            print("已取消")
            return
    
    try:
        # 下载北极
        if args.projection in ['north', 'both']:
            output_dir = Path(args.output_dir) / 'north'
            downloader = PolarTileDownloader(
                projection='north',
                max_zoom=args.max_zoom,
                output_dir=output_dir
            )
            downloader.download_all(max_workers=args.workers, force=args.force)
        
        # 下载南极
        if args.projection in ['south', 'both']:
            output_dir = Path(args.output_dir) / 'south'
            downloader = PolarTileDownloader(
                projection='south',
                max_zoom=args.max_zoom,
                output_dir=output_dir
            )
            downloader.download_all(max_workers=args.workers, force=args.force)
        
        print("\n🎉 全部完成!")
        print(f"\n瓦片位置: {args.output_dir}")
        print("\n下一步:")
        print("  1. 将瓦片复制到项目目录")
        print("  2. 配置应用使用极地瓦片")
        print("  3. 在极地投影模式下启用离线瓦片\n")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断下载")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 错误: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()
