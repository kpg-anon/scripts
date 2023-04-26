#!/bin/bash

# Check if the command-line argument is provided
if [ $# -eq 0 ]; then
  echo "Usage: ./iso2mp4.sh </path/to/input.iso>"
  exit 1
fi

# Extract the ISO file using 7zip
mkdir "${1%.iso}"
7z x "$1" -o"${1%.iso}"

# Find all VOB files excluding VTS_01_0.VOB
find "${1%.iso}/VIDEO_TS" -type f -name "VTS_01_*.VOB" ! -name "VTS_01_0.VOB" > vob_files.txt

# Re-encode all VOB files to MP4 using ffmpeg and output them into a new folder called 'mp4'
mkdir mp4
while IFS= read -r vob_file <&3; do
  ffmpeg -hide_banner -y -i "$vob_file" \
    -c:v libx264 \
    -preset slow \
    -crf 18 \
    -c:a aac -b:a 192k \
    "mp4/$(basename "${vob_file%.*}").mp4"
done 3< vob_files.txt

# Print a list of all the encoded MP4 files to a txt file
find mp4 -type f -name "*.mp4" -printf "file '%p'\n" > mp4_files.txt

# Concatenate all MP4 files into a single MP4 container
ffmpeg -hide_banner -y -f concat -safe 0 -i mp4_files.txt \
    -c copy "${1%.iso}.mp4"

# Cleanup
rm -rf "${1%.iso}" mp4 vob_files.txt mp4_files.txt
