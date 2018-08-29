import * as Hapi from 'hapi';

async function startTracker() {
  if (process.env['HOST'] === undefined) {
    throw new Error('You should specify HOST env variable');
  }

  if (process.env['PORT'] === undefined) {
    throw new Error('You should specify PORT env variable');
  }

  const host = String(process.env['HOST']);
  const port = Number(process.env['PORT']);

  const server = new Hapi.Server({
    host,
    port,
  });

  let nodes = {};

  server.route({
    method: 'GET',
    path: '/status',
    handler: (request: Hapi.Request) => {
      return { status: 'ok' };
    },
  });

  server.route({
    method: 'GET',
    path: '/nodes',
    handler: (request: Hapi.Request) => {
      return nodes;
    },
  });

  server.route({
    method: 'POST',
    path: '/nodes',
    handler: async (request: Hapi.Request) => {
      nodes = request.payload;
      return { status: 'ok' };
    },
  });

  await server.start();
}

startTracker().catch(e => console.error(e));
