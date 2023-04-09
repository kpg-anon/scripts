#!/bin/bash
# RCLONE UPLOAD CRON TAB SCRIPT
# Type crontab -e and add line below (without #)
# * * * * * /etc/scripts/rclone-upload.cron >/dev/null 2>&1
# modify line 20 config file location

if pidof -o %PPID -x "rclone-upload.cron"; then
   exit 1
fi

LOGFILE="/etc/scripts/logs/rclone-upload.cron"
FROM="/path/to/local/folder/"
TO="REMOTE:/folder/"

# CHECK FOR FILES IN FROM FOLDER THAT ARE OLDER THAN 1 MINUTES
if find $FROM* -type f -mmin +1 | read
  then
  echo "$(date "+%d.%m.%Y %T") RCLONE UPLOAD STARTED" | tee -a $LOGFILE
  # MOVE FILES OLDER THAN 15 MINUTES
  rclone move $FROM $TO -c --no-traverse --transfers=300 --checkers=300 --delete-after --min-age 1m --log-file=$LOGFILE
  echo "$(date "+%d.%m.%Y %T") RCLONE UPLOAD ENDED" | tee -a $LOGFILE
fi
exit
