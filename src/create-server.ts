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

(async () => {
  const instanceParams = {
    ImageId: 'ami-0552e3455b9bc8d50',
    InstanceType: 't2.micro',
    KeyName: 'demo',
    MinCount: 1,
    MaxCount: 1,
  };

  try {
    const result = await ec2.runInstances(instanceParams).promise();
    const instances = result.Instances;

    if (!instances) {
      console.error('No instance found');
      return;
    }

    const [instanceId] = instances.map(instance => String(instance.InstanceId));

    const description = await ec2.describeInstances({
       InstanceIds: [instanceId],
    }).promise();

    const ip = getIpFromDescription(description);

    console.log('Waiting for instance ready');

    const waitResult = await waitPort({
      host: ip,
      port: 22,
      timeout: 60000,
      // output: 'silent',
    });

    console.log({ waitResult });

    console.log('Instance ready', ip);

    const ssh = new NodeSSH();

    await ssh.connect({
      host: ip,
      username: 'ubuntu',
      privateKey: sshKeyFile,
    });

    console.log('Connected to host via ssh');

    const uploadResult = await ssh.putFile(installScriptFile, 'install.sh');
    console.log(uploadResult);

    const commandResult = await ssh.execCommand('sudo bash /home/ubuntu/install.sh > install.log');
    console.log(commandResult);

    ssh.dispose();

  } catch (e) {
    console.error(e);
  }
})();
