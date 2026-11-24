import { events } from './mockData.js';

const HOLD_DURATION_MS = 10 * 60 * 1000;
const bookings = new Map();
let nextBookingId = 1;

function apiError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.response = { error: { code, message } };
  return error;
}

function summarize(event) {
  const tiers = event.tiers;
  return {
    id: event.id,
    title: event.title,
    city: event.city,
    venue: event.venue,
    startsAt: event.startsAt,
    status: event.status,
    tierCount: tiers.length,
    minPriceCents: tiers.length ? Math.min(...tiers.map((tier) => tier.priceCents)) : null,
    seatsLeft: tiers.reduce((total, tier) => total + tier.capacity - tier.sold, 0),
  };
}

export async function listEvents(criteria = {}) {
  const query = criteria.q?.trim().toLowerCase();
  const city = criteria.city?.trim().toLowerCase();
  let results = events
    .filter((event) => event.status === 'published')
    .map(summarize)
    .filter((event) => {
      if (query && !`${event.title} ${event.venue}`.toLowerCase().includes(query)) return false;
      if (city && event.city.toLowerCase() !== city) return false;
      if (
        criteria.maxPriceCents !== undefined
        && (event.minPriceCents === null || event.minPriceCents > criteria.maxPriceCents)
      ) return false;
      return true;
    });

  const sortBy = criteria.sort ?? 'date';
  if (!['date', 'price', 'availability'].includes(sortBy)) {
    throw apiError('VALIDATION', 'Unknown event sort order');
  }
  results = [...results].sort((a, b) => {
    if (sortBy === 'price') {
      return (a.minPriceCents ?? Infinity) - (b.minPriceCents ?? Infinity)
        || a.title.localeCompare(b.title);
    }
    if (sortBy === 'availability') {
      return b.seatsLeft - a.seatsLeft || a.title.localeCompare(b.title);
    }
    return a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title);
  });
  return results;
}

export async function getEvent(id) {
  const event = events.find((item) => item.id === id && item.status === 'published');
  if (!event) throw apiError('NOT_FOUND', 'Event not found');
  return structuredClone(event);
}

export async function createBooking({ tierId, quantity }) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw apiError('VALIDATION', 'quantity must be between 1 and 10');
  }
  const tier = events.flatMap((event) => event.tiers).find((item) => item.id === tierId);
  if (!tier) throw apiError('NOT_FOUND', 'Ticket tier not found');
  if (tier.capacity - tier.sold < quantity) {
    throw apiError('SOLD_OUT', `${tier.name} does not have enough tickets available`);
  }
  tier.sold += quantity;
  const bookingNumber = nextBookingId++;
  const reference = `MOCK-${Date.now()}-${bookingNumber}`;
  const booking = {
    id: `mock-booking-${bookingNumber}`,
    userId: 'attendee-demo',
    tierId,
    reference,
    quantity,
    amountCents: tier.priceCents * quantity,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  bookings.set(reference, { ...booking, expiresAt: Date.now() + HOLD_DURATION_MS });
  return structuredClone(booking);
}

export async function pay(reference, { decline = false } = {}) {
  const booking = bookings.get(reference);
  if (!booking) throw apiError('NOT_FOUND', 'Booking not found');
  if (booking.status !== 'pending') {
    throw apiError('INVALID_TRANSITION', 'Only pending bookings can be paid');
  }
  if (Date.now() >= booking.expiresAt) {
    const tier = events.flatMap((event) => event.tiers).find((item) => item.id === booking.tierId);
    if (tier) tier.sold -= booking.quantity;
    booking.status = 'expired';
    throw apiError('HOLD_EXPIRED', 'The ticket hold has expired. Please book again.');
  }
  if (decline) throw apiError('PAYMENT_DECLINED', 'The mock card was declined. Try again.');
  booking.status = 'paid';
  return structuredClone(booking);
}
