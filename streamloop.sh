#!/usr/bin/env sh

DEFAULT_URL="http://twitch.tv/woojungx4/"
DEFAULT_RETRY='180'
DEFAULT_QUALITY='best'

msg () {
  echo "[Streamlink Loop] [$(date +%T)] [$1]: $2"
}

check_app () {
  if command -v "$1" > /dev/null 2>&1; then return 0; else return 1; fi
}

msg 'INFO' 'Starting the Streamlink Loop script...'
trap "msg 'INFO' 'Received a signal to stop. Bye!'; exit 0" INT HUP TERM

while getopts 'q:r:u:' OPT; do
  case $OPT in
    q) QUALITY="$OPTARG";;
    r) RETRY="$OPTARG";;
    u) URL="$OPTARG";;
    \?) msg 'ERROR' 'Invalid option. Use -q for quality, -r for retry (in seconds), and -u for URL.'; exit 1;;
  esac
done

if check_app streamlink; then
  while streamlink --can-handle-url "${URL:-$DEFAULT_URL}"; do
    if ! streamlink  --default-stream "${QUALITY:-$DEFAULT_QUALITY}" --url "${URL:-$DEFAULT_URL}"; then
      msg 'WARNING' 'Unable to find a live stream at this moment.'
    fi
    msg 'WARNING' "Streamlink closed. Will retry in ${RETRY:-$DEFAULT_RETRY} seconds."
    sleep "${RETRY:-$DEFAULT_RETRY}"
  done
  msg 'ERROR' "The URL ${URL:-$DEFAULT_URL} is not valid."; exit 1
else
  msg 'ERROR' "Streamlink is not installed or is not reachable at $PATH."; exit 1
fi
