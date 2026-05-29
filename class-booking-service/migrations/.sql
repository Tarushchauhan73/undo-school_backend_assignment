cat > migrations/001_schema.sql << 'EOF'
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255)  NOT NULL,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    role          VARCHAR(20)   NOT NULL CHECK (role IN ('teacher', 'parent')),
    timezone      VARCHAR(100)  NOT NULL DEFAULT 'UTC',
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offerings (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id    UUID         NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id   UUID         NOT NULL REFERENCES users(id),
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    max_students INTEGER      CHECK (max_students > 0),
    status       VARCHAR(20)  NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'cancelled', 'completed')),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id UUID        NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
    teacher_id  UUID        NOT NULL REFERENCES users(id),
    start_time  TIMESTAMPTZ NOT NULL,
    end_time    TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sessions_valid_times CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_sessions_offering_time ON sessions (offering_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_sessions_time_range ON sessions (start_time, end_time);

CREATE TABLE IF NOT EXISTS bookings (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offering_id UUID        NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL DEFAULT 'confirmed'
                            CHECK (status IN ('confirmed', 'cancelled')),
    booked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT bookings_unique_parent_offering UNIQUE (parent_id, offering_id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_parent ON bookings (parent_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_offering ON bookings (offering_id, status);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_offerings_updated_at BEFORE UPDATE ON offerings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EOF