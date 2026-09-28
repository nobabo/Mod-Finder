import Fastify, { LogController } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { readConfig, type Config } from './config';
import { UpstreamClient } from './http';
import { createApi } from './api';
import { isLocale } from '../shared/locale';

// Local development / native-app backend only. Workers does not bundle Fastify.
export async function createApp(options: { config?: Config; http?: UpstreamClient; logging?: boolean } = {}) {
  const config = options.config ?? readConfig(process.env);
  const api = createApi(config, options.http);
  const app = Fastify({ logger: options.logging ? { level: 'info', serializers: { req: req => ({ method: req.method }), res: res => ({ statusCode: res.statusCode }) } } : false, logController: new LogController({ disableRequestLogging: true }), bodyLimit: 16384 });
  await app.register(cors, { origin: config.origins, methods: ['GET', 'HEAD'], credentials: false });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  app.addHook('onSend', async (_req, reply) => { reply.header('Cache-Control', 'no-store'); reply.header('X-Content-Type-Options', 'nosniff'); });
  app.setErrorHandler((error, _req, reply) => {
    const limited = error instanceof Error && 'statusCode' in error && error.statusCode === 429;
    return reply.code(limited ? 429 : 500).send({ error: limited ? 'rate_limited' : 'internal_error' });
  });
  app.get('/*', async (req, reply) => {
    const requestedLanguage = req.headers['accept-language'];
    const response = await api(new Request('http://localhost' + req.url, { method: req.method }), isLocale(requestedLanguage) ? requestedLanguage : 'ko');
    reply.code(response.status);
    response.headers.forEach((value, key) => reply.header(key, value));
    return reply.send(req.method === 'HEAD' ? '' : await response.text());
  });
  return app;
}

