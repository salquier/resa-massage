import type { Practitioner } from './db/schema';

export async function requirePractitionerToken(
  token: string,
  env: Env
): Promise<Practitioner | Response> {
  const row = await env.DB.prepare(
    'SELECT * FROM practitioners WHERE token = ?'
  ).bind(token).first<Practitioner>();

  if (!row) {
    return new Response(
      JSON.stringify({ error: { code: 'INVALID_TOKEN', message: 'Invalid practitioner token' } }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return row;
}
