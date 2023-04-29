#!/bin/bash
# Album downloader for ilovexs.com

usage() {
  echo "Usage: $0 [-a links.txt] <url>"
  echo "  -a links.txt: specify a txt file containing urls to scrape"
  echo "  -h: display this help message"
  exit 1
}

trap "exit" INT
while getopts ":a:h" opt; do
  case ${opt} in
    a )
      urls_file=$OPTARG
      ;;
    h )
      usage
      ;;
    \? )
      echo "Invalid option: -$OPTARG" 1>&2
      usage
      ;;
    : )
      echo "Option -$OPTARG requires an argument." 1>&2
      usage
      ;;
  esac
done
shift $((OPTIND -1))

if [ -z "$urls_file" ]; then
  if [ "$#" -ne 1 ]; then
    usage
  fi
  url="$1"
  urls=("$url")
else
  urls=($(cat "$urls_file"))
fi

# Create Albums directory if it doesn't already exist
mkdir -p "Albums"

for url in "${urls[@]}"; do
  # Get album name from title tag
  title=$(curl -s "$url" | sed -n 's/.*<title>\(.*\)<\/title>.*/\1/p')
  album=$(echo "$title" | sed 's/[[:space:]]*$//')

  # Create directory for images
  mkdir -p "./Albums/$album"

  # Scrape images with aria2c
  curl -s "$url" \
  | grep -Eo "https?://[^/]+/wp-content/uploads/[0-9]{4}/[0-9]{2}/[^/]+\.(jpg|jpeg|webp|png|gif)" \
  | uniq \
  | aria2c -i - -c \
  --check-certificate=false \
  --max-download-limit=1M -j 1 \
  -d "./Albums/$album" 
done
