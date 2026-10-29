# API examples

Start the server with `npm start`. The examples use `localhost:3000`; replace
`organizer-1` and `attendee-1` with the identities you want to use.

## Create an event

```sh
curl -X POST http://localhost:3000/api/events \
  -H "content-type: application/json" \
  -H "x-user-id: organizer-1" \
  -d '{"title":"Lagos Jazz Night","city":"Lagos","venue":"Civic Hall","startsAt":"2026-12-05T19:00:00Z"}'
```

Save the returned event `id` for the following requests.

## Add a ticket tier

```sh
curl -X POST http://localhost:3000/api/events/EVENT_ID/tiers \
  -H "content-type: application/json" \
  -H "x-user-id: organizer-1" \
  -d '{"name":"General","priceCents":2500,"capacity":100}'
```

Save the returned tier `id` as `TIER_ID`.

## Publish the event

```sh
curl -X POST http://localhost:3000/api/events/EVENT_ID/publish \
  -H "x-user-id: organizer-1"
```

## Search events

```sh
curl "http://localhost:3000/api/events?q=jazz&city=lagos&maxPriceCents=3000&sort=price"
```

## Book tickets

```sh
curl -X POST http://localhost:3000/api/bookings \
  -H "content-type: application/json" \
  -H "x-user-id: attendee-1" \
  -d '{"tierId":"TIER_ID","quantity":2}'
```

Save the returned booking `reference` for the payment and cancellation requests.

## Pay for a booking

```sh
curl -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/pay \
  -H "content-type: application/json" \
  -H "x-user-id: attendee-1" \
  -d '{}'
```

To simulate a declined payment, send `{"decline":true}` instead. The booking
remains pending and can be paid again.

## Cancel an unpaid booking

```sh
curl -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/cancel \
  -H "x-user-id: attendee-1"
```
