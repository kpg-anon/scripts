#!/bin/sh
# dowload "HD포토" pictures from topstarnews for a passed search
#	try what results you get in a browser, Hangul usually works best
[ -z "$1" ] && printf "usage: tzu SEARCHTERMS\n" && exit 0

QT=$(echo "$@" | tr ' ' '+')
i=1
while true; do
	URL="https://www.topstarnews.net/news/articleList.html?sc_area=T&sc_article_type=C&sc_order_by=E&view_type=cs&sc_word=$QT&page=$i"
	NEWARTS=$(curl -s  "$URL" \
		| grep 'class="links"' \
		| sed -e 's|^.*/|http://www.topstarnews.net/news/|' -e 's/".*//')
	[ -z "$NEWARTS" ] && break

	for ART in $NEWARTS; do
		topstar -d "$ART"
	done

	: $((i=i+1))
done
