import { listEvents } from '../api.js';
import { el, formatEventDate, formatPrice } from '../ui.js';

const form = document.querySelector('#filters');
const citySelect = document.querySelector('#city');
const eventList = document.querySelector('#events-list');
const resultsStatus = document.querySelector('#results-status');

function renderEvent(event) {
  const price = event.minPriceCents === null ? 'No tickets listed' : `From ${formatPrice(event.minPriceCents)}`;
  const availability = event.seatsLeft > 0
    ? `${event.seatsLeft} seats left`
    : 'Sold out';
  return el('article', { className: 'event-card' }, [
    el('p', { className: 'eyebrow' }, event.city),
    el('h2', {}, event.title),
    el('p', { className: 'event-meta' }, `${event.venue} · ${formatEventDate(event.startsAt)}`),
    el('div', { className: 'card-footer' }, [
      el('div', {}, [
        el('strong', { className: 'price' }, price),
        el('span', { className: 'availability' }, availability),
      ]),
      el('a', { className: 'button button-secondary', href: `/event.html?id=${encodeURIComponent(event.id)}` }, 'View event'),
    ]),
  ]);
}

function populateCities(events) {
  const selected = citySelect.value;
  const cities = [...new Set(events.map((event) => event.city))].sort((a, b) => a.localeCompare(b));
  citySelect.replaceChildren(el('option', { value: '' }, 'All cities'));
  for (const city of cities) {
    citySelect.append(el('option', { value: city }, city));
  }
  if (cities.includes(selected)) citySelect.value = selected;
}

async function updateEvents() {
  const formData = new FormData(form);
  const maxPrice = formData.get('maxPrice');
  const criteria = {
    q: formData.get('q'),
    city: formData.get('city'),
    sort: formData.get('sort'),
  };
  if (maxPrice !== '') criteria.maxPriceCents = Math.round(Number(maxPrice) * 100);

  const events = await listEvents(criteria);
  eventList.replaceChildren(...events.map(renderEvent));
  resultsStatus.textContent = `${events.length} ${events.length === 1 ? 'event' : 'events'} found`;
}

async function start() {
  try {
    populateCities(await listEvents());
    await updateEvents();
  } catch (error) {
    resultsStatus.textContent = error.message;
  }
}

form.addEventListener('input', () => {
  updateEvents().catch((error) => {
    resultsStatus.textContent = error.message;
  });
});
form.addEventListener('change', () => {
  updateEvents().catch((error) => {
    resultsStatus.textContent = error.message;
  });
});

start();
