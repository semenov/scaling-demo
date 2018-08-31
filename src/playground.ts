import * as AWS from 'aws-sdk';
import * as path from 'path';
import * as util from 'util';
import { GCEDriver } from './gce-driver';

async function run() {
  try {
    const driver = new GCEDriver();
    // const ip = await driver.createServer();
    // console.log({ ip });
    const ips = await driver.getRunningServers();
    console.log(ips);
  } catch (e) {
    console.log(e);
  }
}

run();
