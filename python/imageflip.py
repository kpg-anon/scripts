#!/usr/bin/env python3

"""
This script takes a directory of images and horizontally flips them in place. If no directory is passed the current working directory will be used.

Usage: ./imageflip.py /path/to/input/directory
"""

import os
import sys
import argparse
from PIL import Image
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

# create an argument parser to accept the input directory path
arg_parser = argparse.ArgumentParser()
arg_parser.add_argument("input_dir", nargs="?", default=os.getcwd(), help="path to the input directory (defaults to current working directory)")

# parse the command line arguments
args = arg_parser.parse_args()

# get the input directory path from the command line argument
input_dir = args.input_dir

# loop through all files in the input directory
for filename in os.listdir(input_dir):
    # check if the file is an image
    if any(filename.lower().endswith(extension) for extension in [".jpg", ".jpeg", ".png", ".bmp", ".webp"]):
        # open the image file
        img = Image.open(os.path.join(input_dir, filename))
        # flip the image horizontally
        flipped_img = img.transpose(method=Image.FLIP_LEFT_RIGHT)
        # save the flipped image with the same filename and format
        flipped_img.save(os.path.join(input_dir, filename))

print("All images flipped.", file=sys.stderr)
