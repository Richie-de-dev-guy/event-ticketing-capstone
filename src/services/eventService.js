import { filterEvents, sortEvents, summarizeEvent } from '../domain/eventSearch.js';
import { DomainError } from '../domain/errors.js';
import { newId } from '../domain/ids.js';

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${field} is required`);
  }
  return value.trim();
}

function requireWholeNumber(value, field, minimum) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new DomainError('VALIDATION', `${field} must be a whole number of at least ${minimum}`);
  }
  return value;
}

function requireObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION', 'Request body must be a JSON object');
  }
  return value;
}

function parseStartsAt(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', 'startsAt must be a valid date');
  }
  const date = new Date(value);
  const datePrefix = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (Number.isNaN(date.getTime())) {
    throw new DomainError('VALIDATION', 'startsAt must be a valid date');
  }
  if (datePrefix) {
    const [, year, month, day] = datePrefix.map(Number);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) {
      throw new DomainError('VALIDATION', 'startsAt must be a valid date');
    }
  }
  return date.toISOString();
}

function getUserId(userId) {
  return requireText(userId, 'x-user-id');
}

async function findEvent(repository, eventId) {
  const event = await repository.getEvent(eventId);
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
  return event;
}

function requireOrganizer(event, userId) {
  if (event.organizerId !== getUserId(userId)) {
    throw new DomainError('FORBIDDEN', 'Only the event organizer can change this event');
  }
}

export function createEventService(repository) {
  return {
    async createEvent(input, userId) {
      const body = requireObject(input);
      const event = {
        id: newId(),
        organizerId: getUserId(userId),
        title: requireText(body.title, 'Title'),
        city: requireText(body.city, 'City'),
        venue: typeof body.venue === 'string' ? body.venue.trim() : '',
        startsAt: parseStartsAt(body.startsAt),
        status: 'draft',
      };
      return repository.createEvent(event);
    },

    async addTier(eventId, input, userId) {
      const body = requireObject(input);
      const event = await findEvent(repository, eventId);
      requireOrganizer(event, userId);
      if (event.status !== 'draft') {
        throw new DomainError('INVALID_STATE', 'Ticket tiers can only be added to draft events');
      }
      const tier = {
        id: newId(),
        eventId,
        name: requireText(body.name, 'Tier name'),
        priceCents: requireWholeNumber(body.priceCents, 'priceCents', 0),
        capacity: requireWholeNumber(body.capacity, 'capacity', 1),
        sold: 0,
      };
      return repository.createTier(tier);
    },

    async publishEvent(eventId, userId) {
      const event = await findEvent(repository, eventId);
      requireOrganizer(event, userId);
      const tiers = await repository.listTiersForEvent(eventId);
      if (tiers.length === 0) {
        throw new DomainError('INVALID_STATE', 'Add at least one ticket tier before publishing');
      }
      return repository.updateEvent(eventId, { status: 'published' });
    },

    async searchEvents(criteria = {}, sortBy = 'date') {
      if (criteria.onlyAvailable !== undefined && typeof criteria.onlyAvailable !== 'boolean') {
        throw new DomainError('VALIDATION', 'onlyAvailable must be true or false');
      }
      const events = await repository.listEvents();
      const summaries = [];
      for (const event of events) {
        if (event.status !== 'published') continue;
        const tiers = await repository.listTiersForEvent(event.id);
        summaries.push(summarizeEvent(event, tiers));
      }
      return sortEvents(filterEvents(summaries, criteria), sortBy);
    },

    async getEvent(eventId) {
      return findEvent(repository, eventId);
    },
  };
}
