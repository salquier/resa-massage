const EVENT_TIMEZONE = 'Europe/Paris';

// Convert a local Europe/Paris date+time to a UTC Date.
// Slots are stored in local Paris time; Worker clock is UTC — never append Z directly.
export function parisTimeToUTC(dateStr: string, hhmm: string): Date {
  // Step 1 — naive candidate: treat the Paris local time as if it were UTC.
  const naive = new Date(`${dateStr}T${hhmm}:00Z`);

  // Step 2 — find what Paris date+time this naive UTC moment actually maps to.
  // sv-SE locale reliably returns 0-23 hours (no midnight-as-24 quirk) and
  // gives unambiguous YYYY-MM-DD / HH:MM parts via formatToParts.
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: EVENT_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).formatToParts(naive);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';

  // Reconstruct the Paris local time as a fake UTC timestamp so we can diff it.
  const parisAsUtc = new Date(
    `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00Z`
  );

  // Step 3 — offsetMs is the Paris UTC offset (e.g. +7_200_000 for CEST UTC+2).
  // Subtracting it from the naive candidate gives the true UTC instant.
  const offsetMs = parisAsUtc.getTime() - naive.getTime();
  return new Date(naive.getTime() - offsetMs);
}

export function currentLocalHHMM(): string {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: EVENT_TIMEZONE,
  }).formatToParts(new Date());
  const h = parts.find(p => p.type === 'hour')?.value ?? '00';
  const m = parts.find(p => p.type === 'minute')?.value ?? '00';
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

export function currentLocalDate(): string {
  return new Intl.DateTimeFormat('fr-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: EVENT_TIMEZONE,
  }).format(new Date());
}
