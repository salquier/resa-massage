async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function signCookie(sessionId: string, secret: string): Promise<string> {
  const sig = await hmacSign(sessionId, secret);
  return `${sessionId}.${sig}`;
}

export async function verifyCookie(value: string, secret: string): Promise<boolean> {
  const dotIdx = value.lastIndexOf('.');
  if (dotIdx === -1) return false;
  const sessionId = value.slice(0, dotIdx);
  const expectedSig = await hmacSign(sessionId, secret);
  return value.slice(dotIdx + 1) === expectedSig;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const colonIdx = storedHash.indexOf(':');
  if (colonIdx === -1) return false;
  const saltHex = storedHash.slice(0, colonIdx);
  const hashHex = storedHash.slice(colonIdx + 1);
  const salt = hexToBytes(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
    keyMaterial,
    256
  );
  return timingSafeEqual(bytesToHex(new Uint8Array(derived)), hashHex);
}

export async function requireAdmin(request: Request, env: Env): Promise<Response | null> {
  const cookieHeader = request.headers.get('Cookie') ?? '';
  const match = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/);
  const cookieValue = match?.[1] ?? '';
  if (!cookieValue || !(await verifyCookie(cookieValue, env.ADMIN_SESSION_SECRET))) {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return null;
}
