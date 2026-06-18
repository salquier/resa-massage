import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdmin } from '../../../../lib/admin-auth';
import { updatePractitioner, deletePractitioner } from '../../../../lib/db/practitioners';

export const PATCH: APIRoute = async ({ request, params }) => {
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  try {
    const body = await request.json() as {
      name?: string;
      specialty?: string;
      slot_duration_minutes?: number;
    };
    const updated = await updatePractitioner(env.DB, params.id!, body);
    if (!updated) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Practitioner not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const { token: _token, ...data } = updated;
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

export const DELETE: APIRoute = async ({ request, params }) => {
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  try {
    const result = await deletePractitioner(env.DB, params.id!);
    if (result === 'not_found') {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Practitioner not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (result === 'has_bookings') {
      return new Response(
        JSON.stringify({ error: { code: 'PRACTITIONER_HAS_BOOKINGS', message: 'Cannot delete practitioner with existing bookings' } }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ data: { deleted: true } }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
