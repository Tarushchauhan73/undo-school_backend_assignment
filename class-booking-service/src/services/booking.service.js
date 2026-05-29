const { withTransaction, query } = require('../config/db');
const { AppError } = require('../utils/errors');
const { sessionInTimezone } = require('../utils/timezone');

const getAvailableOfferings = async (parentId, parentTimezone) => {
  const { rows } = await query(
    `SELECT o.id, o.title AS offering_title, o.description, o.max_students, o.status,
       c.title AS course_title, u.name AS teacher_name,
       COUNT(DISTINCT s.id)::int AS session_count,
       MIN(s.start_time) AS first_session_utc,
       COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'confirmed')::int AS confirmed_bookings,
       BOOL_OR(b.parent_id = $1 AND b.status = 'confirmed') AS already_booked
     FROM offerings o
     JOIN courses c ON c.id = o.course_id JOIN users u ON u.id = o.teacher_id
     LEFT JOIN sessions s ON s.offering_id = o.id
     LEFT JOIN bookings b ON b.offering_id = o.id
     WHERE o.status = 'active'
     GROUP BY o.id, c.title, u.name ORDER BY first_session_utc ASC NULLS LAST`,
    [parentId]
  );
  return rows.map(r => ({
    id: r.id, courseTitle: r.course_title, offeringTitle: r.offering_title,
    description: r.description, teacherName: r.teacher_name,
    sessionCount: r.session_count, confirmedBookings: r.confirmed_bookings,
    maxStudents: r.max_students,
    spotsLeft: r.max_students ? r.max_students - r.confirmed_bookings : null,
    alreadyBooked: r.already_booked,
    firstSession: r.first_session_utc
      ? sessionInTimezone({ start_time: r.first_session_utc, end_time: r.first_session_utc, id: null, offering_id: r.id, teacher_id: null }, parentTimezone).startTime
      : null,
  }));
};

const bookOffering = async (parentId, offeringId, parentTimezone) => {
  return withTransaction(async (client) => {
    // Lock the offering row
    const { rows: oRows } = await client.query(
      `SELECT o.*, c.title AS course_title FROM offerings o
       JOIN courses c ON c.id = o.course_id
       WHERE o.id = $1 AND o.status = 'active' FOR UPDATE`,
      [offeringId]
    );
    if (!oRows.length) throw new AppError('Offering not found or not bookable.', 404, 'OFFERING_NOT_FOUND');
    const offering = oRows[0];

    // Prevent double booking
    const { rows: dup } = await client.query(
      "SELECT id FROM bookings WHERE parent_id = $1 AND offering_id = $2 AND status = 'confirmed'",
      [parentId, offeringId]
    );
    if (dup.length) throw new AppError('You have already booked this offering.', 409, 'ALREADY_BOOKED');

    // Capacity check — lock booking rows first, then count
    if (offering.max_students !== null) {
      await client.query(
        "SELECT id FROM bookings WHERE offering_id = $1 AND status = 'confirmed' FOR UPDATE",
        [offeringId]
      );
      const { rows: cap } = await client.query(
        "SELECT COUNT(*)::int AS count FROM bookings WHERE offering_id = $1 AND status = 'confirmed'",
        [offeringId]
      );
      if (cap[0].count >= offering.max_students)
        throw new AppError('This offering is fully booked.', 409, 'OFFERING_FULL');
    }

    // Get new offering's sessions
    const { rows: newSessions } = await client.query(
      'SELECT id, start_time, end_time FROM sessions WHERE offering_id = $1 ORDER BY start_time ASC',
      [offeringId]
    );
    if (!newSessions.length) throw new AppError('This offering has no sessions yet.', 400, 'NO_SESSIONS');

    // Lock parent's existing bookings to serialize concurrent requests
    await client.query(
      "SELECT id FROM bookings WHERE parent_id = $1 AND status = 'confirmed' FOR UPDATE",
      [parentId]
    );

    // Detect time conflicts in SQL
    const { rows: conflicts } = await client.query(
      `SELECT se.id AS eid, se.start_time AS es, se.end_time AS ee,
         sn.id AS nid, sn.start_time AS ns, sn.end_time AS ne,
         oe.title AS et, ce.title AS ect
       FROM sessions se
       JOIN bookings b ON b.offering_id = se.offering_id AND b.parent_id = $1 AND b.status = 'confirmed'
       JOIN offerings oe ON oe.id = se.offering_id
       JOIN courses ce ON ce.id = oe.course_id
       JOIN sessions sn ON sn.offering_id = $2
       WHERE se.start_time < sn.end_time AND sn.start_time < se.end_time
       LIMIT 3`,
      [parentId, offeringId]
    );

    if (conflicts.length) {
      const details = conflicts.map(c => ({
        conflictingOffering: `${c.ect} - ${c.et}`,
        existingSession: {
          start: sessionInTimezone({ start_time: c.es, end_time: c.ee, id: c.eid, offering_id: null, teacher_id: null }, parentTimezone).startTime.display,
          end:   sessionInTimezone({ start_time: c.es, end_time: c.ee, id: c.eid, offering_id: null, teacher_id: null }, parentTimezone).endTime.display,
        },
        newSession: {
          start: sessionInTimezone({ start_time: c.ns, end_time: c.ne, id: c.nid, offering_id: offeringId, teacher_id: null }, parentTimezone).startTime.display,
          end:   sessionInTimezone({ start_time: c.ns, end_time: c.ne, id: c.nid, offering_id: offeringId, teacher_id: null }, parentTimezone).endTime.display,
        },
      }));
      throw new AppError('Booking failed: session conflicts with existing bookings.', 409, 'TIME_CONFLICT', details);
    }

    // All clear — insert booking
    const { rows: bRows } = await client.query(
      "INSERT INTO bookings (parent_id, offering_id, status) VALUES ($1, $2, 'confirmed') RETURNING *",
      [parentId, offeringId]
    );

    return {
      booking: bRows[0],
      offering: { id: offering.id, courseTitle: offering.course_title, title: offering.title },
      sessions: newSessions.map(s => sessionInTimezone(s, parentTimezone)),
    };
  });
};

const getParentBookings = async (parentId, parentTimezone) => {
  const { rows: bRows } = await query(
    `SELECT b.id AS booking_id, b.booked_at, b.status AS booking_status,
       o.id AS offering_id, o.title AS offering_title, o.description, o.status AS offering_status,
       c.title AS course_title, u.name AS teacher_name
     FROM bookings b JOIN offerings o ON o.id = b.offering_id
     JOIN courses c ON c.id = o.course_id JOIN users u ON u.id = o.teacher_id
     WHERE b.parent_id = $1 ORDER BY b.booked_at DESC`,
    [parentId]
  );
  if (!bRows.length) return [];
  const offeringIds = [...new Set(bRows.map(r => r.offering_id))];
  const { rows: sRows } = await query(
    'SELECT * FROM sessions WHERE offering_id = ANY($1::uuid[]) ORDER BY start_time ASC',
    [offeringIds]
  );
  const byOffering = sRows.reduce((acc, s) => {
    (acc[s.offering_id] = acc[s.offering_id] || []).push(s); return acc;
  }, {});
  return bRows.map(b => ({
    bookingId: b.booking_id, bookedAt: b.booked_at, bookingStatus: b.booking_status,
    courseTitle: b.course_title, offeringId: b.offering_id,
    offeringTitle: b.offering_title, offeringStatus: b.offering_status, teacherName: b.teacher_name,
    sessions: (byOffering[b.offering_id] || []).map(s => sessionInTimezone(s, parentTimezone)),
  }));
};

const cancelBooking = async (parentId, bookingId) => {
  const { rows } = await query(
    "UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND parent_id = $2 AND status = 'confirmed' RETURNING *",
    [bookingId, parentId]
  );
  if (!rows.length) throw new AppError('Booking not found or already cancelled.', 404, 'BOOKING_NOT_FOUND');
  return rows[0];
};

module.exports = { getAvailableOfferings, bookOffering, getParentBookings, cancelBooking };
