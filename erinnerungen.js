/* Schlafwolke – Meilensteine und Tagebuch (Fotos in IndexedDB, damit localStorage klein bleibt) */
'use strict';

/* ---------- Fotos ---------- */
let fotoDbP = null;
function fotoDb() {
  return fotoDbP ||= new Promise((ok, err) => {
    const r = indexedDB.open('schlafwolke-fotos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('fotos');
    r.onsuccess = () => ok(r.result); r.onerror = () => err(r.error);
  });
}
async function fotoTx(modus, fn) {
  const db = await fotoDb();
  return new Promise((ok, err) => {
    const tx = db.transaction('fotos', modus), st = tx.objectStore('fotos');
    let erg; const r = fn(st); if (r) r.onsuccess = () => { erg = r.result; };
    tx.oncomplete = () => ok(erg); tx.onerror = () => err(tx.error);
  });
}
const fotoLaden = id => fotoTx('readonly', st => st.get(id));
const fotoPut = (id, blob) => fotoTx('readwrite', st => st.put(blob, id));
const fotoWeg = id => id ? fotoTx('readwrite', st => st.delete(id)).catch(() => {}) : Promise.resolve();
async function fotoAlle() {
  const db = await fotoDb();
  return new Promise((ok, err) => {
    const a = [], r = db.transaction('fotos').objectStore('fotos').openCursor();
    r.onsuccess = () => { const c = r.result; if (c) { a.push([c.key, c.value]); c.continue(); } else ok(a); };
    r.onerror = () => err(r.error);
  });
}
async function fotoVerkleinern(datei, max = 1400) {
  const bild = await new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => err(new Error('Bild nicht lesbar')); i.src = URL.createObjectURL(datei); });
  const f = Math.min(1, max / Math.max(bild.naturalWidth, bild.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(bild.naturalWidth * f); c.height = Math.round(bild.naturalHeight * f);
  c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
  URL.revokeObjectURL(bild.src);
  return new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.82));
}
const fotoUrls = {};
async function fotosEinsetzen(el = document) {
  for (const img of el.querySelectorAll('img[data-foto]')) {
    const id = img.dataset.foto;
    if (!fotoUrls[id]) { const b = await fotoLaden(id).catch(() => null); if (!b) { img.remove(); continue; } fotoUrls[id] = URL.createObjectURL(b); }
    img.src = fotoUrls[id];
  }
}
// Foto-Feld im Dialog: wählt, verkleinert und merkt sich das neue Foto bis zum Speichern
let dlgFoto = { neu: null, alt: null, entfernen: false };
function fotoFeld(altId) {
  dlgFoto = { neu: null, alt: altId || null, entfernen: false };
  return `<div class="foto-feld"><div id="foto-vorschau">${altId ? `<img data-foto="${altId}" alt="">` : ''}</div>
    <label class="knopf rand foto-knopf">📷 ${altId ? 'Foto ändern' : 'Foto hinzufügen'}<input type="file" accept="image/*" hidden onchange="fotoGewaehlt(this.files[0])"></label>
    ${altId ? '<button type="button" class="link" onclick="dlgFoto.entfernen=true;$(\'#foto-vorschau\').innerHTML=\'\'">Foto entfernen</button>' : ''}</div>`;
}
async function fotoGewaehlt(datei) {
  if (!datei) return;
  try {
    dlgFoto.neu = await fotoVerkleinern(datei); dlgFoto.entfernen = false;
    $('#foto-vorschau').innerHTML = `<img src="${URL.createObjectURL(dlgFoto.neu)}" alt="">`;
  } catch (e) { alert('Das Foto konnte nicht geladen werden: ' + e.message); }
}
async function fotoUebernehmen() { // liefert die neue Foto-ID (oder null)
  if (dlgFoto.neu) { const id = 'f' + neueId(); await fotoPut(id, dlgFoto.neu); await fotoWeg(dlgFoto.alt); return id; }
  if (dlgFoto.entfernen) { await fotoWeg(dlgFoto.alt); return null; }
  return dlgFoto.alt;
}
function dialogFertig(promise) { promise.then(() => { speichern(); rendern(); }).catch(e => alert('Foto konnte nicht gespeichert werden: ' + e.message)); }

/* ---------- Meilensteine ---------- */
// [Schlüssel, Name, von Monat, bis Monat] – grobe Orientierung, keine Diagnose
const MEILENSTEINE = [
  ['laecheln', 'Erstes bewusstes Lächeln', 1, 3], ['kopf', 'Hält den Kopf in Bauchlage', 2, 4], ['lachen', 'Lacht laut', 3, 5],
  ['greifen', 'Greift gezielt nach Spielzeug', 3, 5], ['dreht_br', 'Dreht sich vom Bauch auf den Rücken', 4, 6],
  ['dreht_rb', 'Dreht sich vom Rücken auf den Bauch', 5, 7], ['brei', 'Erster Brei', 5, 7], ['sitzt', 'Sitzt ohne Hilfe', 6, 9],
  ['robbt', 'Robbt', 6, 9], ['krabbelt', 'Krabbelt', 7, 11], ['hochziehen', 'Zieht sich zum Stehen hoch', 8, 11],
  ['pinzette', 'Pinzettengriff', 9, 12], ['winkt', 'Winkt', 9, 12], ['becher', 'Trinkt aus dem Becher', 9, 15],
  ['kreuzen', 'Läuft an Möbeln entlang', 9, 13], ['mama', 'Sagt bewusst „Mama“ oder „Papa“', 10, 14], ['steht', 'Steht frei', 10, 14],
  ['schritte', 'Erste freie Schritte', 11, 16], ['wort', 'Erstes Wort', 12, 18], ['zeigt', 'Zeigt auf Dinge', 12, 15],
  ['loeffel', 'Isst mit dem Löffel', 14, 20], ['rennt', 'Rennt', 16, 24], ['zweiwort', 'Erste Zwei-Wort-Sätze', 20, 26],
].map(([k, n, von, bis]) => ({ k, n, von, bis }));
const ERSTE_MALE = [['bad', 'Erstes Bad'], ['spaziergang', 'Erster Spaziergang'], ['durchgeschlafen', 'Erste ganze Nacht durchgeschlafen'],
  ['ausflug', 'Erster Ausflug'], ['urlaub', 'Erster Urlaub'], ['schwimmen', 'Erstes Mal Babyschwimmen'], ['haare', 'Erste Haare geschnitten'],
  ['kita', 'Erster Tag bei Tagesmutter / Kita'], ['weihnachten', 'Erstes Weihnachten'], ['geburtstag', 'Erster Geburtstag']].map(([k, n]) => ({ k, n }));

let babyReiter = 'profil';
function babyReiterSetzen(r) { babyReiter = r; try { sessionStorage.setItem('babyReiter', r); } catch (e) {} zeigeProfil(); window.scrollTo(0, 0); }
function alleMeilensteine() {
  return [...MEILENSTEINE, ...ERSTE_MALE.map(m => ({ ...m, erste: true })), ...Object.entries(S.meilensteine || {}).filter(([k, v]) => v.eigen).map(([k, v]) => ({ k, n: v.name, eigen: true }))];
}
function zeigeMeilensteine() {
  const ms = S.meilensteine || {}, mon = (alterWochen() ?? 0) / 4.345;
  const alle = alleMeilensteine(), erreicht = alle.filter(m => ms[m.k]?.datum);
  const zeile = m => {
    const e = ms[m.k];
    return `<li onclick="meilensteinDialog(${jsArg(m.k)})"><div class="sym ms ${e?.datum ? 'da' : ''}">${e?.datum ? '⭐' : '○'}</div>
      <div class="haupt"><b>${esc(m.n)}</b><div class="leise klein">${e?.datum ? datumDE(new Date(e.datum + 'T12:00').getTime()) + ' · mit ' + alterBeiText(e.datum) + (e.notiz ? ' · ' + esc(e.notiz) : '') : m.von !== undefined ? `meist mit ${m.von}–${m.bis} Monaten` : ''}</div></div>
      ${e?.foto ? `<img data-foto="${e.foto}" class="mini" alt="">` : ''}</li>`;
  };
  const entw = MEILENSTEINE.filter(m => !ms[m.k]?.datum);
  const jetzt = entw.filter(m => mon >= m.von - 1 && mon <= m.bis + 2), spaeter = entw.filter(m => mon < m.von - 1), frueher = entw.filter(m => mon > m.bis + 2);
  const erlListe = [...erreicht].sort((a, b) => ms[b.k].datum.localeCompare(ms[a.k].datum));
  return `<div class="karte"><h2>Meilensteine · ${erreicht.length} erreicht</h2>
      ${jetzt.length ? `<h3>Gerade typisch</h3><ul class="liste">${jetzt.map(zeile).join('')}</ul>` : ''}
      ${erlListe.length ? `<h3>Schon geschafft</h3><ul class="liste">${erlListe.map(zeile).join('')}</ul>` : ''}
      ${frueher.length ? `<h3>Noch nicht eingetragen</h3><ul class="liste">${frueher.map(zeile).join('')}</ul>` : ''}
      ${spaeter.length ? `<details><summary class="leise">Später (${spaeter.length})</summary><ul class="liste">${spaeter.map(zeile).join('')}</ul></details>` : ''}
      <p class="leise klein" style="margin:10px 0 0">Jedes Kind hat sein eigenes Tempo – die Monatsangaben sind nur eine grobe Orientierung, kein Test. Fragen dazu passen gut in die nächste U-Untersuchung.</p>
    </div>
    <div class="karte"><h2>Erste Male</h2><ul class="liste">${alle.filter(m => m.erste || m.eigen).map(zeile).join('')}</ul>
      <button class="knopf rand breit" style="margin-top:10px" onclick="meilensteinDialog()">+ Eigenen Meilenstein anlegen</button></div>`;
}
function meilensteinDialog(k) {
  S.meilensteine ||= {};
  const m = k ? alleMeilensteine().find(x => x.k === k) : null, e = k ? S.meilensteine[k] || {} : {};
  dialog(`<h2>⭐ ${m ? esc(m.n) : 'Eigener Meilenstein'}</h2>
    ${m?.von !== undefined ? `<p class="leise klein" style="margin:0">Meist mit ${m.von}–${m.bis} Monaten – manchmal früher, manchmal später.</p>` : ''}
    ${!m || m.eigen ? `<label class="feld">Name<input name="name" value="${esc(m?.n || '')}" placeholder="z. B. Erstes Mal im Zoo" required></label>` : ''}
    <label class="feld">Datum<input type="date" name="datum" value="${esc(e.datum || '')}" max="${tagKey(Date.now())}"></label>
    <label class="feld">Notiz (optional)<input name="notiz" value="${esc(e.notiz || '')}" placeholder="z. B. bei Oma auf dem Sofa"></label>
    ${fotoFeld(e.foto)}
    <div class="dlg-knoepfe">${e.datum || m?.eigen ? '<button class="knopf gefahr" value="loeschen">Zurücksetzen</button>' : ''}<button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button>
      ${!e.datum ? '<button class="knopf rand" value="heute">Heute</button>' : ''}<button class="knopf erinn" value="ok">Speichern</button></div>`,
    (knopf, f) => {
      const key = k || 'eigen_' + neueId();
      if (knopf === 'loeschen') { const foto = S.meilensteine[key]?.foto; delete S.meilensteine[key]; fotoWeg(foto); return; }
      const datum = knopf === 'heute' ? tagKey(Date.now()) : f.datum.value;
      const name = f.name ? f.name.value.trim() : null;
      if (f.name && !name) return 'Bitte einen Namen eingeben.';
      if (!datum && !(m?.eigen || !m)) return 'Bitte ein Datum wählen oder „Heute“ tippen.';
      const eintrag = { ...e, datum, notiz: f.notiz.value.trim() };
      if (!m || m.eigen) { eintrag.eigen = true; eintrag.name = name; }
      S.meilensteine[key] = eintrag;
      dialogFertig(fotoUebernehmen().then(id => { eintrag.foto = id; }));
    });
  fotosEinsetzen($('#dlg'));
}

/* ---------- Tagebuch ---------- */
function zeigeTagebuch() {
  const ms = S.meilensteine || {};
  const punkte = [
    ...(S.tagebuch || []).map(t => ({ ms: new Date(t.datum + 'T12:00').getTime(), html: `<b>${esc(t.titel || 'Eintrag')}</b>${t.text ? `<p>${esc(t.text).replace(/\n/g, '<br>')}</p>` : ''}`, foto: t.foto, klick: `tagebuchDialog('${t.id}')`, sym: '📖' })),
    ...alleMeilensteine().filter(m => ms[m.k]?.datum).map(m => ({ ms: new Date(ms[m.k].datum + 'T12:00').getTime(), html: `<b>${esc(m.n)}</b>${ms[m.k].notiz ? `<p>${esc(ms[m.k].notiz)}</p>` : ''}`, foto: ms[m.k].foto, klick: `meilensteinDialog(${jsArg(m.k)})`, sym: '⭐' })),
    ...Object.entries(S.zaehne || {}).map(([c, d]) => ({ ms: new Date(d + 'T12:00').getTime(), html: `<b>Neuer Zahn: ${zahnName(+c)}</b>`, klick: `zahnDialog(${c})`, sym: '🦷' })),
  ];
  if (S.profil.geburt) punkte.push({ ms: new Date(S.profil.geburt + 'T12:00').getTime(), html: `<b>${esc(babyName())} ist da!</b>`, sym: '🌟' });
  punkte.sort((a, b) => b.ms - a.ms);
  let html = '', monat = '';
  for (const p of punkte) {
    const m = new Date(p.ms).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    if (m !== monat) { monat = m; html += `<h3 class="tb-monat">${m}</h3>`; }
    html += `<div class="tb-eintrag" ${p.klick ? `onclick="${p.klick}"` : ''}><div class="tb-sym">${p.sym}</div><div class="tb-inhalt">
      <div class="leise klein">${new Date(p.ms).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })}${S.profil.geburt && p.ms >= geburtMs() - TAG ? ' · ' + alterBeiText(tagKey(p.ms), true) : ''}</div>
      ${p.html}${p.foto ? `<img data-foto="${p.foto}" class="tb-foto" alt="">` : ''}</div></div>`;
  }
  return `<button class="knopf erinn breit" style="margin-top:12px" onclick="tagebuchDialog()">✏️ Neuer Tagebuch-Eintrag</button>
    <div class="karte tagebuch">${html || '<p class="leise">Noch keine Einträge.</p>'}</div>
    <p class="fuss-hinweis">Meilensteine und Zähne erscheinen hier automatisch. Fotos bleiben nur auf diesem Gerät – „Sichern“ unter Profil nimmt sie mit.</p>`;
}
function tagebuchDialog(id) {
  S.tagebuch ||= [];
  const t = id ? S.tagebuch.find(x => x.id === id) : null;
  dialog(`<h2>📖 ${t ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</h2>
    <label class="feld">Datum<input type="date" name="datum" value="${esc(t?.datum || tagKey(Date.now()))}" max="${tagKey(Date.now())}" required></label>
    <label class="feld">Überschrift<input name="titel" value="${esc(t?.titel || '')}" placeholder="z. B. Besuch bei Oma und Opa"></label>
    <label class="feld">Was ist passiert?<textarea name="text" rows="4" placeholder="Ein paar Sätze für später …">${esc(t?.text || '')}</textarea></label>
    ${fotoFeld(t?.foto)}
    <div class="dlg-knoepfe">${t ? '<button class="knopf gefahr" value="loeschen">Löschen</button>' : ''}<button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf erinn" value="ok">Speichern</button></div>`,
    (k, f) => {
      if (k === 'loeschen') { if (!confirm('Eintrag samt Foto löschen?')) return 'Nicht gelöscht.'; S.tagebuch = S.tagebuch.filter(x => x !== t); fotoWeg(t.foto); return; }
      const d = { datum: f.datum.value, titel: f.titel.value.trim(), text: f.text.value.trim() };
      if (!d.datum) return 'Bitte ein Datum wählen.';
      if (!d.titel && !d.text && !dlgFoto.neu && !dlgFoto.alt) return 'Bitte etwas eintragen oder ein Foto wählen.';
      const eintrag = t ? Object.assign(t, d) : (S.tagebuch.push({ id: neueId(), ...d }), S.tagebuch[S.tagebuch.length - 1]);
      dialogFertig(fotoUebernehmen().then(id => { eintrag.foto = id; }));
    });
  fotosEinsetzen($('#dlg'));
}

/* ---------- Sicherung inkl. Fotos ---------- */
const blobZuData = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
async function fotosFuerSicherung() { const o = {}; for (const [id, b] of await fotoAlle().catch(() => [])) o[id] = await blobZuData(b); return o; }
async function fotosAusSicherung(o) { for (const [id, data] of Object.entries(o || {})) await fotoPut(id, await (await fetch(data)).blob()); }
