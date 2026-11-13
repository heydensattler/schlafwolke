/* Schlafwolke – Beikost-Plan: Lebensmittel sammeln, Allergene, Breiplan nach Alter */
'use strict';

const ALLERGENE = {
  ei: 'Ei', erdnuss: 'Erdnuss', milch: 'Kuhmilch', gluten: 'Weizen/Gluten', fisch: 'Fisch',
  sesam: 'Sesam', soja: 'Soja', baumnuss: 'Baumnüsse', schalentiere: 'Schalentiere',
};
// Name|Allergen  ·  Zusatz „!“ = erst ab 1 Jahr
const KATALOG = {
  'Gemüse': ['Karotte', 'Pastinake', 'Kürbis', 'Zucchini', 'Brokkoli', 'Blumenkohl', 'Süßkartoffel', 'Fenchel', 'Spinat', 'Erbsen',
    'Mais', 'Rote Bete', 'Kohlrabi', 'Spargel', 'Paprika', 'Tomate', 'Gurke', 'Avocado', 'Aubergine', 'Grüne Bohnen', 'Lauch',
    'Zwiebel', 'Knoblauch', 'Sellerie', 'Rosenkohl', 'Grünkohl', 'Mangold', 'Rotkohl', 'Weißkohl', 'Wirsing', 'Champignons',
    'Steckrübe', 'Petersilienwurzel', 'Topinambur', 'Radieschen', 'Artischocke'],
  'Obst': ['Apfel', 'Birne', 'Banane', 'Pfirsich', 'Aprikose', 'Nektarine', 'Pflaume', 'Mango', 'Honigmelone', 'Wassermelone',
    'Erdbeere', 'Heidelbeere', 'Himbeere', 'Brombeere', 'Kirsche', 'Weintraube', 'Kiwi', 'Orange', 'Mandarine', 'Ananas',
    'Papaya', 'Feige', 'Dattel', 'Granatapfel', 'Johannisbeere', 'Kaki', 'Quitte'],
  'Getreide & Kartoffel': ['Kartoffel', 'Haferflocken|gluten', 'Hirse', 'Reis', 'Dinkel|gluten', 'Weizen|gluten', 'Gerste|gluten',
    'Roggen|gluten', 'Buchweizen', 'Quinoa', 'Amaranth', 'Polenta', 'Couscous|gluten', 'Bulgur|gluten', 'Nudeln|gluten',
    'Brot|gluten', 'Grieß|gluten'],
  'Fleisch, Fisch & Ei': ['Rind', 'Kalb', 'Schwein', 'Lamm', 'Hähnchen', 'Pute', 'Lachs|fisch', 'Forelle|fisch', 'Kabeljau|fisch',
    'Seelachs|fisch', 'Ei|ei', 'Garnelen|schalentiere'],
  'Hülsenfrüchte & Soja': ['Rote Linsen', 'Kichererbsen', 'Weiße Bohnen', 'Kidneybohnen', 'Tofu|soja', 'Edamame|soja'],
  'Milchprodukte': ['Naturjoghurt|milch', 'Quark|milch', 'Frischkäse|milch', 'Butter|milch', 'Milder Käse|milch',
    'Mozzarella|milch', 'Ricotta|milch', 'Kuhmilch als Getränk|milch!'],
  'Nüsse, Samen & Öle': ['Erdnussmus|erdnuss', 'Mandelmus|baumnuss', 'Cashewmus|baumnuss', 'Haselnussmus|baumnuss',
    'Walnuss gemahlen|baumnuss', 'Tahin (Sesammus)|sesam', 'Leinsamen gemahlen', 'Chiasamen', 'Kürbiskerne gemahlen',
    'Sonnenblumenkerne gemahlen', 'Rapsöl', 'Olivenöl', 'Kokos'],
  'Kräuter & Gewürze': ['Petersilie', 'Dill', 'Basilikum', 'Schnittlauch', 'Minze', 'Oregano', 'Thymian', 'Zimt', 'Kreuzkümmel',
    'Paprikapulver mild', 'Kurkuma', 'Ingwer', 'Vanille', 'Honig!'],
};
// Name sicher in ein onclick-Attribut setzen
const jsArg = n => `decodeURIComponent('${encodeURIComponent(n).replace(/'/g, '%27')}')`;
const REAKTION = { mag: ['😋', 'mag es'], neutral: ['😐', 'geht so'], nein: ['🙅', 'mag es nicht'], reaktion: ['⚠️', 'Reaktion'] };

function lebensmittelListe() {
  const liste = [];
  for (const [kat, arr] of Object.entries(KATALOG)) for (const roh of arr) {
    const ab1 = roh.endsWith('!');
    const [n, all] = roh.replace('!', '').split('|');
    liste.push({ n, kat, allergen: all || null, ab1 });
  }
  for (const e of S.beikost.eigene || []) if (!liste.some(x => x.n.toLowerCase() === e.n.toLowerCase())) liste.push({ n: e.n, kat: 'Eigene', allergen: e.allergen || null, ab1: false });
  return liste;
}
// Name → [{ms, r, id}] aus den Beikost-Einträgen
function versuche() {
  const m = {};
  for (const e of S.essen) if (e.art === 'beikost') for (const x of e.lebensmittel || []) (m[x.n] ||= []).push({ ms: e.start, r: x.r || '', id: e.id });
  for (const k in m) m[k].sort((a, b) => a.ms - b.ms);
  return m;
}
function beikostStart() {
  if (S.beikost.start) return new Date(S.beikost.start + 'T00:00').getTime();
  const erste = sortiert(S.essen).find(e => e.art === 'beikost');
  return erste ? tagAnfang(erste.start) : null;
}

/* ---------- Breiplan nach Alter ---------- */
function breiplan() {
  const w = alterWochen(), start = beikostStart();
  if (w === null) return { titel: 'Baby eintragen', text: 'Trag unter „Baby“ den Geburtstag ein, dann zeigt der Plan, was gerade dran ist.', schritte: [] };
  const schritte = [
    ['Mittags: Gemüse-Kartoffel-Fleisch-Brei', 'Woche 1 nur ein Gemüse (z. B. Karotte, Pastinake, Kürbis), Woche 2 mit Kartoffel und 1 TL Rapsöl, ab Woche 3 mit Fleisch. 1× pro Woche Fisch statt Fleisch, vegetarisch mit Haferflocken.'],
    ['Abends: Milch-Getreide-Brei', 'Ca. einen Monat später ersetzt er die Abendmahlzeit. Vollmilch nur im Brei, nicht als Getränk.'],
    ['Nachmittags: Getreide-Obst-Brei', 'Wieder ca. einen Monat später. Ohne Milch, mit etwas Öl und Vitamin-C-reichem Obst.'],
    ['Familienkost', 'Ab etwa 10 Monaten: 3 Hauptmahlzeiten und 2 kleine Zwischenmahlzeiten, weiche Stücke vom Familientisch, Wasser aus dem Becher. Ohne Salz und Zucker.'],
  ];
  if (!start) {
    if (w < 17) return { titel: 'Noch keine Beikost', text: 'Beikost frühestens ab Beginn des 5. Monats. Bis dahin reicht Milch.', schritte, stufe: -1 };
    return { titel: 'Bereit für Beikost?', text: 'Zwischen Beginn des 5. und 7. Monats, wenn dein Baby mit Hilfe aufrecht sitzt, den Kopf sicher hält, Interesse am Essen zeigt und Brei nicht mehr mit der Zunge herausschiebt. Den Start legst du mit dem ersten Beikost-Eintrag fest.', schritte, stufe: 0 };
  }
  const monate = (Date.now() - start) / (30 * TAG);
  let stufe = monate < 1 ? 0 : monate < 2 ? 1 : 2;
  if (w >= 43) stufe = 3;
  const tage = Math.floor((Date.now() - start) / TAG);
  return { titel: schritte[stufe][0], text: `Beikost seit ${tage === 0 ? 'heute' : tage === 1 ? '1 Tag' : tage + ' Tagen'}. ` + schritte[stufe][1], schritte, stufe };
}

/* ---------- Ansicht ---------- */
let bkKatOffen = null;
function zeigeBeikost() {
  const liste = lebensmittelListe(), v = versuche(), ziel = +S.beikost.ziel || 100;
  const probiert = liste.filter(l => v[l.n]);
  const extra = Object.keys(v).filter(n => !liste.some(l => l.n === n)); // z. B. umbenannt/gelöscht
  const anzahl = probiert.length + extra.length;
  const kostproben = Object.values(v).reduce((a, x) => a + x.length, 0);
  const anteil = Math.min(1, anzahl / ziel);
  const U = 2 * Math.PI * 52;
  const plan = breiplan();
  const woche = alterWochen() ?? 99;

  // Allergene
  const allerg = Object.entries(ALLERGENE).map(([k, name]) => {
    const n = liste.filter(l => l.allergen === k).reduce((a, l) => a + (v[l.n]?.length || 0), 0);
    const reakt = liste.some(l => l.allergen === k && v[l.n]?.some(x => x.r === 'reaktion'));
    const letzt = Math.max(0, ...liste.filter(l => l.allergen === k).flatMap(l => (v[l.n] || []).map(x => x.ms)));
    const lange = letzt && Date.now() - letzt > 14 * TAG;
    const st = reakt ? ['⚠️', 'Reaktion – mit Kinderärztin besprechen'] : n === 0 ? ['○', 'noch nicht'] : n < 3 ? ['◐', `${n}× probiert`] : lange ? ['◑', `${n}× · länger nicht mehr`] : ['●', `${n}× · regelmäßig`];
    return `<li class="${reakt ? 'warn' : n ? 'ok' : ''}"><span class="e">${st[0]}</span><span class="haupt">${name}</span><span class="neben">${st[1]}</span></li>`;
  }).join('');

  // Ideen: noch nicht probierte, aus den Gruppen mit dem kleinsten Anteil
  const kats = Object.keys(KATALOG);
  const quote = k => { const a = liste.filter(l => l.kat === k); return a.filter(l => v[l.n]).length / a.length; };
  const offen = kats.map(k => liste.filter(l => l.kat === k && !v[l.n] && !(l.ab1 && woche < 52))).filter(a => a.length);
  offen.sort((a, b) => quote(a[0].kat) - quote(b[0].kat));
  const tag = Math.floor(Date.now() / TAG), ideen = [];
  for (let i = 0; ideen.length < 6 && i < 30; i++) { const a = offen[i % offen.length]; if (!a) break; const x = a[(tag + Math.floor(i / offen.length)) % a.length]; if (x && !ideen.includes(x)) ideen.push(x); }

  const gruppen = [...kats, ...(S.beikost.eigene?.length ? ['Eigene'] : [])].map(k => {
    const a = liste.filter(l => l.kat === k), p = a.filter(l => v[l.n]).length;
    const auf = bkKatOffen === k;
    return `<div class="bk-gruppe"><button class="bk-kopf" onclick="bkKatOffen=${auf ? 'null' : `'${k}'`};zeigeEssen()">
        <span>${k}</span><span class="leise klein">${p} / ${a.length} ${auf ? '▴' : '▾'}</span></button>
        <div class="bk-balken"><i style="width:${a.length ? p / a.length * 100 : 0}%"></i></div>
        ${auf ? `<div class="chips">${a.map(l => chip(l, v)).join('')}</div>` : ''}</div>`;
  }).join('');

  return `<div class="karte bk-fortschritt">
      <svg viewBox="0 0 120 120" class="ring"><circle cx="60" cy="60" r="52" class="spur"/><circle cx="60" cy="60" r="52" class="wert" stroke-dasharray="${U}" stroke-dashoffset="${U * (1 - anteil)}"/></svg>
      <div><div class="gross">${anzahl}<span class="leise" style="font-size:20px"> / ${ziel}</span></div>
        <div class="leise">verschiedene Lebensmittel probiert</div>
        <div class="leise klein">${kostproben} Kostproben insgesamt · <button class="link" onclick="bkZiel()">Ziel ändern</button></div></div>
    </div>
    <button class="knopf essen breit" onclick="beikostDialog()">🥣 Heute probiert …</button>

    <div class="karte"><h2>Was ist gerade dran?</h2>
      <p class="mittel" style="margin:0 0 6px">${esc(plan.titel)}</p><p class="leise" style="margin:0">${esc(plan.text)}</p>
      ${plan.schritte.length ? `<ol class="bk-plan">${plan.schritte.map((s, i) => `<li class="${i < plan.stufe ? 'fertig' : i === plan.stufe ? 'jetzt' : ''}">${esc(s[0])}</li>`).join('')}</ol>` : ''}
      <p class="leise klein" style="margin:8px 0 0">Fingerfood (weiche Stücke, die sich zwischen Daumen und Zeigefinger zerdrücken lassen) kannst du parallel anbieten. Beikoststart: ${beikostStart() ? new Date(beikostStart()).toLocaleDateString('de-DE') : 'noch nicht'} · <button class="link" onclick="bkStartDialog()">ändern</button></p>
    </div>

    ${ideen.length ? `<div class="karte"><h2>Ideen für die nächsten Tage</h2><div class="chips">${ideen.map(l => chip(l, v)).join('')}</div>
      <p class="leise klein" style="margin:8px 0 0">Neues am besten einzeln und vormittags anbieten. Was nicht schmeckt, ruhig 8–15 Mal wieder probieren.</p></div>` : ''}

    <div class="karte"><h2>Allergene</h2>
      <ul class="liste bk-allergene">${allerg}</ul>
      <p class="leise klein" style="margin:8px 0 0">Allergene später einzuführen schützt nach heutigem Wissen nicht vor Allergien. Einzeln, in kleinen Mengen und danach regelmäßig geben. Erdnuss und Nüsse nur als Mus oder gemahlen, nie ganz. Bei Neurodermitis oder Allergien in der Familie vorher mit der Kinderärztin sprechen.</p>
    </div>

    <div class="karte"><h2>Alle Lebensmittel</h2>${gruppen}
      <p class="leise klein" style="margin:10px 0 0">Antippen zeigt, wann es das Lebensmittel gab. ${woche < 52 ? 'Mit 🔒 markiert: erst ab 1 Jahr (Honig, Kuhmilch als Getränk).' : ''}</p></div>`;
}
function chip(l, v) {
  const x = v[l.n], letzte = x && x[x.length - 1].r;
  const sym = x ? (REAKTION[letzte]?.[0] || '✓') : l.ab1 ? '🔒' : '';
  return `<button type="button" class="chip ${x ? 'probiert' : ''} ${letzte === 'reaktion' ? 'warn' : ''}" onclick="lebensmittelDialog(${jsArg(l.n)})">${sym ? sym + ' ' : ''}${esc(l.n)}${x && x.length > 1 ? ` <small>${x.length}×</small>` : ''}</button>`;
}

function bkZiel() {
  const z = prompt('Wie viele verschiedene Lebensmittel sollen es werden?', S.beikost.ziel || 100);
  if (z === null) return;
  const n = parseInt(z, 10);
  if (n > 0 && n < 10000) { S.beikost.ziel = n; speichern(); zeigeEssen(); }
}
function bkStartDialog() {
  dialog(`<h2>Beikoststart</h2><p class="leise klein">Ohne Angabe gilt der Tag des ersten Beikost-Eintrags.</p>
    <label class="feld">Datum<input type="date" name="start" value="${esc(S.beikost.start || '')}" max="${tagKey(Date.now())}"></label>
    <div class="dlg-knoepfe"><button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf essen" value="ok">Speichern</button></div>`,
    (k, f) => { S.beikost.start = f.start.value; });
}

/* ---------- Ein Lebensmittel ---------- */
function lebensmittelDialog(name) {
  const l = lebensmittelListe().find(x => x.n === name) || { n: name, kat: 'Eigene' };
  const x = versuche()[name] || [];
  const zaehl = r => x.filter(y => y.r === r).length;
  dialog(`<h2>${esc(name)}</h2>
    <p class="leise klein" style="margin:0">${esc(l.kat)}${l.allergen ? ' · Allergen: ' + ALLERGENE[l.allergen] : ''}${l.ab1 ? ' · <b>erst ab 1 Jahr</b>' : ''}</p>
    ${x.length ? `<p>${x.length}× probiert · ${Object.entries(REAKTION).filter(([r]) => zaehl(r)).map(([r, [e]]) => `${e} ${zaehl(r)}`).join(' · ')}</p>
      <ul class="liste">${[...x].reverse().slice(0, 10).map(y => `<li onclick="document.querySelector('#dlg').close();beikostDialog('${y.id}')"><div class="sym essen">${REAKTION[y.r]?.[0] || '🥄'}</div>
        <div class="haupt">${WT[new Date(y.ms).getDay()]} ${new Date(y.ms).toLocaleDateString('de-DE')}</div><div class="neben">${REAKTION[y.r]?.[1] || ''}</div></li>`).join('')}</ul>`
      : '<p class="leise">Noch nicht probiert.</p>'}
    ${x.length && zaehl('nein') && !zaehl('mag') ? '<p class="leise klein">Nicht aufgeben: Viele Babys brauchen 8–15 Versuche, bis ihnen etwas schmeckt.</p>' : ''}
    <div class="dlg-knoepfe"><button class="knopf rand" value="abbrechen" formnovalidate>Schließen</button><button class="knopf essen" value="neu" ${l.ab1 && (alterWochen() ?? 99) < 52 ? 'disabled' : ''}>Heute probiert</button></div>`,
    k => { if (k === 'neu') setTimeout(() => beikostDialog(null, [name]), 0); return; });
}

/* ---------- Beikost-Eintrag ---------- */
let bkAuswahl = [];
function beikostDialog(id, vorauswahl) {
  const e = id ? S.essen.find(x => x.id === id) : null;
  bkAuswahl = e ? (e.lebensmittel || []).map(x => ({ ...x })) : (vorauswahl || []).map(n => ({ n, r: '' }));
  const start = e ? e.start : Date.now();
  dialog(`<h2>🥣 ${e ? 'Beikost bearbeiten' : 'Beikost'}</h2>
    <label class="feld">Uhrzeit<input type="datetime-local" name="start" value="${inputWert(start)}" required></label>
    <div id="bk-auswahl"></div>
    <label class="feld">Lebensmittel suchen oder neu anlegen<input name="suche" id="bk-suche" autocomplete="off" placeholder="z. B. Karotte" oninput="bkChips()" onkeydown="if(event.key==='Enter'){event.preventDefault();bkSucheEnter()}"></label>
    <div id="bk-chips" class="chips bk-wahl"></div>
    <label class="feld">Notiz (optional)<input name="notiz" value="${esc(e?.notiz || '')}" placeholder="z. B. halbes Gläschen, als Fingerfood"></label>
    <div class="dlg-knoepfe">${e ? '<button class="knopf gefahr" value="loeschen">Löschen</button>' : ''}<button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf essen" value="ok">Speichern</button></div>`,
    (k, f) => {
      if (k === 'loeschen') { if (!confirm('Eintrag wirklich löschen?')) return 'Nicht gelöscht.'; S.essen = S.essen.filter(x => x !== e); return; }
      const st = ausInput(f.start.value);
      if (!st) return 'Bitte eine Zeit angeben.';
      if (st > Date.now() + MIN) return 'Die Zeit liegt in der Zukunft.';
      if (!bkAuswahl.length && !f.notiz.value.trim()) return 'Bitte mindestens ein Lebensmittel wählen.';
      const d = { art: 'beikost', start: st, ende: st, lebensmittel: bkAuswahl, notiz: f.notiz.value.trim() };
      if (e) Object.assign(e, d); else S.essen.push({ id: neueId(), ...d });
    });
  bkAuswahlZeigen(); bkChips();
}
function bkAuswahlZeigen() {
  const el = $('#bk-auswahl'); if (!el) return;
  el.innerHTML = bkAuswahl.length ? `<p class="leise klein" style="margin:10px 0 4px">Wie hat es geschmeckt?</p><ul class="liste">${bkAuswahl.map((x, i) => `<li style="cursor:default">
      <div class="haupt"><b>${esc(x.n)}</b></div>
      <div class="bk-reakt">${Object.entries(REAKTION).map(([r, [sym, t]]) => `<button type="button" title="${t}" class="${x.r === r ? 'an' : ''}" onclick="bkAuswahl[${i}].r=bkAuswahl[${i}].r==='${r}'?'':'${r}';bkAuswahlZeigen()">${sym}</button>`).join('')}
        <button type="button" title="entfernen" onclick="bkAuswahl.splice(${i},1);bkAuswahlZeigen();bkChips()">✕</button></div></li>`).join('')}</ul>` : '';
}
function bkChips() {
  const el = $('#bk-chips'); if (!el) return;
  const q = ($('#bk-suche')?.value || '').trim().toLowerCase();
  const v = versuche(), gew = new Set(bkAuswahl.map(x => x.n));
  let liste = lebensmittelListe().filter(l => !gew.has(l.n));
  if (q) liste = liste.filter(l => l.n.toLowerCase().includes(q));
  else liste = [...liste.filter(l => v[l.n]).sort((a, b) => v[b.n].at(-1).ms - v[a.n].at(-1).ms).slice(0, 12), ...liste.filter(l => !v[l.n] && !l.ab1).slice(0, 18)];
  const neu = q && !lebensmittelListe().some(l => l.n.toLowerCase().startsWith(q));
  el.innerHTML = (q ? '' : '<p class="leise klein" style="width:100%;margin:0">Zuletzt gegeben und neue Ideen – oder oben suchen:</p>')
    + liste.slice(0, 40).map(l => `<button type="button" class="chip ${v[l.n] ? 'probiert' : ''}" onclick="bkWaehlen(${jsArg(l.n)})">${l.ab1 ? '🔒 ' : ''}${esc(l.n)}</button>`).join('')
    + (neu ? `<button type="button" class="chip neu" onclick="bkSucheEnter()">+ „${esc($('#bk-suche').value.trim())}“ neu anlegen</button>` : '');
}
function bkWaehlen(n) {
  const l = lebensmittelListe().find(x => x.n === n);
  if (l?.ab1 && (alterWochen() ?? 99) < 52 && !confirm(`${n} erst ab 1 Jahr. Trotzdem eintragen?`)) return;
  bkAuswahl.push({ n, r: '' }); $('#bk-suche').value = ''; bkAuswahlZeigen(); bkChips();
}
function bkSucheEnter() {
  const roh = $('#bk-suche').value.trim(); if (!roh) return;
  const treffer = lebensmittelListe().find(l => l.n.toLowerCase() === roh.toLowerCase())
    || (lebensmittelListe().filter(l => l.n.toLowerCase().includes(roh.toLowerCase())).length === 1 && lebensmittelListe().find(l => l.n.toLowerCase().includes(roh.toLowerCase())));
  if (treffer) return bkWaehlen(treffer.n);
  const n = roh.charAt(0).toUpperCase() + roh.slice(1);
  (S.beikost.eigene ||= []).push({ n });
  bkWaehlen(n);
}
