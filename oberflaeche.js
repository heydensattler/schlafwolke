/* Schlafwolke – Oberfläche: fünf Bereiche (Heute, Verlauf, Gesundheit, Wetter, Baby),
   Übersichtsseiten mit Zusammenfassung statt versteckter Reiter. Wird zuletzt geladen und
   ersetzt die bisherige Seitensteuerung aus app.js. */
'use strict';

const BEREICH_SEKTION = { heute: 'v-heute', verlauf: 'v-verlauf', gesundheit: 'v-gesundheit', wetter: 'v-wetter', baby: 'v-profil' };
const ALTE_NAMEN = { schlaf: 'heute', essen: 'heute', profil: 'baby' };
let unter = '';          // Unterseite im Bereich, z. B. „vorsorge“
let heuteVersatz = 0;    // 0 = heute, 1 = gestern …

/* ---------- Übersichtsseiten ---------- */
function letzterWert(feld) {
  const l = sortiert(S.wachstum.filter(w => zahl(w[feld])).map(w => ({ ...w, start: new Date(w.datum + 'T12:00').getTime() })));
  return l[l.length - 1];
}
const UNTERSEITEN = {
  gesundheit: [
    { k: 'vorsorge', t: 'Vorsorge', sym: '📅', farbe: 'gesund', f: () => zeigeVorsorge(), info() {
      const l = vorsorgeListe(); if (!l.length) return 'U-Untersuchungen und Impfungen';
      const dran = l.find(x => x.status === 'jetzt') || l.find(x => x.status === 'nachholen');
      if (dran) return `${dran.typ === 'u' ? dran.k : dran.name} ist jetzt dran`;
      const n = l.find(x => x.status === 'bald' || x.status === 'spaeter');
      return n ? `Als Nächstes ${n.typ === 'u' ? n.k : n.name}, ab ${datumKurz(n.tvonMs)}` : 'Alles erledigt';
    } },
    { k: 'krank', t: 'Krank', sym: '🌡️', farbe: 'gesund', f: () => zeigeKrank(), info() {
      const t = sortiert(S.gesundheit.filter(e => e.art === 'fieber' && e.wert)).at(-1);
      return t && Date.now() - t.start < 3 * TAG ? `Zuletzt ${tempText(t.wert)}, ${relativ(t.start)}` : 'Fieber, Medikamente, wichtige Nummern';
    } },
    { k: 'zaehne', t: 'Zähne', sym: '🦷', farbe: 'gesund', f: () => zeigeZaehne(), info() {
      const n = Object.keys(S.zaehne || {}).length; return n ? `${n} von 20 Milchzähnen` : 'Noch kein Zahn eingetragen';
    } },
    { k: 'wachstum', t: 'Wachstum', sym: '📏', farbe: 'wetter', f: () => zeigeWachstum(), info() {
      const w = letzterWert('gewicht'); return w ? `${deZahl(zahl(w.gewicht), 2)} kg am ${datumKurz(w.start)}` : 'Gewicht, Größe, Kopfumfang';
    } },
  ],
  baby: [
    { k: 'beikost', t: 'Beikost-Plan', sym: '🥣', farbe: 'essen', f: () => zeigeBeikost(), info() {
      const n = Object.keys(versuche()).length; return n ? `${n} von ${S.beikost.ziel || 100} Lebensmitteln probiert` : breiplan().titel;
    } },
    { k: 'meilensteine', t: 'Meilensteine', sym: '⭐', farbe: 'erinn', f: () => zeigeMeilensteine(), info() {
      const n = Object.values(S.meilensteine || {}).filter(m => m.datum).length; return n ? `${n} erreicht` : 'Erstes Lächeln, Drehen, Sitzen …';
    } },
    { k: 'tagebuch', t: 'Tagebuch', sym: '📖', farbe: 'erinn', f: () => zeigeTagebuch(), info() {
      const n = (S.tagebuch || []).length; return n ? `${n} ${n === 1 ? 'Eintrag' : 'Einträge'}` : 'Erinnerungen mit Fotos';
    } },
    { k: 'kosten', t: 'Kosten', sym: '💶', farbe: 'kosten', f: () => zeigeKosten(), info() {
      const k = kostenDaten(); const aus = k.ausgaben.reduce((s, a) => s + a.betrag, 0);
      const rest = k.toepfe.reduce((s, t) => s + topfStand(t).rest, 0);
      if (!aus && !k.toepfe.length) return 'Ausgaben und Zuschüsse';
      return `${euro(aus)} ausgegeben${k.toepfe.length ? `, ${euro(rest)} Zuschuss übrig` : ''}`;
    } },
    { k: 'profil', t: 'Profil und Sicherung', sym: '⚙️', farbe: 'leise', f: null, info() {
      return S.profil.geburt ? `Geboren am ${datumDE(geburtMs())}` : 'Name und Geburtstag eintragen';
    } },
  ],
};
// Welche Unterseiten gerade passen: in der Schwangerschaft die Schwangerschaftsseiten, danach alles fürs Baby
function unterseiten(bereich) {
  if (istSchwanger()) {
    if (bereich === 'gesundheit') return SCHWANGER_SEITEN;
    return UNTERSEITEN.baby.filter(u => ['tagebuch', 'kosten', 'profil'].includes(u.k));
  }
  return UNTERSEITEN[bereich] || [];
}
const alleUnterseiten = bereich => [...(UNTERSEITEN[bereich] || []), ...(bereich === 'gesundheit' ? SCHWANGER_SEITEN : [])];
const BEREICH_TITEL = { gesundheit: 'Gesundheit', baby: () => S.profil.name || 'Baby' };

function hub(bereich) {
  const titel = typeof BEREICH_TITEL[bereich] === 'function' ? BEREICH_TITEL[bereich]() : BEREICH_TITEL[bereich];
  const zeilen = unterseiten(bereich).map(u => {
    let info = ''; try { info = u.info(); } catch (e) { info = ''; }
    return `<button class="hub-zeile" onclick="zeige('${bereich}/${u.k}')">
      <span class="hub-sym" style="--farbe:var(--${u.farbe}-hell)">${u.sym}</span>
      <span class="hub-text"><b>${u.t}</b><small>${esc(info)}</small></span><span class="hub-pfeil" aria-hidden="true">›</span></button>`;
  }).join('');
  const zusatz = bereich === 'baby' && S.profil.geburt ? `<p class="seiten-unter">${esc(alterText())} alt</p>`
    : istSchwanger() ? `<p class="seiten-unter">SSW ${sswText()}, errechneter Termin ${datumDE(etMs())}</p>` : '';
  return `<h1 class="seiten-titel">${esc(titel)}</h1>${zusatz}<nav class="hub">${zeilen}</nav>`;
}
function unterkopf(bereich, titel) {
  const zurueck = typeof BEREICH_TITEL[bereich] === 'function' ? BEREICH_TITEL[bereich]() : BEREICH_TITEL[bereich];
  return `<div class="unterkopf"><button class="zurueck" onclick="zeige('${bereich}')">‹ ${esc(zurueck)}</button><h1 class="seiten-titel">${titel}</h1></div>`;
}

/* ---------- Heute ---------- */
function wetterKurz() {
  const c = S.wetter.cache; if (!c || !S.wetter.ort || !c.d) return '';
  if (Date.now() - c.zeit > 30 * MIN) wetterAbrufen();
  const cur = c.d.current;
  const k = kleidung({ temp: cur.temperature_2m, gefuehlt: cur.apparent_temperature, wind: cur.wind_speed_10m, regen: cur.precipitation, regenW: 0, uv: cur.uv_index || 0, code: cur.weather_code }, S.wetter.transport);
  return `<button class="wetter-chip" onclick="zeige('wetter')">${wmo(cur.weather_code, cur.is_day)[0]} ${Math.round(cur.temperature_2m)}°<span>${k.stufe}</span></button>`;
}
function himmel() {
  const lauf = laufenderSchlaf();
  const { plan } = tagesplan();
  const naechster = plan.find(p => p.art !== 'aufwachen');
  const band = `<div class="himmel-band">${zeitleiste(Date.now(), plan)}<div class="skala"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div></div>`;
  if (lauf) {
    const erw = plan.find(p => p.art === 'aufwachen');
    return `<section class="himmel nacht">
      <p class="himmel-zeile">${esc(babyName())} ${lauf.art === 'nacht' ? 'schläft' : 'macht ein Schläfchen'}</p>
      <div class="himmel-uhr" data-lauf="${lauf.start}">${laufzeit(Date.now() - lauf.start)}</div>
      <p class="himmel-info">seit ${uhr(lauf.start)}${erw ? `, wach ca. ${uhr(erw.ms)}` : ''}</p>
      ${band}
      <button class="knopf hell breit" onclick="schlafStopp()">Aufgewacht</button>
    </section>`;
  }
  const fertig = sortiert(S.schlaf).filter(s => s.ende && s.ende <= Date.now());
  const letzt = fertig.length ? fertig[fertig.length - 1].ende : null;
  const mw = morgenWach(Date.now());
  const wachSeit = Math.max(letzt || 0, mw.ms <= Date.now() ? mw.ms : 0) || Date.now();
  const istNacht = naechster && naechster.art === 'nacht';
  let naechstText = '';
  if (naechster) {
    const s = naechster.start, wort = istNacht ? 'Schlafenszeit' : 'Nächstes Schläfchen';
    naechstText = s < Date.now() ? `${wort}: jetzt, auf Müdigkeitszeichen achten` : `${wort} ca. ${uhr(s)}, ${relativ(s)}`;
  }
  return `<section class="himmel tag">
    <p class="himmel-zeile">${esc(babyName())} ist wach</p>
    <div class="himmel-uhr" data-lauf="${wachSeit}">${laufzeit(Date.now() - wachSeit)}</div>
    <p class="himmel-info">${naechstText}${mw.quelle === 'üblich' && !letzt ? ` <button class="link" onclick="aufwachDialog()">Aufwachzeit ${uhr(mw.ms)} ändern</button>` : ''}</p>
    ${band}
    <div class="knoepfe">
      <button class="knopf ${istNacht ? 'zweit' : ''}" onclick="schlafStart('nap')">Schläfchen</button>
      <button class="knopf nacht ${istNacht ? '' : 'zweit'}" onclick="schlafStart('nacht')">Nachtschlaf</button>
    </div>
  </section>`;
}
function beikostRelevant() { return (alterWochen() ?? 0) >= 17 || S.essen.some(e => e.art === 'beikost'); }
function schnell() {
  const lauf = laufendesEssen();
  const stillMahl = mahlzeiten(S.essen.filter(e => e.art === 'stillen' && e.seite && e.seite !== 'beide'));
  const anfang = stillMahl.length ? stillMahl[stillMahl.length - 1].teile[0].seite : null;
  const naechste = anfang ? (anfang === 'links' ? 'rechts' : 'links') : null;
  const essenZeile = lauf
    ? `<div class="stillen-laeuft"><span>🤱 Stillen ${esc(lauf.seite || '')}</span><b data-lauf="${lauf.start}">${laufzeit(Date.now() - lauf.start)}</b>
        <button class="knopf klein zweit" onclick="seiteWechseln()">Seite wechseln</button><button class="knopf klein essen" onclick="essenStopp()">Fertig</button></div>`
    : `<button class="schnell-knopf essen ${naechste === 'links' ? 'vorschlag' : ''}" onclick="essenStart('links')"><span>🤱</span>Links</button>
       <button class="schnell-knopf essen ${naechste === 'rechts' ? 'vorschlag' : ''}" onclick="essenStart('rechts')"><span>🤱</span>Rechts</button>
       <button class="schnell-knopf essen" onclick="essenDialog(null,'flasche')"><span>🍼</span>Flasche</button>`;
  const fertig = sortiert(S.essen).filter(e => e.ende || e.art !== 'stillen');
  const le = fertig[fertig.length - 1], lw = sortiert(S.windeln).at(-1);
  const zeilen = [
    le ? `Gegessen ${relativ(le.ende || le.start)}${naechste ? `, nächstes Mal ${naechste} anfangen` : ''}` : '',
    lw ? `Gewickelt ${relativ(lw.start)}` : '',
  ].filter(Boolean);
  return `<section class="schnell">
    <h2>Schnell eintragen</h2>
    <div class="schnell-raster">
      ${essenZeile}
      <button class="schnell-knopf windel" onclick="schnellWindel('nass')"><span>💧</span>Nass</button>
      <button class="schnell-knopf windel" onclick="schnellWindel('voll')"><span>💩</span>Voll</button>
      <button class="schnell-knopf windel" onclick="schnellWindel('beides')"><span>💧💩</span>Beides</button>
      ${beikostRelevant() ? `<button class="schnell-knopf essen" onclick="beikostDialog()"><span>🥣</span>Beikost</button>` : ''}
      <button class="schnell-knopf mehr ${beikostRelevant() ? 'zwei' : 'drei'}" onclick="nachtragen()"><span>＋</span>Anderes eintragen</button>
    </div>
    ${zeilen.length ? `<p class="schnell-info">${zeilen.join('<br>')}</p>` : ''}
  </section>`;
}
function schnellWindel(art) {
  windelNeu(art);
  const w = S.windeln[S.windeln.length - 1];
  meldung(`${WINDEL[art][0]} ${WINDEL[art][1]} eingetragen, ${uhr(w.start)}`, () => { S.windeln = S.windeln.filter(x => x !== w); speichern(); rendern(); });
}
function nachtragen() {
  const k = (sym, text, aufruf) => `<button type="button" class="wahl-knopf" onclick="$('#dlg').close();${aufruf}"><span>${sym}</span>${text}</button>`;
  dialog(`<h2>Was möchtest du eintragen?</h2>
    <div class="wahl-raster">
      ${k('😴', 'Schlaf', 'schlafDialog()')}${k('☀️', 'Aufwachzeit', 'aufwachDialog()')}
      ${k('🤱', 'Stillen', "essenDialog(null,'stillen')")}${k('🍼', 'Flasche', "essenDialog(null,'flasche')")}
      ${k('🥣', 'Beikost', 'beikostDialog()')}${k('🧷', 'Windel', 'windelDialog()')}
      ${k('🌡️', 'Fieber', "krankDialog('fieber')")}${k('💊', 'Medikament', "krankDialog('medikament')")}
      ${k('📏', 'Messung', 'wachstumDialog()')}${k('📖', 'Tagebuch', 'tagebuchDialog()')}
    </div>
    <div class="dlg-knoepfe"><button class="knopf rand" value="abbrechen" formnovalidate>Schließen</button></div>`, () => {});
}
function tagEintraege(tag) {
  const a = tag, e = tag + TAG, liste = [];
  for (const s of S.schlaf) {
    const ende = s.ende || Date.now(); if (ende <= a || s.start >= e) continue;
    liste.push({ ms: s.start, sym: s.art === 'nacht' ? '🌙' : '😴', farbe: 'schlaf', titel: s.art === 'nacht' ? 'Nachtschlaf' : 'Schläfchen',
      zeit: `${uhr(s.start)} – ${s.ende ? uhr(s.ende) : 'läuft'}`, neben: dauer((ende - s.start) / MIN, true), klick: `schlafDialog('${s.id}')` });
  }
  for (const f of S.essen) if (f.start >= a && f.start < e)
    liste.push({ ms: f.start, sym: ESSEN_SYM[f.art], farbe: 'essen', titel: essenText(f), zeit: uhr(f.start) + (f.art === 'stillen' && f.ende ? ' – ' + uhr(f.ende) : ''),
      neben: f.art === 'stillen' ? (f.ende ? dauer((f.ende - f.start) / MIN, true) : 'läuft') : '', klick: f.art === 'beikost' ? `beikostDialog('${f.id}')` : `essenDialog('${f.id}')` });
  for (const w of S.windeln) if (w.start >= a && w.start < e)
    liste.push({ ms: w.start, sym: WINDEL[w.art][0], farbe: 'wetter', titel: 'Windel ' + WINDEL[w.art][1].toLowerCase() + (w.farbe ? `, ${STUHLFARBE[w.farbe]}` : ''), zeit: uhr(w.start), neben: '', klick: `windelDialog('${w.id}')` });
  for (const g of S.gesundheit) if (g.start >= a && g.start < e)
    liste.push({ ms: g.start, sym: G_ART[g.art][0], farbe: 'gesund', titel: g.art === 'fieber' ? tempText(g.wert) : g.art === 'medikament' ? g.mittel + (g.dosis ? ', ' + g.dosis : '') : (g.notiz || 'Notiz'),
      zeit: uhr(g.start), neben: '', klick: `krankDialog('${g.art}','${g.id}')` });
  return liste.sort((x, y) => y.ms - x.ms);
}
function tagesbuch() {
  const tag = tagAnfang(Date.now()) - heuteVersatz * TAG;
  const eintraege = tagEintraege(tag);
  const titel = heuteVersatz === 0 ? 'Heute' : heuteVersatz === 1 ? 'Gestern' : new Date(tag).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const naps = S.schlaf.filter(s => s.art === 'nap' && s.start >= tag && s.start < tag + TAG).length;
  const tagschlaf = minutenImTag(S.schlaf, tag, s => s.art === 'nap');
  const mahl = mahlzeiten(S.essen.filter(f => f.start >= tag && f.start < tag + TAG)).length;
  const windeln = S.windeln.filter(w => w.start >= tag && w.start < tag + TAG).length;
  const zahlen = [[naps, naps === 1 ? 'Schläfchen' : 'Schläfchen'], [dauer(tagschlaf, true), 'Tagschlaf'], [mahl, mahl === 1 ? 'Mahlzeit' : 'Mahlzeiten'], [windeln, windeln === 1 ? 'Windel' : 'Windeln']];
  return `<section class="tagesbuch">
    <div class="tag-nav"><button class="pfeil" onclick="heuteVersatz++;rendern()" aria-label="Tag davor">‹</button>
      <h2>${titel}</h2><button class="pfeil" onclick="heuteVersatz=Math.max(0,heuteVersatz-1);rendern()" ${heuteVersatz === 0 ? 'disabled' : ''} aria-label="Tag danach">›</button></div>
    ${heuteVersatz > 0 ? `<div class="himmel-band flach">${zeitleiste(tag)}<div class="skala"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div></div>` : ''}
    <dl class="tag-zahlen">${zahlen.map(([w, b]) => `<div><dt>${b}</dt><dd>${w}</dd></div>`).join('')}</dl>
    <ul class="eintraege">${eintraege.map(x => `<li onclick="${x.klick}"><span class="punkt" style="--farbe:var(--${x.farbe})"></span>
      <time>${x.zeit}</time><span class="was">${x.sym} ${esc(x.titel)}</span><span class="neben">${x.neben}</span></li>`).join('')
      || `<li class="leer-zeile">Noch nichts eingetragen.</li>`}</ul>
    ${heuteVersatz > 0 ? `<button class="knopf rand breit" onclick="nachtragen()">＋ Für diesen Tag nachtragen</button>` : ''}
  </section>`;
}
function zeigeHeute() {
  const el = $('#v-heute');
  if (istSchwanger()) {
    el.innerHTML = `<div class="heute-kopf"><h1 class="seiten-titel">${S.profil.name ? esc(S.profil.name) : 'Deine Schwangerschaft'}</h1>${wetterKurz()}</div>` + schwangerHeute();
    return;
  }
  if (!S.profil.geburt) {
    el.innerHTML = `<section class="willkommen"><div class="willkommen-wolke">☁️</div>
      <h1 class="seiten-titel">Willkommen bei Schlafwolke</h1>
      <p>Die App begleitet dich durch die Schwangerschaft und die Zeit mit dem Baby: Schlaf, Füttern, Windeln, Vorsorge und mehr.</p>
      <div class="knoepfe" style="grid-template-columns:1fr">
        <button class="knopf essen breit" onclick="schwangerStart()">Ich bin schwanger</button>
        <button class="knopf breit" onclick="zeige('baby/profil')">Unser Baby ist schon da</button></div></section>`;
    return;
  }
  const datum = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  el.innerHTML = `<div class="heute-kopf"><h1 class="seiten-titel">${datum}</h1>${wetterKurz()}</div>`
    + (heuteVersatz === 0 ? himmel() + (window.vorsorgeHinweis ? vorsorgeHinweis() : '') + schnell() : '')
    + tagesbuch();
}

/* ---------- Meldung mit „Rückgängig“ ---------- */
let meldungZeit = null;
function meldung(text, rueck) {
  let el = $('#meldung');
  if (!el) { el = document.createElement('div'); el.id = 'meldung'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = `<span>${esc(text)}</span>${rueck ? '<button>Rückgängig</button>' : ''}`;
  if (rueck) el.querySelector('button').onclick = () => { rueck(); el.classList.remove('an'); };
  el.classList.add('an');
  clearTimeout(meldungZeit); meldungZeit = setTimeout(() => el.classList.remove('an'), 5000);
}

/* ---------- Kopfzeile ---------- */
kopf = function () {
  $('#baby-kurz').textContent = istSchwanger() ? `SSW ${sswText()}` : S.profil.geburt ? `${babyName()}, ${alterText()}` : '';
};

/* ---------- Seitensteuerung ---------- */
const _profilAlt = zeigeProfil, _verlaufAlt = zeigeVerlauf, _wetterAlt = zeigeWetter;
zeige = function (ziel) {
  let [bereich, u] = String(ziel || 'heute').split('/');
  bereich = ALTE_NAMEN[bereich] || bereich;
  if (!BEREICH_SEKTION[bereich]) bereich = 'heute';
  if (u && !alleUnterseiten(bereich).some(x => x.k === u)) u = '';
  if (bereich === 'heute' && aktiv !== 'heute') heuteVersatz = 0;
  aktiv = bereich; unter = u || '';
  document.querySelectorAll('.ansicht').forEach(s => s.classList.toggle('aktiv', s.id === BEREICH_SEKTION[bereich]));
  document.querySelectorAll('.leiste button').forEach(b => b.classList.toggle('aktiv', b.dataset.v === bereich));
  try { sessionStorage.setItem('ansicht', bereich + (unter ? '/' + unter : '')); } catch (e) {}
  rendern();
  window.scrollTo(0, 0);
};
rendern = function () {
  kopf();
  if (aktiv === 'heute') return zeigeHeute();
  if (aktiv === 'verlauf') return zeigeVerlauf();
  if (aktiv === 'wetter') return zeigeWetter();
  const el = $('#' + BEREICH_SEKTION[aktiv]);
  if (!unter) { el.innerHTML = hub(aktiv); return; }
  const u = alleUnterseiten(aktiv).find(x => x.k === unter);
  if (u.k === 'profil') {
    babyReiter = 'profil'; _profilAlt();
    el.querySelector('.reiter')?.remove();
    el.insertAdjacentHTML('afterbegin', unterkopf('baby', 'Profil und Sicherung'));
    el.querySelector('.karte').insertAdjacentHTML('afterend', schwangerProfilKarte());
    schwangerProfilBinden();
    return;
  }
  el.innerHTML = unterkopf(aktiv, u.t) + u.f();
  // doppelte Überschrift („Wachstum“ unter „Wachstum“) weglassen
  const h2 = el.querySelector('.karte h2');
  if (h2 && h2.textContent.trim() === u.t) h2.remove();
  fotosEinsetzen(el);
};
// Neu zeichnen nach Eingaben – nur das Profilformular nicht (ungespeicherte Eingaben)
alles = function () { if (aktiv === 'baby' && unter === 'profil') kopf(); else rendern(); };
zeigeProfil = () => rendern();
zeigeEssen = () => rendern();
zeigeGesundheit = () => rendern();
zeigeSchlaf = () => rendern();
zeigeVerlauf = function () {
  if (istSchwanger()) {
    const l = sortiert(schwangerDaten().bewegungen.filter(b => b.ende)).reverse().slice(0, 10);
    $('#v-verlauf').innerHTML = '<h1 class="seiten-titel">Verlauf</h1>' + zeigeSsGewicht()
      + `<div class="karte"><h2>Kindsbewegungen</h2><ul class="liste">${l.map(b => `<li onclick="bewegungDialog('${b.id}')"><div class="haupt"><b>${b.anzahl} ${b.anzahl === 1 ? "Bewegung" : "Bewegungen"}</b><div class="leise klein">${datumKurz(b.start)}, ${uhr(b.start)}</div></div><div class="neben">${dauer((b.ende - b.start) / MIN)}</div></li>`).join('') || '<li class="plan">Noch nicht gezählt.</li>'}</ul></div>`
      + wehenKarte(false);
    return;
  }
  _verlaufAlt();
  const el = $('#v-verlauf');
  el.insertAdjacentHTML('afterbegin', '<h1 class="seiten-titel">Verlauf</h1>');
  el.insertAdjacentHTML('beforeend', windelVerlauf());
};
zeigeWetter = function () {
  _wetterAlt();
  $('#v-wetter').insertAdjacentHTML('afterbegin', '<h1 class="seiten-titel">Wetter</h1>');
};
function windelVerlauf() {
  const heute = tagAnfang(Date.now()), tage = [];
  for (let i = verlaufTage - 1; i >= 0; i--) { const t = heute - i * TAG; const a = S.windeln.filter(w => tagAnfang(w.start) === t); tage.push({ t, nass: a.filter(istNass).length, voll: a.filter(istVoll).length }); }
  if (!tage.some(d => d.nass || d.voll)) return '';
  const max = Math.max(6, ...tage.map(d => Math.max(d.nass, d.voll)));
  return `<div class="karte"><h2>Windeln pro Tag</h2>
    <div class="saeulen" style="height:100px">${tage.map(d => `<div class="saeule" style="flex-direction:row;align-items:flex-end;gap:2px" title="${d.nass} nass, ${d.voll} voll">
      <div class="teil wnass" style="flex:1;height:${d.nass / max * 100}%"></div><div class="teil wvoll" style="flex:1;height:${d.voll / max * 100}%"></div></div>`).join('')}</div>
    <div class="saeulen-achse">${tage.map(d => `<span>${verlaufTage <= 7 ? WT[new Date(d.t).getDay()] : new Date(d.t).getDate()}</span>`).join('')}</div>
    <div class="legende"><span><i style="background:var(--wetter)"></i>nass</span><span><i style="background:var(--windel-voll)"></i>voll</span></div></div>`;
}
setInterval(() => { if (!$('#dlg').open && aktiv === 'heute') rendern(); }, 60000);
