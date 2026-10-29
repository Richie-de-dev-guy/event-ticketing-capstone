export function createMemoryRepository() {
  const events = new Map();
  const tiers = new Map();
  const bookings = new Map();
  const bookingsByReference = new Map();

  return {
    async createEvent(event) {
      events.set(event.id, event);
      return event;
    },
    async getEvent(id) {
      return events.get(id);
    },
    async listEvents() {
      return [...events.values()];
    },
    async updateEvent(id, changes) {
      const event = events.get(id);
      if (!event) return undefined;
      Object.assign(event, changes);
      return event;
    },
    async createTier(tier) {
      tiers.set(tier.id, tier);
      return tier;
    },
    async getTier(id) {
      return tiers.get(id);
    },
    async listTiersForEvent(eventId) {
      return [...tiers.values()].filter((tier) => tier.eventId === eventId);
    },
    async updateTier(id, changes) {
      const tier = tiers.get(id);
      if (!tier) return undefined;
      Object.assign(tier, changes);
      return tier;
    },
    async createBooking(booking) {
      bookings.set(booking.id, booking);
      bookingsByReference.set(booking.reference, booking);
      return booking;
    },
    async getBookingByReference(reference) {
      return bookingsByReference.get(reference);
    },
    async updateBookingByReference(reference, changes) {
      const booking = bookingsByReference.get(reference);
      if (!booking) return undefined;
      Object.assign(booking, changes);
      return booking;
    },
  };
}
