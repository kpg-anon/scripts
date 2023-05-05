#!/usr/bin/bash
# Scrape gfycat links fron kpopfap

GIRL="$@"

# Get popular uploads
curl -sH "User-Agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0'" \
https://old.reddit.com/r/kpopfap/search.json\?q\=$GIRL\&sort\=hot\&restrict_sr\=on\&include_over_18\=on \
| jq -r '.data.children[].data.url_overridden_by_dest' \
| grep gfycat >> tmp.m3u

# Get new uploads
curl -sH "User-Agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0'" \
https://old.reddit.com/r/kpopfap/search.json\?q\=$GIRL\&sort\=new\&restrict_sr\=on\&include_over_18\=on \
| jq -r '.data.children[].data.url_overridden_by_dest' \
| grep gfycat >> tmp.m3u

# Remove duplicates
sort -u -o tmp.m3u tmp.m3u

# Get direct links with yt-dlp
while IFS= read -r line; do yt-dlp -g "$line" >> $GIRL.m3u; done < "tmp.m3u"

# Clean up
rm tmp.m3u

exit
