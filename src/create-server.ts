import * as AWS from 'aws-sdk';
import * as path from 'path';
import * as util from 'util';
import * as sleep from 'sleep-promise';
import * as NodeSSH from 'node-ssh';

const awsConfigFile = path.join(__dirname, '../aws-config.json');
AWS.config.loadFromPath(awsConfigFile);

const sshKeyFile = path.join(__dirname, '../id_rsa');

const ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });

function getIpFromDescription(description) {
  return description.Reservations[0].Instances[0].PublicIpAddress;
}

function isInstanceReady(data) {
  const status = data.InstanceStatuses[0];
  if (!status) return false;

  return status.InstanceState.Name == 'running';
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
    while (true) {
      const instanceStatus = await ec2.describeInstanceStatus({
        InstanceIds: [instanceId],
      }).promise();

      if (isInstanceReady(instanceStatus)) break;

      await sleep(100);
    }

    console.log('Instance ready', ip);

    const ssh = new NodeSSH();

    await ssh.connect({
      host: ip,
      username: 'ubuntu',
      privateKey: sshKeyFile,
    });

    console.log('Connected to host via ssh');

    const commandResult = await ssh.execCommand(
      'curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -',
    );
    console.log(commandResult);

    const command2Result = await ssh.execCommand('sudo apt-get install -y nodejs');
    console.log(command2Result);
    ssh.dispose();

    // console.log('Waiting for instance status ok');
    // const instanceStatus = await ec2.waitFor('instanceStatusOk', {
    //   InstanceIds: [instance.InstanceId],
    // }).promise();

    // console.log('Waiting for instance status ok', instanceStatus);

  } catch (e) {
    console.error(e);
  }
})();

/*
describeInstances response:

{ Reservations:
   [ { Groups: [],
       Instances:
        [ { AmiLaunchIndex: 0,
            ImageId: 'ami-0552e3455b9bc8d50',
            InstanceId: 'i-034476add46f52a4c',
            InstanceType: 't2.micro',
            KeyName: 'demo',
            LaunchTime: 2018-08-28T12:14:44.000Z,
            Monitoring: { State: 'disabled' },
            Placement:
             { AvailabilityZone: 'us-east-2b',
               GroupName: '',
               Tenancy: 'default' },
            PrivateDnsName: 'ip-172-31-21-210.us-east-2.compute.internal',
            PrivateIpAddress: '172.31.21.210',
            ProductCodes: [],
            PublicDnsName: 'ec2-18-219-217-33.us-east-2.compute.amazonaws.com',
            PublicIpAddress: '18.219.217.33',
            State: { Code: 0, Name: 'pending' },
            StateTransitionReason: '',
            SubnetId: 'subnet-6466f61e',
            VpcId: 'vpc-2325174b',
            Architecture: 'x86_64',
            BlockDeviceMappings:
             [ { DeviceName: '/dev/sda1',
                 Ebs:
                  { AttachTime: 2018-08-28T12:14:44.000Z,
                    DeleteOnTermination: true,
                    Status: 'attaching',
                    VolumeId: 'vol-09c21feea769dfeb3' } } ],
            ClientToken: '',
            EbsOptimized: false,
            EnaSupport: true,
            Hypervisor: 'xen',
            ElasticGpuAssociations: [],
            NetworkInterfaces:
             [ { Association:
                  { IpOwnerId: 'amazon',
                    PublicDnsName: 'ec2-18-219-217-33.us-east-2.compute.amazonaws.com',
                    PublicIp: '18.219.217.33' },
                 Attachment:
                  { AttachTime: 2018-08-28T12:14:44.000Z,
                    AttachmentId: 'eni-attach-08005f9cf23c980a1',
                    DeleteOnTermination: true,
                    DeviceIndex: 0,
                    Status: 'attaching' },
                 Description: '',
                 Groups: [ { GroupName: 'default', GroupId: 'sg-f209d09f' } ],
                 Ipv6Addresses: [],
                 MacAddress: '06:f1:78:2f:d0:20',
                 NetworkInterfaceId: 'eni-0217b939060d56c6f',
                 OwnerId: '334161495104',
                 PrivateDnsName: 'ip-172-31-21-210.us-east-2.compute.internal',
                 PrivateIpAddress: '172.31.21.210',
                 PrivateIpAddresses:
                  [ { Association:
                       { IpOwnerId: 'amazon',
                         PublicDnsName: 'ec2-18-219-217-33.us-east-2.compute.amazonaws.com',
                         PublicIp: '18.219.217.33' },
                      Primary: true,
                      PrivateDnsName: 'ip-172-31-21-210.us-east-2.compute.internal',
                      PrivateIpAddress: '172.31.21.210' } ],
                 SourceDestCheck: true,
                 Status: 'in-use',
                 SubnetId: 'subnet-6466f61e',
                 VpcId: 'vpc-2325174b' } ],
            RootDeviceName: '/dev/sda1',
            RootDeviceType: 'ebs',
            SecurityGroups: [ { GroupName: 'default', GroupId: 'sg-f209d09f' } ],
            SourceDestCheck: true,
            Tags: [],
            VirtualizationType: 'hvm',
            CpuOptions: { CoreCount: 1, ThreadsPerCore: 1 } } ],
       OwnerId: '334161495104',
       ReservationId: 'r-06ac1f35fe34e43fe' } ] }
*/
