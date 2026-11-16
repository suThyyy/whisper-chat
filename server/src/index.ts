import { createGateway } from './app.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '0.0.0.0';
const gateway = createGateway({ logger: true });

const shutdown = async (signal: string): Promise<void> => {
  gateway.app.log.info({ signal }, 'shutting down');
  gateway.io.close();
  await gateway.app.close();
  process.exit(0);
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await gateway.app.listen({ port, host });
} catch (error) {
  gateway.app.log.error(error);
  process.exit(1);
}
