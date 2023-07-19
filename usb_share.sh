#!/bin/sh

MY_FILE=/home/pi/usb_share.img
rm -f $MY_FILE
mkdosfs -C -F 32  $MY_FILE 16000000
sudo modprobe g_multi file=$MY_FILE removable=1
sudo rm -Rf /home/pi/usb_share/*
mount -v -o offset=0 -r -t vfat $MY_FILE /mnt/usb_share/

old_time=$(stat -c %Y $MY_FILE)
while :
do
 new_time=$(stat -c %Y $MY_FILE)
 #echo $new_time
 if [ "$new_time" != "$old_time" ]
 then
  echo "Access from USB!"
  sleep 1
   umount /mnt/usb_share/
   sudo mount -v -o offset=0 -r -t vfat $MY_FILE /mnt/usb_share/
   cp -purn /mnt/usb_share/* /home/pi/usb_share/
   old_time=$(stat -c %Y $MY_FILE)
 fi
 sleep 1
done    