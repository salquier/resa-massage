import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdmin } from '../../../../lib/admin-auth';

export const DELETE: APIRoute = async ({ request, params }) => {
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  const slotId = params.id!;

  try {
    const slot = await env.DB.prepare(
      'SELECT id, booking_id FROM slots WHERE id = ?'
    ).bind(slotId).first<{ id: string; booking_id: string | null }>();

    if (!slot) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Créneau introuvable' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (slot.booking_id !== null) {
      return new Response(
        JSON.stringify({ error: { code: 'SLOT_BOOKED', message: 'Ce créneau est réservé et ne peut pas être supprimé' } }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await env.DB.prepare('DELETE FROM slots WHERE id = ?').bind(slotId).run();

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
