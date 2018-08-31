import * as path from 'path';
import * as util from 'util';
import * as sleep from 'sleep-promise';
import * as NodeSSH from 'node-ssh';
import * as waitPort from 'wait-port';

const sshKeyFile = path.join(__dirname, '../id_rsa');
const installScriptFile = path.join(__dirname, '../install.sh');
const prepareScriptFile = path.join(__dirname, '../prepare.sh');

export interface Driver {
  createServer: () => Promise<string>;
  getRunningServers: () => Promise<string[]>;
  sshUser: string;
}

function envToString(env: object): string {
  let result = '';
  for (const key in env) {
    result += `${key}=${env[key]} `;
  }

  return result;
}

export async function createServer(driver: Driver): Promise<string> {
  const ip = await driver.createServer();
  const ssh = new NodeSSH();

  await ssh.connect({
    host: ip,
    username: driver.sshUser,
    privateKey: sshKeyFile,
  });

  console.log('Connected to host via ssh', ip);

  await ssh.putFile(installScriptFile, 'install.sh');

  await ssh.execCommand(`sudo bash install.sh > install.log 2>&1`);
  console.log('Executed install command', ip);

  ssh.dispose();

  return ip;
}

export async function runCommand(
  driver: Driver,
  host: string,
  command: string,
  env: object,
): Promise<void> {
  const ssh = new NodeSSH();

  try {
    await ssh.connect({
      host,
      username: driver.sshUser,
      privateKey: sshKeyFile,
    });

    const execString = envToString(env) + `nohup npm run ${command} > /tmp/app.log 2>&1 <&- &`;
    console.log('Running command', host, execString);
    await ssh.execCommand(execString, { cwd: `/home/${driver.sshUser}/scaling-demo` });
    ssh.dispose();
  } catch (e) {
    console.error('Problems with running command on', host, e);
    throw e;
  }
}

export async function prepareServer(driver: Driver, host: string): Promise<void> {
  const ssh = new NodeSSH();

  console.log('Preparing server', host);

  try {
    await ssh.connect({
      host,
      username: driver.sshUser,
      privateKey: sshKeyFile,
    });

    await ssh.putFile(prepareScriptFile, 'prepare.sh');
    await ssh.execCommand(
      `sudo bash prepare.sh > prepare.log  2>&1`,
    );

    console.log('Server prepared', host);
  } catch (e) {
    console.error('Error with server preparing', host, e);
    throw e;
  }

  ssh.dispose();
}
