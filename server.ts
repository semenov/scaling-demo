import * as net from 'net';

interface HostInfo {
    host: string;
    port: number;
}

interface PeerOptions {
    seeds: HostInfo[];
    port: number;
}

class PeerNode {
    server: net.Server;
    seeds: HostInfo[];
    port: number;

    constructor(options: PeerOptions) {
        this.seeds = options.seeds;
        this.port = options.port;
    }

    async start() {
        this.server = net.createServer(socket => {
            console.log('New incoming connection');
            this.handleConnect(socket);
        });

        return new Promise((resolve, reject) => {
            this.server.on('error', (e) => {
                reject(e);
            });
    
            this.server.on('listening', async () => {
                await this.handleStart();
                resolve();
            });
    
            this.server.listen(this.port);
        })
    }

    async connect(host, port) {
        return new Promise((resolve, reject) => {
            console.log('Before net.connect');
            const socket = net.connect(port, host);

            socket.on('connect', async () => {
                console.log('New outgoing connection');
                this.handleConnect(socket);
                resolve();
            });

            socket.on('error', (e) => {
                reject(e);
            });
        });
    }

    async handleStart() {
        await Promise.all(this.seeds.map(async (seed) => {
            try {
                await this.connect(seed.host, seed.port);
            } catch (e) {
                console.error('Failed to connect to seed', seed);
            }
        }));
    }

    async handleConnect(socket) {
        socket.on('data', (data) => {
            console.log('Data recieved:', data);
            try {
                const msg = JSON.parse(data.toString());
                this.handleMessage(msg);
            } catch (e) {
                console.error(e);
            }
        });

        socket.on('end', () => {
            console.log('Peer disconnected');
        });
    }
    
    async handleMessage(msg) {
        console.log('Message handler', msg);
    }
}


(async () => {
    try {
        console.log('Starting servers');
        const peer = new PeerNode({ 
            port: 7777, 
            seeds: [] 
        });
        await peer.start();

        const peer2 = new PeerNode({ 
            port: 7778, 
            seeds: [{
                host: 'localhost',
                port: 7777
            }, {
                host: 'localhost',
                port: 7776
            }] 
        });
        await peer2.start();

        console.log('Ready');
    } catch (e) {
        console.error('Error!:', e);
    }

})();
