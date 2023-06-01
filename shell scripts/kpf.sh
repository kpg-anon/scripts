#!/usr/bin/env bash

# Set the subreddit to be used
SUBREDDIT="kpopfap"
USER_AGENT="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0"
SEARCH_TERM="$@"
SECONDS=0

# Function to print ASCII box
print_box() {
    msg="# $1 #"
    edge=$(echo "$msg" | sed 's/./#/g')
    echo -e "\n$edge\n$msg\n$edge\n"
}

# Function to scrape page
scrape_page() {
    local after="$1"
    local url="https://old.reddit.com/r/${SUBREDDIT}/search.json?q=${SEARCH_TERM}&sort=new&restrict_sr=on&include_over_18=on&limit=100"
    [[ -n "$after" ]] && url="${url}&after=${after}"
    curl -sH "User-Agent: '${USER_AGENT}'" "$url" | jq -r '.data.children[].data.url_overridden_by_dest'
}

# Function to get next "after" token
get_next() {
    local after="$1"
    local url="https://old.reddit.com/r/${SUBREDDIT}/search.json?q=${SEARCH_TERM}&sort=new&restrict_sr=on&include_over_18=on&limit=100"
    [[ -n "$after" ]] && url="${url}&after=${after}"
    curl -sH "User-Agent: '${USER_AGENT}'" "$url" | jq -r '.data.after'
}

print_box "Scraping ${SUBREDDIT} for submissions"

# Start scraping
after=""
page=0
while true; do
    page=$((page + 1))
    print_box "Page #${page}"
    links=$(scrape_page "$after")
    media_links=$(echo "$links" | grep -P '^https?:\/\/(www\.)?(imgur.com\/[A-Za-z0-9]+(\.[a-z]+)?|gfycat.com\/[a-z]+)$')
    if [[ -n "$media_links" ]]; then
        echo -e "\e[92mFound media links:\e[0m \n$media_links"
        echo "$media_links" >> tmp.m3u
    else
        echo -e "\e[91mNo media links found.\e[0m"
    fi
    after=$(get_next "$after")

    # Exit the loop if there is no next page
    if [[ "$after" == "null" ]]; then
        break
    fi
done

print_box "Outputting direct URLS to file"

# Read each media link line by line
# Use yt-dlp to get the direct url
while IFS= read -r line; do
    echo -e "\e[33mProcessing link:\e[0m $line"
    video_url=$(yt-dlp -f mp4 -g "$line" 2>/dev/null)
    if [[ ! -z "$video_url" ]]; then
        echo -e "\e[92mFound video URL:\e[0m $video_url"
        echo "$video_url" >> "${SEARCH_TERM}.m3u"
    else
        echo -e "\e[91mNo video URL found for link:\e[0m $line"
    fi
done < tmp.m3u

# Remove temporary files
rm tmp.m3u

# Calculate total links
total_links=$(wc -l < "${SEARCH_TERM}.m3u")

# Calculate elapsed time
t=$SECONDS
minutes=$((t/60))
seconds=$((t%60))

print_box "FINISHED"

# Print total links and elapsed time
echo -e "\e[34mLinks scraped:\e[0m $total_links"
printf "\e[92mElapsed:\e[0m %dm%ds\n" $minutes $seconds
