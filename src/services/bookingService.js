import { assertTransition } from '../domain/bookingStateMachine.js';
import { DomainError } from '../domain/errors.js';
import { newId, referenceCode } from '../domain/ids.js';

export const MAX_TICKETS_PER_BOOKING = 10;

function requireUserId(userId) {
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new DomainError('VALIDATION', 'x-user-id is required');
  }
  return userId.trim();
}

function requireObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION', 'Request body must be a JSON object');
  }
  return value;
}

export function createBookingService(repository, paymentGateway) {
  return {
    async createBooking(input, userId) {
      const body = requireObject(input);
      const attendeeId = requireUserId(userId);
      if (typeof body.tierId !== 'string' || body.tierId.trim() === '') {
        throw new DomainError('VALIDATION', 'tierId is required');
      }
      if (
        !Number.isInteger(body.quantity) ||
        body.quantity < 1 ||
        body.quantity > MAX_TICKETS_PER_BOOKING
      ) {
        throw new DomainError(
          'VALIDATION',
          `quantity must be between 1 and ${MAX_TICKETS_PER_BOOKING}`,
        );
      }

      const tier = await repository.getTier(body.tierId);
      if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier not found');
      const event = await repository.getEvent(tier.eventId);
      if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
      if (event.status !== 'published') {
        throw new DomainError('INVALID_STATE', 'Tickets can only be booked for published events');
      }
      const seatsLeft = tier.capacity - tier.sold;
      if (seatsLeft < body.quantity) {
        const message = seatsLeft === 0
          ? `${tier.name} is sold out`
          : `Only ${seatsLeft} ticket(s) left in ${tier.name}`;
        throw new DomainError('SOLD_OUT', message, { seatsLeft });
      }

      await repository.updateTier(tier.id, { sold: tier.sold + body.quantity });
      let reference;
      do {
        reference = referenceCode();
      } while (await repository.getBookingByReference(reference));
      return repository.createBooking({
        id: newId(),
        reference,
        userId: attendeeId,
        tierId: tier.id,
        quantity: body.quantity,
        amountCents: tier.priceCents * body.quantity,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    },

    async payBooking(reference, userId, paymentRequest = {}) {
      const attendeeId = requireUserId(userId);
      const booking = await repository.getBookingByReference(reference);
      if (!booking) throw new DomainError('NOT_FOUND', 'Booking not found');
      if (booking.userId !== attendeeId) {
        throw new DomainError('FORBIDDEN', 'Only the attendee who made the booking can pay for it');
      }
      assertTransition(booking.status, 'paid');
      const result = await paymentGateway.charge({ decline: paymentRequest.decline === true });
      if (!result.success) {
        throw new DomainError('PAYMENT_DECLINED', 'Payment was declined');
      }
      return repository.updateBookingByReference(reference, { status: 'paid' });
    },

    async cancelBooking(reference, userId) {
      const attendeeId = requireUserId(userId);
      const booking = await repository.getBookingByReference(reference);
      if (!booking) throw new DomainError('NOT_FOUND', 'Booking not found');
      if (booking.userId !== attendeeId) {
        throw new DomainError('FORBIDDEN', 'Only the attendee who made the booking can cancel it');
      }
      assertTransition(booking.status, 'cancelled');
      if (booking.status !== 'pending') {
        throw new DomainError('INVALID_TRANSITION', 'Only unpaid bookings can be cancelled');
      }
      const tier = await repository.getTier(booking.tierId);
      if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier not found');
      await repository.updateTier(tier.id, { sold: tier.sold - booking.quantity });
      return repository.updateBookingByReference(reference, { status: 'cancelled' });
    },
  };
}
