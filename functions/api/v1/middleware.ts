import { createMiddleware } from 'hono/factory';

export type AppBindings = {
  Bindings: {
    APP_PASSKEY?: string;
    DB: D1Database;
  };
};

export const requireBearerToken = createMiddleware<AppBindings>(async (c, next) => {
  const expected = c.env.APP_PASSKEY?.trim();
  if (!expected) {
    return c.json({ status: 'ERROR', message: 'APP_PASSKEY missing' }, 500);
  }

  const authorization = c.req.header('Authorization') ?? '';
  if (authorization !== `Bearer ${expected}`) {
    return c.json({ status: 'ERROR', message: 'Unauthorized' }, 401);
  }

  await next();
});
