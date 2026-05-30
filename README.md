# undo-school_backend_assignment
# 📚 Class Offering Booking System

A production-ready backend service for a global live-learning platform where teachers conduct online classes for students across different countries and timezones.

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Database | PostgreSQL 16 |
| Authentication | JWT (jsonwebtoken) |
| Timezone Handling | Luxon (IANA timezone aware) |
| Validation | express-validator |
| Security | helmet, bcryptjs |

---

## 🗂️ Project Structure

```
class-booking-service/
├── src/
│   ├── app.js                        # Express entry point
│   ├── config/
│   │   └── db.js                     # PostgreSQL pool + withTransaction helper
│   ├── controllers/
│   │   ├── auth.controller.js        # Register / Login
│   │   ├── teacher.controller.js     # Offering + Session management
│   │   └── booking.controller.js     # Parent booking flow
│   ├── services/
│   │   ├── auth.service.js           # Auth business logic
│   │   ├── teacher.service.js        # Offering + Session business logic
│   │   └── booking.service.js        # Concurrent-safe booking logic
│   ├── middleware/
│   │   ├── auth.js                   # JWT verify + role guard
│   │   └── errorHandler.js           # Global error handler + validator runner
│   ├── routes/
│   │   └── index.js                  # All route definitions
│   ├── validators/
│   │   └── index.js                  # express-validator rule sets
│   └── utils/
│       ├── errors.js                 # AppError class + asyncHandler
│       └── timezone.js               # Luxon helpers (parseToUTC, formatInTimezone)
├── migrations/
│   ├── 001_schema.sql                # Full schema DDL
│   └── migrate.js                    # Migration runner
├── .env.example
└── README.md
```

---
## 🗂️ Project Structure
![Project Structure]
<img width="1440" height="900" alt="project-structure" src="https://github.com/user-attachments/assets/d53786fd-1bb8-49d9-aad3-342abf0d91be" />



## 🗄️ Database Schema

```
users
  id (UUID PK), name, email (UNIQUE), password_hash,
  role (teacher | parent), timezone (IANA), created_at, updated_at

courses
  id (UUID PK), teacher_id → users, title, description, created_at, updated_at

offerings
  id (UUID PK), course_id → courses, teacher_id → users,
  title, description, max_students (nullable), 
  status (active | cancelled | completed), created_at, updated_at

sessions
  id (UUID PK), offering_id → offerings, teacher_id → users,
  start_time (TIMESTAMPTZ UTC), end_time (TIMESTAMPTZ UTC), created_at
  CHECK: end_time > start_time

bookings
  id (UUID PK), parent_id → users, offering_id → offerings,
  status (confirmed | cancelled), booked_at
  UNIQUE (parent_id, offering_id)   ← prevents double booking
```

> All datetimes stored as `TIMESTAMPTZ` in **UTC**. Conversion to user's local timezone happens at the API response layer.

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 16

### 1. Clone & Install

```bash
git clone <repo-url>
cd class-booking-service
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000
NODE_ENV=development

DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=class_booking_db
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d
```

### 3. Create Database & Run Migration

```bash
psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE class_booking_db;"
npm run migrate
```

### 4. Start Server

```bash
npm run dev       # development (nodemon)
npm start         # production
```

Server starts at: `http://localhost:3000/api/v1`

---

## 🔌 API Reference

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication
All protected routes require:
```
Authorization: Bearer <JWT_TOKEN>
```

---

### 🔐 Auth Endpoints

#### Register
```http
POST /auth/register
```
```json
{
  "name": "Alice Smith",
  "email": "alice@example.com",
  "password": "secret123",
  "role": "teacher",
  "timezone": "America/New_York"
}
```
> `role` must be `"teacher"` or `"parent"`  
> `timezone` must be a valid IANA string e.g. `"Asia/Kolkata"`, `"America/New_York"`

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "name": "Alice Smith", "role": "teacher", "timezone": "America/New_York" },
    "token": "<JWT>"
  }
}
```

---

#### Login
```http
POST /auth/login
```
```json
{
  "email": "alice@example.com",
  "password": "secret123"
}
```

---


## 👩‍🏫 Teacher APIs
![Teacher Register API]
<img width="1440" height="900" alt="teacher-register-api" src="https://github.com/user-attachments/assets/013243ff-be57-4e05-bb77-9ca8c26ff3e5" />



### 👩‍🏫 Teacher Endpoints
> Require `Authorization: Bearer <token>` with role `teacher`

#### Create Offering
```http
POST /teacher/offerings
```
```json
{
  "courseTitle": "Minecraft Coding",
  "title": "Saturday Batch",
  "description": "8-week beginner course",
  "maxStudents": 20
}
```
> Provide either `courseId` (existing course UUID) or `courseTitle` (creates course inline)

---

#### Add Sessions to Offering
```http
POST /teacher/offerings/:offeringId/sessions
```
```json
{
  "sessions": [
    { "startTime": "2026-06-07T18:00:00", "endTime": "2026-06-07T19:00:00" },
    { "startTime": "2026-06-14T18:00:00", "endTime": "2026-06-14T19:00:00" },
    { "startTime": "2026-06-21T18:00:00", "endTime": "2026-06-21T19:00:00" }
  ]
}
```
> Times are interpreted in the **teacher's timezone** (stored in their profile) and saved as UTC

**Response** — sessions returned with times in teacher's timezone:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "startTime": {
        "datetime": "2026-06-07T18:00:00.000-04:00",
        "timezone": "America/New_York",
        "offset": "-04:00",
        "display": "Sunday, 07 Jun 2026 at 06:00 PM EDT"
      },
      "endTime": { "..." }
    }
  ]
}
```

---

#### Get My Offerings
```http
GET /teacher/offerings
GET /teacher/offerings?includeCompleted=true
```

---

#### Get Sessions for an Offering
```http
GET /teacher/offerings/:offeringId/sessions
```

---

#### Update Offering Status
```http
PATCH /teacher/offerings/:offeringId/status
```
```json
{ "status": "cancelled" }
```
> `status` must be `"cancelled"` or `"completed"`

---

### 👨‍👩‍👦 Parent Endpoints
> Require `Authorization: Bearer <token>` with role `parent`

#### Browse Available Offerings
```http
GET /parent/offerings
```
> Session times returned in **parent's local timezone**

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "courseTitle": "Minecraft Coding",
      "offeringTitle": "Saturday Batch",
      "teacherName": "Alice Smith",
      "sessionCount": 3,
      "spotsLeft": 19,
      "alreadyBooked": false,
      "firstSession": {
        "datetime": "2026-06-08T03:30:00.000+05:30",
        "timezone": "Asia/Kolkata",
        "offset": "+05:30",
        "display": "Monday, 08 Jun 2026 at 03:30 AM GMT+5:30"
      }
    }
  ]
}
```

---

#### Book an Offering
```http
POST /parent/offerings/:offeringId/book
```
Books the **entire offering** (all sessions) in one action.

**Success `201`:**
```json
{
  "success": true,
  "data": {
    "booking": { "id": "...", "status": "confirmed", "booked_at": "..." },
    "offering": { "courseTitle": "Minecraft Coding", "title": "Saturday Batch" },
    "sessions": [
      {
        "startTime": { "display": "Monday, 08 Jun 2026 at 03:30 AM GMT+5:30" },
        "endTime":   { "display": "Monday, 08 Jun 2026 at 04:30 AM GMT+5:30" }
      }
    ]
  }
}
```

**Conflict `409`:**
```json
{
  "success": false,
  "code": "TIME_CONFLICT",
  "message": "Booking failed: session conflicts with existing bookings.",
  "conflicts": [
    {
      "conflictingOffering": "Minecraft Coding - Saturday Batch",
      "existingSession": {
        "start": "Monday, 15 Jun 2026 at 03:30 AM GMT+5:30",
        "end":   "Monday, 15 Jun 2026 at 04:30 AM GMT+5:30"
      },
      "newSession": {
        "start": "Monday, 15 Jun 2026 at 04:00 AM GMT+5:30",
        "end":   "Monday, 15 Jun 2026 at 05:00 AM GMT+5:30"
      }
    }
  ]
}
```

---

#### Get My Bookings
```http
GET /parent/bookings
```
Returns all bookings with full session list in parent's timezone.

---

#### Cancel a Booking
```http
PATCH /parent/bookings/:bookingId/cancel
```

---

#### Health Check
```http
GET /health
```
```json
{ "status": "ok", "timestamp": "2026-05-29T11:31:12.745Z" }
```

---

## 🌍 Timezone Handling

- All datetimes stored as `TIMESTAMPTZ` (UTC) in PostgreSQL
- Teachers input session times **without offset** — parsed in their IANA timezone via Luxon
- API responses always include times in the **requesting user's timezone** with 4 fields:

```json
{
  "datetime": "2026-06-08T03:30:00.000+05:30",
  "timezone": "Asia/Kolkata",
  "offset":   "+05:30",
  "display":  "Monday, 08 Jun 2026 at 03:30 AM GMT+5:30"
}
```

**Live example proven:**
- Teacher (New York) creates session at `6:00 PM EDT`
- Parent (India) sees the same session as `3:30 AM IST next day` ✅

---

## 🌍 Timezone Handling
![Timezone Conversion]
<img width="1440" height="900" alt="timezone-conversion" src="https://github.com/user-attachments/assets/40de849a-6fd3-4653-a4d2-a190b0a4e67f" />

## 🔒 Concurrency & Conflict Handling

### The Problem
Two parents booking the same capacity-limited offering simultaneously, or one parent firing two concurrent overlapping booking requests.

### Strategy — inside `bookOffering()`

```
BEGIN TRANSACTION (SERIALIZABLE)
  1. SELECT offering FOR UPDATE          → locks offering row, prevents race on capacity
  2. Check duplicate booking
  3. SELECT bookings FOR UPDATE          → locks all booking rows for this offering
  4. COUNT confirmed bookings            → accurate capacity check after lock
  5. Fetch new offering's sessions
  6. SELECT parent's bookings FOR UPDATE → serializes same-parent concurrent requests
  7. SQL overlap query                   → detects any time conflicts
  8. INSERT booking
     UNIQUE(parent_id, offering_id)      → final safety net
COMMIT / ROLLBACK
```

### Conflict Detection SQL
```sql
WHERE existing.start_time < new.end_time
  AND new.start_time      < existing.end_time
```
Standard interval overlap condition — catches partial overlaps, full overlaps, and containment.

---

## 🔒 Conflict Detection
![Conflict Detection](conflict-detection.png)

<img width="1109" height="231" alt="conflict-detection" src="https://github.com/user-attachments/assets/deeb50b0-2622-4c8b-8ae3-fcb7e7169a1b" />

## ❌ Error Response Format

All errors follow a consistent shape:

```json
{
  "success": false,
  "code": "MACHINE_READABLE_CODE",
  "message": "Human readable description.",
  "details": {}
}
```

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `INVALID_DATETIME` | Bad datetime string in session |
| 400 | `NO_SESSIONS` | Offering has no sessions yet |
| 400 | `MISSING_COURSE` | Neither courseId nor courseTitle provided |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 401 | `INVALID_TOKEN` | Bad or expired JWT |
| 403 | `FORBIDDEN` | Wrong role for this endpoint |
| 404 | `OFFERING_NOT_FOUND` | Offering doesn't exist or not yours |
| 404 | `BOOKING_NOT_FOUND` | Booking not found |
| 409 | `ALREADY_BOOKED` | Parent already booked this offering |
| 409 | `OFFERING_FULL` | Max capacity reached |
| 409 | `TIME_CONFLICT` | Session overlaps with existing booking |
| 409 | `DUPLICATE_ENTRY` | Unique constraint violation |
| 422 | `VALIDATION_ERROR` | Request body/param validation failed |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## ✅ Booking Rules Implementation

| Rule | Implementation |
|---|---|
| **Rule 1** — Book at offering level | Single `POST /parent/offerings/:id/book` books all sessions |
| **Rule 2** — Time conflict locking | SQL interval overlap query blocks any conflicting offering |
| **Rule 3** — Concurrent booking | `SELECT FOR UPDATE` at 3 levels + `UNIQUE` constraint as final guard |

---

## 👤 Author

| | |
|---|---|
| **Name** | Tarush Chauhan |
| **Email** | tarushchauhan19@gmail.com |