// Tiny DOM helpers. All dynamic text goes through textContent, never innerHTML.
import { iconCanvas } from '../render/sprites.js';

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
