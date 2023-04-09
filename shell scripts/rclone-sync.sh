#!/bin/bash

# Variables

#PID - Define where the PID should reside
PIDFILE=

#Rclone transfer type - chose which tpye to use, e.g sync, copy, move etc
TYPE=

#Rclone source dir - where source files or DIR is located, use full path and double quotes. Can be local or remote
SOURCE=

#Rclone dest dir - where source files or DIR is located, use full path and double quotes. Can be local or remote
DEST=

#Rclone option flags - uncomment and populate with options as needed. I recommend using one of the options for logging to file.
#OPT1=
#OPT2=
#OPT3=
#OPT4=
#OPT5=



# Check if PID file exists, if it does, check it's valid, and if not create new
if [ -f $PIDFILE ]
then
  PID=$(cat $PIDFILE)
  ps -p $PID > /dev/null 2>&1
  if [ $? -eq 0 ]
  then
    echo "Rclone sync already running"
    exit 1
  else
    ## If process not found assume not running
    echo $$ > $PIDFILE
    if [ $? -ne 0 ]
    then
      echo "Unable to create PID file"
      exit 1
    fi
  fi
else
  echo $$ > $PIDFILE
  if [ $? -ne 0 ]
  then
    echo "Unable to create PID file"
    exit 1
  fi
fi

# Run the sync job
rclone $TYPE "$SOURCE" "$DEST" $OPT1 $OPT2 $OPT3 $OPT4 $OPT5 -v

# Remove the PID file
rm $PIDFILE
