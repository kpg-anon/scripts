#!/usr/bin/env python3

import sys
import os
import re
import subprocess
import argparse
import time
from datetime import datetime

# Base directory for output path
OUTPUT_BASE_PATH = os.path.expanduser('~/path/to/STREAMS')

# Streamlink options for different platforms
STREAMLINK_OPTIONS = {
    'twitch': '--twitch-proxy-playlist=https://eu2.luminous.dev --twitch-proxy-playlist-fallback --twitch-disable-ads',
    'afreecatv': '--stream-segment-timeout 90'
}

def msg(tag, message):
    print(f"[Streamlink Loop] [{datetime.now().strftime('%H:%M:%S')}] [{tag}]: {message}")

def show_help(platform=''):
    print("Usage: streamloop.py -p <platform> -u <username> [-q <quality>] [-r <retry>]")
    print("  -p  Platform (twitch or afreecatv)")
    print("  -u  Username on the platform")
    print("  -q  Quality of the stream (default: best)")
    print("  -r  Retry interval in seconds (default: 180)")
    print("")
    if platform == 'twitch':
        print("Twitch Quality Options:")
        print("  audio_only, 160p (worst), 360p, 480p, 720p_alt, 720p, 720p60, 1080p, 1080p60 (best)")
    elif platform == 'afreecatv':
        print("AfreecaTV Quality Options:")
        print("  sd (worst), hd, original (best)")

def construct_url_and_output(platform, username):
    if platform == 'twitch':
        url = f"https://www.twitch.tv/{username}"
        output_path = os.path.join(OUTPUT_BASE_PATH, f"TWITCH/{username}/{username}-{{time:%y%m%d}}_{{time:%a}}_{{time:%H}}.{{time:%M%p}}.ts")
        streamlink_options = STREAMLINK_OPTIONS['twitch'].split()
    elif platform == 'afreecatv':
        url = f"https://play.afreecatv.com/{username}/"
        output_path = os.path.join(OUTPUT_BASE_PATH, f"AFREECATV/{username}/{username}-{{time:%y%m%d}}_{{time:%a}}_{{time:%H}}.{{time:%M%p}}.ts")
        streamlink_options = STREAMLINK_OPTIONS['afreecatv'].split()
    else:
        msg('ERROR', f"Unsupported platform: {platform}. Supported platforms are twitch and afreecatv.")
        sys.exit(1)
    return url, output_path, streamlink_options

def check_app(app_name):
    return subprocess.call(["command", "-v", app_name], shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0

def main():
    parser = argparse.ArgumentParser(description='Streamlink helper script for looping a valid URL.')
    parser.add_argument('-p', '--platform', help='Platform (twitch or afreecatv)', required=True)
    parser.add_argument('-u', '--username', help='Username on the platform', required=True)
    parser.add_argument('-q', '--quality', help='Quality of the stream (default: best)', default='best')
    parser.add_argument('-r', '--retry', help='Retry interval in seconds (default: 180)', type=int, default=180)
    args = parser.parse_args()

    # Validate quality option
    if args.platform == 'twitch' and not re.match('^(audio_only|160p|360p|480p|720p_alt|720p|720p60|1080p|1080p60|best)$', args.quality):
        msg('ERROR', "Invalid quality option for Twitch.")
        show_help('twitch')
        sys.exit(1)
    elif args.platform == 'afreecatv' and not re.match('^(sd|hd|original|best)$', args.quality):
        msg('ERROR', "Invalid quality option for AfreecaTV.")
        show_help('afreecatv')
        sys.exit(1)

    url, output_path, streamlink_options = construct_url_and_output(args.platform, args.username)

    if check_app('streamlink'):
        while subprocess.call(["streamlink", "--can-handle-url", url]) == 0:
            command = ["streamlink"] + streamlink_options + ["--output", output_path, "--default-stream", args.quality, "--url", url]
            if subprocess.call(command) != 0:
                msg('WARNING', 'Unable to find a live stream at this moment.')
            msg('WARNING', f"Streamlink closed. Will retry in {args.retry} seconds.")
            time.sleep(args.retry)
        msg('ERROR', f"The URL {url} is not valid.")
        sys.exit(1)
    else:
        msg('ERROR', "Streamlink is not installed or is not reachable at $PATH.")
        sys.exit(1)

if __name__ == "__main__":
    main()
