#!/usr/bin/env sh

###############################################################
# Streamlink helper script for looping a valid streamlink URL #
###############################################################

# Base directory for output path
OUTPUT_BASE_PATH=~/path/to/STREAMS

# Streamlink options for different platforms
STREAMLINK_OPTIONS_TWITCH='--twitch-proxy-playlist=https://eu2.luminous.dev --twitch-proxy-playlist-fallback --twitch-disable-ads'
STREAMLINK_OPTIONS_AFREECATV='--stream-segment-timeout 90'

msg () {
  echo "[Streamlink Loop] [$(date +%T)] [$1]: $2"
}

show_help () {
  echo "Usage: ./streamloop.sh -p <platform> -u <username> [-q <quality>] [-r <retry>]"
  echo "  -p  Platform (twitch or afreecatv)"
  echo "  -u  Username on the platform"
  echo "  -q  Quality of the stream (default: best)"
  echo "  -r  Retry interval in seconds (default: 180)"
  echo ""
  if [ "$1" = "twitch" ]; then
    echo "Twitch Quality Options:"
    echo "  audio_only, 160p (worst), 360p, 480p, 720p_alt, 720p, 720p60, 1080p, 1080p60 (best)"
  elif [ "$1" = "afreecatv" ]; then
    echo "AfreecaTV Quality Options:"
    echo "  sd (worst), hd, original (best)"
  fi
}

show_invalid_quality_message () {
  msg 'ERROR' "Invalid quality option for $1."
  show_help "$1"
  exit 1
}

check_app () {
  if command -v "$1" > /dev/null 2>&1; then return 0; else return 1; fi
}

# Construct URL and output path based on platform and username
construct_url_and_output () {
  PLATFORM=$1
  USERNAME=$2
  case $PLATFORM in
    twitch)
      URL="https://www.twitch.tv/$USERNAME"
      OUTPUT_PATH="$OUTPUT_BASE_PATH/TWITCH/$USERNAME/$USERNAME-{time:%y%m%d}_{time:%a}_{time:%H}.{time:%M%p}.ts"
      STREAMLINK_OPTIONS=$STREAMLINK_OPTIONS_TWITCH
      ;;
    afreecatv)
      URL="https://play.afreecatv.com/$USERNAME/"
      OUTPUT_PATH="$OUTPUT_BASE_PATH/AFREECATV/$USERNAME/$USERNAME-{time:%y%m%d}_{time:%a}_{time:%H}.{time:%M%p}.ts"
      STREAMLINK_OPTIONS=$STREAMLINK_OPTIONS_AFREECATV
      ;;
    *)
      msg 'ERROR' "Unsupported platform: $PLATFORM. Supported platforms are twitch and afreecatv."
      exit 1
      ;;
  esac
}

# Main logic
msg 'INFO' 'Starting the Streamlink Loop script...'
trap "msg 'INFO' 'Received a signal to stop. Bye!'; exit 0" INT HUP TERM

# Initialize variables for default options
PLATFORM=''
USERNAME=''
RETRY='180'
QUALITY='best'

# Process command-line options
while getopts 'hp:u:r:q:' OPT; do
  case $OPT in
    h) show_help "$PLATFORM"; exit 0;;
    p) PLATFORM="$OPTARG";;
    u) USERNAME="$OPTARG";;
    r) RETRY="$OPTARG";;
    q) QUALITY="$OPTARG";;
    \?) show_help "$PLATFORM"; exit 1;;
  esac
done

# Validate required options
if [ -z "$PLATFORM" ] || [ -z "$USERNAME" ]; then
  msg 'ERROR' 'Platform and username are required. Use -p for platform and -u for username.'
  exit 1
fi

# Validate quality option
case $PLATFORM in
  twitch)
    if ! [[ $QUALITY =~ ^(audio_only|160p|360p|480p|720p_alt|720p|720p60|1080p|1080p60|best)$ ]]; then
      show_invalid_quality_message "Twitch"
    fi
    ;;
  afreecatv)
    if ! [[ $QUALITY =~ ^(sd|hd|original|best)$ ]]; then
      show_invalid_quality_message "AfreecaTV"
    fi
    ;;
esac

construct_url_and_output "$PLATFORM" "$USERNAME"

if check_app streamlink; then
  while streamlink --can-handle-url "$URL"; do
    if ! streamlink $STREAMLINK_OPTIONS --output "$OUTPUT_PATH" --default-stream "$QUALITY" --url "$URL"; then
      msg 'WARNING' 'Unable to find a live stream at this moment.'
    fi
    msg 'WARNING' "Streamlink closed. Will retry in $RETRY seconds."
    sleep "$RETRY"
  done
  msg 'ERROR' "The URL $URL is not valid."; exit 1
else
  msg 'ERROR' "Streamlink is not installed or is not reachable at $PATH."; exit 1
fi
