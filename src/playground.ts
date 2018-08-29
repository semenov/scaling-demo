import { runCommand } from './server-management';

const host = '18.191.62.152';
const port = 6000;

async function run() {
  try {
    await runCommand(host, 'tracker', {
      HOST: '0.0.0.0',
      PORT: port,
    });

    console.log('Command executed');
  } catch (e) {
    console.log(e);
  }
}

run();
