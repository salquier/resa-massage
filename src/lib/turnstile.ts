export async function verifyTurnstileToken(token: string, secretKey: string): Promise<boolean> {
  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    });
    const data = await resp.json() as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
