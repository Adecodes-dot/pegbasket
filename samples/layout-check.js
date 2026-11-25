// Excerpt from the browser tests. It runs inside the page and looks for layout
// faults a player would notice: a page that scrolls sideways, a value printed
// as "null" or "undefined", controls off screen or cut short, and buttons that
// overlap or hide under something else. Every screen is checked with it at five
// screen sizes. `game()` returns the running game.

/** Layout faults a player would notice: things off screen or covering each other. */
export function layoutProblems() {
  const W = innerWidth;
  const H = innerHeight;
  const problems = [];
  const wide = document.documentElement.scrollWidth;
  if (wide > W + 1) problems.push(`the page scrolls sideways (${wide}px wide in ${W}px)`);
  // A value that never arrived, printed as words (Element.append prints null as "null").
  const stray = (document.getElementById('ui').innerText.match(/\b(null|undefined|NaN|\[object Object\])\b/) || [])[0];
  if (stray) problems.push(`the screen shows the word "${stray}"`);
  const overlay = [...document.querySelectorAll('.overlay')].pop();
  const scope = overlay || document.getElementById('ui');
  const shown = (e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const label = (e) => (e.textContent.trim() || e.getAttribute('aria-label') || e.className).slice(0, 30);
  // Peg strips scroll sideways on purpose, so what is inside them is exempt.
  const els = [...scope.querySelectorAll('button, input, h1, h2, .panel, .chip, .hint, .turn-banner, .aim-hint')]
    .filter((e) => shown(e) && !e.closest('.tray, .ammo'));
  for (const e of els) {
    const r = e.getBoundingClientRect();
    if (r.left < -1 || r.right > W + 1) problems.push(`"${label(e)}" sticks out sideways (${Math.round(r.left)} to ${Math.round(r.right)} in ${W})`);
  }
  // Things cut off at the top or bottom, unless they sit in something that scrolls.
  for (const e of els) {
    if (e.closest('.sheet, .modal-body')) continue;
    const r = e.getBoundingClientRect();
    if (r.top < -1 || r.bottom > H + 1) problems.push(`"${label(e)}" is cut off (${Math.round(r.top)} to ${Math.round(r.bottom)} in ${H})`);
  }
  const buttons = els.filter((e) => e.tagName === 'BUTTON');
  // Buttons hidden under something else, and fixed labels cut short (a
  // player's own name may shorten with "…", nothing else should).
  const name = game().save.data.settings.playerName;
  for (const b of buttons) {
    const r = b.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (cx >= 0 && cx <= W && cy >= 0 && cy <= H && !b.closest('.sheet, .modal-body')) {
      const top = document.elementFromPoint(cx, cy);
      if (top && !b.contains(top)) problems.push(`"${label(b)}" is hidden under "${label(top)}"`);
    }
    const text = b.querySelector('span');
    if (text && text.scrollWidth > text.clientWidth + 1 && !(name && text.textContent.includes(name))) {
      problems.push(`"${label(b)}" label is cut short`);
    }
  }
  for (let i = 0; i < buttons.length; i++) {
    for (let j = i + 1; j < buttons.length; j++) {
      const a = buttons[i].getBoundingClientRect();
      const b = buttons[j].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 2 && oy > 2 && !buttons[i].contains(buttons[j]) && !buttons[j].contains(buttons[i])) {
        problems.push(`"${label(buttons[i])}" and "${label(buttons[j])}" overlap`);
      }
    }
  }
  if (overlay) {
    for (const b of overlay.querySelectorAll('.modal-actions button')) {
      const r = b.getBoundingClientRect();
      if (r.top < -1 || r.bottom > H + 1) problems.push(`dialog button "${label(b)}" is off screen`);
    }
  }
  return problems;
}
