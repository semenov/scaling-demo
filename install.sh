#!/bin/bash

curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash - &&
sudo apt-get install -y nodejs &&
cd ~ &&
git clone https://github.com/semenov/scaling-demo.git &&
cd scaling-demo &&
npm i
