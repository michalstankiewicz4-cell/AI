// Pasek „zakres profilu” nad listami: przy wybranym profilu pokazuje tylko jego dokumenty / rozmowy / modele,
// z przyciskiem „Pokaż wszystko” (widok wszystkich profili) i z powrotem.

import { h, clear, num } from './dom.js';
import { activeProfile, inProfile } from '../core/profiles.js';

export function profileScope(what, onChange, test = r => inProfile(r)) {
  const el = h('div'); let all = false;
  const st = {
    el,
    // filtruje listę i odświeża pasek (shown z total)
    filter(list) {
      const p = activeProfile(); clear(el);
      if (!p) return list;
      const shown = all ? list : list.filter(test);
      el.append(h('div.scope', h('b', 'Profil: ' + p.name),
        h('span', all ? `pokazuję wszystko (${num(list.length)}), także spoza profilu` : `pokazuję ${what} profilu: ${num(shown.length)} z ${num(list.length)}`),
        h('span.sp'), h('button.ghost.small', { type: 'button', onclick: () => { all = !all; onChange(); } }, all ? 'Tylko profil' : 'Pokaż wszystko')));
      return shown;
    },
  };
  return st;
}
