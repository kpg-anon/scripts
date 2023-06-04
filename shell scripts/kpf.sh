#!/usr/bin/env bash

# Set the subreddit to be used
SUBREDDIT="kpopfap"
DOWNLOAD_FLAG=false
USER_AGENT="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0"
SECONDS=0
LIMIT=100

# Check for flags
while getopts s:n:d: flag; do
    case "${flag}" in
        s) SUBREDDIT="${OPTARG}";;
        n) LIMIT="${OPTARG}";;
        d) SEARCH_TERM="${OPTARG}"; DOWNLOAD_FLAG=true;;
    esac
done
SEARCH_URL=$(echo $SEARCH_TERM | sed 's/ /+/g')
SEARCH_FILE=$(date +%y%m%d)" $SEARCH_TERM-$(date +$EPOCHSECONDS)"

# Function to print ASCII box
print_box() {
    msg="# $1 #"
    edge=$(echo "$msg" | sed 's/./#/g')
    echo -e "\n$edge\n$msg\n$edge\n"
}

# Function to scrape page
scrape_page() {
    local after="$1"
    local url="https://old.reddit.com/r/${SUBREDDIT}/search.json?q=${SEARCH_URL}&sort=new&restrict_sr=on&include_over_18=on&limit=${LIMIT}"
    [[ -n "$after" ]] && url="${url}&after=${after}"
    curl -sH "User-Agent: '${USER_AGENT}'" "$url" | jq -r '.data.children[].data.url_overridden_by_dest'
}

# Function to get next "after" token
get_next() {
    local after="$1"
    local url="https://old.reddit.com/r/${SUBREDDIT}/search.json?q=${SEARCH_URL}&sort=new&restrict_sr=on&include_over_18=on&limit=${LIMIT}"
    [[ -n "$after" ]] && url="${url}&after=${after}"
    curl -sH "User-Agent: '${USER_AGENT}'" "$url" | jq -r '.data.after'
}

print_box "Scraping ${SUBREDDIT} for submissions"

# Start scraping
after=""
page=0
links_found=0
while [[ $links_found -lt $LIMIT ]]; do
    page=$((page + 1))
    print_box "Page #${page}"
    links=$(scrape_page "$after")
    media_links=$(echo "$links" | grep -P '^https?:\/\/(www\.)?(i\.imgur.com\/[A-Za-z0-9]+(\.[a-z]+)?|imgur.com\/[A-Za-z0-9]+(\.[a-z]+)?|gfycat.com\/[a-z]+|redgifs.com\/watch\/[a-z]+)$')
    if [[ -n "$media_links" ]]; then
        echo -e "\e[92mFound media links:\e[0m \n$media_links"
        echo "$media_links" >> "tmp_$SEARCH_FILE.m3u"
        links_found=$(wc -l < "tmp_$SEARCH_FILE.m3u")
    else
        echo -e "\e[91mNo media links found.\e[0m"
    fi
    after=$(get_next "$after")

    # Exit the loop if there is no next page
    if [[ "$after" == "null" ]]; then
        break
    fi
done

# Check if any links were found
if [[ ! -f "tmp_$SEARCH_FILE.m3u" ]]; then
    echo -e "\e[34mLinks scraped:\e[0m 0"
    printf "\e[92mElapsed:\e[0m %dm%ds\n" $((SECONDS/60)) $((SECONDS%60))
    exit 1
fi

print_box "Outputting direct URLS to file"

# Read each media link line by line
# Use yt-dlp to get the direct url
while IFS= read -r line; do
    echo -e "\e[33mProcessing link:\e[0m $line"
    video_url=$(yt-dlp -f mp4 -g --no-warnings "$line" 2>/dev/null)
    if [[ -n "$video_url" ]]; then
        echo -e "\e[92mFound video URL:\e[0m $video_url"
        echo "$video_url" >> "$SEARCH_FILE.m3u"
    else
        echo -e "\e[91mNo video URL found for link:\e[0m $line"
    fi
done < "tmp_$SEARCH_FILE.m3u"

# Clean up
rm "tmp_$SEARCH_FILE.m3u"

# Download videos if the -d flag was set
if [ "$DOWNLOAD_FLAG" = true ] ; then
    print_box "Downloading videos"
    mkdir -p "./$SEARCH_TERM"
    aria2c -i "${SEARCH_FILE}.m3u" -j 16 -x 16 -s 16 -k 1M -c -d "./$SEARCH_TERM"
fi

print_box "Finished"

# Calculate total links
total_links=$(wc -l < "${SEARCH_FILE}.m3u")
echo -e "\e[34mLinks scraped:\e[0m $total_links"

# Calculate elapsed time
printf "\e[92mElapsed:\e[0m %dm%ds\n" $((SECONDS/60)) $((SECONDS%60))
