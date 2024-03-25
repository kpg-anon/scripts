#!/usr/bin/env sh

PLAYLIST="$@"
ARCHIVE=/path/to/archive.log
YTDLP=/path/to/yt-dlp
FFMPEG=/path/to/ffmpeg
OUTPUT=/path/to/output
LOG=/path/to/channelrip.log

if ! command -v aria2c &> /dev/null
then
    echo "aria2c not found in $PATH"
    exit
fi

echo "$(date "+%y%m%d %a %l:%M%p") Starting yt-dlp"

$YTDLP  \
	--verbose \
	--rm-cache-dir \
	--ignore-errors \
	--download-archive $ARCHIVE \
	--ffmpeg-location $FFMPEG \
	--no-check-certificates \
	--user-agent "Mozilla/5.0 (Windows NT 6.1; rv:52.0) Gecko/20100101 Firefox/52.0" \
	--geo-bypass-country KR \
	--continue \
	--sleep-requests 2 \
  --sleep-interval 5 \
  --max-sleep-interval 30 \
	--downloader aria2c \
	--downloader-args aria2c:"-j 16 -x 16 -s 16 -k 1M" \
	--playlist-reverse \
	--encoding UTF-8 \
	--add-metadata \
	--parse-metadata "%(title)s:%(meta_title)s" \
	--parse-metadata "%(channel)s:%(meta_artist)s" \
	--parse-metadata "%(webpage_url)s:%(meta_description)s" \
	--embed-thumbnail \
	--sub-langs en,eng,en_US \
	--convert-subs srt \
	--embed-subs \
	--output "$OUTPUT/%(playlist_autonumber)s - [%(upload_date>%y%m%d %a)s] - %(channel)s - %(title)s___[%(id)s].%(ext)s" \
	$PLAYLIST \
	2>&1 | tee $LOG

echo "$(date "+%y%m%d %a %l:%M%p") yt-dlp finished"

exit
