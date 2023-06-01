#!/bin/bash

# Directory containing .lqm files
input_dir="./lqm"

# Directory where you want to save .txt files
output_dir="./txt"

# Directory where the .lqm files will be extracted
extracted_dir="./extracted"

# Iterate over .lqm files in input directory
for lqm_file in "$input_dir"/*.lqm; do
    # Get the base name of the .lqm file (without extension)
    base_name=$(basename "$lqm_file" .lqm)

    # Extract .lqm file with 7zip to its own directory under the "extracted" folder
    7z x -o"$extracted_dir/$base_name" "$lqm_file"
done

# Iterate over the extracted directories
for dir in "$extracted_dir"/*; do
    # Get the base name of the directory
    base_name=$(basename "$dir")

    # Parse memoinfo.jlqm file with jq and save as .txt file
    jq -r '.MemoObjectList[] | .DescRaw' "$dir/memoinfo.jlqm" > "$output_dir/$base_name.txt"
done
