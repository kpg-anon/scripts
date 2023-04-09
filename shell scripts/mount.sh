#!/bin/bash
# Set to run @reboot in cron
# crontab -e
# @reboot ~/path/to/mount.sh

LOCAL_DIR=/path/to/source/
REMOTE_DIR=REMOTE:/path/to/dest/

rclone mount \
	--allow-other \
	--buffer-size 256M \
	--timeout 5s \
	--log-file=~/logfile.log \
	$REMOTE_DIR \
	$LOCAL_DIR
