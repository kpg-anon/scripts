#!/usr/bin/env python3

"""
This script counts the total number of files per extension within a directory and prints the result to console.
If no directory is provided, it uses the current working directory.
Use -e flag to specify one or multiple comma-separated extensions

Usage: ./extcount.py [-e] [extensions] <folder path>
Example: ./extcount.py -e jpg,mp4 <folder path>
"""

import os
import argparse
from collections import defaultdict
from rich.console import Console
from rich.panel import Panel
from rich.theme import Theme

custom_theme = Theme({
    "ext": "#ff79c6",
    "num_files": "#f8f8f2",
    "files": "#CCCCCC",
    "total_size": "#CCCCCC",
    "size": "#f1fa8c",
    "size_gb": "#ff5555",
    "size_kb": "#50fa7b",
    "divider": "#bd93f9",
    "total_files": "#f8f8f2",
    "frame": "#bd93f9",
    "total_files_label": "#CCCCCC",
})

def count_files(dir_path, extensions=None):
    counts = defaultdict(int)
    sizes = defaultdict(int)
    for root, dirs, files in os.walk(dir_path):
        for file in files:
            ext = os.path.splitext(file)[-1].lower()
            if extensions is None or ext[1:] in extensions:
                counts[ext] += 1
                sizes[ext] += os.path.getsize(os.path.join(root, file))
    return counts, sizes

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("dir_path", nargs='?', default=os.getcwd())
    parser.add_argument("-e", "--extensions", type=str)
    args = parser.parse_args()

    if args.extensions is not None:
        extensions = args.extensions.split(',')
    else:
        extensions = None

    counts, sizes = count_files(args.dir_path, extensions)

    console = Console(theme=custom_theme)
    total_files = 0
    total_size_MB = 0
    for ext, count in counts.items():
        size_MB = sizes[ext] / (1024*1024)
        size_GB = size_MB / 1024
        size_KB = sizes[ext] / 1024
        total_files += count
        total_size_MB += size_MB
        if size_MB >= 1024:
            console.print(Panel(f"[ext]{ext}[/ext] [divider]|[/divider] [num_files]{count}[/num_files] [files]files[/files] [divider]|[/divider] [total_size]total size:[/total_size] [size_gb]{size_GB:.2f} GB[/size_gb]", border_style="frame"))
        elif size_MB < 1:
            console.print(Panel(f"[ext]{ext}[/ext] [divider]|[/divider] [num_files]{count}[/num_files] [files]files[/files] [divider]|[/divider] [total_size]total size:[/total_size] [size_kb]{size_KB:.2f} KB[/size_kb]", border_style="frame"))
        else:
            console.print(Panel(f"[ext]{ext}[/ext] [divider]|[/divider] [num_files]{count}[/num_files] [files]files[/files] [divider]|[/divider] [total_size]total size:[/total_size] [size]{size_MB:.2f} MB[/size]", border_style="frame"))

    total_size_GB = total_size_MB / 1024
    total_size_KB = total_size_MB * 1024
    if total_size_MB >= 1024:
        console.print(Panel(f"[total_files]{total_files}[/total_files] [total_files_label]Total files[/total_files_label] [divider]|[/divider] [total_size]size:[/total_size] [size_gb]{total_size_GB:.2f} GB[/size_gb]", border_style="frame"))
    elif total_size_MB < 1:
        console.print(Panel(f"[total_files]{total_files}[/total_files] [total_files_label]Total files[/total_files_label] [divider]|[/divider] [total_size]size:[/total_size] [size_kb]{total_size_KB:.2f} KB[/size_kb]", border_style="frame"))
    else:
        console.print(Panel(f"[total_files]{total_files}[/total_files] [total_files_label]Total files[/total_files_label] [divider]|[/divider] [total_size]size:[/total_size] [size]{total_size_MB:.2f} MB[/size]", border_style="frame"))
