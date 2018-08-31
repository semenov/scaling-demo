import * as Compute from '@google-cloud/compute';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import * as util from 'util';
import * as waitPort from 'wait-port';

function getIpFromObject(object) {
  return object.networkInterfaces[0].accessConfigs[0].natIP;
}

const zoneName = 'us-central1-a';

export class GCEDriver {
  private compute: Compute;
  sshUser: string = 'semenov';

  constructor() {
    const keyFilename = path.join(__dirname, '../gcloud-key.json');

    this.compute = new Compute({
      keyFilename,
    });
  }

  async createServer(): Promise<string> {
    const zone = this.compute.zone(zoneName);
    const name = 'server-' + uuid();

    const [vm, operation] = await zone.createVM(name, {
      os: 'ubuntu',
      machineType: 'n1-standard-1',
      networkInterfaces: [
        {
          network: 'global/networks/default',
          accessConfigs: [
            { type: 'ONE_TO_ONE_NAT', name: 'External NAT' },
          ],
        },
      ],
    });

    await operation.promise();
    const [metadata] = await vm.getMetadata();
    const ip = getIpFromObject(metadata);

    await waitPort({
      host: ip,
      port: 22,
      timeout: 30000,
      output: 'silent',
    });

    return ip;
  }

  async getRunningServers(): Promise<string[]> {
    const ips: string[] = [];
    const zone = this.compute.zone(zoneName);
    let vms;
    let nextQuery;

    do {
      [vms, nextQuery] = await zone.getVMs(nextQuery);
      for (const vm of vms) {
        const ip = getIpFromObject(vm.metadata);
        ips.push(ip);
      }
    } while (nextQuery);

    return ips;
  }
}
