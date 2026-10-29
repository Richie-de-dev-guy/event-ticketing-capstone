import { createMemoryRepository } from '../repositories/memory.js';
import { createBookingService } from '../services/bookingService.js';
import { createEventService } from '../services/eventService.js';
import { mockPaymentGateway } from '../lib/mockPaymentGateway.js';
import { Router } from './router.js';

export function createApiRouter({
  repository = createMemoryRepository(),
  paymentGateway = mockPaymentGateway,
} = {}) {
  const router = new Router();
  const events = createEventService(repository);
  const bookings = createBookingService(repository, paymentGateway);

  router.get('/health', () => ({ status: 200, body: { status: 'ok' } }));
  router.post('/api/events', async ({ request, body }) => ({
    status: 201,
    body: await events.createEvent(body, request.headers['x-user-id']),
  }));
  router.post('/api/events/:id/tiers', async ({ request, params, body }) => ({
    status: 201,
    body: await events.addTier(params.id, body, request.headers['x-user-id']),
  }));
  router.post('/api/events/:id/publish', async ({ request, params }) => ({
    status: 200,
    body: await events.publishEvent(params.id, request.headers['x-user-id']),
  }));
  router.get('/api/events', async ({ query }) => {
    const criteria = {};
    for (const key of ['q', 'city', 'from', 'to']) {
      if (query.has(key)) criteria[key] = query.get(key);
    }
    if (query.has('maxPriceCents')) {
      const value = query.get('maxPriceCents');
      criteria.maxPriceCents = value !== '' && Number.isInteger(Number(value))
        ? Number(value)
        : Number.NaN;
    }
    if (query.has('onlyAvailable')) {
      const value = query.get('onlyAvailable');
      if (value !== 'true' && value !== 'false') {
        criteria.onlyAvailable = value;
      } else {
        criteria.onlyAvailable = value === 'true';
      }
    }
    return { status: 200, body: await events.searchEvents(criteria, query.get('sort') ?? 'date') };
  });
  router.post('/api/bookings', async ({ request, body }) => ({
    status: 201,
    body: await bookings.createBooking(body, request.headers['x-user-id']),
  }));
  router.post('/api/bookings/:reference/pay', async ({ request, params, body }) => ({
    status: 200,
    body: await bookings.payBooking(params.reference, request.headers['x-user-id'], body),
  }));
  router.post('/api/bookings/:reference/cancel', async ({ request, params }) => ({
    status: 200,
    body: await bookings.cancelBooking(params.reference, request.headers['x-user-id']),
  }));

  return router;
}
