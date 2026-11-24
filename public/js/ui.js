export function el(tag, props = {}, children = []) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (name.startsWith('on') && typeof value === 'function') {
      element.addEventListener(name.slice(2).toLowerCase(), value);
    } else if (name === 'className') {
      element.setAttribute('class', value);
    } else if (['disabled', 'checked', 'selected', 'value'].includes(name)) {
      element[name] = value;
    } else if (value !== undefined && value !== null) {
      element.setAttribute(name, String(value));
    }
  }

  const items = Array.isArray(children) ? children : [children];
  for (const child of items) {
    if (child === undefined || child === null || child === false) continue;
    if (child instanceof Node) {
      element.append(child);
    } else {
      const text = document.createTextNode('');
      text.textContent = String(child);
      element.append(text);
    }
  }
  return element;
}

export function formatPrice(amountCents) {
  return `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(amountCents / 100)}`;
}

export function formatEventDate(value) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
