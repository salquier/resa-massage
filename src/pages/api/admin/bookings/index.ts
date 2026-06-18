import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdmin } from '../../../../lib/admin-auth';

export const GET: APIRoute = async ({ request, url }) => {
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  const q = url.searchParams.get('q')?.trim() ?? '';
  if (!q) {
    return new Response(
      JSON.stringify({ data: [] }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const pattern = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
    const rows = await env.DB.prepare(`
      SELECT b.id, b.participant_name, b.phone,
             p.name as practitioner_name,
             s.start_time as slot_start_time, s.day_date as slot_date
      FROM bookings b
      JOIN practitioners p ON b.practitioner_id = p.id
      JOIN slots s ON b.slot_id = s.id
      WHERE b.participant_name LIKE ? OR b.phone LIKE ?
      ORDER BY s.day_date ASC, s.start_time ASC
    `).bind(pattern, pattern).all<{
      id: string;
      participant_name: string;
      phone: string | null;
      practitioner_name: string;
      slot_start_time: string;
      slot_date: string;
    }>();

    const data = rows.results.map(r => ({
      id: r.id,
      participantName: r.participant_name,
      phone: r.phone ?? null,
      practitionerName: r.practitioner_name,
      slotStartTime: r.slot_start_time,
      slotDate: r.slot_date,
    }));

    return new Response(
      JSON.stringify({ data }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
