const { DateTime } = require('luxon');

const isValidTimezone = (tz) => {
  try { return DateTime.now().setZone(tz).isValid; }
  catch { return false; }
};

const parseToUTC = (isoString, timezone = 'UTC') => {
  const dt = DateTime.fromISO(isoString, { zone: timezone });
  if (!dt.isValid) throw new Error(`Invalid datetime: "${isoString}". ${dt.invalidReason}`);
  return dt.toUTC().toJSDate();
};

const formatInTimezone = (utcDate, timezone = 'UTC') => {
  const dt = DateTime.fromJSDate(new Date(utcDate), { zone: 'UTC' }).setZone(timezone);
  return {
    datetime: dt.toISO(),
    timezone: dt.zoneName,
    offset:   dt.toFormat('ZZ'),
    display:  dt.toFormat("cccc, dd LLL yyyy 'at' hh:mm a ZZZZ"),
  };
};

const sessionInTimezone = (session, timezone = 'UTC') => ({
  id:         session.id,
  offeringId: session.offering_id,
  teacherId:  session.teacher_id,
  startTime:  formatInTimezone(session.start_time, timezone),
  endTime:    formatInTimezone(session.end_time, timezone),
  createdAt:  session.created_at,
});

module.exports = { isValidTimezone, parseToUTC, formatInTimezone, sessionInTimezone };