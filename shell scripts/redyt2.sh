#!/bin/sh
# inspired by https://github.com/Bugswriter/redyt
set -e

limit=100
case "$1" in
	-h|"") echo "usage: $(basename "$0") [-h|<SUBREDDIT>|-u <USER>|-s <SUBREDDIT> QUERY...] "; exit ;;
	-u) url="https://old.reddit.com/user/${2:?}/submitted/hot.json?limit=$limit" ;;
	-s)
		sub=${2:?}
		shift 2; query=${*:?}
		url="https://old.reddit.com/r/$sub/search.json?q=$(echo "$query" | tr ' ' '+')&restrict_sr=on&include_over_18=on"
		;;
	*) url="https://old.reddit.com/r/$1/hot.json?limit=$limit" ;;
esac

curl -sH "User-agent: 'your bot 0.1'" "$url" \
	| jq -r '.data.children[].data.url_overridden_by_dest' \
	| xargs mpv --loop=inf
