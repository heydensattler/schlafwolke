/* Schlafwolke – Windeln und Wachstum (WHO-Kurven aus who.js) */
'use strict';

/* ================= Windeln ================= */
const WINDEL = { nass: ['💧', 'Nass'], voll: ['💩', 'Voll'], beides: ['💧💩', 'Nass + voll'] };
const STUHLFARBE = { gelb: 'gelb / senfgelb', braun: 'braun', gruen: 'grün', schwarz: 'schwarz-grün (Kindspech)', hell: 'hell / weißlich / lehmfarben' };
const istNass = w => w.art === 'nass' || w.art === 'beides';
const istVoll = w => w.art === 'voll' || w.art === 'beides';

function windelNeu(art) {
  S.windeln.push({ id: neueId(), art, start: Date.now() });
  speichern(); zeigeEssen();
}
function zeigeWindeln() {
  const alle = sortiert(S.windeln), jetzt = Date.now();
  const letzte = alle[alle.length - 1];
  const h24 = alle.filter(w => w.start > jetzt - TAG);
  const nass24 = h24.filter(istNass).length, voll24 = h24.filter(istVoll).length;
  const heute = tagAnfang(jetzt);
  const alterTage = S.profil.geburt ? Math.floor((jetzt - new Date(S.profil.geburt + 'T00:00').getTime()) / TAG) : null;

  // Richtwert nur in den ersten Wochen, wenn es darauf wirklich ankommt
  let richtwert = '';
  if (alterTage !== null && alterTage < 42) {
    const sollNass = alterTage < 5 ? alterTage + 1 : 6;
    const knapp = alterTage >= 1 && nass24 < sollNass && alle.some(w => w.start < jetzt - TAG);
    richtwert = `<li class="${knapp ? 'wichtig' : ''}">Richtwert ${alterTage < 5 ? `am ${alterTage + 1}. Lebenstag: etwa ${sollNass} nasse Windeln` : 'ab dem 6. Tag: mindestens 6 nasse Windeln'} in 24 Stunden${alterTage >= 4 ? ' und in den ersten Wochen meist mehrmals täglich Stuhl' : ''}.
      ${knapp ? ' Weniger als das? Mehr anlegen bzw. füttern und Hebamme oder Kinderärztin fragen.' : ''}</li>`;
  }
  const hell = alle.filter(w => w.farbe === 'hell' && w.start > jetzt - 7 * TAG);
  const warnHell = hell.length ? `<li class="wichtig">Heller, weißlicher oder lehmfarbener Stuhl am ${new Date(hell[hell.length - 1].start).toLocaleDateString('de-DE')}: bitte noch heute mit der Kinderärztin sprechen und die Stuhlfarbkarte im gelben Heft vergleichen.</li>` : '';

  const tage = []; for (let i = 6; i >= 0; i--) { const t = heute - i * TAG; const a = alle.filter(w => tagAnfang(w.start) === t); tage.push({ t, nass: a.filter(istNass).length, voll: a.filter(istVoll).length }); }
  const max = Math.max(6, ...tage.map(d => Math.max(d.nass, d.voll)));
  const saeulen = tage.map(d => `<div class="saeule" style="flex-direction:row;align-items:flex-end;gap:2px" title="${d.nass} nass, ${d.voll} voll">
      <div class="teil wnass" style="flex:1;height:${d.nass / max * 100}%"></div><div class="teil wvoll" style="flex:1;height:${d.voll / max * 100}%"></div></div>`).join('');
  const achse = tage.map(d => `<span>${WT[new Date(d.t).getDay()]}</span>`).join('');
  const zeile = w => `<li onclick="windelDialog('${w.id}')"><div class="sym windel">${WINDEL[w.art][0]}</div>
      <div class="haupt"><b>${WINDEL[w.art][1]}</b>${w.farbe ? ` <span class="leise klein">· ${STUHLFARBE[w.farbe]}</span>` : ''}<div class="leise klein">${WT[new Date(w.start).getDay()]} ${uhr(w.start)}${w.notiz ? ' · ' + esc(w.notiz) : ''}</div></div>
      <div class="neben">${relativ(w.start)}</div></li>`;

  return `<div class="karte status">
      <div class="leise">Letzte Windel</div>
      <div class="gross" style="margin:6px 0">${letzte ? relativ(letzte.start) : '–'}</div>
      <div class="leise klein">${letzte ? WINDEL[letzte.art][1] + ' um ' + uhr(letzte.start) : 'Noch nichts eingetragen'}</div>
      <div class="knoepfe drei">
        <button class="knopf windel" onclick="windelNeu('nass')">💧 Nass</button>
        <button class="knopf windel" onclick="windelNeu('voll')">💩 Voll</button>
        <button class="knopf windel" onclick="windelNeu('beides')">💧💩 Beides</button>
      </div>
      <p class="leise klein" style="margin:8px 0 0">Ein Tipp trägt die Windel mit der aktuellen Uhrzeit ein. Zum Ändern oder für die Stuhlfarbe unten antippen.</p>
    </div>
    <div class="karte"><h2>Letzte 24 Stunden</h2>
      <div class="kacheln"><div class="kachel"><div class="wert">${nass24}</div><div class="bez">nasse Windeln</div></div>
        <div class="kachel"><div class="wert">${voll24}</div><div class="bez">volle Windeln</div></div></div>
      ${richtwert || warnHell ? `<ul class="hinweise">${warnHell}${richtwert}</ul>` : ''}
    </div>
    <div class="karte"><h2>Letzte 7 Tage</h2>
      <div class="saeulen" style="height:100px">${saeulen}</div><div class="saeulen-achse">${achse}</div>
      <div class="legende"><span><i style="background:var(--wetter)"></i>nass</span><span><i style="background:#b08a5a"></i>voll</span></div>
    </div>
    <div class="karte"><h2>Letzte 48 Stunden</h2>
      <ul class="liste">${alle.filter(w => w.start > jetzt - 2 * TAG).reverse().map(zeile).join('') || '<li class="plan">Noch nichts eingetragen.</li>'}</ul>
      <div class="knoepfe" style="grid-template-columns:1fr"><button class="knopf rand" onclick="windelDialog()">+ Nachtragen</button></div>
    </div>`;
}
function windelDialog(id) {
  const w = id ? S.windeln.find(x => x.id === id) : null;
  const opt = (obj, wert) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${wert === k ? 'selected' : ''}>${Array.isArray(v) ? v[0] + ' ' + v[1] : v}</option>`).join('');
  dialog(`<h2>${w ? 'Windel bearbeiten' : 'Windel nachtragen'}</h2>
    <label class="feld">Art<select name="art">${opt(WINDEL, w?.art || 'nass')}</select></label>
    <label class="feld">Uhrzeit<input type="datetime-local" name="start" value="${inputWert(w ? w.start : Date.now())}" required></label>
    <label class="feld">Stuhlfarbe (bei voller Windel)<select name="farbe"><option value="">–</option>${opt(STUHLFARBE, w?.farbe)}</select></label>
    <label class="feld">Notiz (optional)<input name="notiz" value="${esc(w?.notiz || '')}" placeholder="z. B. wund, sehr flüssig"></label>
    <div class="dlg-knoepfe">${w ? '<button class="knopf gefahr" value="loeschen">Löschen</button>' : ''}<button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf windel" value="ok">Speichern</button></div>`,
    (k, f) => {
      if (k === 'loeschen') { S.windeln = S.windeln.filter(x => x !== w); return; }
      const st = ausInput(f.start.value);
      if (!st) return 'Bitte eine Zeit angeben.';
      if (st > Date.now() + MIN) return 'Die Zeit liegt in der Zukunft.';
      const d = { art: f.art.value, start: st, farbe: f.art.value === 'nass' ? '' : f.farbe.value, notiz: f.notiz.value.trim() };
      if (w) Object.assign(w, d); else S.windeln.push({ id: neueId(), ...d });
    });
}

/* ================= Wachstum ================= */
const MASSE = {
  gewicht: { name: 'Gewicht', einheit: 'kg', stellen: 2 },
  groesse: { name: 'Größe', einheit: 'cm', stellen: 1 },
  kopf: { name: 'Kopfumfang', einheit: 'cm', stellen: 1 },
};
let wachsMass = 'gewicht';
const zahl = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) && n > 0 ? n : null; };
const deZahl = (n, st) => n.toLocaleString('de-DE', { minimumFractionDigits: st, maximumFractionDigits: st });
function alterMonate(ms) { return (ms - new Date(S.profil.geburt + 'T00:00').getTime()) / (30.4375 * TAG); }
function lms(mass, monate) {
  const tab = WHO_LMS[S.profil.geschlecht]?.[mass]; if (!tab || monate < 0 || monate > 24) return null;
  const i = Math.min(23, Math.floor(monate)), f = monate - i, a = tab[i], b = tab[i + 1];
  return a.map((x, k) => x + (b[k] - x) * f);
}
const ausZ = ([L, M, Sg], z) => M * Math.pow(1 + L * Sg * z, 1 / L);
function zWert([L, M, Sg], x) { return (Math.pow(x / M, L) - 1) / (L * Sg); }
function phi(z) { // Normalverteilung
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
const PERZ = [[-1.881, 3], [-1.036, 15], [0, 50], [1.036, 85], [1.881, 97]];

function wachsKurve(mass, punkte) {
  const B = 340, H = 230, l = 36, r = 10, o = 10, u = 26;
  const letzterMonat = Math.max(alterMonate(Date.now()), ...punkte.map(p => p.m));
  const xmax = Math.min(24, Math.max(6, Math.ceil(letzterMonat + 2)));
  const kurven = PERZ.map(([z]) => { const a = []; for (let m = 0; m <= xmax + 1e-9; m += 0.25) a.push([m, ausZ(lms(mass, m), z)]); return a; });
  let ymin = Math.min(kurven[0][0][1], ...punkte.map(p => p.v)), ymax = Math.max(kurven[4][kurven[4].length - 1][1], ...punkte.map(p => p.v));
  const pad = (ymax - ymin) * 0.05; ymin -= pad; ymax += pad;
  const X = m => l + (m / xmax) * (B - l - r), Y = v => o + (1 - (v - ymin) / (ymax - ymin)) * (H - o - u);
  const pfad = a => a.map(([m, v], i) => (i ? 'L' : 'M') + X(m).toFixed(1) + ' ' + Y(v).toFixed(1)).join('');
  const band = (a, b) => pfad(a) + b.slice().reverse().map(([m, v]) => 'L' + X(m).toFixed(1) + ' ' + Y(v).toFixed(1)).join('') + 'Z';
  const schritt = (ymax - ymin) > 30 ? 10 : (ymax - ymin) > 12 ? 5 : (ymax - ymin) > 6 ? 2 : 1;
  let gitter = '';
  for (let v = Math.ceil(ymin / schritt) * schritt; v <= ymax; v += schritt) gitter += `<line x1="${l}" x2="${B - r}" y1="${Y(v)}" y2="${Y(v)}" class="gitter"/><text x="${l - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  const xs = xmax <= 12 ? 1 : 3;
  for (let m = 0; m <= xmax; m += xs) gitter += `<text x="${X(m)}" y="${H - 8}" text-anchor="${m + xs > xmax ? 'end' : 'middle'}">${m + xs > xmax ? m + ' Monate' : m}</text>`;
  const marken = PERZ.map(([, p], i) => { const a = kurven[i][kurven[i].length - 1]; return `<text x="${X(a[0]) - 2}" y="${Y(a[1]) - 3}" text-anchor="end" class="pz">${p}</text>`; }).join('');
  return `<svg viewBox="0 0 ${B} ${H}" class="kurve" role="img" aria-label="${MASSE[mass].name} im Vergleich zu den WHO-Kurven">
    ${gitter}
    <path d="${band(kurven[0], kurven[4])}" class="band-aussen"/><path d="${band(kurven[1], kurven[3])}" class="band-innen"/>
    <path d="${pfad(kurven[2])}" class="median"/>${marken}
    ${punkte.length > 1 ? `<path d="${pfad(punkte.map(p => [p.m, p.v]))}" class="baby-linie"/>` : ''}
    ${punkte.map(p => `<circle cx="${X(p.m)}" cy="${Y(p.v)}" r="4" class="baby-punkt"/>`).join('')}
  </svg>`;
}
function zeigeWachstum() {
  const liste = sortiert(S.wachstum.map(w => ({ ...w, start: new Date(w.datum + 'T12:00').getTime() })));
  const mass = wachsMass, M = MASSE[mass];
  const punkte = liste.filter(w => zahl(w[mass])).map(w => ({ m: alterMonate(w.start), v: zahl(w[mass]), w }));
  const reiter = `<div class="reiter">${Object.entries(MASSE).map(([k, v]) => `<button class="${k === mass ? 'an' : ''}" onclick="wachsMass='${k}';zeigeProfil()">${v.name}</button>`).join('')}</div>`;
  let kopf = '', kurve = '', hinweis = '';
  const kannKurve = S.profil.geburt && S.profil.geschlecht && alterMonate(Date.now()) <= 26;
  if (punkte.length) {
    const p = punkte[punkte.length - 1], vor = punkte[punkte.length - 2];
    const t = lms(mass, p.m);
    const pz = t ? Math.round(phi(zWert(t, p.v)) * 100) : null;
    let diff = '';
    if (vor) {
      const tage = (p.w.start - vor.w.start) / TAG;
      if (mass === 'gewicht' && tage >= 3) diff = `${Math.round((p.v - vor.v) * 1000 / tage * 7) >= 0 ? '+' : ''}${Math.round((p.v - vor.v) * 1000 / tage * 7)} g pro Woche seit ${new Date(vor.w.start).toLocaleDateString('de-DE')}`;
      else if (tage >= 3) diff = `${p.v - vor.v >= 0 ? '+' : ''}${deZahl(p.v - vor.v, 1)} cm seit ${new Date(vor.w.start).toLocaleDateString('de-DE')}`;
    }
    kopf = `<div class="vorhersage" style="margin-top:14px"><div class="gross">${deZahl(p.v, M.stellen)} <span style="font-size:18px">${M.einheit}</span></div>
      <div class="leise" style="text-align:right">${pz !== null ? `${pz <= 1 ? 'unter der 3.' : pz >= 99 ? 'über der 97.' : 'etwa ' + pz + '.'} Perzentile` : ''}</div></div>
      <p class="leise klein" style="margin:4px 0 0">am ${new Date(p.w.start).toLocaleDateString('de-DE')}${diff ? ' · ' + diff : ''}</p>`;
    if (pz !== null && (pz < 3 || pz > 97)) hinweis = '<li class="wichtig">Der Wert liegt außerhalb des Bereichs, in dem 94 von 100 Babys liegen. Das kann ganz normal sein – sprich es bei der nächsten U-Untersuchung an.</li>';
  }
  if (kannKurve) kurve = wachsKurve(mass, punkte);
  const ohneKurve = !S.profil.geschlecht ? 'Für die Kurven oben „Geschlecht“ auswählen.' : !S.profil.geburt ? 'Für die Kurven den Geburtstag eintragen.' : alterMonate(Date.now()) > 26 ? 'Die Kurven reichen bis 2 Jahre.' : '';
  const zeilen = [...liste].reverse().map(w => `<li onclick="wachstumDialog('${w.id}')"><div class="sym wachs">📏</div>
      <div class="haupt"><b>${new Date(w.start).toLocaleDateString('de-DE')}</b>${w.notiz ? ` <span class="leise klein">· ${esc(w.notiz)}</span>` : ''}
      <div class="leise klein">${['gewicht', 'groesse', 'kopf'].filter(k => zahl(w[k])).map(k => deZahl(zahl(w[k]), MASSE[k].stellen) + ' ' + MASSE[k].einheit).join(' · ')}</div></div></li>`).join('');
  return `<div class="karte" id="wachstum"><h2>Wachstum</h2>${reiter}${kopf}
      ${kurve ? `<div style="margin-top:10px">${kurve}</div><div class="legende"><span><i class="lg-aussen"></i>3.–97. Perzentile</span><span><i class="lg-innen"></i>15.–85.</span><span><i style="background:var(--wetter)"></i>${esc(babyName())}</span></div>` : ''}
      ${ohneKurve ? `<p class="leise klein">${ohneKurve}</p>` : ''}
      <ul class="hinweise">${hinweis}<li>Die Kurven zeigen, wo andere gesunde Babys liegen (WHO-Standard). Wichtiger als die genaue Perzentile ist, dass dein Baby ungefähr in seinem Bereich bleibt.</li></ul>
      <button class="knopf breit" style="margin-top:12px;background:var(--wetter)" onclick="wachstumDialog()">+ Messung eintragen</button>
      ${zeilen ? `<ul class="liste" style="margin-top:8px">${zeilen}</ul>` : ''}
    </div>`;
}
function wachstumDialog(id) {
  const w = id ? S.wachstum.find(x => x.id === id) : null;
  const vorDatum = w ? w.datum : (S.wachstum.length || !S.profil.geburt ? tagKey(Date.now()) : S.profil.geburt);
  const wert = (k) => w && zahl(w[k]) ? deZahl(zahl(w[k]), MASSE[k].stellen) : '';
  dialog(`<h2>📏 ${w ? 'Messung bearbeiten' : 'Messung eintragen'}</h2>
    <p class="leise klein" style="margin:0">Werte z. B. aus dem gelben U-Heft. Leere Felder werden übersprungen.</p>
    <label class="feld">Datum<input type="date" name="datum" value="${vorDatum}" max="${tagKey(Date.now())}" required></label>
    <div class="zeile2"><label class="feld">Gewicht (kg)<input name="gewicht" inputmode="decimal" placeholder="z. B. 6,45" value="${wert('gewicht')}"></label>
      <label class="feld">Größe (cm)<input name="groesse" inputmode="decimal" placeholder="z. B. 62,5" value="${wert('groesse')}"></label></div>
    <label class="feld">Kopfumfang (cm)<input name="kopf" inputmode="decimal" placeholder="z. B. 40,5" value="${wert('kopf')}"></label>
    <label class="feld">Notiz (optional)<input name="notiz" value="${esc(w?.notiz || '')}" placeholder="z. B. U4, Hebamme"></label>
    <div class="dlg-knoepfe">${w ? '<button class="knopf gefahr" value="loeschen">Löschen</button>' : ''}<button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf" style="background:var(--wetter)" value="ok">Speichern</button></div>`,
    (k, f) => {
      if (k === 'loeschen') { if (!confirm('Messung löschen?')) return 'Nicht gelöscht.'; S.wachstum = S.wachstum.filter(x => x !== w); setTimeout(zeigeProfil, 0); return; }
      const d = { datum: f.datum.value, notiz: f.notiz.value.trim() };
      for (const m of ['gewicht', 'groesse', 'kopf']) {
        const roh = f[m].value.trim(); if (!roh) { d[m] = null; continue; }
        let n = zahl(roh); if (n === null) return `${MASSE[m].name}: bitte eine Zahl eingeben.`;
        if (m === 'gewicht' && n > 100) n = n / 1000; // in Gramm eingegeben
        const grenzen = { gewicht: [1, 25], groesse: [35, 110], kopf: [25, 55] }[m];
        if (n < grenzen[0] || n > grenzen[1]) return `${MASSE[m].name} ${deZahl(n, MASSE[m].stellen)} ${MASSE[m].einheit} wirkt unplausibel – bitte prüfen.`;
        d[m] = n;
      }
      if (!d.datum) return 'Bitte ein Datum angeben.';
      if (!d.gewicht && !d.groesse && !d.kopf) return 'Bitte mindestens einen Wert eintragen.';
      if (w) Object.assign(w, d); else S.wachstum.push({ id: neueId(), ...d });
      setTimeout(zeigeProfil, 0);
    });
}
