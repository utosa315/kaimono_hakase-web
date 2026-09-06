import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Browser event contract, without navigating to a shop or adding dependencies.
function setup() {
  const handlers = {};
  let focused = null;
  const cards = [];
  const input = { value: '', addEventListener: (name, fn) => { handlers[name] = fn; }, focus() { focused = 'input'; } };
  const status = {};
  const list = { appendChild: card => cards.push(card), addEventListener: (name, fn) => { handlers['list-' + name] = fn; }, querySelector: () => cards[0] };
  const example = { dataset: { keyword: '日焼け止め' }, addEventListener: (name, fn) => { handlers.example = fn; } };
  const elements = { kw: input, 'site-list': list, 'search-status': status };
  const document = {
    documentElement: { lang: 'ja' },
    getElementById: id => elements[id],
    querySelectorAll: selector => selector === 'a.site-card' ? cards : selector === '[data-keyword]' ? [example] : [],
    addEventListener: (name, fn) => { handlers['document-' + name] = fn; },
    createElement: () => {
      const children = {};
      const classes = new Set();
      return {
        dataset: {},
        classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name) },
        setAttribute(name, value) { this[name] = value; }, removeAttribute(name) { delete this[name]; },
        querySelector: selector => children[selector] ||= {},
        focus() { focused = this.dataset.site; },
      };
    },
  };
  const context = { document, setTimeout, window: { open() { assert.fail('Typing must never open a shop'); } } };
  vm.runInNewContext(readFileSync(new URL('../search.js', import.meta.url), 'utf8'), context);
  handlers['document-DOMContentLoaded']();
  return { input, cards, handlers, status, focus: () => focused };
}

test('IME confirmation does not move focus or open a shopping site', () => {
  const ui = setup();
  ui.input.value = 'カメラ';
  for (const event of [{ isComposing: true }, { keyCode: 229 }]) {
    ui.handlers.keydown({ key: 'Enter', ...event, preventDefault() { assert.fail('Do not cancel IME confirmation'); } });
    assert.equal(ui.focus(), null);
  }
});

test('Enter selects a destination without automatic navigation; blank Enter stays put', () => {
  const ui = setup();
  ui.handlers.keydown({ key: 'Enter', preventDefault() {} });
  assert.equal(ui.focus(), null);
  ui.input.value = 'camera';
  ui.handlers.input();
  ui.handlers.keydown({ key: 'Enter', preventDefault() {} });
  assert.equal(ui.focus(), 'amazon');
});

test('Example populates links; a new keyword resets visited status', () => {
  const ui = setup();
  assert.equal(ui.cards[0]['aria-disabled'], 'true');
  ui.handlers.example();
  assert.equal(ui.input.value, '日焼け止め');
  assert.equal(new URL(ui.cards[0].href).searchParams.get('k'), '日焼け止め');
  ui.handlers['list-click']({ target: { closest: () => ui.cards[0] } });
  assert.match(ui.status.textContent, /1 \/ 9/);
  assert.match(ui.cards[0]['aria-label'], /確認済み/);
  ui.input.value = 'camera';
  ui.handlers.input();
  assert.equal(ui.cards[0].classList.contains('is-visited'), false);
  assert.doesNotMatch(ui.cards[0]['aria-label'], /確認済み/);
});
