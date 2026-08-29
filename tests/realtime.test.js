import { createServer } from 'http';
import { clearTimeout, setTimeout } from 'timers';

import { io as createClient } from 'socket.io-client';

import { Role } from '../src/config/constants.js';
import {
  emitEnquiryCreated,
  emitEnquiryMessage,
  initSocketServer,
} from '../src/realtime/socketServer.js';
import { signAccessToken } from '../src/utils/jwt.js';

const BUYER_ID = '11111111-1111-4111-8111-111111111111';
const SELLER_ID = '22222222-2222-4222-8222-222222222222';
const ENQUIRY_ID = '33333333-3333-4333-8333-333333333333';

let httpServer;
let socketServer;
let origin;
const clients = [];

function waitFor(socket, event) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 3000);
    socket.once(event, (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

async function connectCustomer(id) {
  const token = signAccessToken({ id, role: Role.CUSTOMER });
  const client = createClient(origin, {
    autoConnect: false,
    auth: { token },
    transports: ['websocket'],
  });
  clients.push(client);
  const connected = waitFor(client, 'connect');
  client.connect();
  await connected;
  return client;
}

beforeAll(async () => {
  httpServer = createServer();
  socketServer = initSocketServer(httpServer);
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  origin = `http://127.0.0.1:${address.port}`;
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.disconnect());
});

afterAll(async () => {
  await new Promise((resolve) => socketServer.close(resolve));
});

describe('enquiry realtime delivery', () => {
  it('delivers one message immediately to both users in a private-sale thread', async () => {
    const [buyer, seller] = await Promise.all([connectCustomer(BUYER_ID), connectCustomer(SELLER_ID)]);
    const buyerMessage = waitFor(buyer, 'enquiry:message');
    const sellerMessage = waitFor(seller, 'enquiry:message');
    const payload = {
      enquiryId: ENQUIRY_ID,
      id: '44444444-4444-4444-8444-444444444444',
      text: 'Is this pet still available?',
      sentAt: new Date().toISOString(),
      fromPartner: false,
    };

    emitEnquiryMessage(
      ENQUIRY_ID,
      { customerId: BUYER_ID, individualOwnerId: SELLER_ID, storeId: null },
      payload
    );

    await expect(buyerMessage).resolves.toEqual(payload);
    await expect(sellerMessage).resolves.toEqual(payload);
  });

  it('announces a brand-new thread to the private seller without an inbox refresh', async () => {
    const seller = await connectCustomer(SELLER_ID);
    const created = waitFor(seller, 'enquiry:created');

    emitEnquiryCreated({ individualOwnerId: SELLER_ID, storeId: null }, { enquiryId: ENQUIRY_ID });

    await expect(created).resolves.toEqual({ enquiryId: ENQUIRY_ID });
  });
});
