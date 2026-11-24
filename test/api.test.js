import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer } from '../src/http/app.js';
import { createApiRouter } from '../src/http/apiRoutes.js';
import { createMemoryRepository } from '../src/repositories/memory.js';

describe('REST API', () => {
  let server;
  let baseUrl;

  beforeEach(async () => {
    server = createAppServer({ router: createApiRouter({ repository: createMemoryRepository() }) });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function request(path, { method = 'GET', userId, body } = {}) {
    const headers = {};
    if (userId) headers['x-user-id'] = userId;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }

  async function createPublishedEvent({ title = 'Lagos Jazz Night', priceCents = 2500 } = {}) {
    const created = await request('/api/events', {
      method: 'POST',
      userId: 'organizer-1',
      body: {
        title,
        city: 'Lagos',
        venue: 'Civic Hall',
        startsAt: '2026-12-05T19:00:00Z',
      },
    });
    const eventId = created.body.id;
    const tier = await request(`/api/events/${eventId}/tiers`, {
      method: 'POST',
      userId: 'organizer-1',
      body: { name: 'General', priceCents, capacity: 3 },
    });
    await request(`/api/events/${eventId}/publish`, {
      method: 'POST',
      userId: 'organizer-1',
    });
    return { eventId, tierId: tier.body.id };
  }

  it('creates, publishes, searches, books, pays and cancels through the real server', async () => {
    const created = await request('/api/events', {
      method: 'POST',
      userId: 'organizer-1',
      body: {
        title: 'Lagos Jazz Night',
        city: 'Lagos',
        venue: 'Civic Hall',
        startsAt: '2026-12-05T19:00:00Z',
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'draft');
    assert.equal(created.body.organizerId, 'organizer-1');
    assert.equal((await request('/api/events')).body.length, 0);

    const tier = await request(`/api/events/${created.body.id}/tiers`, {
      method: 'POST',
      userId: 'organizer-1',
      body: { name: 'General', priceCents: 2500, capacity: 3 },
    });
    assert.equal(tier.status, 201);
    assert.equal(tier.body.sold, 0);

    const published = await request(`/api/events/${created.body.id}/publish`, {
      method: 'POST',
      userId: 'organizer-1',
    });
    assert.equal(published.body.status, 'published');
    const search = await request('/api/events?q=JAZZ&city=lagos&maxPriceCents=3000&sort=price');
    assert.equal(search.status, 200);
    assert.deepEqual(search.body.map((event) => event.title), ['Lagos Jazz Night']);

    const booking = await request('/api/bookings', {
      method: 'POST',
      userId: 'attendee-1',
      body: { tierId: tier.body.id, quantity: 2 },
    });
    assert.equal(booking.status, 201);
    assert.equal(booking.body.amountCents, 5000);
    assert.equal(booking.body.status, 'pending');

    const paid = await request(`/api/bookings/${booking.body.reference}/pay`, {
      method: 'POST',
      userId: 'attendee-1',
      body: {},
    });
    assert.equal(paid.status, 200);
    assert.equal(paid.body.status, 'paid');
    assert.equal((await request(`/api/bookings/${booking.body.reference}/cancel`, {
      method: 'POST',
      userId: 'attendee-1',
    })).body.error.code, 'INVALID_TRANSITION');
  });

  it('keeps a declined payment pending and limits payment to the booking attendee', async () => {
    const { tierId } = await createPublishedEvent();
    const booking = await request('/api/bookings', {
      method: 'POST',
      userId: 'attendee-1',
      body: { tierId, quantity: 1 },
    });
    const declined = await request(`/api/bookings/${booking.body.reference}/pay`, {
      method: 'POST',
      userId: 'attendee-1',
      body: { decline: true },
    });
    assert.equal(declined.status, 400);
    assert.equal(declined.body.error.code, 'PAYMENT_DECLINED');

    const wrongAttendee = await request(`/api/bookings/${booking.body.reference}/pay`, {
      method: 'POST',
      userId: 'attendee-2',
      body: {},
    });
    assert.equal(wrongAttendee.body.error.code, 'FORBIDDEN');

    const retry = await request(`/api/bookings/${booking.body.reference}/pay`, {
      method: 'POST',
      userId: 'attendee-1',
      body: {},
    });
    assert.equal(retry.body.status, 'paid');
  });

  it('cancels pending bookings and releases inventory exactly once', async () => {
    const { tierId } = await createPublishedEvent();
    const booking = await request('/api/bookings', {
      method: 'POST',
      userId: 'attendee-1',
      body: { tierId, quantity: 2 },
    });
    const cancelled = await request(`/api/bookings/${booking.body.reference}/cancel`, {
      method: 'POST',
      userId: 'attendee-1',
    });
    assert.equal(cancelled.body.status, 'cancelled');

    const again = await request(`/api/bookings/${booking.body.reference}/cancel`, {
      method: 'POST',
      userId: 'attendee-1',
    });
    assert.equal(again.body.error.code, 'INVALID_TRANSITION');

    const search = await request('/api/events?onlyAvailable=true');
    assert.equal(search.body[0].seatsLeft, 3);
  });

  it('uses the standard error envelope for invalid data and invalid transitions', async () => {
    const missingIdentity = await request('/api/events', {
      method: 'POST',
      body: { title: 'Event', city: 'Lagos', startsAt: '2026-12-05' },
    });
    assert.deepEqual(Object.keys(missingIdentity.body), ['error']);
    assert.equal(missingIdentity.body.error.code, 'VALIDATION');

    const badDate = await request('/api/events', {
      method: 'POST',
      userId: 'organizer-1',
      body: { title: 'Event', city: 'Lagos', startsAt: '2026-02-31' },
    });
    assert.equal(badDate.body.error.code, 'VALIDATION');

    const emptyEvent = await request('/api/events', {
      method: 'POST',
      userId: 'organizer-1',
      body: { title: 'Empty', city: 'Lagos', startsAt: '2026-12-05' },
    });
    const cannotPublish = await request(`/api/events/${emptyEvent.body.id}/publish`, {
      method: 'POST',
      userId: 'organizer-1',
    });
    assert.equal(cannotPublish.body.error.code, 'INVALID_STATE');
    const invalidTier = await request(`/api/events/${emptyEvent.body.id}/tiers`, {
      method: 'POST',
      userId: 'organizer-1',
      body: { name: 'General', priceCents: 19.99, capacity: 1 },
    });
    assert.equal(invalidTier.body.error.code, 'VALIDATION');
    const badSearch = await request('/api/events?sort=unknown');
    assert.equal(badSearch.body.error.code, 'VALIDATION');
  });

  it('rejects bookings for drafts, invalid quantities and unavailable tiers', async () => {
    const draft = await request('/api/events', {
      method: 'POST',
      userId: 'organizer-1',
      body: { title: 'Draft', city: 'Lagos', startsAt: '2026-12-05' },
    });
    const tier = await request(`/api/events/${draft.body.id}/tiers`, {
      method: 'POST',
      userId: 'organizer-1',
      body: { name: 'General', priceCents: 500, capacity: 1 },
    });
    const draftBooking = await request('/api/bookings', {
      method: 'POST',
      userId: 'attendee-1',
      body: { tierId: tier.body.id, quantity: 1 },
    });
    assert.equal(draftBooking.body.error.code, 'INVALID_STATE');

    await request(`/api/events/${draft.body.id}/publish`, {
      method: 'POST',
      userId: 'organizer-1',
    });
    const badQuantity = await request('/api/bookings', {
      method: 'POST',
      userId: 'attendee-1',
      body: { tierId: tier.body.id, quantity: 11 },
    });
    assert.equal(badQuantity.body.error.code, 'VALIDATION');
    const missingTier = await request('/api/bookings', {
      method: 'POST',
      userId: 'attendee-1',
      body: { tierId: 'missing', quantity: 1 },
    });
    assert.equal(missingTier.body.error.code, 'NOT_FOUND');

    const successfulBooking = await request('/api/bookings', {
      method: 'POST',
      userId: 'attendee-1',
      body: { tierId: tier.body.id, quantity: 1 },
    });
    assert.equal(successfulBooking.body.status, 'pending');
    const soldOut = await request('/api/bookings', {
      method: 'POST',
      userId: 'attendee-2',
      body: { tierId: tier.body.id, quantity: 1 },
    });
    assert.equal(soldOut.body.error.code, 'SOLD_OUT');
  });
});
