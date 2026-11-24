CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'attendee'
    CHECK (role IN ('organizer', 'attendee', 'staff'))
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  organizer_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  city TEXT NOT NULL,
  venue TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS ticket_tiers (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  sold INTEGER NOT NULL DEFAULT 0 CHECK (sold >= 0 AND sold <= capacity),
  UNIQUE (event_id, name)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  tier_id TEXT NOT NULL REFERENCES ticket_tiers(id),
  reference TEXT NOT NULL UNIQUE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded', 'checked_in')),
  created_at TEXT NOT NULL
);
