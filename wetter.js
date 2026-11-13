/* Schlafwolke – Wetter und Kleidungsempfehlung (Wetterdaten: Open-Meteo, ohne Schlüssel) */
'use strict';

const WMO = {
  0: ['☀️', 'Klar'], 1: ['🌤️', 'Überwiegend klar'], 2: ['⛅', 'Teils bewölkt'], 3: ['☁️', 'Bedeckt'],
  45: ['🌫️', 'Nebel'], 48: ['🌫️', 'Reifnebel'],
  51: ['🌦️', 'Leichter Nieselregen'], 53: ['🌦️', 'Nieselregen'], 55: ['🌧️', 'Starker Nieselregen'],
  56: ['🌧️', 'Gefrierender Niesel'], 57: ['🌧️', 'Gefrierender Niesel'],
  61: ['🌦️', 'Leichter Regen'], 63: ['🌧️', 'Regen'], 65: ['🌧️', 'Starker Regen'],
  66: ['🌧️', 'Gefrierender Regen'], 67: ['🌧️', 'Gefrierender Regen'],
  71: ['🌨️', 'Leichter Schnee'], 73: ['🌨️', 'Schnee'], 75: ['❄️', 'Starker Schnee'], 77: ['🌨️', 'Schneegriesel'],
  80: ['🌦️', 'Regenschauer'], 81: ['🌧️', 'Regenschauer'], 82: ['⛈️', 'Heftige Schauer'],
  85: ['🌨️', 'Schneeschauer'], 86: ['❄️', 'Schneeschauer'],
  95: ['⛈️', 'Gewitter'], 96: ['⛈️', 'Gewitter mit Hagel'], 99: ['⛈️', 'Gewitter mit Hagel'],
};
const wmo = (c, tag = true) => { const w = WMO[c] || ['🌡️', 'Wetter']; return [!tag && c <= 1 ? '🌙' : w[0], w[1]]; };
const SCHNEE = c => [71, 73, 75, 77, 85, 86].includes(c);

let wetterStunde = null; // null = jetzt, sonst Index in hourly
let ortSuche = { text: '', treffer: [], laeuft: false, fehler: '' };
let wetterLaden = false, wetterFehler = '';

/* ---------- Abruf ---------- */
async function holeJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Wetterdienst antwortet nicht (' + r.status + ')');
  return r.json();
}
async function wetterAbrufen(erzwingen) {
  const o = S.wetter.ort; if (!o) return;
  const c = S.wetter.cache;
  if (!erzwingen && c && c.lat === o.lat && c.lon === o.lon && Date.now() - c.zeit < 30 * MIN) return;
  wetterLaden = true; wetterFehler = ''; if (aktiv === 'wetter') zeigeWetter();
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + o.lat + '&longitude=' + o.lon +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index,is_day' +
      '&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,uv_index,is_day' +
      '&daily=temperature_2m_min,temperature_2m_max,uv_index_max,sunrise,sunset' +
      '&forecast_days=3&timezone=auto';
    const d = await holeJSON(url);
    S.wetter.cache = { lat: o.lat, lon: o.lon, zeit: Date.now(), d };
    speichern();
  } catch (e) {
    wetterFehler = navigator.onLine === false ? 'Keine Internetverbindung.' : e.message;
  }
  wetterLaden = false;
  if (aktiv === 'wetter') zeigeWetter();
}
async function ortSuchen(text) {
  ortSuche = { text, treffer: [], laeuft: true, fehler: '' }; zeigeWetter();
  try {
    const d = await holeJSON('https://geocoding-api.open-meteo.com/v1/search?count=6&language=de&format=json&name=' + encodeURIComponent(text));
    ortSuche.treffer = d.results || [];
    if (!ortSuche.treffer.length) ortSuche.fehler = 'Kein Ort gefunden.';
  } catch (e) { ortSuche.fehler = e.message; }
  ortSuche.laeuft = false; zeigeWetter();
}
function ortWaehlen(i) {
  const t = ortSuche.treffer[i];
  S.wetter.ort = { name: t.name, zusatz: [t.admin1, t.country_code !== 'DE' ? t.country : ''].filter(Boolean).join(', '), lat: +t.latitude.toFixed(3), lon: +t.longitude.toFixed(3) };
  ortSuche = { text: '', treffer: [], laeuft: false, fehler: '' };
  wetterStunde = null; speichern(); wetterAbrufen(true);
}
function standortNutzen() {
  if (!navigator.geolocation || !window.isSecureContext) {
    ortSuche.fehler = 'Der Standort ist hier nicht verfügbar (nur über https oder direkt am Mac). Bitte den Ort eintippen.'; zeigeWetter(); return;
  }
  ortSuche.laeuft = true; zeigeWetter();
  navigator.geolocation.getCurrentPosition(pos => {
    S.wetter.ort = { name: 'Mein Standort', zusatz: '', lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3) };
    ortSuche.laeuft = false; wetterStunde = null; speichern(); wetterAbrufen(true);
  }, err => { ortSuche.laeuft = false; ortSuche.fehler = 'Standort nicht freigegeben – bitte den Ort eintippen.'; zeigeWetter(); }, { timeout: 15000, maximumAge: 600000 });
}

/* ---------- Kleidung ---------- */
// w: {gefuehlt, temp, wind, regen (mm), regenW (%), uv, code}
function kleidung(w, transport) {
  const woche = alterWochen() ?? 20;
  let t = w.gefuehlt;
  if (woche < 12) t -= 2;              // ganz Kleine kühlen schneller aus
  if (transport === 'trage') t += 3;   // Körperwärme der Eltern
  const teile = [], hinweise = [];
  let stufe;
  if (t >= 26) {
    stufe = 'Sehr warm';
    teile.push(['🩲', 'Kurzarmbody oder nur Windel'], ['👕', 'Draußen: luftige, lange, dünne Baumwolle als Sonnenschutz'], ['👒', 'Sonnenhut mit Nackenschutz']);
  } else if (t >= 21) {
    stufe = 'Warm';
    teile.push(['🩲', 'Kurzarmbody'], ['👖', 'Dünne Hose oder kurzer Strampler'], ['👒', 'Sonnenhut'], ['🧦', 'Socken nur bei Bedarf']);
  } else if (t >= 17) {
    stufe = 'Mild';
    teile.push(['👕', 'Langarmbody'], ['👖', 'Strampler oder Hose + Oberteil'], ['🧥', 'Dünne Jacke oder Strickjacke'], ['🧢', 'Dünne Mütze'], ['🧦', 'Socken']);
  } else if (t >= 12) {
    stufe = 'Frisch';
    teile.push(['👕', 'Langarmbody'], ['👖', 'Strampler oder Hose'], ['🧶', 'Pullover oder Fleecejacke'], ['🧥', 'Übergangsjacke oder dünner Overall'], ['🧢', 'Baumwollmütze über die Ohren'], ['🧦', 'Socken oder Krabbelschuhe']);
  } else if (t >= 6) {
    stufe = 'Kühl';
    teile.push(['👕', 'Langarmbody'], ['🧦', 'Strumpfhose + Strampler oder Hose'], ['🧶', 'Pullover'], ['🧥', 'Gefütterter Overall'], ['🧣', 'Warme Mütze über die Ohren, ggf. Halstuch'], ['🧦', 'Warme Socken']);
  } else if (t >= 0) {
    stufe = 'Kalt';
    teile.push(['👕', 'Langarmbody (gern Wolle/Seide)'], ['🧦', 'Wollstrumpfhose + Hose'], ['🧶', 'Wollpullover oder Fleece'], ['🧥', 'Winteroverall'], ['🧣', 'Strickmütze + Halstuch oder Schlupfmütze'], ['🧤', 'Fäustlinge'], ['🧦', 'Dicke Socken / gefütterte Schühchen']);
  } else {
    stufe = 'Frostig';
    teile.push(['👕', 'Wollbody als erste Lage'], ['🧦', 'Wollstrumpfhose + Hose'], ['🧶', 'Wollpullover + Fleece'], ['🧥', 'Dicker Winteroverall'], ['🧣', 'Schlupfmütze über Ohren und Hals'], ['🧤', 'Fäustlinge'], ['🧦', 'Gefütterte Schühchen']);
    hinweise.push(['wichtig', 'Bei Frost lieber kurze Runden. Gesicht mit einer fettenden Wind-und-Wetter-Creme (ohne Wasser) schützen.']);
  }

  if (transport === 'wagen') {
    if (t < 6) teile.push(['🛏️', 'Kinderwagen: warmer Fußsack (Lammfell oder Daunen)']);
    else if (t < 12) teile.push(['🛏️', 'Kinderwagen: Fußsack oder Decke']);
    else if (t < 17) teile.push(['🛏️', 'Kinderwagen: dünne Decke dabeihaben']);
    if (t >= 24) hinweise.push(['wichtig', 'Verdeck nicht mit Tuch oder Decke zuhängen – darunter staut sich die Hitze. Lieber Sonnenschirm oder Schatten.']);
  } else if (transport === 'trage') {
    hinweise.push(['', 'In der Trage wärmst du mit – darum hier eine Lage weniger. Beine, Füße und Kopf schauen heraus und brauchen es extra warm.']);
    if (w.gefuehlt < 12) teile.push(['🧥', 'Tragecover oder Tragejacke über euch beide']);
    if (w.gefuehlt >= 24) hinweise.push(['wichtig', 'Bei Wärme in der Trage schnell zu warm: dünne Kleidung, Nacken öfter fühlen.']);
  } else if (transport === 'auto') {
    hinweise.push(['wichtig', 'Im Autositz keinen dicken Overall – der Gurt sitzt sonst zu locker. Dünne Lagen anziehen und eine Decke über den angeschnallten Gurt legen.']);
  }

  const nass = w.regen >= 0.1 || w.regenW >= 50;
  if (nass) hinweise.push(['wichtig', SCHNEE(w.code) ? 'Schnee: Regenverdeck/Schneeschutz und wasserfeste Schühchen.' : 'Regen möglich: Regenverdeck bzw. Regenanzug mitnehmen.']);
  else if (w.regenW >= 25) hinweise.push(['', `Regenrisiko ${w.regenW} %: Regenverdeck sicherheitshalber einpacken.`]);
  if (w.wind >= 30) hinweise.push(['wichtig', `Kräftiger Wind (${Math.round(w.wind)} km/h): Windschutz für den Wagen, Mütze über die Ohren.`]);
  else if (w.wind >= 20 && t < 17) hinweise.push(['', 'Es weht spürbar – Mütze über die Ohren.']);
  if (w.uv >= 3) {
    hinweise.push(['wichtig', `UV-Index ${w.uv.toFixed(0)}: Sonnenhut, langärmelige dünne Kleidung und Schatten. Babys im ersten Jahr nicht in die direkte Sonne.`]);
    if (w.uv >= 6) hinweise.push(['wichtig', 'Hohe UV-Belastung: die Mittagszeit (ca. 11–15 Uhr) möglichst drinnen oder im Schatten verbringen.']);
  }
  if (w.temp >= 30) hinweise.push(['wichtig', 'Hitze: öfter stillen bzw. trinken anbieten, nicht im geparkten Auto lassen.']);
  hinweise.push(['', 'Nackentest: warm und trocken = passt, verschwitzt = zu warm, kühl = eine Lage dazu. Kalte Hände sind normal.']);
  return { stufe, teile, hinweise };
}

// Schlafsack nach Zimmertemperatur
function schlafsack(zimmer) {
  if (zimmer >= 27) return { tog: '0,2', text: 'Nur Windel oder Kurzarmbody', warn: 'Sehr warm – Zimmer möglichst kühlen.' };
  if (zimmer >= 24) return { tog: '0,5', text: 'Kurzarmbody' };
  if (zimmer >= 21) return { tog: '1,0', text: 'Langarmbody' };
  if (zimmer >= 18) return { tog: '2,5', text: 'Kurzarm- oder Langarmbody' };
  if (zimmer >= 16) return { tog: '2,5', text: 'Langarmbody + Schlafanzug' };
  return { tog: '3,5', text: 'Langarmbody + Schlafanzug', warn: 'Unter 16 °C ist es recht kühl fürs Babyzimmer.' };
}

/* ---------- Ansicht ---------- */
function zeigeWetter() {
  const el = $('#v-wetter');
  const o = S.wetter.ort;
  const sucheHtml = `<form id="ort-form" style="display:flex;gap:8px">
      <input name="q" placeholder="Ort eingeben, z. B. Augsburg" value="${esc(ortSuche.text)}" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid var(--linie);background:var(--grund)">
      <button class="knopf wetter" style="min-height:0">Suchen</button></form>
      <button class="link" style="margin-top:10px;color:var(--wetter)" onclick="standortNutzen()">📍 Meinen Standort verwenden</button>
      ${ortSuche.laeuft ? '<p class="leise">Suche …</p>' : ''}
      ${ortSuche.fehler ? `<p class="fehler">${esc(ortSuche.fehler)}</p>` : ''}
      <ul class="treffer">${ortSuche.treffer.map((t, i) => `<li onclick="ortWaehlen(${i})"><b>${esc(t.name)}</b> <span class="leise klein">${esc([t.postcodes?.[0], t.admin1, t.country].filter(Boolean).join(' · '))}</span></li>`).join('')}</ul>`;

  if (!o || ortSuche.treffer.length || ortSuche.zeigen) {
    el.innerHTML = `<div class="karte"><h2>Wo seid ihr?</h2>${sucheHtml}</div>`
      + (o ? `<button class="knopf rand breit" onclick="ortSuche={text:'',treffer:[],laeuft:false,fehler:''};zeigeWetter()">Abbrechen</button>` : '');
    bindeSuche(); return;
  }
  const c = S.wetter.cache;
  const passt = c && c.lat === o.lat && c.lon === o.lon;
  if (!passt) {
    el.innerHTML = `<div class="karte leer">${wetterLaden ? '<p>Wetter wird geladen …</p>' : `<p class="fehler">${esc(wetterFehler || 'Noch keine Wetterdaten.')}</p><button class="knopf wetter" onclick="wetterAbrufen(true)">Erneut versuchen</button>`}</div>`;
    if (!wetterLaden && !wetterFehler) wetterAbrufen();
    return;
  }
  wetterAbrufen(); // im Hintergrund auffrischen, wenn älter als 30 Min.
  const d = c.d, h = d.hourly;
  const jetzt = Date.now();
  // nächste 24 Stunden ab der aktuellen Stunde
  const start = Math.max(0, h.time.findIndex(t => new Date(t).getTime() > jetzt - STD));
  const idx = []; for (let i = start; i < Math.min(h.time.length, start + 24); i++) idx.push(i);
  let w, titel;
  if (wetterStunde === null || !idx.includes(wetterStunde)) {
    wetterStunde = null;
    const cur = d.current;
    w = { temp: cur.temperature_2m, gefuehlt: cur.apparent_temperature, wind: cur.wind_speed_10m, regen: cur.precipitation, regenW: h.precipitation_probability[start] ?? 0, uv: cur.uv_index ?? 0, code: cur.weather_code, tag: cur.is_day };
    titel = 'Jetzt';
  } else {
    const i = wetterStunde;
    w = { temp: h.temperature_2m[i], gefuehlt: h.apparent_temperature[i], wind: h.wind_speed_10m[i], regen: h.precipitation[i], regenW: h.precipitation_probability[i] ?? 0, uv: h.uv_index[i] ?? 0, code: h.weather_code[i], tag: h.is_day[i] };
    titel = (tagKey(new Date(h.time[i]).getTime()) === tagKey(jetzt) ? 'Heute' : 'Morgen') + ' um ' + h.time[i].slice(11, 16);
  }
  const [ikon, text] = wmo(w.code, w.tag);
  const tr = S.wetter.transport;
  const k = kleidung(w, tr);
  const z = S.wetter.zimmer;
  const sack = schlafsack(z);
  const runde = v => Math.round(v);
  const alterNotiz = (alterWochen() ?? 99) < 12 ? ' · eine Lage mehr, weil noch so klein' : '';

  el.innerHTML = `<div class="karte">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h2 style="margin:0">${esc(o.name)}${o.zusatz ? ' <span style="text-transform:none;letter-spacing:0">· ' + esc(o.zusatz) + '</span>' : ''}</h2>
        <button class="link" style="color:var(--wetter)" onclick="ortSuche.zeigen=true;zeigeWetter()">Ort ändern</button></div>
      <div class="wetter-jetzt" style="margin-top:10px"><div class="ikon">${ikon}</div>
        <div><div class="leise klein">${titel}</div><div class="gross">${runde(w.temp)}°</div><div class="leise">${text} · gefühlt ${runde(w.gefuehlt)}°</div></div></div>
      <div class="werte">
        <div><b>${runde(w.wind)}</b>km/h Wind</div><div><b>${w.regenW ?? 0} %</b>Regen</div>
        <div><b>${(w.uv ?? 0).toFixed(0)}</b>UV-Index</div><div><b>${runde(d.daily.temperature_2m_min[0])}–${runde(d.daily.temperature_2m_max[0])}°</b>heute</div>
      </div>
      <h3 class="klein leise" style="font-weight:600">Für später planen – Stunde antippen</h3>
      <div class="stunden">
        <div class="stunde ${wetterStunde === null ? 'an' : ''}" onclick="wetterStunde=null;zeigeWetter()"><span class="leise">Jetzt</span><span class="e">${wmo(d.current.weather_code, d.current.is_day)[0]}</span><b>${runde(d.current.temperature_2m)}°</b></div>
        ${idx.slice(1).map(i => `<div class="stunde ${wetterStunde === i ? 'an' : ''}" onclick="wetterStunde=${i};zeigeWetter()"><span class="leise">${h.time[i].slice(11, 13)} Uhr</span><span class="e">${wmo(h.weather_code[i], h.is_day[i])[0]}</span><b>${runde(h.temperature_2m[i])}°</b></div>`).join('')}
      </div>
      <p class="leise klein" style="margin:4px 0 0">Stand ${uhr(c.zeit)} · <button class="link" style="color:var(--wetter)" onclick="wetterAbrufen(true)">${wetterLaden ? 'lädt …' : 'aktualisieren'}</button>${wetterFehler ? ' · <span class="fehler">' + esc(wetterFehler) + '</span>' : ''}</p>
    </div>

    <div class="karte"><h2>Was ziehe ich ${esc(babyName())} an?</h2>
      <div class="reiter">
        <button class="${tr === 'wagen' ? 'an' : ''}" onclick="transportSetzen('wagen')">Kinderwagen</button>
        <button class="${tr === 'trage' ? 'an' : ''}" onclick="transportSetzen('trage')">Trage</button>
        <button class="${tr === 'auto' ? 'an' : ''}" onclick="transportSetzen('auto')">Auto</button>
      </div>
      <p style="margin:14px 0 4px"><span class="stufe">${k.stufe}</span> <span class="leise klein">nach gefühlten ${runde(w.gefuehlt)}°${alterNotiz}</span></p>
      <ul class="outfit">${k.teile.map(([e, t]) => `<li><span class="e">${e}</span><span>${esc(t)}</span></li>`).join('')}</ul>
      <ul class="hinweise">${k.hinweise.map(([cls, t]) => `<li class="${cls}">${esc(t)}</li>`).join('')}</ul>
    </div>

    <div class="karte"><h2>Heute Nacht im Schlafsack</h2>
      <p class="leise klein" style="margin:0">Wie warm ist es im Schlafzimmer? (ideal 16–20 °C)</p>
      <div class="regler"><button onclick="zimmer(-1)" aria-label="kälter">−</button><div class="wert">${z} °C</div><button onclick="zimmer(1)" aria-label="wärmer">+</button></div>
      <div class="tog"><div class="zahl"><div><b>${sack.tog}</b>TOG</div></div>
        <div><b>Schlafsack mit ${sack.tog} TOG</b><div class="leise">darunter: ${sack.text}</div></div></div>
      <ul class="hinweise">
        ${sack.warn ? `<li class="wichtig">${sack.warn}</li>` : ''}
        <li>Im Bett keine Mütze, keine Decke, kein Kissen – der Schlafsack reicht. Draußen ist es nachts ${runde(d.daily.temperature_2m_min[1] ?? d.daily.temperature_2m_min[0])}° kalt.</li>
      </ul>
    </div>
    <p class="fuss-hinweis">Wetterdaten: Open-Meteo.com. Kleidung und TOG sind Richtwerte – jedes Baby empfindet anders.</p>`;
}
function bindeSuche() {
  const f = $('#ort-form'); if (!f) return;
  f.onsubmit = ev => { ev.preventDefault(); const q = f.q.value.trim(); if (q.length >= 2) ortSuchen(q); };
}
function transportSetzen(t) { S.wetter.transport = t; speichern(); zeigeWetter(); }
function zimmer(d) { S.wetter.zimmer = Math.min(30, Math.max(12, S.wetter.zimmer + d)); speichern(); zeigeWetter(); }
