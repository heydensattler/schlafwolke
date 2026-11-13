/* Schlafwolke – Schlaf, Füttern und Wetter fürs Baby. Alle Daten bleiben im Browser (localStorage). */
'use strict';

const SPEICHER = 'schlafwolke-v1';
const MIN = 60000, STD = 3600000, TAG = 86400000;

/* ---------- Daten ---------- */
const S = {
  profil: { name: '', geburt: '', aufwach: '07:00', spaetestens: '20:30' },
  schlaf: [],   // {id, art:'nap'|'nacht', start, ende|null}
  essen: [],    // {id, art:'stillen'|'flasche'|'beikost', seite, start, ende|null, ml, milch, notiz}
  aufwachen: {},// {'JJJJ-MM-TT': ms} – Aufwachzeit, falls kein Nachtschlaf eingetragen
  wetter: { ort: null, zimmer: 20, transport: 'wagen', cache: null },
  beikost: { ziel: 100, start: '', eigene: [] }, // Lebensmittel stehen in essen (art beikost, lebensmittel: [{n, r}])
};
function laden() {
  try {
    const d = JSON.parse(localStorage.getItem(SPEICHER) || 'null');
    if (d) for (const k of Object.keys(S)) if (d[k] !== undefined) S[k] = (typeof S[k] === 'object' && !Array.isArray(S[k])) ? { ...S[k], ...d[k] } : d[k];
  } catch (e) { console.warn('Laden fehlgeschlagen', e); }
}
function speichern() {
  try { localStorage.setItem(SPEICHER, JSON.stringify(S)); } catch (e) { alert('Speichern nicht möglich: ' + e.message); }
}
const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- Hilfen ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const zwei = n => String(n).padStart(2, '0');
const uhr = ms => { const d = new Date(ms); return zwei(d.getHours()) + ':' + zwei(d.getMinutes()); };
const tagKey = ms => { const d = new Date(ms); return d.getFullYear() + '-' + zwei(d.getMonth() + 1) + '-' + zwei(d.getDate()); };
const tagAnfang = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
function dauer(min, kurz) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60), m = min % 60;
  if (kurz) return h ? `${h}:${zwei(m)} h` : `${m} Min`;
  if (!h) return `${m} Min`;
  return m ? `${h} Std ${m} Min` : `${h} Std`;
}
function laufzeit(ms) { // 1:05:09
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sek = s % 60;
  return (h ? h + ':' + zwei(m) : m) + ':' + zwei(sek);
}
function inputWert(ms) { const d = new Date(ms); return tagKey(ms) + 'T' + zwei(d.getHours()) + ':' + zwei(d.getMinutes()); }
function ausInput(v) { return v ? new Date(v).getTime() : null; }
function zeitAm(tagMs, hhmm) { const [h, m] = (hhmm || '07:00').split(':').map(Number); const d = new Date(tagMs); d.setHours(h, m, 0, 0); return d.getTime(); }
function relativ(ms) {
  const diff = Math.round((ms - Date.now()) / MIN);
  if (Math.abs(diff) < 2) return 'jetzt';
  return diff > 0 ? 'in ' + dauer(diff) : 'vor ' + dauer(-diff);
}
const babyName = () => S.profil.name || 'Baby';

/* ---------- Alter & Wachfenster ---------- */
function alterWochen(jetzt = Date.now()) {
  if (!S.profil.geburt) return null;
  return Math.max(0, Math.floor((jetzt - new Date(S.profil.geburt + 'T00:00').getTime()) / (7 * TAG)));
}
function alterText() {
  const w = alterWochen(); if (w === null) return '';
  if (w < 13) return w === 1 ? '1 Woche' : `${w} Wochen`;
  const g = new Date(S.profil.geburt + 'T00:00'), j = new Date();
  let mon = (j.getFullYear() - g.getFullYear()) * 12 + j.getMonth() - g.getMonth();
  if (j.getDate() < g.getDate()) mon--;
  if (mon < 24) return `${mon} Monate`;
  return `${Math.floor(mon / 12)} Jahre`;
}
// Richtwerte (Minuten). Wachfenster wachsen über den Tag von min bis max (letztes = vor dem Nachtschlaf).
const WACHFENSTER = [
  { bis: 4,   min: 35,  max: 60,  naps: 5, nap: 50,  text: 'Neugeborene schlafen noch ohne festen Rhythmus.' },
  { bis: 8,   min: 60,  max: 90,  naps: 4, nap: 60 },
  { bis: 13,  min: 75,  max: 105, naps: 4, nap: 60 },
  { bis: 17,  min: 90,  max: 120, naps: 4, nap: 60 },
  { bis: 26,  min: 120, max: 150, naps: 3, nap: 70 },
  { bis: 35,  min: 150, max: 180, naps: 2, nap: 80 },
  { bis: 52,  min: 180, max: 240, naps: 2, nap: 75 },
  { bis: 78,  min: 240, max: 330, naps: 1, nap: 120 },
  { bis: 9999,min: 300, max: 360, naps: 1, nap: 100 },
];
function regel() {
  const w = alterWochen();
  if (w === null) return WACHFENSTER[4];
  return WACHFENSTER.find(r => w < r.bis);
}

/* ---------- Schlaf: Tageslogik ---------- */
const sortiert = arr => [...arr].sort((a, b) => a.start - b.start);
const laufenderSchlaf = () => S.schlaf.find(s => !s.ende);
const laufendesEssen = () => S.essen.find(e => !e.ende && e.art === 'stillen');

// Morgendliches Aufwachen des Tages (Ende eines Nachtschlafs zwischen 3 und 12 Uhr), sonst eingetragene/übliche Zeit
function morgenWach(tagMs) {
  const a = tagAnfang(tagMs);
  const nacht = sortiert(S.schlaf).filter(s => s.art === 'nacht' && s.ende && s.ende >= a + 3 * STD && s.ende <= a + 12 * STD);
  if (nacht.length) return { ms: nacht[nacht.length - 1].ende, quelle: 'eingetragen' };
  const k = tagKey(tagMs);
  if (S.aufwachen[k]) return { ms: S.aufwachen[k], quelle: 'eingetragen' };
  return { ms: zeitAm(tagMs, S.profil.aufwach), quelle: 'üblich' };
}
function napsAm(tagMs) {
  const mw = morgenWach(tagMs).ms, ende = tagAnfang(tagMs) + TAG;
  return sortiert(S.schlaf).filter(s => s.art === 'nap' && s.start >= mw - 30 * MIN && s.start < ende);
}

// Persönliche Werte der letzten 7 Tage: Wachfenster je Position und Schläfchenlänge
function persoenlich() {
  const heute = tagAnfang(Date.now()), fenster = {}, laengen = [];
  for (let i = 1; i <= 7; i++) {
    const t = heute - i * TAG;
    const mw = morgenWach(t);
    if (mw.quelle !== 'eingetragen') continue;
    let wach = mw.ms;
    const naps = napsAm(t);
    naps.forEach((n, idx) => {
      const ww = (n.start - wach) / MIN;
      if (ww > 15 && ww < 480) (fenster[idx] ||= []).push(ww);
      if (n.ende) { const l = (n.ende - n.start) / MIN; if (l >= 10 && l <= 240) laengen.push(l); wach = n.ende; }
    });
  }
  const mittel = a => a && a.length >= 2 ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const f = {}; for (const k in fenster) f[k] = mittel(fenster[k]);
  return { fenster: f, nap: mittel(laengen) };
}
function wachfenster(idx, anzahlNaps, r, p) {
  const anteil = anzahlNaps ? Math.min(1, idx / anzahlNaps) : 1;
  let ww = r.min + (r.max - r.min) * anteil;
  const eigen = p.fenster[idx];
  if (eigen && idx < anzahlNaps) ww = 0.6 * ww + 0.4 * Math.min(r.max * 1.2, Math.max(r.min * 0.8, eigen));
  return Math.round(ww);
}

// Plan für den Rest des Tages ab letztem Aufwachen
function tagesplan(jetzt = Date.now()) {
  const r = regel(), p = persoenlich();
  const napLen = Math.round(p.nap ? 0.5 * r.nap + 0.5 * p.nap : r.nap);
  const heute = tagAnfang(jetzt);
  const lauf = laufenderSchlaf();
  const plan = [];
  if (lauf && lauf.art === 'nacht') return { plan, r, napLen };

  const mw = morgenWach(jetzt);
  const naps = napsAm(jetzt);
  let wach = mw.ms, fertig = naps.length;
  const fertigeNaps = naps.filter(n => n.ende);
  if (fertigeNaps.length) wach = fertigeNaps[fertigeNaps.length - 1].ende;
  if (lauf) { // läuft gerade ein Schläfchen: erwartetes Aufwachen
    const ende = Math.max(lauf.start + napLen * MIN, jetzt + 5 * MIN);
    plan.push({ art: 'aufwachen', ms: ende });
    wach = ende;
  }
  const spaet = zeitAm(heute, S.profil.spaetestens || '20:30');
  const napGrenze = spaet - 3 * STD;
  for (let i = fertig; i < 10; i++) {
    if (i >= r.naps) {
      plan.push({ art: 'nacht', start: Math.max(lauf ? 0 : jetzt, Math.min(wach + wachfenster(r.naps, r.naps, r, p) * MIN, spaet)) });
      break;
    }
    let s = wach + wachfenster(i, r.naps, r, p) * MIN;
    if (s < jetzt && !lauf) s = jetzt; // Vorschlag verpasst: Plan ab jetzt neu rechnen
    if (s > napGrenze && r.naps >= 3 && wach + r.max * MIN < zeitAm(heute, '18:00') && s + 30 * MIN + r.min * MIN <= spaet) {
      // sonst wäre die Schlafenszeit zu früh: kurzes Nickerchen am späten Nachmittag
      plan.push({ art: 'nap', start: s, ende: s + 30 * MIN, nr: i + 1 });
      wach = s + 30 * MIN; i = r.naps - 1; continue;
    }
    if (s > napGrenze) { // kein Platz mehr für ein Schläfchen: früher ins Bett
      const bett = Math.max(lauf ? 0 : jetzt, Math.min(wach + r.max * MIN, spaet));
      plan.push({ art: 'nacht', start: bett });
      break;
    }
    const kurz = i === r.naps - 1 && r.naps >= 3; // letztes Schläfchen bei 3+ Naps ist oft kurz
    const len = kurz ? Math.min(napLen, 40) : napLen;
    plan.push({ art: 'nap', start: s, ende: s + len * MIN, nr: i + 1 });
    wach = s + len * MIN;
  }
  return { plan, r, napLen };
}

/* ---------- Ansicht: Schlaf ---------- */
function zeitleiste(tagMs, mitPlan) {
  const a = tagAnfang(tagMs), e = a + TAG;
  const pos = ms => ((Math.min(Math.max(ms, a), e) - a) / TAG * 100).toFixed(2);
  let html = '';
  for (const s of S.schlaf) {
    const ende = s.ende || Date.now();
    if (ende <= a || s.start >= e) continue;
    html += `<div class="blk ${s.art === 'nacht' ? 'nacht' : ''}" style="left:${pos(s.start)}%;width:${(pos(ende) - pos(s.start)).toFixed(2)}%"></div>`;
  }
  if (mitPlan) for (const p of mitPlan) {
    if (p.art === 'aufwachen') continue;
    const ende = p.ende || p.start + 60 * MIN;
    html += `<div class="blk plan ${p.art === 'nacht' ? 'nacht' : ''}" style="left:${pos(p.start)}%;width:${(pos(ende) - pos(p.start)).toFixed(2)}%"></div>`;
  }
  for (const f of S.essen) if (f.start >= a && f.start < e) html += `<div class="pkt" style="left:${pos(f.start)}%"></div>`;
  if (Date.now() >= a && Date.now() < e) html += `<div class="jetzt" style="left:${pos(Date.now())}%"></div>`;
  return `<div class="zeitleiste">${html}</div>`;
}

function zeigeSchlaf() {
  const el = $('#v-schlaf');
  if (!S.profil.geburt) {
    el.innerHTML = `<div class="karte leer"><div class="gross-ikon">☁️</div>
      <p class="mittel">Willkommen bei Schlafwolke</p>
      <p class="leise">Trag kurz Name und Geburtstag deines Babys ein. Daraus berechnet die App passende Wachfenster.</p>
      <button class="knopf breit" onclick="zeige('profil')">Baby eintragen</button></div>`;
    return;
  }
  const lauf = laufenderSchlaf();
  const { plan, r, napLen } = tagesplan();
  const naechster = plan.find(p => p.art !== 'aufwachen');
  let status;
  if (lauf) {
    const erw = plan.find(p => p.art === 'aufwachen');
    status = `<div class="karte status schlaeft">
      <div class="leise">${esc(babyName())} ${lauf.art === 'nacht' ? 'schläft (Nacht) seit' : 'macht ein Schläfchen seit'} ${uhr(lauf.start)}</div>
      <div class="uhr" data-lauf="${lauf.start}">${laufzeit(Date.now() - lauf.start)}</div>
      <div class="leise">${erw ? 'Erwartetes Aufwachen ca. ' + uhr(erw.ms) : 'Gute Nacht 🌙'}</div>
      <div class="knoepfe" style="grid-template-columns:1fr"><button class="knopf weiss" onclick="schlafStopp()">☀️ Aufgewacht</button></div>
    </div>`;
  } else {
    const fertig = sortiert(S.schlaf).filter(s => s.ende && s.ende <= Date.now());
    const letzt = fertig.length ? fertig[fertig.length - 1].ende : null;
    const mw = morgenWach(Date.now());
    const wachSeit = Math.max(letzt || 0, mw.ms <= Date.now() ? mw.ms : 0) || Date.now();
    const istNacht = naechster && naechster.art === 'nacht';
    status = `<div class="karte status">
      <div class="leise">${esc(babyName())} ist wach seit</div>
      <div class="uhr" data-lauf="${wachSeit}">${laufzeit(Date.now() - wachSeit)}</div>
      <div class="leise klein">${mw.quelle === 'üblich' && !letzt ? `Aufgewacht heute ca. ${uhr(mw.ms)} (übliche Zeit) · <button class="link" onclick="aufwachDialog()">ändern</button>` : `seit ${uhr(wachSeit)}`}</div>
      <div class="knoepfe">
        <button class="knopf ${!istNacht ? 'empfohlen' : 'zweit'}" onclick="schlafStart('nap')">😴 Schläfchen</button>
        <button class="knopf nacht ${istNacht ? 'empfohlen' : ''}" onclick="schlafStart('nacht')">🌙 Nachtschlaf</button>
      </div>
    </div>`;
  }

  let vorh = '';
  if (naechster) {
    const s = naechster.start, ueberfaellig = s < Date.now();
    vorh = `<div class="karte">
      <h2>${naechster.art === 'nacht' ? 'Schlafenszeit' : 'Nächstes Schläfchen'}</h2>
      <div class="vorhersage"><div class="gross">${ueberfaellig ? 'jetzt' : 'ca. ' + uhr(s)}</div>
        <div class="leise">${ueberfaellig ? 'Müdigkeitszeichen beachten' : relativ(s)}</div></div>
      <p class="leise klein" style="margin:8px 0 0">Wachfenster mit ${alterText().replace(/(Monat|Jahr)e$/, '$1en')}: ${dauer(r.min)} bis ${dauer(r.max)} · meist ${r.naps} Schläfchen am Tag${r.text ? '. ' + r.text : ''}</p>
    </div>`;
  }

  const heute = Date.now();
  const eintraege = sortiert(S.schlaf).filter(s => (s.ende || Date.now()) >= tagAnfang(heute) && s.start < tagAnfang(heute) + TAG);
  let liste = eintraege.map(s => {
    const ende = s.ende || Date.now();
    return `<li onclick="schlafDialog('${s.id}')"><div class="sym ${s.art === 'nacht' ? 'nacht' : ''}">${s.art === 'nacht' ? '🌙' : '😴'}</div>
      <div class="haupt"><b>${s.art === 'nacht' ? 'Nachtschlaf' : 'Schläfchen'}</b><div class="leise klein">${uhr(s.start)} – ${s.ende ? uhr(s.ende) : 'läuft'}</div></div>
      <div class="neben">${dauer((ende - s.start) / MIN)}</div></li>`;
  }).join('');
  liste += plan.filter(p => p.art !== 'aufwachen').map(p => `<li class="plan"><div class="sym plan">${p.art === 'nacht' ? '🌙' : '💤'}</div>
      <div class="haupt">${p.art === 'nacht' ? 'Schlafenszeit (Vorschlag)' : p.nr + '. Schläfchen (Vorschlag)'}<div class="klein">${uhr(p.start)}${p.ende ? ' – ' + uhr(p.ende) : ''}</div></div>
      <div class="neben">${p.ende ? dauer((p.ende - p.start) / MIN) : ''}</div></li>`).join('');

  const napsHeute = eintraege.filter(s => s.art === 'nap');
  const tagMin = napsHeute.reduce((a, s) => a + ((s.ende || Date.now()) - s.start) / MIN, 0);

  el.innerHTML = status + vorh + `<div class="karte"><h2>Heute</h2>
    ${zeitleiste(heute, plan)}
    <div class="skala"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
    <p class="leise klein">${napsHeute.length} Schläfchen · ${dauer(tagMin)} Tagschlaf · gestrichelt = Vorschlag</p>
    <ul class="liste">${liste || '<li class="plan">Noch nichts eingetragen.</li>'}</ul>
    <div class="knoepfe"><button class="knopf rand" onclick="schlafDialog()">+ Nachtragen</button><button class="knopf rand" onclick="aufwachDialog()">☀️ Aufwachzeit</button></div>
  </div>`;
}

function schlafStart(art) {
  if (laufenderSchlaf()) return;
  S.schlaf.push({ id: neueId(), art, start: Date.now(), ende: null });
  speichern(); alles();
}
function schlafStopp() {
  const l = laufenderSchlaf(); if (!l) return;
  l.ende = Date.now();
  if (l.ende - l.start < MIN) { if (confirm('Weniger als eine Minute – Eintrag verwerfen?')) S.schlaf = S.schlaf.filter(s => s !== l); }
  speichern(); alles();
}

/* ---------- Dialoge ---------- */
function dialog(html, beimSpeichern) {
  const dlg = $('#dlg'), f = $('#dlg-form');
  f.innerHTML = html + '<div class="fehler" id="dlg-fehler"></div>';
  f.onsubmit = ev => {
    const knopf = ev.submitter && ev.submitter.value;
    if (knopf === 'abbrechen') return;
    const fehler = beimSpeichern(knopf, f);
    if (fehler) { ev.preventDefault(); $('#dlg-fehler').textContent = fehler; return; }
    speichern(); alles();
  };
  dlg.showModal();
}

function schlafDialog(id) {
  const s = id ? S.schlaf.find(x => x.id === id) : null;
  const jetzt = Date.now();
  const start = s ? s.start : jetzt - 60 * MIN, ende = s ? s.ende : jetzt;
  dialog(`<h2>${s ? 'Schlaf bearbeiten' : 'Schlaf nachtragen'}</h2>
    <label class="feld">Art<select name="art"><option value="nap">😴 Schläfchen</option><option value="nacht" ${s && s.art === 'nacht' ? 'selected' : ''}>🌙 Nachtschlaf</option></select></label>
    <div class="zeile2"><label class="feld">Eingeschlafen<input type="datetime-local" name="start" value="${inputWert(start)}" required></label>
    <label class="feld">Aufgewacht<input type="datetime-local" name="ende" value="${ende ? inputWert(ende) : ''}"></label></div>
    <p class="leise klein">„Aufgewacht“ leer lassen, wenn der Schlaf noch läuft.</p>
    <div class="dlg-knoepfe">${s ? '<button class="knopf gefahr" value="loeschen">Löschen</button>' : ''}<button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf" value="ok">Speichern</button></div>`,
    (k, f) => {
      if (k === 'loeschen') { if (!confirm('Eintrag wirklich löschen?')) return 'Nicht gelöscht.'; S.schlaf = S.schlaf.filter(x => x !== s); return; }
      const st = ausInput(f.start.value), en = ausInput(f.ende.value);
      if (!st) return 'Bitte Beginn angeben.';
      if (en && en <= st) return 'Aufwachen muss nach dem Einschlafen liegen.';
      if (st > Date.now() + MIN) return 'Beginn liegt in der Zukunft.';
      if (!en && S.schlaf.some(x => !x.ende && x !== s)) return 'Es läuft schon ein Schlaf. Bitte eine Aufwachzeit eintragen.';
      if (s) Object.assign(s, { art: f.art.value, start: st, ende: en });
      else S.schlaf.push({ id: neueId(), art: f.art.value, start: st, ende: en });
    });
}

function aufwachDialog() {
  const mw = morgenWach(Date.now());
  dialog(`<h2>Heute aufgewacht um</h2>
    <p class="leise klein">Damit startet der Tagesplan. Wenn du den Nachtschlaf einträgst, nimmt die App automatisch dessen Ende.</p>
    <label class="feld">Uhrzeit<input type="time" name="zeit" value="${uhr(mw.ms)}" required></label>
    <div class="dlg-knoepfe"><button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf" value="ok">Übernehmen</button></div>`,
    (k, f) => { S.aufwachen[tagKey(Date.now())] = zeitAm(Date.now(), f.zeit.value); });
}

/* ---------- Ansicht: Füttern ---------- */
const ESSEN_SYM = { stillen: '🤱', flasche: '🍼', beikost: '🥣' };
function essenText(e) {
  if (e.art === 'stillen') return 'Stillen' + (e.seite ? ' ' + { links: 'links', rechts: 'rechts', beide: 'beide Seiten' }[e.seite] : '');
  if (e.art === 'flasche') return 'Flasche' + (e.ml ? ` ${e.ml} ml` : '') + (e.milch ? ` · ${e.milch}` : '');
  const lm = (e.lebensmittel || []).map(x => x.n).join(', ');
  return 'Beikost' + (lm ? ` · ${lm}` : '') + (e.notiz ? ` · ${e.notiz}` : '');
}
// Einträge, die höchstens 15 Min. auseinanderliegen (z. B. Seitenwechsel, Flasche nach dem Stillen), zählen als eine Mahlzeit
function mahlzeiten(liste) {
  const gruppen = [];
  for (const e of sortiert(liste)) {
    const g = gruppen[gruppen.length - 1];
    if (g && e.start - g.ende <= 15 * MIN) { g.teile.push(e); g.ende = Math.max(g.ende, e.ende || Date.now()); }
    else gruppen.push({ start: e.start, ende: e.ende || Date.now(), teile: [e] });
  }
  return gruppen;
}
let essenReiter = 'milch';
function essenReiterSetzen(r) { essenReiter = r; try { sessionStorage.setItem('essenReiter', r); } catch (e) {} zeigeEssen(); }
function zeigeEssen() {
  const el = $('#v-essen');
  const reiter = `<div class="reiter" style="margin-top:12px"><button class="${essenReiter === 'milch' ? 'an' : ''}" onclick="essenReiterSetzen('milch')">Mahlzeiten</button><button class="${essenReiter === 'beikost' ? 'an' : ''}" onclick="essenReiterSetzen('beikost')">Beikost-Plan</button></div>`;
  if (essenReiter === 'beikost') { el.innerHTML = reiter + zeigeBeikost(); return; }
  const lauf = laufendesEssen();
  const alle = sortiert(S.essen);
  const fertig = alle.filter(e => e.ende || e.art !== 'stillen');
  const letzte = fertig[fertig.length - 1];
  // Anfangsseite abwechseln: erste Stillseite der letzten Still-Mahlzeit
  const stillMahl = mahlzeiten(alle.filter(e => e.art === 'stillen' && e.seite && e.seite !== 'beide'));
  const anfang = stillMahl.length ? stillMahl[stillMahl.length - 1].teile[0].seite : null;
  const naechsteSeite = anfang ? (anfang === 'links' ? 'rechts' : 'links') : null;

  let oben;
  if (lauf) {
    oben = `<div class="karte status" style="background:linear-gradient(160deg,var(--essen),#c86a52);color:#fff;border:0">
      <div style="opacity:.85">Stillen ${esc(lauf.seite || '')} seit ${uhr(lauf.start)}</div>
      <div class="uhr" data-lauf="${lauf.start}">${laufzeit(Date.now() - lauf.start)}</div>
      <div class="knoepfe">
        <button class="knopf weiss" style="color:#a24e33" onclick="seiteWechseln()">⇄ Seite wechseln</button>
        <button class="knopf weiss" style="color:#a24e33" onclick="essenStopp()">✓ Fertig</button>
      </div></div>`;
  } else {
    oben = `<div class="karte status">
      <div class="leise">Letzte Mahlzeit</div>
      <div class="gross" style="margin:6px 0">${letzte ? relativ(letzte.ende || letzte.start) : '–'}</div>
      <div class="leise klein">${letzte ? esc(essenText(letzte)) + ' um ' + uhr(letzte.start) : 'Noch nichts eingetragen'}${naechsteSeite ? `<br>Zuletzt ${anfang} angefangen – nächstes Mal mit <b>${naechsteSeite}</b> beginnen` : ''}</div>
      <div class="knoepfe">
        <button class="knopf essen ${naechsteSeite === 'links' ? 'empfohlen' : 'zweit'}" onclick="essenStart('links')">🤱 Links</button>
        <button class="knopf essen ${naechsteSeite === 'rechts' ? 'empfohlen' : 'zweit'}" onclick="essenStart('rechts')">🤱 Rechts</button>
      </div>
      <div class="knoepfe">
        <button class="knopf essen zweit" onclick="essenDialog(null,'flasche')">🍼 Flasche</button>
        <button class="knopf essen zweit" onclick="beikostDialog()">🥣 Beikost</button>
      </div></div>`;
  }

  const heute = tagAnfang(Date.now());
  const heuteListe = alle.filter(e => e.start >= heute);
  const ml = heuteListe.reduce((a, e) => a + (e.art === 'flasche' ? (+e.ml || 0) : 0), 0);
  const stillMin = heuteListe.reduce((a, e) => a + (e.art === 'stillen' ? ((e.ende || Date.now()) - e.start) / MIN : 0), 0);
  const gruppen = mahlzeiten(alle), abstaende = [];
  for (let i = 1; i < gruppen.length; i++) if (gruppen[i].start > Date.now() - 3 * TAG) {
    const d = (gruppen[i].start - gruppen[i - 1].start) / MIN; if (d > 20 && d < 600) abstaende.push(d);
  }
  const mahlHeute = gruppen.filter(g => g.start >= heute).length;
  const abstand = abstaende.length ? abstaende.reduce((a, b) => a + b, 0) / abstaende.length : null;

  const zeile = e => `<li onclick="${e.art === 'beikost' ? 'beikostDialog' : 'essenDialog'}('${e.id}')"><div class="sym essen">${ESSEN_SYM[e.art]}</div>
    <div class="haupt"><b>${esc(essenText(e))}</b><div class="leise klein">${WT[new Date(e.start).getDay()]} ${uhr(e.start)}${e.ende && e.art === 'stillen' ? ' – ' + uhr(e.ende) : ''}</div></div>
    <div class="neben">${e.art === 'stillen' ? (e.ende ? dauer((e.ende - e.start) / MIN) : 'läuft') : ''}</div></li>`;
  const juengste = alle.filter(e => e.start > Date.now() - 2 * TAG).reverse();

  el.innerHTML = reiter + oben + `<div class="karte"><h2>Heute</h2>
    <div class="kacheln">
      <div class="kachel"><div class="wert">${mahlHeute}</div><div class="bez">${mahlHeute === 1 ? "Mahlzeit" : "Mahlzeiten"}</div></div>
      <div class="kachel"><div class="wert">${abstand ? dauer(abstand, true) : '–'}</div><div class="bez">Ø Abstand (3 Tage)</div></div>
      <div class="kachel"><div class="wert">${dauer(stillMin, true)}</div><div class="bez">gestillt</div></div>
      <div class="kachel"><div class="wert">${ml} ml</div><div class="bez">aus der Flasche</div></div>
    </div></div>
    <div class="karte"><h2>Letzte 48 Stunden</h2>
    <ul class="liste">${juengste.map(zeile).join('') || '<li class="plan">Noch nichts eingetragen.</li>'}</ul>
    <div class="knoepfe" style="grid-template-columns:1fr"><button class="knopf rand" onclick="essenDialog(null,'stillen')">+ Nachtragen</button></div></div>`;
}
function essenStart(seite) {
  if (laufendesEssen()) return;
  S.essen.push({ id: neueId(), art: 'stillen', seite, start: Date.now(), ende: null });
  speichern(); alles();
}
function essenStopp() {
  const l = laufendesEssen(); if (!l) return;
  l.ende = Date.now(); speichern(); alles();
}
function seiteWechseln() { // aktuelle Seite beenden, andere starten
  const l = laufendesEssen(); if (!l) return;
  l.ende = Date.now();
  S.essen.push({ id: neueId(), art: 'stillen', seite: l.seite === 'links' ? 'rechts' : 'links', start: Date.now() + 1, ende: null });
  speichern(); alles();
}
function essenDialog(id, artVorgabe) {
  const e = id ? S.essen.find(x => x.id === id) : null;
  const art = e ? e.art : artVorgabe;
  const start = e ? e.start : Date.now() - (art === 'stillen' ? 15 * MIN : 0);
  const ende = e ? e.ende : (art === 'stillen' ? Date.now() : null);
  const letzteFlasche = [...S.essen].reverse().find(x => x.art === 'flasche');
  const opt = (v, t, w) => `<option value="${v}" ${w === v ? 'selected' : ''}>${t}</option>`;
  dialog(`<h2>${ESSEN_SYM[art]} ${e ? 'Bearbeiten' : { stillen: 'Stillen nachtragen', flasche: 'Flasche', beikost: 'Beikost' }[art]}</h2>
    <input type="hidden" name="art" value="${art}">
    ${art === 'stillen' ? `<label class="feld">Seite<select name="seite">${opt('links', 'Links', e?.seite)}${opt('rechts', 'Rechts', e?.seite)}${opt('beide', 'Beide', e?.seite)}</select></label>
      <div class="zeile2"><label class="feld">Beginn<input type="datetime-local" name="start" value="${inputWert(start)}" required></label>
      <label class="feld">Ende<input type="datetime-local" name="ende" value="${ende ? inputWert(ende) : ''}"></label></div>`
    : `<label class="feld">Uhrzeit<input type="datetime-local" name="start" value="${inputWert(start)}" required></label>`}
    ${art === 'flasche' ? `<div class="zeile2"><label class="feld">Menge (ml)<input type="number" inputmode="numeric" name="ml" min="0" max="500" step="5" value="${e?.ml ?? letzteFlasche?.ml ?? ''}"></label>
      <label class="feld">Milch<select name="milch">${opt('Muttermilch', 'Muttermilch', e?.milch ?? letzteFlasche?.milch)}${opt('Pre-Milch', 'Pre-Milch', e?.milch ?? letzteFlasche?.milch)}${opt('Folgemilch', 'Folgemilch', e?.milch ?? letzteFlasche?.milch)}${opt('Wasser/Tee', 'Wasser/Tee', e?.milch ?? letzteFlasche?.milch)}</select></label></div>` : ''}
    <label class="feld">${art === 'beikost' ? 'Was gab es?' : 'Notiz (optional)'}<input name="notiz" value="${esc(e?.notiz || '')}" placeholder="${art === 'beikost' ? 'z. B. Karottenbrei, halbes Gläschen' : ''}"></label>
    <div class="dlg-knoepfe">${e ? '<button class="knopf gefahr" value="loeschen">Löschen</button>' : ''}<button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf essen" value="ok">Speichern</button></div>`,
    (k, f) => {
      if (k === 'loeschen') { if (!confirm('Eintrag wirklich löschen?')) return 'Nicht gelöscht.'; S.essen = S.essen.filter(x => x !== e); return; }
      const st = ausInput(f.start.value);
      if (!st) return 'Bitte eine Zeit angeben.';
      if (st > Date.now() + MIN) return 'Die Zeit liegt in der Zukunft.';
      const d = { art, start: st, notiz: f.notiz.value.trim() };
      if (art === 'stillen') {
        d.seite = f.seite.value; d.ende = ausInput(f.ende.value);
        if (d.ende && d.ende <= st) return 'Ende muss nach dem Beginn liegen.';
        if (!d.ende && S.essen.some(x => x.art === 'stillen' && !x.ende && x !== e)) return 'Es läuft schon ein Stillen.';
      } else { d.ende = st; }
      if (art === 'flasche') { d.ml = f.ml.value ? +f.ml.value : null; d.milch = f.milch.value; }
      if (e) Object.assign(e, d); else S.essen.push({ id: neueId(), ...d });
    });
}

/* ---------- Ansicht: Verlauf ---------- */
let verlaufTage = 7;
function minutenImTag(eintraege, tagMs, filter) {
  const a = tagAnfang(tagMs), e = a + TAG;
  return eintraege.filter(filter).reduce((sum, s) => {
    const st = Math.max(s.start, a), en = Math.min(s.ende || Date.now(), e);
    return sum + Math.max(0, en - st) / MIN;
  }, 0);
}
function zeigeVerlauf() {
  const el = $('#v-verlauf');
  const heute = tagAnfang(Date.now());
  const tage = [];
  for (let i = verlaufTage - 1; i >= 0; i--) {
    const t = heute - i * TAG;
    const tag = minutenImTag(S.schlaf, t, s => s.art === 'nap');
    const nacht = minutenImTag(S.schlaf, t, s => s.art === 'nacht');
    const naps = S.schlaf.filter(s => s.art === 'nap' && s.ende && tagAnfang(s.start) === t);
    const mahl = S.essen.filter(f => tagAnfang(f.start) === t);
    const anzMahl = mahlzeiten(mahl).length;
    tage.push({ t, tag, nacht, naps, mahl, anzMahl, ml: mahl.reduce((x, f) => x + (f.art === 'flasche' ? +f.ml || 0 : 0), 0) });
  }
  // Durchschnitte nur über Tage mit Einträgen und ohne heute (unvollständig)
  const voll = tage.filter(d => d.t < heute && (d.tag + d.nacht) > 0);
  const avg = f => voll.length ? voll.reduce((a, d) => a + f(d), 0) / voll.length : null;
  const napsAlle = voll.flatMap(d => d.naps);
  const napLen = napsAlle.length ? napsAlle.reduce((a, n) => a + (n.ende - n.start) / MIN, 0) / napsAlle.length : null;
  const mahlTage = tage.filter(d => d.t < heute && d.mahl.length);
  const mahlAvg = mahlTage.length ? mahlTage.reduce((a, d) => a + d.anzMahl, 0) / mahlTage.length : null;
  // Wachfenster aus den Tagen
  const ww = [];
  for (const d of voll) {
    const mw = morgenWach(d.t); if (mw.quelle !== 'eingetragen') continue;
    let w = mw.ms;
    for (const n of napsAm(d.t)) { const x = (n.start - w) / MIN; if (x > 15 && x < 480) ww.push(x); if (n.ende) w = n.ende; }
  }
  const wwAvg = ww.length ? ww.reduce((a, b) => a + b, 0) / ww.length : null;
  const fmt = (v, f) => v === null ? '–' : f(v);

  const max = Math.max(14 * 60, ...tage.map(d => d.tag + d.nacht));
  const maxMahl = Math.max(8, ...tage.map(d => d.anzMahl));
  const saeulen = tage.map(d => `<div class="saeule" title="${dauer(d.tag + d.nacht)}">
      <div class="teil tag" style="height:${d.tag / max * 100}%"></div><div class="teil nacht" style="height:${d.nacht / max * 100}%"></div></div>`).join('');
  const mahlSaeulen = tage.map(d => `<div class="saeule" title="${d.anzMahl} Mahlzeiten"><div class="teil essen" style="height:${d.anzMahl / maxMahl * 100}%"></div></div>`).join('');
  const achse = tage.map(d => `<span>${verlaufTage <= 7 ? WT[new Date(d.t).getDay()] : new Date(d.t).getDate()}</span>`).join('');
  const woche = [...tage].reverse().map(d => `<div class="zeile"><div class="tag">${WT[new Date(d.t).getDay()]} ${new Date(d.t).getDate()}.</div>
      ${zeitleiste(d.t)}<div class="summe">${dauer(d.tag + d.nacht, true)}</div></div>`).join('');

  el.innerHTML = `<div class="karte">
      <div class="reiter"><button class="${verlaufTage === 7 ? 'an' : ''}" onclick="verlaufTage=7;zeigeVerlauf()">7 Tage</button><button class="${verlaufTage === 14 ? 'an' : ''}" onclick="verlaufTage=14;zeigeVerlauf()">14 Tage</button></div>
    </div>
    <div class="karte"><h2>Schlaf im Durchschnitt</h2>
      <div class="kacheln">
        <div class="kachel"><div class="wert">${fmt(avg(d => d.tag + d.nacht), v => dauer(v, true))}</div><div class="bez">Schlaf pro Tag</div></div>
        <div class="kachel"><div class="wert">${fmt(avg(d => d.nacht), v => dauer(v, true))}</div><div class="bez">davon Nacht</div></div>
        <div class="kachel"><div class="wert">${fmt(avg(d => d.naps.length), v => v.toFixed(1).replace('.', ','))}</div><div class="bez">Schläfchen pro Tag</div></div>
        <div class="kachel"><div class="wert">${fmt(napLen, v => dauer(v, true))}</div><div class="bez">Ø Schläfchen</div></div>
        <div class="kachel"><div class="wert">${fmt(wwAvg, v => dauer(v, true))}</div><div class="bez">Ø Wachfenster</div></div>
        <div class="kachel"><div class="wert">${fmt(mahlAvg, v => v.toFixed(1).replace('.', ','))}</div><div class="bez">Mahlzeiten pro Tag</div></div>
      </div>
      <p class="leise klein">Ohne den heutigen Tag. Nachtschlaf wird an Mitternacht geteilt.</p>
    </div>
    <div class="karte"><h2>Schlaf pro Tag</h2>
      <div class="saeulen">${saeulen}</div><div class="saeulen-achse">${achse}</div>
      <div class="legende"><span><i style="background:var(--schlaf)"></i>Tagschlaf</span><span><i style="background:var(--nacht)"></i>Nachtschlaf</span></div>
    </div>
    <div class="karte woche"><h2>Schlafmuster</h2>${woche}
      <div class="zeile"><div></div><div class="skala"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div><div></div></div>
      <div class="legende"><span><i style="background:var(--essen);border-radius:50%"></i>Mahlzeit</span></div>
    </div>
    <div class="karte"><h2>Mahlzeiten pro Tag</h2>
      <div class="saeulen" style="height:90px">${mahlSaeulen}</div><div class="saeulen-achse">${achse}</div>
    </div>`;
}

/* ---------- Ansicht: Profil ---------- */
function zeigeProfil() {
  const p = S.profil;
  $('#v-profil').innerHTML = `<div class="karte"><h2>Dein Baby</h2>
    <form id="profil-form">
      <label class="feld">Name<input name="name" value="${esc(p.name)}" placeholder="z. B. Mia" autocomplete="off"></label>
      <label class="feld">Geburtsdatum<input type="date" name="geburt" value="${esc(p.geburt)}" max="${tagKey(Date.now())}" required></label>
      <div class="zeile2">
        <label class="feld">Übliche Aufwachzeit<input type="time" name="aufwach" value="${esc(p.aufwach)}"></label>
        <label class="feld">Spätestens ins Bett<input type="time" name="spaetestens" value="${esc(p.spaetestens)}"></label>
      </div>
      <button class="knopf breit">Speichern</button>
      <p class="leise klein" id="profil-ok"></p>
    </form></div>
    <div class="karte"><h2>Datensicherung</h2>
      <p class="leise klein">Alle Einträge liegen nur auf diesem Gerät, in diesem Browser. Sichere sie ab und zu als Datei.</p>
      <div class="knoepfe"><button class="knopf rand" onclick="sichern()">⬇︎ Sichern</button><button class="knopf rand" onclick="$('#import').click()">⬆︎ Wiederherstellen</button></div>
      <input type="file" id="import" accept="application/json,.json" hidden onchange="wiederherstellen(this.files[0])">
      <div class="knoepfe" style="grid-template-columns:1fr"><button class="knopf gefahr" onclick="allesLoeschen()">Alle Daten löschen</button></div>
    </div>
    <p class="fuss-hinweis">Schlafwolke gibt Richtwerte aus üblichen Empfehlungen. Jedes Baby ist anders – bei Fragen zu Schlaf, Trinken oder Gesundheit bitte Hebamme oder Kinderärztin fragen.</p>`;
  $('#profil-form').onsubmit = ev => {
    ev.preventDefault();
    const f = ev.target;
    Object.assign(S.profil, { name: f.name.value.trim(), geburt: f.geburt.value, aufwach: f.aufwach.value || '07:00', spaetestens: f.spaetestens.value || '20:30' });
    speichern(); kopf();
    $('#profil-ok').textContent = 'Gespeichert ✓';
  };
}
function sichern() {
  const blob = new Blob([JSON.stringify({ ...S, wetter: { ...S.wetter, cache: null } }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Schlafwolke Sicherung ${tagKey(Date.now())}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function wiederherstellen(datei) {
  if (!datei) return;
  datei.text().then(t => {
    const d = JSON.parse(t);
    if (!Array.isArray(d.schlaf) || !d.profil) throw new Error('Keine Schlafwolke-Sicherung');
    if (!confirm(`Sicherung mit ${d.schlaf.length} Schlaf- und ${(d.essen || []).length} Fütter-Einträgen laden? Die aktuellen Daten werden ersetzt.`)) return;
    localStorage.setItem(SPEICHER, JSON.stringify(d)); laden(); alles(); alert('Wiederhergestellt ✓');
  }).catch(e => alert('Datei konnte nicht gelesen werden: ' + e.message));
}
function allesLoeschen() {
  if (!confirm('Wirklich ALLE Einträge und das Profil löschen? Das lässt sich nicht rückgängig machen.')) return;
  localStorage.removeItem(SPEICHER); location.reload();
}

/* ---------- Rahmen ---------- */
let aktiv = 'schlaf';
function kopf() {
  $('#baby-kurz').textContent = S.profil.geburt ? `${babyName()} · ${alterText()}` : '';
}
function zeige(v) {
  aktiv = v;
  document.querySelectorAll('.ansicht').forEach(s => s.classList.toggle('aktiv', s.id === 'v-' + v));
  document.querySelectorAll('.leiste button').forEach(b => b.classList.toggle('aktiv', b.dataset.v === v));
  try { sessionStorage.setItem('ansicht', v); } catch (e) {}
  rendern();
  window.scrollTo(0, 0);
}
function rendern() {
  kopf();
  ({ schlaf: zeigeSchlaf, essen: zeigeEssen, verlauf: zeigeVerlauf, wetter: () => window.zeigeWetter && zeigeWetter(), profil: zeigeProfil })[aktiv]();
}
function alles() { if (aktiv !== 'profil') rendern(); else kopf(); }

document.querySelectorAll('.leiste button').forEach(b => b.onclick = () => zeige(b.dataset.v));
laden();
// Laufende Uhren jede Sekunde, Vorhersagen jede Minute aktualisieren
setInterval(() => document.querySelectorAll('[data-lauf]').forEach(u => u.textContent = laufzeit(Date.now() - +u.dataset.lauf)), 1000);
setInterval(() => { if (!$('#dlg').open && (aktiv === 'schlaf' || aktiv === 'essen')) rendern(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#dlg').open && aktiv !== 'profil') rendern(); });
window.addEventListener('DOMContentLoaded', () => {
  let start = 'schlaf';
  try { start = sessionStorage.getItem('ansicht') || 'schlaf'; essenReiter = sessionStorage.getItem('essenReiter') || 'milch'; } catch (e) {}
  zeige(start);
});
if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
