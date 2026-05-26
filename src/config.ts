import 'dotenv/config';
import { z } from 'zod';

const LogLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']);

const ConfigSchema = z.object({
  port: z.coerce.number().int().min(0).max(65535).default(8080),
  host: z.string().min(1).default('0.0.0.0'),
  authUser: z.string().min(1).default('admin'),
  authPassword: z.string().min(1).default('admin'),
  logLevel: LogLevelSchema.default('info'),
  apiBasePath: z.string().startsWith('/').default('/rest/api/v1'),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = ConfigSchema.safeParse({
    port: env.PORT,
    host: env.HOST,
    authUser: env.AUTH_USER,
    authPassword: env.AUTH_PASSWORD,
    logLevel: env.LOG_LEVEL,
    apiBasePath: env.API_BASE_PATH,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration: ${issues}`);
  }
  return Object.freeze(parsed.data);
}
