import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdmin } from '../../../lib/admin-auth';
import { getAllSchedules } from '../../../lib/db/slots';

export const GET: APIRoute = async ({ request, url }) => {
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  try {
    const schedules = await getAllSchedules(env.DB, date);
    return new Response(
      JSON.stringify({ data: { schedules, date } }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
