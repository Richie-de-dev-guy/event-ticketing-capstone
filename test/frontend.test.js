import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { createBooking, getEvent, listEvents, pay } from '../public/js/api.js';
import { resetMockData } from '../public/js/mockData.js';
import { formatPrice } from '../public/js/ui.js';

describe('mock frontend API', () => {
  beforeEach(() => resetMockData());

  it('filters case-insensitively and sorts by the selected event field', async () => {
    const filtered = await listEvents({ q: 'JAZZ', city: 'lagos', sort: 'price' });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 'lagos-jazz-night');
    const cheapest = await listEvents({ sort: 'price' });
    assert.equal(cheapest[0].id, 'ibadan-food-fair');
  });

  it('caps bookings at ten and at seats remaining, then leaves a declined booking retryable', async () => {
    await assert.rejects(createBooking({ tierId: 'jazz-general', quantity: 11 }), { code: 'VALIDATION' });
    await assert.rejects(createBooking({ tierId: 'jazz-vip', quantity: 9 }), { code: 'SOLD_OUT' });

    const booking = await createBooking({ tierId: 'jazz-general', quantity: 2 });
    assert.equal(booking.status, 'pending');
    assert.equal(booking.amountCents, 500000);
    assert.equal('expiresAt' in booking, false);
    await assert.rejects(pay(booking.reference, { decline: true }), { code: 'PAYMENT_DECLINED' });
    const paid = await pay(booking.reference);
    assert.equal(paid.status, 'paid');
    await assert.rejects(pay(booking.reference), { code: 'INVALID_TRANSITION' });
    assert.equal((await getEvent('lagos-jazz-night')).tiers[0].sold, 40);
  });
});

describe('price formatting', () => {
  it('converts whole cents to a whole-naira display', () => {
    assert.equal(formatPrice(250000), '₦2,500');
  });
});
