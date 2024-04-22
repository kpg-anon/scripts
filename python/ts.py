import sys
import subprocess

'''
This script horizontally stacks local or remote videos side-by-side using mpv's built-in filtergraph.
It accepts either a single input or three total inputs.
It can optionally apply 90-degree (transpose=1) or 270-degree (transpose=3) rotation.

Usage:
    ts.py [-r 1|3] "input" ["input2"] ["input3"]

Examples:
Hstack a single local video without rotation:
    ts.py "1.webm"
Hstack multiple local videos with 90-degree rotation:
    ts.py -r 1 "1.webm" "2.webm" "3.webm"
Hstack a single YouTube link with 90-degree rotation:
    ts.py -r 1 [URL]
'''

def is_url(input_string):
    return input_string.startswith(('http'))

def get_direct_urls(youtube_url):
    video_url_process = subprocess.run(f'yt-dlp -g --format "bestvideo[ext=webm]" "{youtube_url}"', shell=True, stdout=subprocess.PIPE, text=True)
    audio_url_process = subprocess.run(f'yt-dlp -g --format "bestaudio" "{youtube_url}"', shell=True, stdout=subprocess.PIPE, text=True)

    video_url = video_url_process.stdout.strip()
    audio_url = audio_url_process.stdout.strip()

    return video_url, audio_url

def main(args):
    if len(args) < 2:
        print("Usage: ts.py [-r 1|3] input [input2] [input3] or ts.py [URL]")
        print("Rotation: 1 for 90 degrees, 3 for 270 degrees.")
        print("Accepts either local file path(s) or a YouTube URL.")
        return

    rotation_for_local = ""
    rotation_for_youtube = ""
    rotation_arg = False
    start_index = 1

    if len(args) > 2 and args[1] == "-r":
        rotation_arg = True
        start_index = 3
        if args[2] in ["1", "3"]:
            rotation_for_youtube = f"transpose={args[2]},"
            rotation_for_local = f"[vid1]transpose={args[2]}[rot1];[vid2]transpose={args[2]}[rot2];[vid3]transpose={args[2]}[rot3];"

    input_files = args[start_index:]
    input_file = '"' + input_files[0] + '"'

    if is_url(input_files[0]):
        # Handle YouTube URL
        video_url, audio_url = get_direct_urls(input_files[0])
        vf_option = f"{rotation_for_youtube}lavfi=[split=3[a][b:lit][c];[a][b:lit][c]hstack=inputs=3]" if rotation_arg else "lavfi=[split=3[a][b:lit][c];[a][b:lit][c]hstack=inputs=3]"
        mpv_command = f'mpv --speed=0.4 --loop=inf --fullscreen "{video_url}" --audio-file="{audio_url}" --vf="{vf_option}"'
    else:
        # Handle local files
        if len(input_files) == 1:
            external_files = '"' + input_files[0] + '";"' + input_files[0] + '"'
        else:
            external_files = '"' + '";"'.join(input_files[1:]) + '"'
        stack_inputs = "[rot1][rot2][rot3]" if rotation_arg else "[vid1][vid2][vid3]"
        mpv_command = f'mpv --speed=0.4 --loop=inf --fullscreen --lavfi-complex="{rotation_for_local}{stack_inputs}hstack=inputs=3[vo];[aid1][aid2][aid3]amix=inputs=3[ao]" {input_file} --external-files={external_files}'

    subprocess.run(mpv_command, shell=True)

if __name__ == "__main__":
    main(sys.argv)
