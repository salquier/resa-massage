-- Performance indexes for frequently joined/filtered columns

CREATE INDEX IF NOT EXISTS idx_slots_practitioner_date ON slots(practitioner_id, day_date);
CREATE INDEX IF NOT EXISTS idx_slots_booking_id ON slots(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(phone);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_sms_jobs_booking_id ON sms_jobs(booking_id);
CREATE INDEX IF NOT EXISTS idx_sms_jobs_status ON sms_jobs(status);
