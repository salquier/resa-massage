import type { AvailabilityWindow } from './schema';

export async function getWindowsForDay(
  db: D1Database,
  practitionerId: string,
  date: string
): Promise<AvailabilityWindow[]> {
  const result = await db.prepare(
    'SELECT * FROM availability_windows WHERE practitioner_id = ? AND day_date = ? ORDER BY start_time ASC'
  ).bind(practitionerId, date).all<AvailabilityWindow>();
  return result.results;
}

export function deleteWindowsForDayStmt(
  db: D1Database,
  practitionerId: string,
  date: string
): D1PreparedStatement {
  return db.prepare(
    'DELETE FROM availability_windows WHERE practitioner_id = ? AND day_date = ?'
  ).bind(practitionerId, date);
}

export function insertWindowStmt(
  db: D1Database,
  window: { id: string; practitioner_id: string; day_date: string; start_time: string; end_time: string }
): D1PreparedStatement {
  return db.prepare(
    'INSERT INTO availability_windows (id, practitioner_id, day_date, start_time, end_time) VALUES (?, ?, ?, ?, ?)'
  ).bind(window.id, window.practitioner_id, window.day_date, window.start_time, window.end_time);
}
