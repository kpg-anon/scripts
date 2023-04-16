#!/bin/sh
# Takes a naver photo gallery from https://entertain.naver.com/photo such as https://entertain.naver.com/photo/issue/1048216/300 as argument.
# Downloads photos into directories named after the release date

page=1

cid=${1#*issue/}
cid=${cid%/*}

while :; do
	imgs=$(curl -s "https://entertain.naver.com/photo/issueItemList.json?cid=${cid}&page=${page}" \
		| jq -r '.results[].thumbnails[].thumbUrl')
	printf "$imgs" | while read -r img; do
			url="${img%?type*}"
			date=$(echo "$img" | awk -F'/' '{
				sub(/^20/, "", $(NF-3))
				print $(NF-3) $(NF-2) $(NF-1)
			}')
			dir="${date} naver x dispatch"
			mkdir -p "$dir"
			(
				cd "$dir"
				echo "$url"
				curl -O "$url"
			)
		done
	if [ -z "$imgs" ]; then
		break
	fi
	page=$((page + 1))
done
