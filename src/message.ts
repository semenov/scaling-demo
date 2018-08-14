import { Socket } from 'net';
import * as readline from 'readline';

export interface Message {
  senderId?: string;
  channel?: string;
  type: string;
  data: any;
}

export enum MessageType {
  Tx = 'tx',
  Peers = 'peers',
  Greeting = 'greeting',
  Block = 'block',
  BlockProposal = 'block_proposal',
  BlockVote = 'block_vote',
}

function decodeMessage(bufffer: Buffer): Message {
  return JSON.parse(bufffer.toString());
}

function encodeMessage(msg: Message): string {
  return JSON.stringify(msg);
}

export function sendMessage(socket: Socket, msg: Message) {
  socket.write(encodeMessage(msg) + '\n');
}

export function listenMessages(
  socket: Socket,
  handler: (msg: Message, socket: Socket) => void,
): void {
  const rl = readline.createInterface({ input: socket });

  rl.on('line', data => {
    try {
      const msg = decodeMessage(data);
      handler(msg, socket);
    } catch (e) {
      console.error(e);
    }
  });
}
