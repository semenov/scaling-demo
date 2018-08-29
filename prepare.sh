#!/bin/bash

killall node
rm /tmp/app.log
cd ~
rm -rf scaling-demo
git clone https://github.com/semenov/scaling-demo.git &&
cd scaling-demo &&
npm i
