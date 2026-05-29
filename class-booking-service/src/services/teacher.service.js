const { query } = require('../config/db');
const { AppError } = require('../utils/errors');
const { parseToUTC, sessionInTimezone } = require('../utils/timezone');

const createOffering = async (teacherId, { courseId, courseTitle, title, description, maxStudents }) => {
  let cid = courseId;
  if (!cid) {
    if (!courseTitle) throw new AppError('Provide courseId or courseTitle.', 400, 'MISSING_COURSE');
    const { rows } = await query('INSERT INTO courses (teacher_id, title) VALUES ($1, $2) RETURNING id', [teacherId, courseTitle]);
    cid = rows[0].id;
  } else {
    const { rows } = await query('SELECT id FROM courses WHERE id = $1 AND teacher_id = $2', [courseId, teacherId]);
    if (!rows.length) throw new AppError('Course not found or not yours.', 404, 'COURSE_NOT_FOUND');
  }
  const { rows } = await query(
    `INSERT INTO offerings (course_id, teacher_id, title, description, max_students)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [cid, teacherId, title, description || null, maxStudents || null]
  );
  return rows[0];
};

const addSessions = async (teacherId, offeringId, sessions, teacherTimezone) => {
  const { rows: oRows } = await query('SELECT id FROM offerings WHERE id = $1 AND teacher_id = $2 AND status = $3', [offeringId, teacherId, 'active']);
  if (!oRows.length) throw new AppError('Offering not found, not yours, or not active.', 404, 'OFFERING_NOT_FOUND');

  const parsed = sessions.map((s, i) => {
    let startUTC, endUTC;
    try { startUTC = parseToUTC(s.startTime, teacherTimezone); endUTC = parseToUTC(s.endTime, teacherTimezone); }
    catch (err) { throw new AppError(`Session ${i+1}: ${err.message}`, 400, 'INVALID_DATETIME'); }
    if (endUTC <= startUTC) throw new AppError(`Session ${i+1}: endTime must be after startTime.`, 400, 'INVALID_SESSION_TIMES');
    return { startUTC, endUTC };
  });

  for (let i = 0; i < parsed.length; i++)
    for (let j = i+1; j < parsed.length; j++)
      if (parsed[i].startUTC < parsed[j].endUTC && parsed[j].startUTC < parsed[i].endUTC)
        throw new AppError(`Sessions ${i+1} and ${j+1} overlap.`, 400, 'SESSION_SELF_OVERLAP');

  const { rows } = await query(
    `INSERT INTO sessions (offering_id, teacher_id, start_time, end_time)
     SELECT * FROM UNNEST($1::uuid[], $2::uuid[], $3::timestamptz[], $4::timestamptz[]) AS t(offering_id, teacher_id, start_time, end_time)
     RETURNING *`,
    [parsed.map(() => offeringId), parsed.map(() => teacherId), parsed.map(s => s.startUTC), parsed.map(s => s.endUTC)]
  );
  return rows.map(s => sessionInTimezone(s, teacherTimezone));
};

const getTeacherOfferings = async (teacherId, { includeCompleted = false } = {}) => {
  const statuses = includeCompleted ? ['active','completed','cancelled'] : ['active'];
  const { rows } = await query(
    `SELECT o.*, c.title AS course_title, COUNT(s.id)::int AS session_count,
       MIN(s.start_time) AS first_session, MAX(s.end_time) AS last_session
     FROM offerings o JOIN courses c ON c.id = o.course_id
     LEFT JOIN sessions s ON s.offering_id = o.id
     WHERE o.teacher_id = $1 AND o.status = ANY($2::text[])
     GROUP BY o.id, c.title ORDER BY first_session ASC NULLS LAST`,
    [teacherId, statuses]
  );
  return rows;
};

const getOfferingSessions = async (teacherId, offeringId, teacherTimezone) => {
  const { rows: oRows } = await query('SELECT * FROM offerings WHERE id = $1 AND teacher_id = $2', [offeringId, teacherId]);
  if (!oRows.length) throw new AppError('Offering not found or not yours.', 404, 'OFFERING_NOT_FOUND');
  const { rows } = await query('SELECT * FROM sessions WHERE offering_id = $1 ORDER BY start_time ASC', [offeringId]);
  return { offering: oRows[0], sessions: rows.map(s => sessionInTimezone(s, teacherTimezone)) };
};

const updateOfferingStatus = async (teacherId, offeringId, status) => {
  const { rows } = await query('UPDATE offerings SET status = $1 WHERE id = $2 AND teacher_id = $3 RETURNING *', [status, offeringId, teacherId]);
  if (!rows.length) throw new AppError('Offering not found or not yours.', 404, 'OFFERING_NOT_FOUND');
  return rows[0];
};

module.exports = { createOffering, addSessions, getTeacherOfferings, getOfferingSessions, updateOfferingStatus };