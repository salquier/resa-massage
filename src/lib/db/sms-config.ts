import type { SmsConfig } from './schema';

export async function getSmsConfig(db: D1Database): Promise<SmsConfig> {
  const row = await db.prepare('SELECT * FROM sms_config WHERE id = 1').first<SmsConfig>();
  return row!;
}

export async function updateSmsConfig(
  db: D1Database,
  config: { confirmationEnabled: boolean; reminderEnabled: boolean; practitionerTriggerEnabled: boolean }
): Promise<SmsConfig> {
  await db.prepare(
    'UPDATE sms_config SET confirmation_enabled = ?, reminder_enabled = ?, practitioner_trigger_enabled = ? WHERE id = 1'
  ).bind(
    config.confirmationEnabled ? 1 : 0,
    config.reminderEnabled ? 1 : 0,
    config.practitionerTriggerEnabled ? 1 : 0
  ).run();
  return getSmsConfig(db);
}
