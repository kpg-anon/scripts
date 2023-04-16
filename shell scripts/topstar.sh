#!/bin/sh
# Download images from a topstarnews article
#	-d	save images in a directory named after the article's date
#		be warned that around New Year the year may be off by one
if [ -z "$1" ]; then printf "usage: topstar [ -d ] URL\n"; exit 0; fi

if [ "$1" = "-d" ]; then
	DATA=$(curl -sL "$2")
else
	DATA=$(curl -sL "$1")
fi

if [ "$1" = "-d" ]; then
	POSTDATE=$(printf "%s" "$DATA" | awk -F' ' \
		'/class="fa fa-clock-o fa-fw"/ { gsub(/^.*승인 ../,""); gsub(/<\/li>.*$/,""); print $1}')
	POSTYEAR=$(printf "%s" "$POSTDATE" | awk -F'.' '{print $1}')
	POSTMONTH=$(printf "%s" "$POSTDATE" | awk -F'.' '{print $2}')
	POSTDAY=$(printf "%s" "$POSTDATE" | awk -F'.' '{print $3}')
	
	DESC=$(printf "%s" "$DATA" \
		| grep '<meta name="description" content="')
	DAY=$(printf "%s" "$DESC" \
		| awk '/일/ {start=match($0, /[0-9]?[0-9]일/); end=match($0, /일/); print(substr($0, start, end-start))}')
	MONTH=$(printf "%s" "$DESC" \
		| awk '/월.*일/ {start=match($0, /[0-9]?[0-9]월/); end=match($0, /월/); print(substr($0, start, end-start))}')
	YEAR=$(printf "%s" "$DESC" \
		| awk '/년.*월.*일.*/ {start=match($0, /[0-9]?[0-9]년/); end=match($0, /년/); print(substr($0, start, end-start))}')
	
	if [ -z "$YEAR" ]; then YEAR=$POSTYEAR; fi
	if [ -z "$MONTH" ]; then MONTH=$POSTMONTH; fi
	if [ -z "$DAY" ]; then DAY=$POSTDAY; fi

	DATE=$(printf "%2s%2s%2s" "$YEAR" "$MONTH" "$DAY" | tr ' ' '0')
fi

#IMGS=$(printf "%s" "$DATA" | grep 'class="posi-re"' | \
IMGS=$(printf "%s" "$DATA" \
	| grep 'class="photo-layout image' \
	| sed -e 's/^.*data-org="//' -e 's/jpg.*$/jpg/')

for IMG in $IMGS; do
	NAME="$(printf "%s\n" "$IMG" | sed "s|^.*/||")"
	if [ "$1" = "-d" ]; then
		NAME=$(printf "%s/%s" "$DATE" "$NAME")
		mkdir -p "$DATE"
	fi
	printf "%s\n" "$NAME"
	curl "$IMG" -so "$NAME"
done

