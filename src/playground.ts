import * as AWS from 'aws-sdk';
import * as path from 'path';
import * as util from 'util';

const awsConfigFile = path.join(__dirname, '../aws-config.json');

AWS.config.loadFromPath(awsConfigFile);

const ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });

async function run() {
  try {
    const description = await ec2.describeInstances({}).promise();
    console.log(util.inspect(description, false, null));
  } catch (e) {
    console.log(e);
  }
}

run();
