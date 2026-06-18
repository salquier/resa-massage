import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdmin } from '../../../../lib/admin-auth';
import { listPractitioners, createPractitioner } from '../../../../lib/db/practitioners';

export const GET: APIRoute = async ({ request }) => {
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  try {
    const practitioners = await listPractitioners(env.DB);
    const data = practitioners.map(({ token: _token, ...p }) => p);
    return new Response(JSON.stringify({ data }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  try {
    const { name, specialty, slot_duration_minutes } = await request.json() as {
      name: string;
      specialty: string;
      slot_duration_minutes: number;
    };

    if (!name || !specialty || !slot_duration_minutes) {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_INPUT', message: 'name, specialty, and slot_duration_minutes are required' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const practitioner = await createPractitioner(env.DB, {
      name,
      specialty,
      slot_duration_minutes: Number(slot_duration_minutes),
    });
    const accessUrl = `/practitioner/${practitioner.token}`;
    return new Response(
      JSON.stringify({ data: { id: practitioner.id, token: practitioner.token, accessUrl } }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
