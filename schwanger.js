/* Schlafwolke – Schwangerschaft: SSW, Größe des Babys, Kindsbewegungen, Wehen, Vorsorge, Gewicht, To-dos.
   Aktiv, solange ein Entbindungstermin eingetragen und das Baby noch nicht geboren ist. */
'use strict';

function schwangerDaten() {
  S.schwanger ||= {};
  const s = S.schwanger;
  s.bewegungen ||= []; s.wehen ||= []; s.gewicht ||= []; s.vorsorge ||= {}; s.termine ||= []; s.todos ||= {};
  return s;
}
const istSchwanger = () => !!(S.schwanger && S.schwanger.et) && !S.profil.geburt;
const etMs = () => new Date(S.schwanger.et + 'T12:00').getTime();
// Schwangerschaftstage seit der letzten Periode (ET = Tag 280)
function ssTage(ms = Date.now()) { return 280 - Math.round((etMs() - tagAnfang(ms) - 12 * STD) / TAG); }
function sswText(ms) { const t = ssTage(ms); return `${Math.floor(t / 7)}+${t % 7}`; }
const sswNr = ms => Math.floor(ssTage(ms) / 7) + 1;           // „in der 25. SSW“
const datumAusSsTag = tag => etMs() - (280 - tag) * TAG;

// Größe in der vollendeten Woche: [Vergleich, Symbol, Länge cm, Gewicht g] – ca.-Werte, bis SSW 19 Scheitel–Steiß, ab 20 Scheitel–Ferse
const GROESSE = {
  4: ['ein Mohnsamen', '•', 0.1, 0], 5: ['ein Sesamkorn', '•', 0.2, 0], 6: ['eine Linse', '🫘', 0.5, 0], 7: ['eine Heidelbeere', '🫐', 1, 0],
  8: ['eine Himbeere', '🍓', 1.6, 1], 9: ['eine Kirsche', '🍒', 2.3, 2], 10: ['eine Erdbeere', '🍓', 3.1, 4], 11: ['eine Feige', '🫒', 4.1, 7],
  12: ['eine Limette', '🍋', 5.4, 14], 13: ['ein Pfirsich', '🍑', 7.4, 23], 14: ['eine Zitrone', '🍋', 8.7, 43], 15: ['ein Apfel', '🍎', 10.1, 70],
  16: ['eine Avocado', '🥑', 11.6, 100], 17: ['eine Birne', '🍐', 13, 140], 18: ['eine Paprika', '🫑', 14.2, 190], 19: ['eine Mango', '🥭', 15.3, 240],
  20: ['eine Banane', '🍌', 25.6, 300], 21: ['eine Karotte', '🥕', 26.7, 360], 22: ['eine Papaya', '🥭', 27.8, 430], 23: ['eine Grapefruit', '🍊', 28.9, 500],
  24: ['ein Maiskolben', '🌽', 30, 600], 25: ['ein Blumenkohl', '🥦', 34.6, 660], 26: ['ein Salatkopf', '🥬', 35.6, 760], 27: ['ein Brokkoli', '🥦', 36.6, 875],
  28: ['eine Aubergine', '🍆', 37.6, 1000], 29: ['ein Butternusskürbis', '🎃', 38.6, 1150], 30: ['ein Kohlkopf', '🥬', 39.9, 1300], 31: ['eine Kokosnuss', '🥥', 41.1, 1500],
  32: ['ein Chinakohl', '🥬', 42.4, 1700], 33: ['eine Ananas', '🍍', 43.7, 1900], 34: ['eine Honigmelone', '🍈', 45, 2150], 35: ['ein Hokkaido-Kürbis', '🎃', 46.2, 2400],
  36: ['ein Römersalat', '🥬', 47.4, 2600], 37: ['ein Bund Mangold', '🥬', 48.6, 2860], 38: ['eine Lauchstange', '🥬', 49.8, 3080], 39: ['eine kleine Wassermelone', '🍉', 50.7, 3290],
  40: ['ein Kürbis', '🎃', 51.2, 3460],
};
function groesse() { const w = Math.min(40, Math.max(4, Math.floor(ssTage() / 7))); return { w, g: GROESSE[w] }; }
const groesseText = g => `${g[2] < 1 ? 'unter 1' : String(g[2]).replace('.', ',')} cm${g[3] ? `, ${g[3] >= 1000 ? (g[3] / 1000).toFixed(1).replace('.', ',') + ' kg' : g[3] + ' g'}` : ''}`;
// Was gerade passiert (ab vollendeter Woche)
const ENTWICKLUNG = [
  [4, 'Das Herz beginnt sich zu bilden und schlägt bald zum ersten Mal.'],
  [8, 'Alle wichtigen Organe sind angelegt. Arme und Beine wachsen.'],
  [12, 'Das erste Drittel ist bald geschafft. Das Baby kann schon am Daumen nuckeln.'],
  [16, 'Das Baby hört erste Geräusche. Bei manchen ist das Geschlecht im Ultraschall zu erkennen.'],
  [18, 'Viele spüren in diesen Wochen die ersten Bewegungen, oft wie ein Flattern.'],
  [22, 'Das Baby hat einen Schlaf-Wach-Rhythmus. Die Bewegungen werden deutlicher.'],
  [24, 'Die Lunge reift. Ab jetzt hätte das Baby mit intensiver Hilfe gute Chancen.'],
  [28, 'Das letzte Drittel beginnt. Das Baby öffnet die Augen und reagiert auf Licht.'],
  [32, 'Das Baby legt Fettpolster an. Viele drehen sich jetzt mit dem Kopf nach unten.'],
  [35, 'Es wird eng im Bauch. Die Bewegungen fühlen sich eher wie Schieben an.'],
  [37, 'Das Baby gilt jetzt als reif geboren. Die Geburt kann jederzeit beginnen.'],
  [40, 'Der errechnete Termin ist da. Nur wenige Babys kommen genau an diesem Tag.'],
];
const entwicklung = () => { const w = Math.floor(ssTage() / 7); let t = ENTWICKLUNG[0][1]; for (const [ab, x] of ENTWICKLUNG) if (w >= ab) t = x; return t; };
const trimester = () => { const w = Math.floor(ssTage() / 7); return w < 13 ? 1 : w < 28 ? 2 : 3; };

/* ---------- Vorsorge nach Mutterpass ---------- */
// [Schlüssel, Name, von SSW, bis SSW, Hinweis]
const SS_VORSORGE = [
  ['erst', 'Feststellung und Mutterpass', 5, 10, 'Erste Untersuchung bei der Frauenärztin, Blutgruppe und Antikörper werden bestimmt.'],
  ['us1', '1. Ultraschall', 9, 12.9, 'Basis-Ultraschall: Herzschlag, Größe, Termin wird überprüft.'],
  ['ett', 'Ersttrimester-Test (freiwillig)', 11, 13.9, 'Freiwillige Zusatzuntersuchung, oft selbst zu bezahlen. Bluttest (NIPT) übernimmt die Kasse nur in bestimmten Fällen.'],
  ['us2', '2. Ultraschall', 19, 22.9, 'Organe und Wachstum werden angesehen.'],
  ['zucker', 'Zuckertest', 24, 27.9, 'Test auf Schwangerschaftsdiabetes.'],
  ['antik', '2. Antikörpersuchtest', 24, 27.9, 'Bei Rhesus negativ gibt es um die 28. Woche eine Anti-D-Spritze.'],
  ['keuch', 'Keuchhusten-Impfung', 28, 32, 'Von der STIKO empfohlen, zu Beginn des letzten Drittels. Schützt das Baby in den ersten Monaten.'],
  ['us3', '3. Ultraschall', 29, 32.9, 'Lage und Wachstum des Babys.'],
  ['hepb', 'Hepatitis-B-Test', 32, 36, 'Bluttest, damit das Baby bei Bedarf gleich nach der Geburt geschützt wird.'],
  ['gbs', 'B-Streptokokken-Abstrich (freiwillig)', 35, 37, 'Oft selbst zu bezahlen. Bei positivem Befund gibt es unter der Geburt Antibiotika.'],
].map(([k, n, von, bis, text]) => ({ k, n, von, bis, text }));
const ZYKLUS = w => w < 32 ? 28 : w < 40 ? 14 : 2; // Abstand der Vorsorgetermine in Tagen
function ssVorsorgeStand(x) {
  const st = schwangerDaten().vorsorge[x.k] || {}, w = ssTage() / 7;
  if (st.erledigt) return 'erledigt';
  if (st.entfaellt) return 'entfaellt';
  if (w > x.bis + 0.1) return 'vorbei';
  if (w >= x.von) return 'jetzt';
  if (x.von - w <= 3) return 'bald';
  return 'spaeter';
}
function naechsteVorsorge() {
  const t = schwangerDaten().termine.filter(x => x.art === 'vorsorge').map(x => new Date(x.datum + 'T12:00').getTime()).sort((a, b) => a - b);
  const letzte = t.filter(x => x <= Date.now()).at(-1);
  const geplant = t.find(x => x > tagAnfang(Date.now()));
  if (geplant) return { ms: geplant, geplant: true };
  if (!letzte) return null;
  return { ms: letzte + ZYKLUS(Math.floor(ssTage(letzte) / 7)) * TAG, geplant: false };
}

/* ---------- To-dos ---------- */
// [Schlüssel, Aufgabe, ab SSW, Hinweis]
const SS_TODOS = [
  ['hebamme', 'Hebamme suchen', 6, 'Am besten gleich: in vielen Orten sind Hebammen früh ausgebucht. Die Kasse bezahlt Vor- und Nachsorge.'],
  ['arbeit', 'Arbeitgeber informieren', 12, 'Ab dann gilt der Mutterschutz am Arbeitsplatz. Eine Bescheinigung gibt die Frauenärztin.'],
  ['kurs', 'Geburtsvorbereitungskurs buchen', 20, 'Der Kurs selbst ist meist ab der 28. Woche, Plätze früh sichern.'],
  ['elterngeld', 'Elterngeld und Elternzeit planen', 24, 'Elternzeit spätestens 7 Wochen vorher beim Arbeitgeber anmelden. Elterngeld erst nach der Geburt beantragen.'],
  ['klinik', 'Geburtsklinik ansehen und anmelden', 28, 'Viele Kliniken bieten Infoabende an. Anmeldung meist zwischen der 30. und 36. Woche.'],
  ['kinderarzt', 'Kinderarztpraxis suchen', 30, 'Für die U2 und die Zeit danach. Manche Praxen nehmen nur nach Voranmeldung auf.'],
  ['ausstattung', 'Erstausstattung und Babyschale', 30, 'Babyschale fürs Auto für die Heimfahrt aus der Klinik nicht vergessen.'],
  ['tasche', 'Kliniktasche packen', 34, 'Mutterpass, Versichertenkarte, Ausweis, Kleidung für dich und das Baby.'],
  ['mutterschutz', 'Mutterschutz beginnt', 34, 'Sechs Wochen vor dem errechneten Termin. Mutterschaftsgeld bei der Krankenkasse beantragen.'],
].map(([k, n, ab, text]) => ({ k, n, ab, text }));

/* ---------- Heute in der Schwangerschaft ---------- */
function schwangerHeute() {
  const s = schwangerDaten(), t = ssTage(), { g } = groesse();
  const rest = Math.max(0, 280 - t), anteil = Math.min(1, Math.max(0, t / 280));
  const lb = s.bewegungen.find(b => !b.ende), lw = s.wehen.find(w => !w.ende);
  const nv = naechsteVorsorge();
  const offen = SS_TODOS.filter(x => !s.todos[x.k] && Math.floor(t / 7) >= x.ab - 2);
  const R = 46, U = 2 * Math.PI * R;
  return `<section class="bauch">
      <div class="bauch-ring"><svg viewBox="0 0 110 110" aria-hidden="true"><circle cx="55" cy="55" r="${R}" class="spur"/><circle cx="55" cy="55" r="${R}" class="wert" stroke-dasharray="${U}" stroke-dashoffset="${U * (1 - anteil)}"/></svg>
        <span class="bauch-frucht">${g[1]}</span></div>
      <div class="bauch-text">
        <p class="bauch-ssw">SSW ${sswText()}</p>
        <p class="bauch-gross">so groß wie ${g[0]}</p>
        <p class="bauch-klein">ca. ${groesseText(g)} · ${sswNr()}. Woche · ${trimester()}. Drittel</p>
      </div>
      <p class="bauch-entwicklung">${entwicklung()}</p>
      <p class="bauch-rest">${rest ? `Noch ${rest} Tage bis zum errechneten Termin am ${datumDE(etMs())}` : `Der errechnete Termin war am ${datumDE(etMs())}`}</p>
    </section>
    ${lw ? `<div class="stillen-laeuft wehe"><span>⏱️ Wehe läuft</span><b data-lauf="${lw.start}">${laufzeit(Date.now() - lw.start)}</b><span></span><button class="knopf klein essen" onclick="weheStopp()">Wehe vorbei</button></div>` : ''}
    ${lb ? `<div class="stillen-laeuft"><span>👣 Bewegungen zählen</span><b>${lb.anzahl}</b><button class="knopf klein zweit" onclick="bewegungFertig()">Fertig</button><button class="knopf klein essen" onclick="bewegungPlus()">＋ 1</button></div>` : ''}
    <section class="schnell"><h2>Schnell eintragen</h2><div class="schnell-raster">
      <button class="schnell-knopf essen" onclick="bewegungStart()"><span>👣</span>Bewegungen</button>
      <button class="schnell-knopf essen" onclick="weheStart()"><span>⏱️</span>Wehe</button>
      <button class="schnell-knopf windel" onclick="ssGewichtDialog()"><span>⚖️</span>Gewicht</button>
      <button class="schnell-knopf windel" onclick="ssTerminDialog()"><span>🩺</span>Vorsorge</button>
      <button class="schnell-knopf mehr zwei" onclick="tagebuchDialog()"><span>📖</span>Tagebuch</button>
    </div></section>
    ${nv ? `<button class="erinnerung" onclick="zeige('gesundheit/ss_vorsorge')">🩺 ${nv.geplant ? 'Nächste Vorsorge' : 'Nächste Vorsorge etwa'} am ${datumDE(nv.ms)} <span>›</span></button>` : ''}
    ${offen.length ? `<div class="karte"><h2>Gerade wichtig</h2><ul class="todo">${offen.slice(0, 3).map(todoZeile).join('')}</ul>
      ${offen.length > 3 ? `<button class="link" onclick="zeige('gesundheit/ss_todos')">Alle ${offen.length} offenen Punkte</button>` : ''}</div>` : ''}
    ${wehenKarte(true)}`;
}
function todoZeile(x) {
  const s = schwangerDaten(), erl = !!s.todos[x.k];
  const datum = x.k === 'mutterschutz' ? ` ab ${datumDE(etMs() - 42 * TAG)}` : '';
  return `<li class="${erl ? 'erl' : ''}"><label><input type="checkbox" ${erl ? 'checked' : ''} onchange="todoSetzen('${x.k}',this.checked)">
    <span><b>${x.n}${datum}</b><small>${x.text}</small></span></label></li>`;
}
function todoSetzen(k, an) { const s = schwangerDaten(); if (an) s.todos[k] = tagKey(Date.now()); else delete s.todos[k]; speichern(); rendern(); }

/* ---------- Kindsbewegungen ---------- */
function bewegungStart() {
  const s = schwangerDaten();
  if (!s.bewegungen.some(b => !b.ende)) s.bewegungen.push({ id: neueId(), start: Date.now(), ende: null, anzahl: 0 });
  speichern(); rendern();
}
function bewegungPlus() { const b = schwangerDaten().bewegungen.find(x => !x.ende); if (!b) return; b.anzahl++; speichern(); rendern(); }
function bewegungFertig() {
  const s = schwangerDaten(), b = s.bewegungen.find(x => !x.ende); if (!b) return;
  b.ende = Date.now();
  if (!b.anzahl) s.bewegungen = s.bewegungen.filter(x => x !== b);
  speichern(); rendern();
  if (b.anzahl) meldung(`${b.anzahl} Bewegungen in ${dauer((b.ende - b.start) / MIN)}`);
}
function zeigeBewegungen() {
  const s = schwangerDaten(), l = sortiert(s.bewegungen.filter(b => b.ende)).reverse();
  return `<div class="karte"><h2>So geht's</h2><p style="margin:0">Such dir eine ruhige Zeit, in der dein Baby meist aktiv ist, leg dich auf die Seite und tippe bei jeder Bewegung auf „＋ 1“.
      Wichtig ist, dass du das gewohnte Muster deines Babys kennst.</p>
      <button class="knopf essen breit" style="margin-top:12px" onclick="bewegungStart();zeige('heute')">👣 Jetzt zählen</button></div>
    <ul class="hinweise"><li class="wichtig">Bewegt sich dein Baby weniger als sonst oder gar nicht mehr, warte nicht bis zum nächsten Tag: Ruf deine Hebamme oder den Kreißsaal an, auch nachts.</li></ul>
    <div class="karte"><h2>Bisher gezählt</h2><ul class="liste">${l.map(b => `<li onclick="bewegungDialog('${b.id}')"><div class="sym essen">👣</div>
      <div class="haupt"><b>${b.anzahl} ${b.anzahl === 1 ? "Bewegung" : "Bewegungen"}</b><div class="leise klein">${WT[new Date(b.start).getDay()]} ${datumKurz(b.start)}, ${uhr(b.start)} · SSW ${sswText(b.start)}</div></div>
      <div class="neben">${dauer((b.ende - b.start) / MIN)}</div></li>`).join('') || '<li class="plan">Noch nicht gezählt.</li>'}</ul></div>`;
}
function bewegungDialog(id) {
  const s = schwangerDaten(), b = s.bewegungen.find(x => x.id === id);
  dialog(`<h2>👣 Bewegungen</h2>
    <div class="zeile2"><label class="feld">Beginn<input type="datetime-local" name="start" value="${inputWert(b.start)}"></label>
      <label class="feld">Ende<input type="datetime-local" name="ende" value="${inputWert(b.ende)}"></label></div>
    <label class="feld">Anzahl<input name="anzahl" type="number" min="0" value="${b.anzahl}"></label>
    <div class="dlg-knoepfe"><button class="knopf gefahr" value="loeschen">Löschen</button><button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf" value="ok">Speichern</button></div>`,
    (k, f) => {
      if (k === 'loeschen') { s.bewegungen = s.bewegungen.filter(x => x !== b); return; }
      const st = ausInput(f.start.value), en = ausInput(f.ende.value);
      if (!st || !en || en <= st) return 'Ende muss nach dem Beginn liegen.';
      Object.assign(b, { start: st, ende: en, anzahl: Math.max(0, +f.anzahl.value || 0) });
    });
}

/* ---------- Wehen ---------- */
function weheStart() { const s = schwangerDaten(); if (!s.wehen.some(w => !w.ende)) s.wehen.push({ id: neueId(), start: Date.now(), ende: null }); speichern(); rendern(); }
function weheStopp() { const w = schwangerDaten().wehen.find(x => !x.ende); if (!w) return; w.ende = Date.now(); speichern(); rendern(); }
function wehenKarte(nurAktuell) {
  const l = sortiert(schwangerDaten().wehen.filter(w => w.ende));
  const stunde = l.filter(w => w.start > Date.now() - STD);
  if (nurAktuell && !stunde.length) return '';
  const abst = []; for (let i = 1; i < stunde.length; i++) abst.push((stunde[i].start - stunde[i - 1].start) / MIN);
  const mAbst = abst.length ? abst.reduce((a, b) => a + b, 0) / abst.length : null;
  const mDauer = stunde.length ? stunde.reduce((a, w) => a + (w.ende - w.start), 0) / stunde.length / 1000 : null;
  const regel = stunde.length >= 6 && mAbst && mAbst <= 5.5 && mDauer >= 45;
  const zeilen = [...l].reverse().slice(0, nurAktuell ? 6 : 40).map((w, i, arr) => {
    const vor = arr[i + 1];
    return `<li style="cursor:default"><div class="haupt"><b>${uhr(w.start)}</b> <span class="leise klein">${datumKurz(w.start)}</span></div>
      <div class="neben">${Math.round((w.ende - w.start) / 1000)} s${vor ? ` · alle ${dauer((w.start - vor.start) / MIN)}` : ''}</div></li>`;
  }).join('');
  return `<div class="karte"><h2>Wehen${nurAktuell ? ' der letzten Stunde' : ''}</h2>
    ${stunde.length ? `<div class="kacheln"><div class="kachel"><div class="wert">${stunde.length}</div><div class="bez">in der letzten Stunde</div></div>
      <div class="kachel"><div class="wert">${mAbst ? dauer(mAbst) : '–'}</div><div class="bez">Abstand im Schnitt</div></div></div>` : ''}
    ${regel ? `<ul class="hinweise"><li class="wichtig">Die Wehen kommen seit einer Stunde regelmäßig etwa alle 5 Minuten. Ruf jetzt den Kreißsaal oder deine Hebamme an.</li></ul>` : ''}
    <ul class="liste">${zeilen || '<li class="plan">Noch keine Wehen eingetragen.</li>'}</ul></div>`;
}
function zeigeWehen() {
  const lw = schwangerDaten().wehen.find(w => !w.ende);
  return `<button class="knopf ${lw ? 'essen' : ''} breit" style="min-height:64px;font-size:18px;margin:6px 0 10px" onclick="${lw ? 'weheStopp()' : 'weheStart()'}">${lw ? 'Wehe vorbei' : '⏱️ Wehe beginnt'}</button>
    ${wehenKarte(false)}
    <ul class="hinweise">
      <li>Für das erste Kind gilt oft als Richtwert: Wehen alle 5 Minuten, je etwa eine Minute lang, seit einer Stunde. Dann in die Klinik fahren oder anrufen.</li>
      <li class="wichtig">Sofort anrufen bei Blasensprung, Blutung, starken Dauerschmerzen oder wenn sich das Baby weniger bewegt.</li></ul>`;
}

/* ---------- Gewicht und Vorsorgetermine ---------- */
function ssGewichtDialog(id) {
  const s = schwangerDaten(), g = id ? s.gewicht.find(x => x.id === id) : null;
  dialog(`<h2>⚖️ Mein Gewicht</h2>
    <div class="zeile2"><label class="feld">Datum<input type="date" name="datum" value="${g?.datum || tagKey(Date.now())}" max="${tagKey(Date.now())}"></label>
      <label class="feld">Gewicht (kg)<input name="kg" inputmode="decimal" value="${g ? String(g.kg).replace('.', ',') : ''}" placeholder="z. B. 68,4"></label></div>
    <div class="dlg-knoepfe">${g ? '<button class="knopf gefahr" value="loeschen">Löschen</button>' : ''}<button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf" value="ok">Speichern</button></div>`,
    (k, f) => {
      if (k === 'loeschen') { s.gewicht = s.gewicht.filter(x => x !== g); return; }
      const kg = zahl(f.kg.value); if (!kg || kg < 30 || kg > 250) return 'Bitte ein Gewicht in kg eingeben.';
      if (g) Object.assign(g, { datum: f.datum.value, kg }); else s.gewicht.push({ id: neueId(), datum: f.datum.value, kg });
    });
}
function ssTerminDialog(id) {
  const s = schwangerDaten(), t = id ? s.termine.find(x => x.id === id) : null;
  dialog(`<h2>🩺 Vorsorgetermin</h2>
    <p class="leise klein" style="margin:0">Trag vergangene Termine mit den Werten aus dem Mutterpass ein oder plane den nächsten.</p>
    <label class="feld">Datum<input type="date" name="datum" value="${t?.datum || tagKey(Date.now())}" required></label>
    <div class="zeile2"><label class="feld">Blutdruck<input name="rr" value="${esc(t?.rr || '')}" placeholder="z. B. 115/70"></label>
      <label class="feld">Gewicht (kg)<input name="kg" inputmode="decimal" value="${t?.kg ? String(t.kg).replace('.', ',') : ''}"></label></div>
    <label class="feld">Notiz<input name="notiz" value="${esc(t?.notiz || '')}" placeholder="z. B. Ultraschall, alles gut"></label>
    <div class="dlg-knoepfe">${t ? '<button class="knopf gefahr" value="loeschen">Löschen</button>' : ''}<button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf gesund" value="ok">Speichern</button></div>`,
    (k, f) => {
      if (k === 'loeschen') { s.termine = s.termine.filter(x => x !== t); return; }
      if (!f.datum.value) return 'Bitte ein Datum wählen.';
      const kg = zahl(f.kg.value);
      const d = { art: 'vorsorge', datum: f.datum.value, rr: f.rr.value.trim(), kg: kg || null, notiz: f.notiz.value.trim() };
      if (t) Object.assign(t, d); else s.termine.push({ id: neueId(), ...d });
      if (kg && new Date(d.datum + 'T12:00') <= new Date() && !s.gewicht.some(x => x.datum === d.datum)) s.gewicht.push({ id: neueId(), datum: d.datum, kg });
    });
}
function ssUntersuchungDialog(k) {
  const x = SS_VORSORGE.find(y => y.k === k), st = schwangerDaten().vorsorge[k] || {};
  dialog(`<h2>${x.n}</h2><p class="leise klein" style="margin:0">${x.text} Üblich in der ${Math.floor(x.von) + 1}. bis ${Math.floor(x.bis) + 1}. Woche (${datumDE(datumAusSsTag(x.von * 7))} bis ${datumDE(datumAusSsTag(Math.floor(x.bis) * 7 + 6))}).</p>
    <label class="feld">Erledigt am<input type="date" name="erledigt" value="${esc(st.erledigt || '')}" max="${tagKey(Date.now())}"></label>
    <label class="feld" style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="entfaellt" ${st.entfaellt ? 'checked' : ''} style="width:auto;margin:0"> entfällt / nicht gewünscht</label>
    <label class="feld">Notiz<input name="notiz" value="${esc(st.notiz || '')}"></label>
    <div class="dlg-knoepfe"><button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button>${!st.erledigt ? '<button class="knopf rand" value="heute">Heute erledigt</button>' : ''}<button class="knopf gesund" value="ok">Speichern</button></div>`,
    (knopf, f) => {
      const d = { erledigt: knopf === 'heute' ? tagKey(Date.now()) : f.erledigt.value, entfaellt: f.entfaellt.checked, notiz: f.notiz.value.trim() };
      if (!d.erledigt && !d.entfaellt && !d.notiz) delete schwangerDaten().vorsorge[k]; else schwangerDaten().vorsorge[k] = d;
    });
}
const SS_STAND = { erledigt: ['✓', 'erledigt', 'ok'], entfaellt: ['–', 'entfällt', ''], jetzt: ['●', 'jetzt', 'jetzt'], bald: ['◔', 'bald', 'bald'], spaeter: ['○', '', ''], vorbei: ['!', 'Zeitraum vorbei', 'warn'] };
function zeigeSsVorsorge() {
  const s = schwangerDaten(), nv = naechsteVorsorge();
  const termine = [...s.termine].sort((a, b) => b.datum.localeCompare(a.datum));
  const unters = SS_VORSORGE.map(x => {
    const st = ssVorsorgeStand(x), [sym, txt, cls] = SS_STAND[st], e = s.vorsorge[x.k];
    return `<li class="v-${cls}" onclick="ssUntersuchungDialog('${x.k}')"><div class="sym v-sym">${sym}</div>
      <div class="haupt"><b>${x.n}</b><div class="leise klein">${e?.erledigt ? 'am ' + datumDE(new Date(e.erledigt + 'T12:00').getTime()) : `${Math.floor(x.von) + 1}.–${Math.floor(x.bis) + 1}. Woche`}</div></div>
      <div class="neben v-st">${txt}</div></li>`;
  }).join('');
  return `<div class="karte"><h2>Vorsorgetermine</h2>
      <p style="margin:0 0 8px">${nv ? `${nv.geplant ? 'Nächster Termin' : 'Nächster Termin etwa'} am <b>${datumDE(nv.ms)}</b>.` : 'Trag deinen letzten oder nächsten Termin ein, dann rechnet die App mit.'}
      <span class="leise klein">Bis zur 32. Woche alle 4 Wochen, danach alle 2 Wochen, nach dem Termin alle 2 Tage.</span></p>
      <ul class="liste">${termine.map(t => `<li onclick="ssTerminDialog('${t.id}')"><div class="sym med">🩺</div>
        <div class="haupt"><b>${datumDE(new Date(t.datum + 'T12:00').getTime())}</b>${new Date(t.datum + 'T12:00') > new Date() ? ' <span class="leise klein">geplant</span>' : ''}
        <div class="leise klein">${[t.rr ? 'RR ' + esc(t.rr) : '', t.kg ? String(t.kg).replace('.', ',') + ' kg' : '', esc(t.notiz || '')].filter(Boolean).join(' · ') || 'SSW ' + sswText(new Date(t.datum + 'T12:00').getTime())}</div></div></li>`).join('')}</ul>
      <button class="knopf rand breit" style="margin-top:8px" onclick="ssTerminDialog()">＋ Termin eintragen</button></div>
    <div class="karte"><h2>Besondere Untersuchungen</h2><ul class="liste">${unters}</ul>
      <p class="leise klein" style="margin:8px 0 0">Nach den Mutterschafts-Richtlinien. Deine Frauenärztin oder Hebamme sagt dir, was bei dir ansteht.</p></div>`;
}
function zeigeSsGewicht() {
  const l = [...schwangerDaten().gewicht].sort((a, b) => a.datum.localeCompare(b.datum));
  const zunahme = l.length >= 2 ? l.at(-1).kg - l[0].kg : null;
  return `<div class="karte"><h2>Mein Gewicht</h2>
    ${zunahme !== null ? `<p class="mittel" style="margin:0">${zunahme >= 0 ? '+' : ''}${zunahme.toFixed(1).replace('.', ',')} kg</p><p class="leise klein" style="margin:2px 0 10px">seit ${datumDE(new Date(l[0].datum + 'T12:00').getTime())}. Wie viel passt, hängt vom Gewicht vor der Schwangerschaft ab – sprich darüber bei der Vorsorge.</p>` : ''}
    <ul class="liste">${[...l].reverse().map(g => `<li onclick="ssGewichtDialog('${g.id}')"><div class="haupt"><b>${String(g.kg).replace('.', ',')} kg</b><div class="leise klein">${datumDE(new Date(g.datum + 'T12:00').getTime())} · SSW ${sswText(new Date(g.datum + 'T12:00').getTime())}</div></div></li>`).join('') || '<li class="plan">Noch nichts eingetragen.</li>'}</ul>
    <button class="knopf rand breit" style="margin-top:8px" onclick="ssGewichtDialog()">＋ Gewicht eintragen</button></div>`;
}
function zeigeSsTodos() {
  const s = schwangerDaten(), w = Math.floor(ssTage() / 7);
  const jetzt = SS_TODOS.filter(x => w >= x.ab - 2), spaeter = SS_TODOS.filter(x => w < x.ab - 2);
  return `<div class="karte"><h2>Jetzt dran</h2><ul class="todo">${jetzt.map(todoZeile).join('') || '<li>Gerade nichts.</li>'}</ul></div>
    ${spaeter.length ? `<div class="karte"><h2>Später</h2><ul class="todo">${spaeter.map(x => todoZeile(x).replace('<b>', `<b><span class="leise">ab ${x.ab}. Woche · </span>`)).join('')}</ul></div>` : ''}`;
}
function ssWoche() {
  const { w, g } = groesse();
  const zeilen = Object.entries(GROESSE).filter(([k]) => +k >= 8).map(([k, x]) => `<li class="${+k === w ? 'jetzt' : ''}"><span>${k}</span><span>${x[1]} ${x[0]}</span><span>${groesseText(x)}</span></li>`).join('');
  return `<div class="karte"><h2>Woche für Woche</h2><ul class="wochen">${zeilen}</ul><p class="leise klein">Durchschnittswerte, jedes Baby wächst etwas anders. Bis zur 19. Woche Länge vom Scheitel bis zum Po, danach bis zur Ferse.</p></div>`;
}

/* ---------- Seiten für die Übersicht „Gesundheit“ ---------- */
const SCHWANGER_SEITEN = [
  { k: 'ss_woche', t: 'Woche für Woche', sym: '🍎', farbe: 'essen', f: () => ssWoche(), info: () => `SSW ${sswText()}, so groß wie ${groesse().g[0]}` },
  { k: 'ss_vorsorge', t: 'Vorsorge', sym: '🩺', farbe: 'gesund', f: () => zeigeSsVorsorge(), info() {
    const nv = naechsteVorsorge(); const dran = SS_VORSORGE.find(x => ssVorsorgeStand(x) === 'jetzt');
    return dran ? `${dran.n} ist jetzt dran` : nv ? `Nächster Termin etwa ${datumDE(nv.ms)}` : 'Mutterpass-Termine und Untersuchungen';
  } },
  { k: 'ss_bewegungen', t: 'Kindsbewegungen', sym: '👣', farbe: 'essen', f: () => zeigeBewegungen(), info() {
    const b = sortiert(schwangerDaten().bewegungen.filter(x => x.ende)).at(-1);
    return b ? `Zuletzt ${b.anzahl} in ${dauer((b.ende - b.start) / MIN)}, ${relativ(b.start)}` : 'Tritte zählen';
  } },
  { k: 'ss_wehen', t: 'Wehen', sym: '⏱️', farbe: 'gesund', f: () => zeigeWehen(), info: () => 'Dauer und Abstand messen' },
  { k: 'ss_gewicht', t: 'Mein Gewicht', sym: '⚖️', farbe: 'wetter', f: () => zeigeSsGewicht(), info() {
    const l = [...schwangerDaten().gewicht].sort((a, b) => a.datum.localeCompare(b.datum)); return l.length ? `${String(l.at(-1).kg).replace('.', ',')} kg` : 'Gewichtsverlauf';
  } },
  { k: 'ss_todos', t: 'Zu erledigen', sym: '✅', farbe: 'erinn', f: () => zeigeSsTodos(), info() {
    const s = schwangerDaten(), w = Math.floor(ssTage() / 7); const n = SS_TODOS.filter(x => !s.todos[x.k] && w >= x.ab - 2).length;
    return n ? `${n} ${n === 1 ? 'Punkt' : 'Punkte'} offen` : 'Hebamme, Klinik, Kliniktasche …';
  } },
];

/* ---------- Profil: Entbindungstermin, Geburt ---------- */
function schwangerProfilKarte() {
  const s = schwangerDaten();
  if (S.profil.geburt && !s.et) return '';
  return `<div class="karte"><h2>Schwangerschaft</h2>
    ${S.profil.geburt ? `<p class="leise" style="margin:0">Das Baby ist da – die Schwangerschaftsdaten bleiben gespeichert.</p>` : `
    <form id="ss-form">
      <div class="zeile2"><label class="feld">Errechneter Termin<input type="date" name="et" value="${esc(s.et || '')}"></label>
        <label class="feld">oder erster Tag der letzten Periode<input type="date" name="lp" max="${tagKey(Date.now())}"></label></div>
      <button class="knopf breit">Termin speichern</button></form>
    ${s.et ? `<button class="knopf essen breit" style="margin-top:10px" onclick="geburtDialog()">Unser Baby ist da!</button>` : ''}`}
  </div>`;
}
function schwangerProfilBinden() {
  const f = $('#ss-form'); if (!f) return;
  f.onsubmit = ev => {
    ev.preventDefault();
    let et = f.et.value;
    if (!et && f.lp.value) et = tagKey(new Date(f.lp.value + 'T12:00').getTime() + 280 * TAG);
    if (!et) { alert('Bitte den errechneten Termin oder den ersten Tag der letzten Periode eintragen.'); return; }
    schwangerDaten().et = et; speichern(); rendern(); meldung(`Termin gespeichert: ${datumDE(new Date(et + 'T12:00').getTime())}`);
  };
  const pf = $('#profil-form'); if (pf && istSchwanger()) pf.geburt.required = false;
}
function geburtDialog() {
  dialog(`<h2>Herzlichen Glückwunsch!</h2><p class="leise">Ab jetzt zeigt die App Schlaf, Füttern, Windeln und alles fürs Baby.</p>
    <label class="feld">Geboren am<input type="date" name="geburt" value="${tagKey(Date.now())}" max="${tagKey(Date.now())}" required></label>
    <label class="feld">Name<input name="name" value="${esc(S.profil.name || '')}"></label>
    <label class="feld">Geschlecht<select name="geschlecht"><option value="">–</option><option value="w">Mädchen</option><option value="m">Junge</option></select></label>
    <div class="dlg-knoepfe"><button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf essen" value="ok">Speichern</button></div>`,
    (k, f) => {
      if (!f.geburt.value) return 'Bitte das Geburtsdatum eintragen.';
      Object.assign(S.profil, { geburt: f.geburt.value, name: f.name.value.trim() || S.profil.name, geschlecht: f.geschlecht.value || S.profil.geschlecht });
      (S.tagebuch ||= []).push({ id: neueId(), datum: f.geburt.value, titel: 'Geburt', text: `Geboren in der SSW ${sswText(new Date(f.geburt.value + 'T12:00').getTime())}.` });
      setTimeout(() => zeige('heute'), 0);
    });
}
function schwangerStart() {
  dialog(`<h2>Schön, dass du da bist</h2><p class="leise" style="margin:0">Mit dem errechneten Termin zeigt die App deine Schwangerschaftswoche, die Größe des Babys und anstehende Vorsorge.</p>
    <label class="feld">Errechneter Termin<input type="date" name="et"></label>
    <label class="feld">oder erster Tag der letzten Periode<input type="date" name="lp" max="${tagKey(Date.now())}"></label>
    <div class="dlg-knoepfe"><button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf essen" value="ok">Los geht's</button></div>`,
    (k, f) => {
      let et = f.et.value;
      if (!et && f.lp.value) et = tagKey(new Date(f.lp.value + 'T12:00').getTime() + 280 * TAG);
      if (!et) return 'Bitte den Termin oder den ersten Tag der letzten Periode eintragen.';
      const t = 280 - Math.round((new Date(et + 'T12:00').getTime() - tagAnfang(Date.now()) - 12 * STD) / TAG);
      if (t < 0 || t > 300) return 'Dieser Termin passt nicht zu einer laufenden Schwangerschaft.';
      schwangerDaten().et = et;
    });
}
