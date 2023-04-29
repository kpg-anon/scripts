#!/bin/bash
# Search for albums on ilovexs.com

# Check if search term is provided
if [ -z "$1" ]; then
    echo "Usage: ./xsearch "search term""
    exit 1
fi

# Join the search terms with a + sign
search_term=$(echo "$1" | tr ' ' '+')

# Set the URL and output filename
url="https://www.ilovexs.com/search/?key=$search_term"
output_file="$1.txt"

# Extract the links using curl and grep
links=$(curl -s "$url" | grep -o '/post_id/[0-9]*')

# Remove duplicates and save to the output file
echo "${links}" | uniq | sed "s#^#https://www.ilovexs.com#" > "$output_file"

# Count the number of links and print to console
count=$(wc -l < "$output_file")
echo "Total links found: $count"
