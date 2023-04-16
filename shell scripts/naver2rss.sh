#!/bin/sh
# naver2rss - Takes the full link to the desired Naver blog as first argument.
# Copyright (C) 2021  ysh <thinkingaboutshu@waifu.club>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

n=1 # if set, stop after n articles

url="${1:-https://post.naver.com/my/series/detail.naver?seriesNo=463657&memberNo=38791383}"
html=$(curl -s "$url")
title=$(echo "$html" | awk -F'"' '/og:title/ { print $(NF-1) }')
cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>$title</title>
<link>$url</link>
EOF

i=0
echo "$html" | awk -F'"' '
	/data-cid/ {
		volumeNo = $10
		sub(/_.*/, "", volumeNo)
		print volumeNo
	}' | while read -r volumeNo; do
		if [ -n "$n" ]; then
			 [ "$i" -ge "$n" ] && break
		fi
		i=$((i+1))
		link="https://m.post.naver.com/viewer/postView.naver?volumeNo=$volumeNo"
		html=$(curl -s "$link")
		title=$(echo "$html" | awk -F'"' '/og:title/ { print $(NF-1) }')
		date=$(TZ='Asia/Seoul' date -d"$(echo "$html" \
			| awk -F'"' '/nv:news:date/ { print $(NF-1) }')" +'%a, %d %b %Y %H:%M:%S %z')
		description=$(echo "$html" \
			| grep -e 'data-image-id' -e 'data-linktype="img"' \
			| awk '
				BEGIN {
					RS = "\""
					print "<![CDATA["
				}
				/^https?/ && /jpg|JPG|png|PNG|gif|GIF/ && !/static\.post/ {
					gsub(/?.*$/, "")
					print "<img src=\"" $0 "\"/>"
				}
				END { print "]]>" }')
		cat <<-EOF
		<item>
		<title>$title</title>
		<link>$link</link>
		<guid>$volumeNo</guid>
		<pubDate>$date</pubDate>
		<description>
		$description
		</description>
		</item>
		EOF
done

cat <<EOF
</channel>
</rss>
EOF
