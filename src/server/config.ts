import { z } from 'zod';
import { SOURCES, type Source } from '../shared/types';
const envSchema = z.object({
  HOST: z.string().default('127.0.0.1'), PORT: z.coerce.number().int().min(1).max(65535).default(4318),
  CURSEFORGE_API_KEY: z.string().default(''), STEAM_API_KEY: z.string().default(''),
  DISABLED_SOURCES: z.string().default(''),
  UPSTREAM_USER_AGENT: z.string().default('ModFinder/0.1.0'),
  CORS_ORIGINS: z.string().default('http://localhost:1420,http://127.0.0.1:1420,http://tauri.localhost,https://tauri.localhost,tauri://localhost'),
});
export function readConfig(env: Record<string, string | undefined> = {}) {
  const parsed = envSchema.parse(env);
  const sources = (value: string) => new Set(value.split(',').map(s => s.trim()).filter((s): s is Source => SOURCES.includes(s as Source)));
  return { ...parsed, disabledSources: sources(parsed.DISABLED_SOURCES), origins: parsed.CORS_ORIGINS.split(',').map(s => s.trim()) };
}
export type Config = ReturnType<typeof readConfig>;
