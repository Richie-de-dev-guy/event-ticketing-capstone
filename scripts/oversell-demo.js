import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createEventService } from '../src/services/eventService.js';
import { mockPaymentGateway } from '../src/lib/mockPaymentGateway.js';

const ATTEMPTS = 50;

function reproduceCheckThenWrite() {
  let sold = 0;
  const observedSold = Array.from({ length: ATTEMPTS }, () => sold);
  const successes = observedSold.filter((snapshot) => snapshot + 1 <= 1).length;
  sold = observedSold.at(-1) + 1;
  return { successes, sold };
}

const before = reproduceCheckThenWrite();
console.log(
  `Before fix (stale check-then-write): ${before.successes} successes, `
  + `${ATTEMPTS - before.successes} SOLD_OUT; ${before.successes} bookings for 1 seat `
  + `(sold counter ${before.sold}/1).`,
);

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'ticketing-oversell-'));
const repository = createSqliteRepository({ databasePath: join(temporaryDirectory, 'demo.db') });

try {
  const events = createEventService(repository);
  const bookings = createBookingService(repository, mockPaymentGateway);
  const event = await events.createEvent({
    title: 'Concurrency Demo',
    city: 'Lagos',
    startsAt: '2026-12-05T17:00:00Z',
  }, 'organizer-1');
  const tier = await events.addTier(event.id, {
    name: 'Last Seat',
    priceCents: 500,
    capacity: 1,
  }, 'organizer-1');
  await events.publishEvent(event.id, 'organizer-1');

  const results = await Promise.allSettled(
    Array.from({ length: ATTEMPTS }, (_, index) => bookings.createBooking(
      { tierId: tier.id, quantity: 1 },
      `attendee-${index}`,
    )),
  );
  const successes = results.filter((result) => result.status === 'fulfilled').length;
  const soldOut = results.filter(
    (result) => result.status === 'rejected' && result.reason.code === 'SOLD_OUT',
  ).length;
  const finalTier = await repository.getTier(tier.id);
  console.log(
    `After fix (atomic SQLite update): ${successes} successes, ${soldOut} SOLD_OUT; `
    + `seats sold ${finalTier.sold}/${finalTier.capacity}.`,
  );

  if (successes !== 1 || soldOut !== ATTEMPTS - 1 || finalTier.sold !== 1) {
    throw new Error('Oversell demo did not meet the one-seat acceptance criteria');
  }
} finally {
  repository.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
