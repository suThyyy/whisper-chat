import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { Server as SocketServer } from 'socket.io';

export interface Gateway {
  app: FastifyInstance;
  io: SocketServer;
}

interface GatewayOptions {
  logger?: boolean;
  p0SocketToken?: string;
}

const redactionPaths = [
  'req.headers.authorization',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.token',
  'req.body.accessToken',
  'req.body.refreshToken',
  'req.body.envelope.payload',
  'req.body.envelope.wraps',
  'req.body.payload',
  'req.body.wraps',
  'res.headers.authorization'
];

export function createGateway(options: GatewayOptions = {}): Gateway {
  const app = Fastify({
    bodyLimit: 256 * 1024,
    logger: options.logger
      ? {
          level: process.env.LOG_LEVEL ?? 'info',
          redact: { paths: redactionPaths, censor: '[REDACTED]' }
        }
      : false,
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID()
  });

  app.get(
    '/v1/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['status'],
            properties: { status: { const: 'ready' } }
          }
        }
      }
    },
    async () => ({ status: 'ready' as const })
  );

  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    request.log.error({ err: error }, 'request failed');
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    return reply.status(statusCode).send({
      code: statusCode === 413 ? 'PAYLOAD_TOO_LARGE' : statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
      message: statusCode >= 500 ? 'Internal server error' : error.message,
      requestId: request.id
    });
  });

  const io = new SocketServer(app.server, {
    transports: ['websocket'],
    allowUpgrades: false,
    serveClient: false,
    maxHttpBufferSize: 8 * 1024
  });

  const expectedToken = options.p0SocketToken ?? process.env.P0_SOCKET_TOKEN ?? 'p0-valid-token';
  io.use((socket, next) => {
    const accessToken = socket.handshake.auth?.accessToken;
    const protocolVersion = socket.handshake.auth?.protocolVersion;
    if (typeof accessToken !== 'string' || accessToken !== expectedToken || protocolVersion !== 1) {
      const authError = new Error('unauthorized') as Error & { data?: Record<string, string> };
      authError.data = { code: 'UNAUTHORIZED', requestId: randomUUID() };
      next(authError);
      return;
    }
    next();
  });

  io.on('connection', (socket) => {
    socket.emit('session.expiring', { expiresAt: Date.now() + 15 * 60 * 1000 });
  });

  return { app, io };
}

export async function closeGateway(gateway: Gateway): Promise<void> {
  await new Promise<void>((resolve) => gateway.io.close(() => resolve()));
  if (gateway.app.server.listening) {
    await gateway.app.close();
  }
}
