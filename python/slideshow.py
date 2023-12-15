import subprocess
import os
import argparse
import random

'''
This script creates a media collage/slideshow from a single or multiple specified folders, displaying images and videos in separate optionally fullscreen MPV windows.

The script allows for different grid layouts (2x2, 3x2, or 3x1) and can filter media by type (images, videos, or mixed). Playback speed and slideshow duration can also be adjusted.

*Note: in 3x1 fullscreen mode you will have to set the taskbar to autohide for MPV's geometry option to work properly.

Examples:
# Display mixed media in a 2x2 grid: 
python slideshow.py --mode 2x2 /path/to/media
# Display only images in a 3x2 grid with a 20s delay: 
python slideshow.py --mode 3x2 --type images --duration 20 /path/to/media
# Display only videos from multiple folders in a 3x1 grid with reduced speed in fullscreen: 
python slideshow.py -m 3x1 -t videos -s .75 -f /path/to/media1 /path/to/media2
'''

SCREEN_WIDTH = 2560
SCREEN_HEIGHT = 1600
SCREEN_HEIGHT_REDUCED = 1528  # Reduced height considering the taskbar

def play_with_mpv_playlist(playlist_file, duration, position, window_size, speed):
    mpv_args = [
        'mpv',
        '--loop=no',
        '--no-border',
        '--keep-open=yes',
        '--volume=0',
        '--speed={}'.format(speed),
        '--image-display-duration={}'.format(duration),
        '--shuffle',
        '--geometry=' + window_size + '+' + position,
        '--playlist={}'.format(playlist_file),
    ]
    subprocess.Popen(mpv_args)

def main(mode, folders, duration, speed, media_type, fullscreen):
    media_files = []
    for folder in folders:
        for root, dirs, files in os.walk(folder):
            for file in files:
                file_path = os.path.join(root, file)
                if media_type in ['mixed', 'images'] and file.endswith(image_formats):
                    media_files.append(file_path)
                elif media_type in ['mixed', 'videos'] and file.endswith(video_formats):
                    media_files.append(file_path)

    random.shuffle(media_files)

    playlist_file = 'playlist.m3u'
    with open(playlist_file, 'w', encoding='utf-8') as f:
        for file in media_files:
            f.write(f'{file}\n')

    screen_width = SCREEN_WIDTH
    screen_height = SCREEN_HEIGHT if fullscreen else SCREEN_HEIGHT_REDUCED

    if mode == '2x2':
        window_width = screen_width // 2
        window_height = screen_height // 2
    elif mode == '3x2':
        window_width = -(-screen_width // 3)
        window_height = screen_height // 2
    elif mode == '3x1':
        window_width = -(-screen_width // 3)
        window_height = screen_height

    positions = [
        f'{window_width * col}+{window_height * row}' for row in range(2 if mode != '3x1' else 1) for col in range(3 if mode != '2x2' else 2)
    ]

    for position in positions:
        play_with_mpv_playlist(playlist_file, duration, position, f'{window_width}x{window_height}', speed)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Media collage viewer.')
    parser.add_argument('folders', nargs='+', type=str, help='Folders containing media files.')
    parser.add_argument('-d', '--duration', type=int, default=10, help='Duration for images.')
    parser.add_argument('-m', '--mode', type=str, choices=['2x2', '3x2', '3x1'], default='2x2', help='Layout mode.')
    parser.add_argument('-s', '--speed', type=float, default=1, help='Playback speed.')
    parser.add_argument('-t', '--type', type=str, choices=['images', 'videos', 'mixed'], default='mixed', help='Type of media to include in the playlist.')
    parser.add_argument('-f', '--fullscreen', action='store_true', help='Display over the taskbar in fullscreen mode.')

    args = parser.parse_args()

    image_formats = ('.jpg', '.jpeg', '.png', '.gif', '.webp')
    video_formats = ('.mp4', '.mkv', '.webm', '.mov')

    main(args.mode, args.folders, args.duration, args.speed, args.type, args.fullscreen)
