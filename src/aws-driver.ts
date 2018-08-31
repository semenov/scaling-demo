import * as AWS from 'aws-sdk';
import * as path from 'path';

function getIpFromDescription(description) {
  return description.Reservations[0].Instances[0].PublicIpAddress;
}

export class AWSDriver {
  private ec2: AWS.EC2;

  constructor() {
    const awsConfigFile = path.join(__dirname, '../aws-config.json');
    AWS.config.loadFromPath(awsConfigFile);

    this.ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });
  }

  async createServer(): Promise<string> {
    const instanceParams = {
      ImageId: 'ami-0552e3455b9bc8d50',
      InstanceType: 't2.micro',
      KeyName: 'demo',
      MinCount: 1,
      MaxCount: 1,
    };

    const result = await this.ec2.runInstances(instanceParams).promise();
    const instances = result.Instances;

    if (!instances) {
      throw new Error('No instance found');
    }

    const [instanceId] = instances.map(instance => String(instance.InstanceId));

    const description = await this.ec2.describeInstances({
        InstanceIds: [instanceId],
    }).promise();

    const ip = getIpFromDescription(description);

    console.log('Waiting for instance ready', ip);

    await this.ec2.waitFor('instanceStatusOk', {
      InstanceIds: [instanceId],
    }).promise();

    console.log('Instance ready', ip);

    return ip;
  }

  async getRunningServers(): Promise<string[]> {
    const ips: string[] = [];
    const description = await this.ec2.describeInstances().promise();
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
}
