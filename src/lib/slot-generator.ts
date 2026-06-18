import type { AvailabilityWindow } from './db/schema';

export interface SlotTime {
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
}

export function generateSlots(
  windows: AvailabilityWindow[],
  slotDurationMinutes: number,
  _date: string // YYYY-MM-DD — passed by caller for context, unused in pure computation
): SlotTime[] {
  const slots: SlotTime[] = [];
  for (const window of windows) {
    let current = toMinutes(window.start_time);
    const end = toMinutes(window.end_time);
    while (current + slotDurationMinutes <= end) {
      slots.push({
        startTime: fromMinutes(current),
        endTime: fromMinutes(current + slotDurationMinutes),
      });
      current += slotDurationMinutes;
    }
  }
  return slots;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
