import { app } from '../functions/api/v1/[[route]]';
import type { AppBindings } from '../functions/api/v1/middleware';

export type Env = AppBindings['Bindings'] & {
  ASSETS: Fetcher;
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const response = await app.fetch(request, env, ctx);
    const pathname = new URL(request.url).pathname;

    if (response.status !== 404 || pathname.startsWith('/api/')) {
      return response;
    }

    return env.ASSETS.fetch(request);
  },
};
