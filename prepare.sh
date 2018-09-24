#!/bin/bash

node -v || curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash - && sudo apt-get install -y nodejs
killall node
rm /tmp/app.log
cd ~
rm -rf scaling-demo
git clone https://github.com/semenov/scaling-demo.git &&
cd scaling-demo &&
npm i
