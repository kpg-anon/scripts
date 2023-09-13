#!/bin/bash

# This script scrapes media links from selca.kastden.org based on a given hashtag
# It saves these links in a text file and then downloads them using aria2c.
# 
# Usage:
# Run the script with a hashtag as the argument.
# Example: ./kastdenscrape.sh hyunbin

# Theme colors
foreground="\e[38;5;7m"
comment="\e[38;5;60m"
cyan="\e[38;5;87m"
pink="\e[38;5;207m"
green="\e[38;5;84m"
reset="\e[0m"

# Function to scrape media links from HTML content
scrape_links() {
  local html_content="$1"
  local output_file="$2"

  # Parse the HTML to extract original media links and append the domain
  echo "$html_content" | grep -o '/original/[^"]*' | sed 's/^/https:\/\/selca.kastden.org/' >> "$output_file"
}

# Function to fetch the next page URL
fetch_next_url() {
  local html_content="$1"
  local hashtag="$2"

  echo "$html_content" | grep -o 'href="/hashtag/'"${hashtag}"'/?max_time_id=[0-9]*' | sed 's/href="//' | tail -n 1
}

# Check if hashtag is provided
if [ -z "$1" ]; then
  echo -e "${pink}Usage: ./kastdenscrape.sh <hashtag>${reset}"
  exit 1
fi

# Extract hashtag from the argument
hashtag="$1"

# Construct the full URL
url="https://selca.kastden.org/hashtag/${hashtag}/"

# Get the current date in YYMMDD format
current_date=$(date +"%y%m%d")

# Initialize the output file and directory names
output_file="${current_date} ${hashtag}.txt"
output_dir="${current_date} ${hashtag}"

# Create the output directory
mkdir -p "$output_dir"

# Initialize the page number
page_number=1

while [ ! -z "$url" ]; do
  # Use curl to get the webpage content
  html_content=$(curl -s "$url")

  # Scrape media links from the HTML content
  scrape_links "$html_content" "$output_file"

  # Count the number of links scraped from this page
  links_scraped=$(echo "$html_content" | grep -o '/original/[^"]*' | wc -l)
  
  echo -e "${cyan}Scraping page #${page_number}... ${green}${links_scraped} links scraped.${reset}"

  # Break the loop if no links are scraped
  if [ $links_scraped -eq 0 ]; then
    echo -e "${pink}No more links to scrape. Exiting.${reset}"
    break
  fi

  # Fetch the next page URL
  next_url_suffix=$(fetch_next_url "$html_content" "$hashtag")
  
  if [ ! -z "$next_url_suffix" ]; then
    url="https://selca.kastden.org${next_url_suffix}"
    page_number=$((page_number + 1))
  else
    url=""
  fi
done

echo -e "${cyan}Starting download with aria2c...${reset}"
# Use aria2c to download media, skipping already downloaded files
aria2c -i "$output_file" --check-certificate=false -j 16 -x 16 -s 16 -k 1M -c --auto-file-renaming=false --conditional-get=true -d "$output_dir"

# Count the total number of files downloaded
total_files_downloaded=$(ls "$output_dir" | wc -l)
echo -e "${green}Script completed."
echo -e "${total_files_downloaded} files downloaded.${reset}"
