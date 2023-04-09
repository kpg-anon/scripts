#!/bin/sh
# Download images in a naver post
[ -z "$1" ] && printf "usage: naver URL\n" && exit 0

curl -sL "$1" \
| grep -e 'data-image-id' -e 'data-linktype="img"' \
| sed 's|data-src="|data-src="\n|g; s/"src" : "/"src" : "\n/g' \
| sed 's|^[^(https://)].*||; s/\.jpg.*/\.jpg/; s/\.JPG.*/\.jpg/; s|\.png.*|\.png|; s|\.gif.*|\.gif|' \
| aria2c -j 1 -i - \
| awk -F': ' '
/Download complete:/ {
print $(NF)
}
/ERROR/ {
print "# " $0
}'
