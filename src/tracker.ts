import * as Hapi from 'hapi';

async function startTracker() {
  const server = new Hapi.Server({
    host: 'localhost',
    port: 6000,
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
