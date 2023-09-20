#!/usr/bin/env bash

# Requirements:
#    • curl
#    • jq
#    • yt-dlp
#    • aria2c
#
# This script is used for scraping subreddits for imgur, gfycat and redgifs video links.
# The scraped links are processed using yt-dlp to retrieve direct media URLs which are then saved to a .m3u playlist file and optionally downloaded with aria2c.
#
# Usage:
# ./kpf.sh -s <subreddit name> -n <number of links to scrape> -d <search term>
# All flag parameters are optional.
# -s: The subreddit to scrape. Default is 'kpopfap'.
# -n: The number of most recent submissions to scrape.
# -d: Downloads the media files to a directory name matching the search term.
# If no optional flags are provided, the script will scrape the 'kpopfap' subreddit for all submissions for a given search term and print the direct URLs to .m3u playlist file.
# Examples:
# ./kpf.sh "ive wonyoung"
# ./kpf.sh -n 25 -d hikaru


# Set the subreddit to be used
SUBREDDIT="kpopfap"
DOWNLOAD_FLAG=false
USER_AGENT="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0"
SECONDS=0
LIMIT=100

# Define color codes
RED='\033[1;31m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
PINK='\033[1;35m'
PURPLE='\033[1;34m'
NC='\033[0m'

# Initialize SEARCH_TERM as empty string
SEARCH_TERM=""

# Check for flags
while getopts s:n:d:: flag; do
    case "${flag}" in
        s) SUBREDDIT="${OPTARG}";;
        n) LIMIT="${OPTARG}";;
        d) DOWNLOAD_FLAG=true
           if [[ ${OPTARG} ]]; then
               SEARCH_TERM="${OPTARG}"
           fi
           ;;
    esac
done

# Shift the arguments past the options
shift $((OPTIND-1))

# If there are any arguments left and SEARCH_TERM is still empty, they will be the search term
if [[ -z ${SEARCH_TERM} ]]; then
    SEARCH_TERM="$*"
fi

SEARCH_URL=$(echo $SEARCH_TERM | sed 's/ /+/g')
SEARCH_FILE=$(date +%y%m%d)" $SEARCH_TERM-$(date +$EPOCHSECONDS)"

# Function to print ASCII box
print_box() {
    msg="# $1 #"
    edge=$(echo "$msg" | sed 's/./#/g')
    echo -e "\n${PINK}$edge\n$msg\n$edge${NC}\n"
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
    media_links=$(echo "$links" | grep -P '^https?:\/\/(www\.)?(imgur.com\/[A-Za-z0-9]+(\.(?!jpg$|png$)[a-z]+)?|i.imgur.com\/[A-Za-z0-9]+(\.(?!jpg$|png$)[a-z]+)?)$')
    if [[ -n "$media_links" ]]; then
        links_count=$(echo "$media_links" | wc -l)
        if [[ $((links_found + links_count)) -gt $LIMIT ]]; then
            media_links=$(echo "$media_links" | head -n $((LIMIT - links_found)))
        fi
        links_count=$(echo "$media_links" | wc -l)
        links_found=$((links_found + links_count))
        echo -e "${GREEN}Found media links:${NC} \n$media_links"
        echo "$media_links" >> "tmp_$SEARCH_FILE.m3u"
    else
        echo -e "${RED}No media links found.${NC} \n"
    fi
    after=$(get_next "$after")

    # Exit the loop if there is no next page
    if [[ "$after" == "null" ]]; then
        break
    fi
done

# Check if any links were found
if [[ ! -f "tmp_$SEARCH_FILE.m3u" ]]; then
    echo -e "${PURPLE}Links scraped:${NC} 0"
    printf "${GREEN}Elapsed:${NC} %dm%ds\n" $((SECONDS/60)) $((SECONDS%60))
    exit 1
fi

print_box "Outputting direct URLS to file"

# Read each media link line by line
# Use yt-dlp to get the direct url
while IFS= read -r line; do
    echo -e "${YELLOW}Processing link:${NC} $line"
    video_url=$(yt-dlp -f mp4 -g --no-warnings "$line" 2>/dev/null)
    if [[ -n "$video_url" ]]; then
        echo -e "${GREEN}Found video URL:${NC} $video_url"
        echo "$video_url" >> "$SEARCH_FILE.m3u"
    else
        echo -e "${RED}No video URL found for link:${NC} $line"
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
echo -e "${PURPLE}Links scraped:${NC} $total_links"

# Calculate elapsed time
printf "${GREEN}Elapsed:${NC} %dm%ds\n" $((SECONDS/60)) $((SECONDS%60))
