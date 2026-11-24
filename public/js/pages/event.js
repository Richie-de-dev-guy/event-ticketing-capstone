import { createBooking, getEvent, pay } from '../api.js';
import { el, formatEventDate, formatPrice } from '../ui.js';

const root = document.querySelector('#event-content');
const HOLD_DURATION_MS = 10 * 60 * 1000;
let countdownInterval;

function showMessage(container, message, kind = 'error') {
  container.replaceChildren(el('p', { className: `notice notice-${kind}`, role: 'status' }, message));
}

function renderCheckout(booking) {
  const checkout = el('section', { className: 'checkout-panel', 'aria-labelledby': 'checkout-title' });
  const countdown = el('p', { className: 'countdown', 'aria-live': 'polite' });
  const message = el('div', { className: 'checkout-message', 'aria-live': 'polite' });
  const paymentForm = el('form', { className: 'payment-form' });
  const declineId = `decline-${booking.reference}`;
  const declineCheckbox = el('input', { id: declineId, name: 'decline', type: 'checkbox' });

  paymentForm.append(
    el('h2', { id: 'checkout-title' }, 'Checkout'),
    el('p', {}, `Booking ${booking.reference} · ${formatPrice(booking.amountCents)}`),
    el('div', { className: 'field checkbox-field' }, [
      declineCheckbox,
      el('label', { for: declineId }, 'Simulate a declined mock card'),
    ]),
    el('button', { className: 'button', type: 'submit' }, 'Pay now'),
  );
  checkout.append(countdown, paymentForm, message);

  const expiresAt = Date.now() + HOLD_DURATION_MS;
  const updateCountdown = () => {
    const secondsLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = String(secondsLeft % 60).padStart(2, '0');
    countdown.textContent = secondsLeft > 0
      ? `Your seats are held for ${minutes}:${seconds}.`
      : 'Your seat hold has expired. Please book again.';
    if (secondsLeft === 0) {
      paymentForm.querySelector('button').disabled = true;
      clearInterval(countdownInterval);
    }
  };
  updateCountdown();
  clearInterval(countdownInterval);
  countdownInterval = setInterval(updateCountdown, 1000);

  paymentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = paymentForm.querySelector('button');
    button.disabled = true;
    message.replaceChildren();
    try {
      const paidBooking = await pay(booking.reference, { decline: declineCheckbox.checked });
      clearInterval(countdownInterval);
      showMessage(message, `Payment complete. Your booking reference is ${paidBooking.reference}.`, 'success');
    } catch (error) {
      showMessage(message, error.message);
      if (error.code === 'HOLD_EXPIRED') button.disabled = true;
      else button.disabled = false;
    }
  });

  return checkout;
}

function renderTier(tier, event) {
  const seatsLeft = tier.capacity - tier.sold;
  const soldOut = seatsLeft === 0;
  const quantityId = `quantity-${tier.id}`;
  const quantity = el('input', {
    id: quantityId,
    name: `quantity-${tier.id}`,
    type: 'number',
    min: 1,
    max: Math.min(10, seatsLeft),
    value: 1,
    step: 1,
    disabled: soldOut,
  });
  const status = el('p', {
    className: soldOut ? 'availability sold-out' : 'availability',
    role: soldOut ? 'status' : undefined,
  }, soldOut ? 'Sold out' : `${seatsLeft} seats left`);
  const feedback = el('div', { 'aria-live': 'polite' });
  const form = el('form', { className: 'tier-form' }, [
    el('div', { className: 'tier-heading' }, [
      el('div', {}, [
        el('h3', {}, tier.name),
        el('p', { className: 'price' }, formatPrice(tier.priceCents)),
      ]),
      status,
    ]),
    el('div', { className: 'field quantity-field' }, [
      el('label', { for: quantityId }, 'Tickets'),
      quantity,
    ]),
    el('button', { className: 'button', type: 'submit', disabled: soldOut }, soldOut ? 'Sold out' : 'Book tickets'),
    feedback,
  ]);

  form.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const requestedQuantity = Number(quantity.value);
    const maxQuantity = Math.min(10, seatsLeft);
    if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1 || requestedQuantity > maxQuantity) {
      showMessage(feedback, `Choose between 1 and ${maxQuantity} tickets.`);
      return;
    }

    const button = form.querySelector('button');
    button.disabled = true;
    feedback.replaceChildren();
    try {
      const booking = await createBooking({ tierId: tier.id, quantity: requestedQuantity });
      const checkout = renderCheckout(booking);
      root.querySelector('#checkout')?.remove();
      const checkoutContainer = el('div', { id: 'checkout' }, checkout);
      root.append(checkoutContainer);
      checkoutContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      showMessage(feedback, error.message);
      button.disabled = false;
    }
  });
  return el('article', { className: 'tier-card' }, form);
}

async function start() {
  const eventId = new URLSearchParams(window.location.search).get('id');
  if (!eventId) {
    showMessage(root, 'Choose an event from the events list.');
    return;
  }

  try {
    const event = await getEvent(eventId);
    root.replaceChildren(
      el('section', { className: 'event-hero' }, [
        el('p', { className: 'eyebrow' }, `${event.city} · ${event.venue}`),
        el('h1', {}, event.title),
        el('p', { className: 'event-meta' }, formatEventDate(event.startsAt)),
      ]),
      el('section', { className: 'tiers-section', 'aria-labelledby': 'tiers-title' }, [
        el('div', { className: 'section-heading' }, [
          el('div', {}, [
            el('p', { className: 'eyebrow' }, 'Choose your experience'),
            el('h2', { id: 'tiers-title' }, 'Tickets'),
          ]),
        ]),
        el('div', { className: 'tier-grid' }, event.tiers.map((tier) => renderTier(tier, event))),
      ]),
    );
  } catch (error) {
    showMessage(root, error.message);
  }
}

start();
