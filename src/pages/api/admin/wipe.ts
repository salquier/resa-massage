import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdmin } from '../../../lib/admin-auth';

export const POST: APIRoute = async ({ request }) => {
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sms_jobs'),
      env.DB.prepare('DELETE FROM bookings'),
      env.DB.prepare('DELETE FROM slots'),
      env.DB.prepare('DELETE FROM availability_windows'),
      env.DB.prepare('DELETE FROM practitioners'),
      env.DB.prepare('UPDATE sms_config SET confirmation_enabled=1, reminder_enabled=1, practitioner_trigger_enabled=1 WHERE id=1'),
    ]);

    return new Response(
      JSON.stringify({ data: { ok: true } }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
