#!/bin/sh
# read one yt video link per line and print the playlist link

awk '
BEGIN {
	FS = "&|v=|youtu.be/"
}
/youtu\.be\/|youtube\.com\/watch\?v=/ {
	if (NR > 20) {
		print "max number of playlist items exeeded" >"/dev/stderr"
		exit
	}
	list = list $2 ","
}
END {
	print "http://www.youtube.com/watch_videos?video_ids=" list
}' \
| curl -Ls -w %{url_effective} -o /dev/null  "$(cat)" \
| awk '
BEGIN {
	FS = "&|&list="
}
$2 != "" {
	print "https://www.youtube.com/playlist?list=" $2
}'
