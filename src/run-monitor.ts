import { monitorStats } from './monitor-stats';

async function runMonitor() {
  if (process.env['TRACKER_URL'] === undefined) {
    console.error('You should specify TRACKER_URL env variable');
    return;
  }
  const trackerUrl = String(process.env['TRACKER_URL']);
  await monitorStats(trackerUrl);
}

runMonitor();
