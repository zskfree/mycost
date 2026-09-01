import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { buildSystemPrompt } from './ai';
import { requireBearerToken, type AppBindings } from './middleware';
import { listTransactions } from './db';

const app = new Hono<AppBindings>();

app.get('/health', (c) => c.json({ status: 'ok' }));
app.use('*', requireBearerToken);

app.post('/entry', async (c) => {
  buildSystemPrompt(c.req.header('x-client-datetime') ?? '', c.req.header('x-client-weekday') ?? '');
  return c.json({ status: 'TODO', message: 'entry route scaffolded' }, 501);
});

app.get('/transactions', async (c) => {
  await listTransactions(c.env.DB, {});
  return c.json({ status: 'TODO', message: 'transactions route scaffolded' }, 501);
});

app.put('/transactions/:id', (c) => {
  void c.req.param('id');
  return c.json({ status: 'TODO', message: 'update route scaffolded' }, 501);
});

app.delete('/transactions/:id', (c) => {
  void c.req.param('id');
  return c.json({ status: 'TODO', message: 'delete route scaffolded' }, 501);
});

app.get('/export', (c) => c.json({ status: 'TODO', message: 'export route scaffolded' }, 501));

export const onRequest = handle(app);
