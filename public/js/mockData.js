const seedEvents = [
  {
    id: 'lagos-jazz-night',
    title: 'Lagos Jazz Night',
    city: 'Lagos',
    venue: 'Civic Hall',
    startsAt: '2026-12-05T19:00:00Z',
    status: 'published',
    tiers: [
      { id: 'jazz-general', name: 'General', priceCents: 250000, capacity: 100, sold: 38 },
      { id: 'jazz-vip', name: 'VIP', priceCents: 750000, capacity: 30, sold: 22 },
    ],
  },
  {
    id: 'abuja-art-weekend',
    title: 'Abuja Art Weekend',
    city: 'Abuja',
    venue: 'Unity Arts Centre',
    startsAt: '2026-12-12T10:00:00Z',
    status: 'published',
    tiers: [
      { id: 'art-entry', name: 'Day Pass', priceCents: 150000, capacity: 80, sold: 34 },
      { id: 'art-workshop', name: 'Workshop', priceCents: 400000, capacity: 20, sold: 20 },
    ],
  },
  {
    id: 'ibadan-food-fair',
    title: 'Ibadan Street Food Fair',
    city: 'Ibadan',
    venue: 'Agodi Gardens',
    startsAt: '2026-12-19T12:00:00Z',
    status: 'published',
    tiers: [
      { id: 'food-general', name: 'General Entry', priceCents: 50000, capacity: 200, sold: 91 },
    ],
  },
];

export let events = structuredClone(seedEvents);

export function resetMockData() {
  events = structuredClone(seedEvents);
}
