import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdmin } from '../../../lib/admin-auth';

export const POST: APIRoute = async ({ request }) => {
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  let body: { phone?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const phone = body.phone?.trim();
  if (!phone) {
    return new Response(
      JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Numéro de téléphone requis' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const id = `test_${crypto.randomUUID()}`;
  await env.DB.prepare(
    'INSERT INTO sms_test_queue (id, phone, status, created_at) VALUES (?, ?, ?, ?)'
  ).bind(id, phone, 'pending', new Date().toISOString()).run();

  return new Response(
    JSON.stringify({ data: { jobId: id } }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  );
};
