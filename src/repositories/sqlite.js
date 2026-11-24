import { openDatabase } from '../db/connection.js';

function mapEvent(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    organizerId: row.organizer_id,
    title: row.title,
    city: row.city,
    venue: row.venue,
    startsAt: row.starts_at,
    status: row.status,
  };
}

function mapTier(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    priceCents: row.price_cents,
    capacity: row.capacity,
    sold: row.sold,
  };
}

function mapBooking(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    userId: row.user_id,
    tierId: row.tier_id,
    reference: row.reference,
    quantity: row.quantity,
    amountCents: row.amount_cents,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function createSqliteRepository({ databasePath } = {}) {
  const database = openDatabase(databasePath);
  const insertUser = database.prepare(
    'INSERT INTO users (id, role) VALUES (?, ?) ON CONFLICT (id) DO NOTHING',
  );
  const selectEvent = database.prepare('SELECT * FROM events WHERE id = ?');
  const selectTier = database.prepare('SELECT * FROM ticket_tiers WHERE id = ?');
  const selectBooking = database.prepare('SELECT * FROM bookings WHERE reference = ?');

  function ensureUser(id, role) {
    insertUser.run(id, role);
  }

  return {
    async createEvent(event) {
      ensureUser(event.organizerId, 'organizer');
      database.prepare(`
        INSERT INTO events (id, organizer_id, title, city, venue, starts_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.id,
        event.organizerId,
        event.title,
        event.city,
        event.venue,
        event.startsAt,
        event.status,
      );
      return mapEvent(selectEvent.get(event.id));
    },
    async getEvent(id) {
      return mapEvent(selectEvent.get(id));
    },
    async listEvents() {
      return database.prepare('SELECT * FROM events').all().map(mapEvent);
    },
    async updateEvent(id, changes) {
      if (Object.hasOwn(changes, 'status')) {
        database.prepare('UPDATE events SET status = ? WHERE id = ?').run(changes.status, id);
      }
      return mapEvent(selectEvent.get(id));
    },
    async createTier(tier) {
      database.prepare(`
        INSERT INTO ticket_tiers (id, event_id, name, price_cents, capacity, sold)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(tier.id, tier.eventId, tier.name, tier.priceCents, tier.capacity, tier.sold);
      return mapTier(selectTier.get(tier.id));
    },
    async getTier(id) {
      return mapTier(selectTier.get(id));
    },
    async reserveTickets(id, quantity) {
      const result = database.prepare(`
        UPDATE ticket_tiers
        SET sold = sold + ?
        WHERE id = ? AND sold + ? <= capacity
      `).run(quantity, id, quantity);
      return Number(result.changes);
    },
    async listTiersForEvent(eventId) {
      return database.prepare('SELECT * FROM ticket_tiers WHERE event_id = ?')
        .all(eventId)
        .map(mapTier);
    },
    async updateTier(id, changes) {
      if (Object.hasOwn(changes, 'sold')) {
        database.prepare('UPDATE ticket_tiers SET sold = ? WHERE id = ?').run(changes.sold, id);
      }
      return mapTier(selectTier.get(id));
    },
    async createBooking(booking) {
      ensureUser(booking.userId, 'attendee');
      database.prepare(`
        INSERT INTO bookings (
          id, user_id, tier_id, reference, quantity, amount_cents, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        booking.id,
        booking.userId,
        booking.tierId,
        booking.reference,
        booking.quantity,
        booking.amountCents,
        booking.status,
        booking.createdAt,
      );
      return mapBooking(selectBooking.get(booking.reference));
    },
    async getBookingByReference(reference) {
      return mapBooking(selectBooking.get(reference));
    },
    async updateBookingByReference(reference, changes) {
      if (Object.hasOwn(changes, 'status')) {
        database.prepare('UPDATE bookings SET status = ? WHERE reference = ?')
          .run(changes.status, reference);
      }
      return mapBooking(selectBooking.get(reference));
    },
    close() {
      database.close();
    },
  };
}
