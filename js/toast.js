const el = document.querySelector('#toast');
let hide = 0;

// short message at the bottom of the screen, with one button when there is something to take back
export function say(msg, label, act) {
  el.replaceChildren(msg);
  if (act) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = () => { el.hidePopover?.(); act(); };
    el.append(b);
  }
  if (el.showPopover && !el.matches(':popover-open')) el.showPopover();
  clearTimeout(hide);
  hide = setTimeout(() => el.hidePopover?.(), act ? 6000 : 3400);
}
