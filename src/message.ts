import { Socket } from 'net';
import * as readline from 'readline';
import { validateSchema } from './validation';
import { messageSchema } from './schema';

export interface Message {
  channel: string;
  type: string;
  data: any;
}

export enum MessageType {
  Tx = 'tx',
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
  console.time('sendMessage');
  console.time('sendMessage validateSchema');
  validateSchema(messageSchema, msg);
  console.timeEnd('sendMessage validateSchema');
  if (socket) {
    console.time('sendMessage encodeMessage');
    const encodedMessage = encodeMessage(msg);
    console.timeEnd('sendMessage encodeMessage');
    console.time('sendMessage socket.write');
    socket.write(encodedMessage + '\n');
    console.timeEnd('sendMessage socket.write');
  }

  console.timeEnd('sendMessage');
}

export function listenMessages(
  socket: Socket,
  handler: (msg: Message, socket: Socket) => void,
): void {
  const rl = readline.createInterface({ input: socket });

  rl.on('line', async data => {
    try {
      const msg = decodeMessage(data);
      validateSchema(messageSchema, msg);
      await handler(msg, socket);
    } catch (e) {
      console.error(e);
    }
  });
}
