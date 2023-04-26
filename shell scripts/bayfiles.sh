#!/bin/bash

# Read the list of URLs from the file
urls=$(cat urls.txt)

# Loop through the URLs
for url in $urls; do
  # Scrape the download link
  download_url=$(curl -s $url | grep -o 'https://cdn-[0-9]*\.bayfiles\.com/.*' | sed 's/">.*//')
  # Download the file using aria2c
  aria2c -c -l log.txt --check-certificate=false $download_url
done
