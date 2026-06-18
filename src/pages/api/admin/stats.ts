import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdmin } from '../../../lib/admin-auth';

export const GET: APIRoute = async ({ request }) => {
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currentHHMM = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

    const [totalRow, completedRows, smsRows] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as count FROM bookings').first<{ count: number }>(),
      env.DB.prepare(`
        SELECT p.name as practitioner_name, COUNT(*) as count
        FROM bookings b
        JOIN slots s ON b.slot_id = s.id
        JOIN practitioners p ON b.practitioner_id = p.id
        WHERE s.day_date = ? AND s.start_time < ?
        GROUP BY p.id
        ORDER BY p.name ASC
      `).bind(today, currentHHMM).all<{ practitioner_name: string; count: number }>(),
      env.DB.prepare(
        "SELECT type, COUNT(*) as count FROM sms_jobs WHERE status = 'sent' GROUP BY type"
      ).all<{ type: string; count: number }>(),
    ]);

    const smsSentByType: Record<string, number> = { confirmation: 0, reminder: 0, practitioner_trigger: 0 };
    smsRows.results.forEach(r => { smsSentByType[r.type] = r.count; });

    return new Response(
      JSON.stringify({
        data: {
          totalBookings: totalRow?.count ?? 0,
          completedByPractitioner: completedRows.results,
          smsSentByType,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
