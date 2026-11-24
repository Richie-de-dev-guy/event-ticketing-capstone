import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiRouter } from '../src/http/apiRoutes.js';
import { createAppServer } from '../src/http/app.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createEventService } from '../src/services/eventService.js';

describe('SQLite oversell protection', () => {
  let directory;
  let repository;
  let server;
  let baseUrl;
  let tierId;
  let eventId;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'ticketing-oversell-test-'));
    repository = createSqliteRepository({ databasePath: join(directory, 'test.db') });
    const events = createEventService(repository);
    const event = await events.createEvent({
      title: 'One Seat Event',
      city: 'Lagos',
      startsAt: '2026-12-05T17:00:00Z',
    }, 'organizer-1');
    eventId = event.id;
    const tier = await events.addTier(event.id, {
      name: 'General',
      priceCents: 500,
      capacity: 1,
    }, 'organizer-1');
    tierId = tier.id;
    await events.publishEvent(event.id, 'organizer-1');

    server = createAppServer({ router: createApiRouter({ repository }) });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    repository?.close();
    if (directory) rmSync(directory, { recursive: true, force: true });
  });

  it('allows exactly one of 50 simultaneous requests to reserve the last seat', async () => {
    const responses = await Promise.all(
      Array.from({ length: 50 }, (_, index) => fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': `attendee-${index}`,
        },
        body: JSON.stringify({ tierId, quantity: 1 }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }))),
    );

    const successes = responses.filter((response) => response.status === 201);
    const soldOut = responses.filter(
      (response) => response.status === 400 && response.body.error.code === 'SOLD_OUT',
    );
    const finalTier = await repository.getTier(tierId);

    assert.equal(successes.length, 1);
    assert.equal(soldOut.length, 49);
    assert.equal(finalTier.sold, 1);
    assert.equal(finalTier.sold <= finalTier.capacity, true);
  });

  it('keeps events and tier inventory when the repository is reopened', async () => {
    repository.close();
    repository = createSqliteRepository({ databasePath: join(directory, 'test.db') });

    const savedEvent = await repository.getEvent(eventId);
    const savedTier = await repository.getTier(tierId);
    assert.equal(savedEvent.title, 'One Seat Event');
    assert.equal(savedTier.capacity, 1);
    assert.equal(savedTier.sold, 0);
  });
});
