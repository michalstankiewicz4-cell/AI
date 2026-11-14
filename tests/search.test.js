// Wyszukiwanie w bibliotece (BM25): fragmenty, odmiany słów, wagi tekstu ogólnego i dokumentów nieaktualnych.
import { terms, chunks, buildIndex, searchIndex } from '../js/core/search.js';

export default async function (t) {
  t.eq(terms('Ile dni urlopu mi przysługuje?').join(' '), 'dni urlopu przysł', 'słowa: bez krótkich i częstych, rdzeń 6 liter');
  t.eq(terms('urlop')[0], terms('urlopie')[0].slice(0, 5) === 'urlop' ? 'urlop' : null, 'rdzeń: urlop ≈ urlopie');
  const c = chunks('Art. 1. Pierwszy.\nArt. 2. Drugi przepis.\n\nAkapit trzeci.', 30);
  t.ok(c.length >= 2 && c[0].startsWith('Art. 1.'), `podział na fragmenty po akapitach i artykułach (${c.length})`);
  const kp = { id: 'kp', name: 'Kodeks pracy', text: 'Art. 154. § 1. Wymiar urlopu wynosi 20 dni, jeżeli pracownik jest zatrudniony krócej niż 10 lat, 26 dni – co najmniej 10 lat.\n\nArt. 30. Umowa o pracę rozwiązuje się za wypowiedzeniem.', tags: ['akt prawny'] };
  const old = { ...kp, id: 'old', name: 'Kodeks pracy (stary)', text: kp.text.replace('20 dni', '18 dni'), tags: ['nieaktualny'] };
  const wiki = { id: 'w', name: 'Wikipedia – Urlop wypoczynkowy', general: true, text: 'Urlop wypoczynkowy to płatna przerwa w pracy. Wymiar urlopu zależy od stażu pracy.', tags: ['Wikipedia'] };
  const ix = buildIndex([old, wiki, kp]);
  const r = searchIndex(ix, 'Ile dni urlopu mi przysługuje?', 3);
  t.ok(r.length >= 2 && r[0].docId === 'kp', `najlepszy fragment z aktualnego Kodeksu pracy (${r.map(x => x.docId).join(', ')})`);
  t.ok(r[0].text.includes('Art. 154'), 'fragment zawiera właściwy artykuł');
  t.ok(r.findIndex(x => x.docId === 'old') > r.findIndex(x => x.docId === 'kp'), 'dokument nieaktualny niżej');
  t.eq(searchIndex(ix, 'zupełnie inne zagadnienie podatkowe', 3).length, 0, 'brak trafień – pusty wynik');
  t.eq(searchIndex(ix, 'wypowiedzeniem', 1)[0].text.includes('Art. 30'), true, 'odmiana: „wypowiedzeniem” znajduje art. 30');
}
