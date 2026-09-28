import 'dotenv/config';
import { createApp } from './app';
import { readConfig } from './config';
const config = readConfig(process.env);
const app = await createApp({ config, logging: true });
await app.listen({ host: config.HOST, port: config.PORT });
process.once('SIGINT', () => void app.close());
process.once('SIGTERM', () => void app.close());
