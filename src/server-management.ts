import * as AWS from 'aws-sdk';
import * as path from 'path';
import * as util from 'util';
import * as sleep from 'sleep-promise';
import * as NodeSSH from 'node-ssh';
import * as waitPort from 'wait-port';

/*
Zones:
us-east-1
us-east-2
us-west-2

*/

const awsConfigFile = path.join(__dirname, '../aws-config.json');
const sshKeyFile = path.join(__dirname, '../id_rsa');
const installScriptFile = path.join(__dirname, '../install.sh');
const prepareScriptFile = path.join(__dirname, '../prepare.sh');

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

  console.log('Waiting for instance ready', ip);

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

  console.log('Connected to host via ssh', ip);

  await ssh.putFile(installScriptFile, 'install.sh');

  await ssh.execCommand('sudo bash /home/ubuntu/install.sh > install.log 2>&1 ');

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

  const execString = envToString(env) + `nohup npm run ${command} > /tmp/app.log 2>&1 <&- &`;
  console.log('Running command', host, execString);
  await ssh.execCommand(execString, { cwd: '/home/ubuntu/scaling-demo' });
  ssh.dispose();
}

export async function prepareServer(host: string): Promise<void> {
  const ssh = new NodeSSH();

  console.log('Preparing server', host);

  try {
    await ssh.connect({
      host,
      username: 'ubuntu',
      privateKey: sshKeyFile,
    });

    await ssh.putFile(prepareScriptFile, 'prepare.sh');
    await ssh.execCommand(
      'sudo bash /home/ubuntu/prepare.sh > prepare.log  2>&1',
    );

    console.log('Server prepared', host);
  } catch (e) {
    console.error('Error with server preparing', host, e);
    throw e;
  }

  ssh.dispose();
}

export async function getRunningServers(): Promise<string[]> {
  const ips: string[] = [];
  const description = await ec2.describeInstances().promise();
  const reservations: AWS.EC2.Reservation[] = description.Reservations || [];
  for (const reservation of reservations) {
    if (!reservation.Instances) continue;
    const instance = reservation.Instances[0];
    if (!instance || !instance.State) continue;
    if (instance.State.Name == 'running' && instance.PublicIpAddress) {
      ips.push(instance.PublicIpAddress);
    }
  }

  return ips;
}
