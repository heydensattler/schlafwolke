/* Schlafwolke – Gesundheit: Vorsorge (U-Untersuchungen, Impfungen), Krank (Fieber, Medikamente), Zähne */
'use strict';

const MON = 30.4375; // Tage pro Monat
let gesReiter = 'vorsorge';
function gesReiterSetzen(r) { gesReiter = r; try { sessionStorage.setItem('gesReiter', r); } catch (e) {} zeigeGesundheit(); window.scrollTo(0, 0); }
const geburtMs = () => S.profil.geburt ? new Date(S.profil.geburt + 'T00:00').getTime() : null;
const datumDE = ms => new Date(ms).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' });
const datumKurz = ms => new Date(ms).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });

/* ================= Vorsorge ================= */
// Zeiträume in Tagen ab Geburt: [empfohlen von, bis, Toleranz von, bis]
const U_PLAN = [
  ['U1', 'Neugeborenen-Erstuntersuchung', 0, 0, 0, 1, 'direkt nach der Geburt'],
  ['U2', 'Neugeborenen-Basisuntersuchung', 3, 10, 3, 14, '3.–10. Lebenstag'],
  ['U3', 'Untersuchung in der 4.–5. Woche', 28, 35, 21, 56, '4.–5. Lebenswoche (spätestens 8. Woche), auch Hüft-Ultraschall'],
  ['U4', 'Untersuchung im 3.–4. Monat', 3 * MON, 4 * MON, 2 * MON, 4.5 * MON, '3.–4. Lebensmonat'],
  ['U5', 'Untersuchung im 6.–7. Monat', 6 * MON, 7 * MON, 5 * MON, 8 * MON, '6.–7. Lebensmonat'],
  ['U6', 'Untersuchung im 10.–12. Monat', 10 * MON, 12 * MON, 9 * MON, 14 * MON, '10.–12. Lebensmonat'],
  ['U7', 'Untersuchung im 21.–24. Monat', 21 * MON, 24 * MON, 20 * MON, 27 * MON, '21.–24. Lebensmonat'],
  ['U7a', 'Untersuchung im 34.–36. Monat', 34 * MON, 36 * MON, 33 * MON, 38 * MON, '34.–36. Lebensmonat'],
  ['U8', 'Untersuchung im 46.–48. Monat', 46 * MON, 48 * MON, 43 * MON, 50 * MON, '46.–48. Lebensmonat'],
  ['U9', 'Untersuchung im 60.–64. Monat', 60 * MON, 64 * MON, 58 * MON, 66 * MON, '60.–64. Lebensmonat'],
].map(([k, name, v, b, tv, tb, text]) => ({ k, name, typ: 'u', von: v, bis: b, tvon: tv, tbis: tb, text }));

// Impfungen nach STIKO-Kalender für Säuglinge (Alter in Monaten bzw. Wochen)
const IMPF_PLAN = [
  ['rsv', 'RSV-Prophylaxe', null, 'Antikörper gegen RSV, einmal vor bzw. in der ersten RSV-Saison (Oktober–März). Im Winterhalbjahr geboren: möglichst gleich nach der Geburt.'],
  ['rota1', 'Rotaviren – 1. Dosis', 6 / 4.345, 'Schluckimpfung ab 6 Wochen, möglichst bald danach beginnen.'],
  ['rota2', 'Rotaviren – 2. Dosis', 2, 'Mindestens 4 Wochen nach der 1. Dosis.'],
  ['rota3', 'Rotaviren – 3. Dosis', 3, 'Nur bei Impfstoffen mit 3 Dosen – sonst „entfällt“ wählen.'],
  ['sechs1', '6-fach-Impfung – 1. Dosis', 2, 'Tetanus, Diphtherie, Keuchhusten, Hib, Polio, Hepatitis B.'],
  ['pneu1', 'Pneumokokken – 1. Dosis', 2, 'Meist am selben Termin wie die 6-fach-Impfung.'],
  ['menb1', 'Meningokokken B – 1. Dosis', 2, ''],
  ['sechs2', '6-fach-Impfung – 2. Dosis', 4, ''],
  ['pneu2', 'Pneumokokken – 2. Dosis', 4, ''],
  ['menb2', 'Meningokokken B – 2. Dosis', 4, ''],
  ['sechs3', '6-fach-Impfung – 3. Dosis', 11, 'Abschluss der Grundimmunisierung.'],
  ['pneu3', 'Pneumokokken – 3. Dosis', 11, ''],
  ['mmrv1', 'Masern, Mumps, Röteln, Windpocken – 1. Dosis', 11, 'Die Masernimpfung ist vor Kita-Beginn Pflicht.'],
  ['menb3', 'Meningokokken B – 3. Dosis', 12, ''],
  ['menc', 'Meningokokken C', 12, ''],
  ['mmrv2', 'Masern, Mumps, Röteln, Windpocken – 2. Dosis', 15, ''],
  ['tdap', 'Auffrischung Tetanus, Diphtherie, Keuchhusten', 60, 'Mit 5–6 Jahren.'],
].map(([k, name, mon, text]) => ({ k, name, typ: 'impf', mon, text }));

function impfFenster(i) {
  const g = geburtMs();
  if (i.k === 'rsv') { // Ende der ersten RSV-Saison: 31. März nach der Geburt (bzw. des nächsten Winters)
    const d = new Date(g), j = d.getMonth() >= 3 ? d.getFullYear() + 1 : d.getFullYear();
    const saisonStart = new Date(j - 1, 9, 1).getTime();
    return { von: Math.max(g, saisonStart - 30 * TAG), bis: new Date(j, 2, 31).getTime(), tbis: new Date(j, 2, 31).getTime() };
  }
  const von = g + i.mon * MON * TAG;
  return { von, bis: von + 1.5 * MON * TAG, tbis: von + (i.mon < 12 ? 3 : 6) * MON * TAG };
}
function vorsorgeListe() {
  const g = geburtMs(); if (!g) return [];
  const jetzt = Date.now();
  const alle = [
    ...U_PLAN.map(u => ({ ...u, vonMs: g + u.von * TAG, bisMs: g + (u.bis + 1) * TAG, tbisMs: g + (u.tbis + 1) * TAG, tvonMs: g + u.tvon * TAG })),
    ...IMPF_PLAN.map(i => { const f = impfFenster(i); return { ...i, vonMs: f.von, bisMs: f.bis, tbisMs: f.tbis, tvonMs: f.von }; }),
  ];
  for (const x of alle) {
    const st = S.vorsorge[x.k] || {};
    x.st = st;
    if (st.erledigt) x.status = 'erledigt';
    else if (st.entfaellt) x.status = 'entfaellt';
    else if (jetzt > x.tbisMs) x.status = x.typ === 'u' ? 'verpasst' : 'nachholen';
    else if (jetzt >= x.tvonMs) x.status = 'jetzt';
    else if (x.tvonMs - jetzt < 30 * TAG) x.status = 'bald';
    else x.status = 'spaeter';
  }
  return alle.sort((a, b) => a.vonMs - b.vonMs);
}
const V_STATUS = {
  erledigt: ['✓', 'erledigt', 'ok'], entfaellt: ['–', 'entfällt', ''], jetzt: ['●', 'jetzt dran', 'jetzt'],
  bald: ['◔', 'bald', 'bald'], spaeter: ['○', '', ''], verpasst: ['!', 'Zeitraum vorbei', 'warn'], nachholen: ['!', 'nachholen', 'warn'],
};
function vorsorgeZeile(x) {
  const [sym, txt, cls] = V_STATUS[x.status];
  const wann = x.st.erledigt ? 'am ' + datumDE(new Date(x.st.erledigt + 'T12:00').getTime())
    : x.st.termin ? '📅 Termin ' + datumDE(new Date(x.st.termin).getTime()) + (x.st.termin.length > 10 ? ', ' + x.st.termin.slice(11, 16) + ' Uhr' : '')
    : x.typ === 'u' ? `${datumKurz(x.tvonMs)} – ${datumKurz(x.tbisMs - TAG)}` : (x.k === 'rsv' ? 'bis ' + datumKurz(x.bisMs) : 'ab ' + datumKurz(x.vonMs));
  return `<li class="v-${cls}" onclick="vorsorgeDialog('${x.k}')"><div class="sym v-sym">${x.typ === 'u' ? x.k : '💉'}</div>
    <div class="haupt"><b>${x.typ === 'u' ? esc(x.name) : esc(x.name)}</b><div class="leise klein">${wann}</div></div>
    <div class="neben v-st">${sym} ${txt}</div></li>`;
}
function vorsorgeHinweis() { // kleine Erinnerung auf der Startseite
  const jetzt = Date.now();
  const offen = vorsorgeListe().filter(x => !x.st.termin && x.k !== 'U1' && (x.typ === 'u'
    ? (x.status === 'jetzt' || x.status === 'bald')
    : (x.status === 'jetzt' && x.vonMs > jetzt - 42 * TAG) || (x.status === 'bald' && x.vonMs < jetzt + 14 * TAG)));
  if (!offen.length) return '';
  const us = offen.filter(x => x.typ === 'u').map(x => x.k), imp = offen.filter(x => x.typ === 'impf').length;
  const teile = [...us, ...(imp ? [imp === 1 ? '1 Impfung' : imp + ' Impfungen'] : [])];
  return `<button class="erinnerung" onclick="gesReiter='vorsorge';zeige('gesundheit')">📅 ${teile.join(' und ')} ${teile.length > 1 || imp > 1 ? 'stehen' : 'steht'} an – Termin vereinbart? <span>›</span></button>`;
}
function zeigeVorsorge() {
  if (!geburtMs()) return `<div class="karte leer"><p>Trag unter „Baby“ den Geburtstag ein, dann berechnet die App alle Termine.</p></div>`;
  const alle = vorsorgeListe();
  const dran = alle.filter(x => ['jetzt', 'bald', 'nachholen', 'verpasst'].includes(x.status));
  const naechste = dran.length ? dran : alle.filter(x => x.status === 'spaeter').slice(0, 2);
  const u = alle.filter(x => x.typ === 'u'), i = alle.filter(x => x.typ === 'impf');
  const erl = a => a.filter(x => x.status === 'erledigt').length;
  return `<div class="karte"><h2>${dran.length ? 'Jetzt dran' : 'Als Nächstes'}</h2>
      <ul class="liste">${naechste.map(vorsorgeZeile).join('')}</ul>
      <p class="leise klein" style="margin:8px 0 0">Antippen zum Abhaken, Termin eintragen oder als „entfällt“ markieren.</p></div>
    <div class="karte"><h2>U-Untersuchungen · ${erl(u)} von ${u.length}</h2><ul class="liste">${u.map(vorsorgeZeile).join('')}</ul>
      <p class="leise klein" style="margin:8px 0 0">Daten aus dem gelben Kinder-Untersuchungsheft. Die Zeiträume sind die gesetzlichen, inkl. Toleranz.</p></div>
    <div class="karte"><h2>Impfungen · ${erl(i)} von ${i.length}</h2><ul class="liste">${i.map(vorsorgeZeile).join('')}</ul>
      <p class="leise klein" style="margin:8px 0 0">Nach dem Impfkalender der STIKO (Stand 2025/26). Die Kinderärztin kann davon abweichen, z. B. bei Frühgeborenen. Mehrere Impfungen werden meist am selben Termin gegeben.</p></div>`;
}
function vorsorgeDialog(k) {
  const x = vorsorgeListe().find(y => y.k === k); if (!x) return;
  const st = S.vorsorge[k] || {};
  dialog(`<h2>${x.typ === 'u' ? x.k + ' · ' : '💉 '}${esc(x.name)}</h2>
    <p class="leise klein" style="margin:0">${esc(x.text || '')}${x.typ === 'u' ? ` · Zeitraum ${datumDE(x.tvonMs)} bis ${datumDE(x.tbisMs - TAG)}` : ''}</p>
    <label class="feld">Termin vereinbart am<input type="datetime-local" name="termin" value="${esc(st.termin || '')}"></label>
    <label class="feld">Erledigt am<input type="date" name="erledigt" value="${esc(st.erledigt || '')}" max="${tagKey(Date.now())}"></label>
    ${x.typ === 'impf' ? `<label class="feld" style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="entfaellt" ${st.entfaellt ? 'checked' : ''} style="width:auto;margin:0"> entfällt / nicht geplant</label>` : ''}
    <label class="feld">Notiz (optional)<input name="notiz" value="${esc(st.notiz || '')}" placeholder="${x.typ === 'u' ? 'z. B. alles gut, Gewicht 6,2 kg' : 'z. B. Impfstoff, leichtes Fieber danach'}"></label>
    <div class="dlg-knoepfe"><button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button>
      ${!st.erledigt ? `<button class="knopf rand" value="heute">Heute erledigt</button>` : ''}<button class="knopf gesund" value="ok">Speichern</button></div>`,
    (knopf, f) => {
      const d = { termin: f.termin.value, erledigt: knopf === 'heute' ? tagKey(Date.now()) : f.erledigt.value, notiz: f.notiz.value.trim(), entfaellt: !!(f.entfaellt && f.entfaellt.checked) };
      if (!d.termin && !d.erledigt && !d.notiz && !d.entfaellt) delete S.vorsorge[k]; else S.vorsorge[k] = d;
    });
}

/* ================= Krank: Fieber, Medikamente, Symptome ================= */
const G_ART = { fieber: ['🌡️', 'Temperatur'], medikament: ['💊', 'Medikament'], symptom: ['🤧', 'Symptom / Notiz'] };
function fieberStufe(t) {
  const w = alterWochen() ?? 99;
  if (t >= 38 && w < 13) return ['warn', 'Fieber unter 3 Monaten: bitte sofort Kinderärztin oder Bereitschaftsdienst (116 117) anrufen.'];
  if (t >= 39 && w < 26) return ['warn', 'Hohes Fieber unter 6 Monaten: bitte noch heute ärztlich abklären lassen.'];
  if (t >= 40) return ['warn', 'Sehr hohes Fieber: bitte ärztlich abklären lassen.'];
  if (t >= 38.5) return ['fieber', 'Fieber'];
  if (t >= 37.6) return ['erhoeht', 'erhöhte Temperatur'];
  if (t < 36) return ['erhoeht', 'niedrige Temperatur – noch einmal messen'];
  return ['ok', 'normal'];
}
const tempText = t => t.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' °C';
function zeigeKrank() {
  const alle = sortiert(S.gesundheit), jetzt = Date.now();
  const temps = alle.filter(e => e.art === 'fieber' && e.wert);
  const lt = temps[temps.length - 1];
  let oben = '';
  if (lt && jetzt - lt.start < 2 * TAG) {
    const [cls, txt] = fieberStufe(lt.wert);
    oben = `<div class="karte status temp-${cls}"><div class="leise">Zuletzt gemessen ${relativ(lt.start)}</div>
      <div class="uhr">${tempText(lt.wert)}</div><div>${txt}</div></div>`;
  }
  // Medikamente: je Mittel letzte Gabe, Abstand
  const mittel = {};
  for (const e of alle) if (e.art === 'medikament' && e.mittel) (mittel[e.mittel] ||= []).push(e);
  const medKarten = Object.entries(mittel).filter(([, a]) => jetzt - a[a.length - 1].start < 3 * TAG).map(([m, a]) => {
    const l = a[a.length - 1], abst = +(S.meds?.[m]?.abstand || 0);
    const naechste = abst ? l.start + abst * STD : null, in24 = a.filter(e => e.start > jetzt - TAG).length;
    return `<li onclick="krankDialog('medikament', null, ${jsArg(m)})"><div class="sym med">💊</div>
      <div class="haupt"><b>${esc(m)}</b><div class="leise klein">zuletzt ${uhr(l.start)}${l.dosis ? ' · ' + esc(l.dosis) : ''} · ${in24}× in 24 Std</div></div>
      <div class="neben">${naechste ? (naechste <= jetzt ? '<span class="ok-text">wieder möglich</span>' : 'frühestens<br><b>' + uhr(naechste) + '</b>') : relativ(l.start)}</div></li>`;
  }).join('');
  // Temperaturkurve der letzten 3 Tage
  const t3 = temps.filter(e => e.start > jetzt - 3 * TAG);
  let kurve = '';
  if (t3.length >= 2) {
    const B = 340, H = 130, l = 30, r = 8, o = 8, u = 20, x0 = jetzt - 3 * TAG;
    const ymin = Math.min(36, ...t3.map(e => e.wert)) - 0.3, ymax = Math.max(39.5, ...t3.map(e => e.wert)) + 0.3;
    const X = ms => l + (ms - x0) / (3 * TAG) * (B - l - r), Y = v => o + (1 - (v - ymin) / (ymax - ymin)) * (H - o - u);
    let g = ''; for (let v = Math.ceil(ymin); v <= ymax; v++) g += `<line x1="${l}" x2="${B - r}" y1="${Y(v)}" y2="${Y(v)}" class="gitter"/><text x="${l - 5}" y="${Y(v) + 3}" text-anchor="end">${v}°</text>`;
    for (let i = 0; i <= 3; i++) { const t = tagAnfang(x0) + i * TAG; if (t >= x0) g += `<text x="${X(t)}" y="${H - 5}" text-anchor="middle">${WT[new Date(t).getDay()]}</text>`; }
    kurve = `<div class="karte"><h2>Temperatur, letzte 3 Tage</h2><svg viewBox="0 0 ${B} ${H}" class="kurve">${g}
      <rect x="${l}" y="${Y(ymax)}" width="${B - l - r}" height="${Y(38.5) - Y(ymax)}" class="fieberzone"/>
      <path d="${t3.map((e, i) => (i ? 'L' : 'M') + X(e.start).toFixed(1) + ' ' + Y(e.wert).toFixed(1)).join('')}" class="baby-linie"/>
      ${t3.map(e => `<circle cx="${X(e.start)}" cy="${Y(e.wert)}" r="3.5" class="baby-punkt"/>`).join('')}</svg>
      <p class="leise klein" style="margin:4px 0 0">Rot hinterlegt: ab 38,5 °C (Fieber).</p></div>`;
  }
  const zeile = e => `<li onclick="krankDialog('${e.art}','${e.id}')"><div class="sym med">${G_ART[e.art][0]}</div>
    <div class="haupt"><b>${e.art === 'fieber' ? tempText(e.wert) : e.art === 'medikament' ? esc(e.mittel) + (e.dosis ? ' · ' + esc(e.dosis) : '') : esc(e.notiz || 'Notiz')}</b>
      <div class="leise klein">${WT[new Date(e.start).getDay()]} ${datumKurz(e.start)}, ${uhr(e.start)}${e.art !== 'symptom' && e.notiz ? ' · ' + esc(e.notiz) : ''}${e.ort ? ' · ' + esc(e.ort) : ''}</div></div></li>`;
  const liste = alle.filter(e => e.start > jetzt - 7 * TAG).reverse();
  return `${oben}
    <div class="knoepfe drei" style="margin-top:12px">
      <button class="knopf gesund" onclick="krankDialog('fieber')">🌡️ Fieber</button>
      <button class="knopf gesund" onclick="krankDialog('medikament')">💊 Medikament</button>
      <button class="knopf gesund" onclick="krankDialog('symptom')">🤧 Notiz</button></div>
    ${medKarten ? `<div class="karte"><h2>Medikamente</h2><ul class="liste">${medKarten}</ul>
      <p class="leise klein" style="margin:8px 0 0">Dosis und Abstand immer nach Packungsbeilage bzw. Kinderärztin – nach Gewicht, nicht nach Alter. Die App rechnet nur die Uhrzeit.</p></div>` : ''}
    ${kurve}
    <div class="karte"><h2>Letzte 7 Tage</h2><ul class="liste">${liste.map(zeile).join('') || '<li class="plan">Keine Einträge – hoffentlich bleibt das so.</li>'}</ul></div>
    <div class="karte notfall"><h2>Wichtige Nummern</h2>
      <a class="nummer" href="tel:112"><b>112</b><span>Notruf – bei Atemnot, Bewusstlosigkeit, Krampfanfall</span></a>
      <a class="nummer" href="tel:116117"><b>116 117</b><span>Ärztlicher Bereitschaftsdienst (nachts, am Wochenende)</span></a>
      <a class="nummer" href="tel:+498919240"><b>089 19240</b><span>Giftnotruf München (für Bayern)</span></a>
      ${S.profil.arzt ? `<a class="nummer" href="tel:${esc(S.profil.arzt.replace(/[^\d+]/g, ''))}"><b>${esc(S.profil.arzt)}</b><span>Kinderarztpraxis</span></a>` : ''}
      <button class="link" onclick="arztDialog()">${S.profil.arzt ? 'Nummer der Praxis ändern' : '+ Nummer der Kinderarztpraxis eintragen'}</button>
    </div>`;
}
function arztDialog() {
  dialog(`<h2>Kinderarztpraxis</h2><label class="feld">Telefonnummer<input name="arzt" type="tel" value="${esc(S.profil.arzt || '')}" placeholder="z. B. 0821 123456"></label>
    <div class="dlg-knoepfe"><button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf gesund" value="ok">Speichern</button></div>`,
    (k, f) => { S.profil.arzt = f.arzt.value.trim(); });
}
function krankDialog(art, id, mittelVorgabe) {
  const e = id ? S.gesundheit.find(x => x.id === id) : null;
  const bekannte = [...new Set(S.gesundheit.filter(x => x.mittel).map(x => x.mittel))];
  const mittel = e?.mittel || mittelVorgabe || '';
  const letzteDosis = mittel ? [...S.gesundheit].reverse().find(x => x.mittel === mittel)?.dosis : '';
  dialog(`<h2>${G_ART[art][0]} ${e ? G_ART[art][1] + ' bearbeiten' : G_ART[art][1]}</h2>
    <label class="feld">Uhrzeit<input type="datetime-local" name="start" value="${inputWert(e ? e.start : Date.now())}" required></label>
    ${art === 'fieber' ? `<div class="zeile2"><label class="feld">Temperatur (°C)<input name="wert" inputmode="decimal" placeholder="z. B. 38,4" value="${e ? String(e.wert).replace('.', ',') : ''}" required></label>
      <label class="feld">Gemessen<select name="ort">${['im Po', 'im Ohr', 'unter der Achsel', 'an der Stirn'].map(o => `<option ${e?.ort === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label></div>
      <p class="leise klein" style="margin:0">Am genauesten ist bei Babys die Messung im Po.</p>` : ''}
    ${art === 'medikament' ? `<label class="feld">Mittel<input name="mittel" list="mittel-liste" value="${esc(mittel)}" placeholder="z. B. Paracetamol-Zäpfchen 75 mg" required>
        <datalist id="mittel-liste">${bekannte.map(m => `<option value="${esc(m)}">`).join('')}</datalist></label>
      <div class="zeile2"><label class="feld">Dosis<input name="dosis" value="${esc(e?.dosis || letzteDosis || '')}" placeholder="z. B. 1 Zäpfchen"></label>
      <label class="feld">Mindestabstand (Std)<input name="abstand" inputmode="decimal" value="${esc(S.meds?.[mittel]?.abstand || '')}" placeholder="laut Beipackzettel"></label></div>` : ''}
    <label class="feld">${art === 'symptom' ? 'Was ist los?' : 'Notiz (optional)'}<input name="notiz" value="${esc(e?.notiz || '')}" placeholder="${art === 'symptom' ? 'z. B. Schnupfen, trinkt wenig, Ausschlag' : ''}" ${art === 'symptom' ? 'required' : ''}></label>
    <div class="dlg-knoepfe">${e ? '<button class="knopf gefahr" value="loeschen">Löschen</button>' : ''}<button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf gesund" value="ok">Speichern</button></div>`,
    (k, f) => {
      if (k === 'loeschen') { S.gesundheit = S.gesundheit.filter(x => x !== e); return; }
      const st = ausInput(f.start.value);
      if (!st) return 'Bitte eine Zeit angeben.';
      if (st > Date.now() + MIN) return 'Die Zeit liegt in der Zukunft.';
      const d = { art, start: st, notiz: f.notiz.value.trim() };
      if (art === 'fieber') {
        const t = zahl(f.wert.value); if (!t || t < 34 || t > 43) return 'Bitte eine Temperatur zwischen 34 und 43 °C eingeben.';
        d.wert = Math.round(t * 10) / 10; d.ort = f.ort.value;
      }
      if (art === 'medikament') {
        d.mittel = f.mittel.value.trim(); d.dosis = f.dosis.value.trim();
        if (!d.mittel) return 'Bitte das Mittel angeben.';
        const a = zahl(f.abstand.value);
        S.meds ||= {}; if (a) S.meds[d.mittel] = { abstand: a }; else if (f.abstand.value.trim() === '') delete S.meds[d.mittel];
      }
      if (e) Object.assign(e, d); else S.gesundheit.push({ id: neueId(), ...d });
    });
}

/* ================= Zähne ================= */
// FDI-Schema Milchzähne: 5x oben rechts, 6x oben links, 7x unten links, 8x unten rechts; Endziffer 1–5 = Mitte → hinten
const ZAHN_TYP = { 1: 'mittlerer Schneidezahn', 2: 'seitlicher Schneidezahn', 3: 'Eckzahn', 4: 'erster Backenzahn', 5: 'zweiter Backenzahn' };
const ZAHN_ALTER = { oben: { 1: [8, 12], 2: [9, 13], 3: [16, 22], 4: [13, 19], 5: [25, 33] }, unten: { 1: [6, 10], 2: [10, 16], 3: [17, 23], 4: [14, 18], 5: [23, 31] } };
const ZAEHNE = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65, 85, 84, 83, 82, 81, 71, 72, 73, 74, 75];
const zahnInfo = c => { const q = Math.floor(c / 10), t = c % 10, oben = q === 5 || q === 6; return { c, t, oben, seite: q === 5 || q === 8 ? 'rechts' : 'links', alter: ZAHN_ALTER[oben ? 'oben' : 'unten'][t] }; };
function zahnName(c) { const z = zahnInfo(c); return `${ZAHN_TYP[z.t][0].toUpperCase() + ZAHN_TYP[z.t].slice(1)} ${z.oben ? 'oben' : 'unten'} ${z.seite}`; }
function zeigeZaehne() {
  const da = S.zaehne || {}, n = ZAEHNE.filter(c => da[c]).length;
  // Gebiss als zwei Bögen; aus Sicht des Betrachters ist die rechte Seite des Babys links
  const B = 330, H = 330, cx = B / 2, rx = 128, ry = 112, cyO = 150, cyU = 190, GR = { 1: 26, 2: 23, 3: 26, 4: 31, 5: 33 };
  // Zähne gleichmäßig nach Bogenlänge auf einer halben Ellipse verteilen
  const pkt = w => [cx - rx * Math.cos(w), Math.sin(w)];
  const proben = []; let len = 0, vor = pkt(0);
  for (let i = 1; i <= 360; i++) { const w = Math.PI * i / 360, p = pkt(w); len += Math.hypot((p[0] - vor[0]), ry * (p[1] - vor[1])); proben.push([len, w]); vor = p; }
  const reihe = ZAEHNE.slice(0, 10).map(c => GR[c % 10]), noetig = reihe.reduce((a, x) => a + x, 0) + 9 * 5;
  let pos = (len - noetig) / 2; const winkel = reihe.map(g => { const ziel = pos + g / 2; pos += g + 5; return proben.find(p => p[0] >= ziel)[1]; });
  const zahn = (c, k, oben) => {
    const w = winkel[k], x = cx - rx * Math.cos(w), y = oben ? cyO - ry * Math.sin(w) : cyU + ry * Math.sin(w);
    const t = c % 10, r = GR[t] / 2, drin = !!da[c];
    return `<g class="zahn ${drin ? 'da' : ''}" onclick="zahnDialog(${c})" role="button" aria-label="${zahnName(c)}">
      <rect x="${(x - r).toFixed(1)}" y="${(y - r).toFixed(1)}" width="${2 * r}" height="${2 * r}" rx="${t >= 4 ? 8 : r}" />
      ${drin ? `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle">✓</text>` : ''}</g>`;
  };
  const svg = `<svg viewBox="0 0 ${B} ${H}" class="gebiss">
    <text x="${cx}" y="115" text-anchor="middle" class="kiefer">Oberkiefer</text><text x="${cx}" y="232" text-anchor="middle" class="kiefer">Unterkiefer</text>
    <text x="4" y="174" class="kiefer">rechts</text><text x="${B - 4}" y="174" text-anchor="end" class="kiefer">links</text>
    ${ZAEHNE.slice(0, 10).map((c, i) => zahn(c, i, true)).join('')}${ZAEHNE.slice(10).map((c, i) => zahn(c, i, false)).join('')}</svg>`;
  const mon = alterWochen() !== null ? alterWochen() / 4.345 : null;
  const offen = ZAEHNE.filter(c => !da[c]).map(zahnInfo).sort((a, b) => a.alter[0] - b.alter[0] || a.alter[1] - b.alter[1]);
  const naechste = offen.length ? offen.filter(z => z.alter[0] === offen[0].alter[0] && z.t === offen[0].t && z.oben === offen[0].oben) : [];
  const liste = ZAEHNE.filter(c => da[c]).sort((a, b) => da[a].localeCompare(da[b])).map(c => `<li onclick="zahnDialog(${c})"><div class="sym zahn-sym">🦷</div>
      <div class="haupt"><b>${zahnName(c)}</b><div class="leise klein">${datumDE(new Date(da[c] + 'T12:00').getTime())}${mon !== null ? ' · mit ' + alterBeiText(da[c]) : ''}</div></div></li>`).join('');
  return `<div class="karte"><h2>Milchzähne · ${n} von 20</h2>${svg}
      <p class="leise klein" style="margin:0;text-align:center">Zahn antippen, wenn er durchgebrochen ist.</p>
      ${naechste.length ? `<p style="margin:12px 0 0">Meist als Nächstes: <b>${ZAHN_TYP[naechste[0].t]}${naechste.length > 1 ? 'e' : ''} ${naechste[0].oben ? 'oben' : 'unten'}</b> <span class="leise">(üblich mit ${naechste[0].alter[0]}–${naechste[0].alter[1]} Monaten)</span></p>` : ''}
    </div>
    ${liste ? `<div class="karte"><h2>Durchgebrochen</h2><ul class="liste">${liste}</ul></div>` : ''}
    <div class="karte"><h2>Gut zu wissen</h2><ul class="hinweise" style="margin:0">
      <li>Ab dem ersten Zahn zweimal täglich putzen, mit Kinderzahnpasta mit 1000 ppm Fluorid in Reiskorngröße, ab 2 Jahren erbsengroß.</li>
      <li>Ab dem 6. Monat gibt es zahnärztliche Früherkennungsuntersuchungen – der erste Besuch, wenn die ersten Zähne da sind.</li>
      <li>Beim Zahnen helfen Beißringe aus dem Kühlschrank (nicht Gefrierfach) und Massieren des Zahnfleischs. Hohes Fieber kommt nicht vom Zahnen – dann lieber abklären lassen.</li>
      <li>Der Zeitpunkt ist sehr unterschiedlich: Manche Babys haben mit 4 Monaten den ersten Zahn, andere erst nach dem ersten Geburtstag.</li></ul></div>`;
}
function alterBeiText(datum, alt) { // „mit 5 Monaten“ bzw. (alt) „5 Monate alt“
  const g = geburtMs(); if (!g) return '';
  const tage = Math.floor((new Date(datum + 'T12:00').getTime() - g) / TAG);
  if (tage < 0) return '';
  let t;
  if (tage === 0) return alt ? 'Geburtstag' : 'der Geburt';
  if (tage < 14) t = tage === 1 ? '1 Tag' : `${tage} Tage`;
  else if (tage < 91) t = `${Math.floor(tage / 7)} Wochen`;
  else {
    const m = Math.floor(tage / MON);
    t = m < 24 ? `${m} Monate` : `${Math.floor(m / 12)} Jahre${m % 12 ? ' und ' + (m % 12) + (m % 12 === 1 ? ' Monat' : ' Monate') : ''}`;
  }
  if (alt) return t + ' alt';
  return t.replace(/Tage\b/, 'Tagen').replace(/1 Tag$/, '1 Tag').replace(/Monate\b/g, 'Monaten').replace(/Jahre\b/, 'Jahren');
}
function zahnDialog(c) {
  const z = zahnInfo(c), d = (S.zaehne || {})[c] || '';
  dialog(`<h2>🦷 ${zahnName(c)}</h2>
    <p class="leise klein" style="margin:0">Bricht meist mit ${z.alter[0]}–${z.alter[1]} Monaten durch.</p>
    <label class="feld">Durchgebrochen am<input type="date" name="datum" value="${d}" max="${tagKey(Date.now())}"></label>
    <div class="dlg-knoepfe">${d ? '<button class="knopf gefahr" value="loeschen">Entfernen</button>' : ''}<button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button>
      ${!d ? '<button class="knopf rand" value="heute">Heute</button>' : ''}<button class="knopf gesund" value="ok">Speichern</button></div>`,
    (k, f) => {
      S.zaehne ||= {};
      if (k === 'loeschen') { delete S.zaehne[c]; return; }
      const wert = k === 'heute' ? tagKey(Date.now()) : f.datum.value;
      if (!wert) return 'Bitte ein Datum wählen.';
      S.zaehne[c] = wert;
    });
}

/* ================= Ansicht ================= */
function zeigeGesundheit() {
  const reiter = `<div class="reiter" style="margin-top:12px">${[['vorsorge', 'Vorsorge'], ['krank', 'Krank'], ['zaehne', 'Zähne']].map(([k, t]) => `<button class="${gesReiter === k ? 'an' : ''}" onclick="gesReiterSetzen('${k}')">${t}</button>`).join('')}</div>`;
  $('#v-gesundheit').innerHTML = reiter + ({ vorsorge: zeigeVorsorge, krank: zeigeKrank, zaehne: zeigeZaehne }[gesReiter] || zeigeVorsorge)()
    + '<p class="fuss-hinweis">Richtwerte und Erinnerungen ersetzen keine ärztliche Beratung. Im Zweifel lieber einmal mehr bei der Kinderärztin anrufen.</p>';
}
