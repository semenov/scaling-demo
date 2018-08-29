import * as AWS from 'aws-sdk';
import * as path from 'path';
import * as util from 'util';
import * as sleep from 'sleep-promise';
import * as NodeSSH from 'node-ssh';
import * as waitPort from 'wait-port';

const awsConfigFile = path.join(__dirname, '../aws-config.json');
const sshKeyFile = path.join(__dirname, '../id_rsa');
const installScriptFile = path.join(__dirname, '../install.sh');

AWS.config.loadFromPath(awsConfigFile);

const ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });

function getIpFromDescription(description) {
  return description.Reservations[0].Instances[0].PublicIpAddress;
}

function envToString(env: object): string {
  let result = '';
  for (const key in env) {
    result += `${key}=${env[key]} `;
  }

  return result;
}

export async function createServer(): Promise<string> {
  const instanceParams = {
    ImageId: 'ami-0552e3455b9bc8d50',
    InstanceType: 't2.micro',
    KeyName: 'demo',
    MinCount: 1,
    MaxCount: 1,
  };

  const result = await ec2.runInstances(instanceParams).promise();
  const instances = result.Instances;

  if (!instances) {
    throw new Error('No instance found');
  }

  const [instanceId] = instances.map(instance => String(instance.InstanceId));

  const description = await ec2.describeInstances({
      InstanceIds: [instanceId],
  }).promise();

  const ip = getIpFromDescription(description);

  console.log('Waiting for instance ready');

  await ec2.waitFor('instanceStatusOk', {
    InstanceIds: [instanceId],
  }).promise();

  console.log('Instance ready', ip);

  const ssh = new NodeSSH();

  await ssh.connect({
    host: ip,
    username: 'ubuntu',
    privateKey: sshKeyFile,
  });

  console.log('Connected to host via ssh');

  await ssh.putFile(installScriptFile, 'install.sh');

  const commandResult = await ssh.execCommand('sudo bash /home/ubuntu/install.sh > install.log');
  console.log(commandResult);

  ssh.dispose();

  return ip;
}

export async function runCommand(host: string, command: string, env: object): Promise<void> {
  const ssh = new NodeSSH();

  await ssh.connect({
    host,
    username: 'ubuntu',
    privateKey: sshKeyFile,
  });

  const execString = envToString(env) + `nohup npm run ${command} &`;
  const commandResult = await ssh.execCommand(execString, { cwd: '/home/ubuntu/scaling-demo' });
  console.log(commandResult);
  ssh.dispose();
}
