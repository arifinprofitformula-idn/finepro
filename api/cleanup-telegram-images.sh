#!/bin/bash
DIR="/home/ubuntu/projects/finepro/api/uploads/telegram"
find "$DIR" -name "*.jpg" -type f -mmin +1440 -delete 2>/dev/null
find "$DIR" -name "*.png" -type f -mmin +1440 -delete 2>/dev/null
