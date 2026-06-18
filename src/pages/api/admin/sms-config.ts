import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdmin } from '../../../lib/admin-auth';
import { getSmsConfig, updateSmsConfig } from '../../../lib/db/sms-config';
import type { SmsConfig } from '../../../lib/db/schema';

function toDto(config: SmsConfig) {
  return {
    confirmationEnabled: config.confirmation_enabled === 1,
    reminderEnabled: config.reminder_enabled === 1,
    practitionerTriggerEnabled: config.practitioner_trigger_enabled === 1,
  };
}

export const GET: APIRoute = async ({ request }) => {
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  try {
    const config = await getSmsConfig(env.DB);
    return new Response(JSON.stringify({ data: toDto(config) }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PUT: APIRoute = async ({ request }) => {
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  try {
    const body = await request.json() as {
      confirmationEnabled: boolean;
      reminderEnabled: boolean;
      practitionerTriggerEnabled: boolean;
    };
    const updated = await updateSmsConfig(env.DB, body);
    return new Response(JSON.stringify({ data: toDto(updated) }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
