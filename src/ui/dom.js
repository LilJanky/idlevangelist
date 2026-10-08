// Tiny DOM helpers. All dynamic text goes through textContent, never innerHTML.
import { iconCanvas } from '../render/sprites.js';

// Element.append(null) writes the text "null" into the page. Conditional children (`cond ? node : null`) are used everywhere,
// so appending nothing is made a no-op for the whole UI.
if (typeof Element !== 'undefined' && !Element.prototype.__nullSafeAppend) {
  const nativeAppend = Element.prototype.append;
  Element.prototype.append = function append(...nodes) {
    return nativeAppend.apply(this, nodes.filter((n) => n !== null && n !== undefined && n !== false));
  };
  Element.prototype.__nullSafeAppend = true;
}

export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'on') for (const [evt, fn] of Object.entries(value)) node.addEventListener(evt, fn);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') node.style.cssText = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function icon(kind, size = 20) {
  return iconCanvas(kind, size);
}

export function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

export function setHidden(node, hidden) {
  node.classList.toggle('hidden', !!hidden);
}
