/* Schlafwolke – Kosten: Ausgaben, wer gezahlt hat, Zuschüsse („Töpfe“) mit Restbetrag */
'use strict';

const KOSTEN_KAT = {
  ausstattung: ['🛏️', 'Ausstattung & Möbel'], unterwegs: ['🚼', 'Kinderwagen & Unterwegs'], kleidung: ['👕', 'Kleidung'],
  pflege: ['🧴', 'Pflege & Windeln'], essen: ['🍼', 'Ernährung'], spielen: ['🧸', 'Spielzeug & Bücher'],
  gesundheit: ['🩺', 'Gesundheit & Arzt'], kurse: ['🎓', 'Kurse & Betreuung'], sonstiges: ['📦', 'Sonstiges'],
};
function kostenDaten() {
  S.kosten ||= {};
  const k = S.kosten;
  k.personen ||= [{ id: 'mama', name: 'Mama' }, { id: 'papa', name: 'Papa' }];
  k.toepfe ||= []; k.ausgaben ||= [];
  return k;
}
// „1.500“, „1500,50“, „1.500,50 €“, „19.99“ → Zahl
function betragZahl(v) {
  let s = String(v ?? '').replace(/[\s€]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}
const euro = n => (Math.round(n * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2, maximumFractionDigits: 2 }) + ' €';
const eingabeEuro = n => n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ',');
const personName = id => kostenDaten().personen.find(p => p.id === id)?.name || 'unbekannt';
const topfName = id => kostenDaten().toepfe.find(t => t.id === id)?.name || 'gelöschter Zuschuss';
const ausTopf = a => (a.anteile || []).reduce((s, x) => s + (x.betrag || 0), 0);
const eigenAnteil = a => Math.max(0, Math.round((a.betrag - ausTopf(a)) * 100) / 100);
function topfStand(t) {
  const genutzt = kostenDaten().ausgaben.flatMap(a => (a.anteile || []).filter(x => x.topf === t.id).map(x => ({ a, betrag: x.betrag })));
  const verbraucht = genutzt.reduce((s, x) => s + x.betrag, 0);
  return { genutzt, verbraucht, rest: Math.round((t.betrag - verbraucht) * 100) / 100 };
}

let kostenFilter = '';
function zeigeKosten() {
  const k = kostenDaten(), aus = [...k.ausgaben].sort((x, y) => y.datum.localeCompare(x.datum));
  const gesamt = aus.reduce((s, a) => s + a.betrag, 0), zusch = aus.reduce((s, a) => s + ausTopf(a), 0);
  const zuschGesamt = k.toepfe.reduce((s, t) => s + t.betrag, 0), restGesamt = k.toepfe.reduce((s, t) => s + topfStand(t).rest, 0);

  // Töpfe
  const toepfe = k.toepfe.map(t => {
    const st = topfStand(t), anteil = t.betrag ? Math.min(1, st.verbraucht / t.betrag) : 0;
    return `<div class="topf ${st.rest < 0 ? 'ueber' : ''}" onclick="topfDialog('${t.id}')">
      <div class="topf-kopf"><div><b>${esc(t.name)}</b><div class="leise klein">${t.von ? 'von ' + esc(t.von) + ' · ' : ''}${euro(t.betrag)}${t.datum ? ' · ' + datumDE(new Date(t.datum + 'T12:00').getTime()) : ''}</div></div>
        <div class="topf-rest"><span class="leise klein">${st.rest < 0 ? 'überzogen' : 'noch übrig'}</span><b>${euro(Math.abs(st.rest))}</b></div></div>
      <div class="bk-balken"><i style="width:${anteil * 100}%"></i></div>
      ${st.genutzt.length ? `<ul class="topf-liste">${st.genutzt.map(x => `<li><span>${esc(x.a.titel)}</span><span>${euro(x.betrag)}</span></li>`).join('')}</ul>` : '<p class="leise klein" style="margin:6px 0 0">Noch nichts davon ausgegeben.</p>'}
    </div>`;
  }).join('');

  // Je Kategorie und Person
  const jeKat = {}; for (const a of aus) jeKat[a.kategorie] = (jeKat[a.kategorie] || 0) + a.betrag;
  const maxKat = Math.max(1, ...Object.values(jeKat));
  const katHtml = Object.entries(jeKat).sort((a, b) => b[1] - a[1]).map(([kat, s]) => `<div class="kat-zeile" onclick="kostenFilter=kostenFilter==='${kat}'?'':'${kat}';zeigeProfil()">
      <span>${KOSTEN_KAT[kat]?.[0] || '📦'} ${KOSTEN_KAT[kat]?.[1] || 'Sonstiges'}</span><b>${euro(s)}</b>
      <div class="bk-balken"><i style="width:${s / maxKat * 100}%"></i></div></div>`).join('');
  const jeP = {}; for (const a of aus) if (eigenAnteil(a) > 0) jeP[a.zahler] = (jeP[a.zahler] || 0) + eigenAnteil(a);
  const jeT = {}; for (const a of aus) for (const x of a.anteile || []) jeT[x.topf] = (jeT[x.topf] || 0) + x.betrag;
  const getragen = [
    ...k.personen.map(p => [p.name, jeP[p.id] || 0, 'eigenes Geld']),
    ...Object.entries(jeP).filter(([id]) => !k.personen.some(p => p.id === id)).map(([id, s]) => ['unbekannt', s, '']),
    ...Object.entries(jeT).map(([id, s]) => [topfName(id), s, 'aus Zuschuss']),
  ].filter(x => x[1] > 0 || x[2] === 'eigenes Geld');
  let ausgleich = '';
  if (k.personen.length === 2) {
    const [p1, p2] = k.personen, d = ((jeP[p1.id] || 0) - (jeP[p2.id] || 0)) / 2;
    if (Math.abs(d) >= 1) ausgleich = `<p class="leise klein" style="margin:8px 0 0">Bei halbe-halbe müsste ${esc(d > 0 ? p2.name : p1.name)} noch <b>${euro(Math.abs(d))}</b> an ${esc(d > 0 ? p1.name : p2.name)} ausgleichen.</p>`;
  }

  const liste = aus.filter(a => !kostenFilter || a.kategorie === kostenFilter);
  let listHtml = '', monat = '';
  for (const a of liste) {
    const m = new Date(a.datum + 'T12:00').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    if (m !== monat) { monat = m; listHtml += `<li class="monat">${m}</li>`; }
    const wer = [...(a.anteile || []).map(x => `${euro(x.betrag)} aus ${esc(topfName(x.topf))}`), ...(eigenAnteil(a) > 0 ? [`${(a.anteile || []).length ? euro(eigenAnteil(a)) + ' ' : ''}${esc(personName(a.zahler))}`] : [])].join(' · ');
    listHtml += `<li onclick="ausgabeDialog('${a.id}')"><div class="sym kosten">${KOSTEN_KAT[a.kategorie]?.[0] || '📦'}</div>
      <div class="haupt"><b>${esc(a.titel)}</b><div class="leise klein">${new Date(a.datum + 'T12:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} · ${wer}</div></div>
      <div class="neben"><b>${euro(a.betrag)}</b></div></li>`;
  }

  return `<div class="knoepfe" style="margin-top:12px">
      <button class="knopf kosten" onclick="ausgabeDialog()">+ Ausgabe</button>
      <button class="knopf kosten zweit" onclick="topfDialog()">+ Zuschuss</button></div>
    <div class="karte"><h2>Überblick</h2>
      <div class="kacheln">
        <div class="kachel"><div class="wert">${euro(gesamt)}</div><div class="bez">ausgegeben</div></div>
        <div class="kachel"><div class="wert">${euro(gesamt - zusch)}</div><div class="bez">aus eigener Tasche</div></div>
        <div class="kachel"><div class="wert">${euro(zuschGesamt)}</div><div class="bez">Zuschüsse erhalten</div></div>
        <div class="kachel"><div class="wert ${restGesamt < 0 ? 'minus' : ''}">${euro(restGesamt)}</div><div class="bez">davon noch übrig</div></div>
      </div></div>
    ${k.toepfe.length ? `<div class="karte"><h2>Zuschüsse &amp; Geldgeschenke</h2>${toepfe}</div>`
      : `<div class="karte"><h2>Zuschüsse &amp; Geldgeschenke</h2><p class="leise" style="margin:0">Habt ihr Geld bekommen, z. B. 2.000 € von den Großeltern? Leg es als Zuschuss an. Ausgaben daraus ziehen den Betrag ab, und hier steht immer, was noch übrig ist.</p></div>`}
    ${aus.length ? `<div class="karte"><h2>Wer hat was getragen?</h2>
      <ul class="liste">${getragen.map(([n, s, art]) => `<li style="cursor:default"><div class="haupt"><b>${esc(n)}</b><div class="leise klein">${art}</div></div><div class="neben"><b>${euro(s)}</b></div></li>`).join('')}</ul>
      ${ausgleich}<button class="link" style="margin-top:8px;color:var(--kosten)" onclick="personenDialog()">Personen bearbeiten</button></div>
    <div class="karte"><h2>Nach Kategorie</h2>${katHtml}<p class="leise klein" style="margin:8px 0 0">Antippen filtert die Liste unten.</p></div>` : ''}
    <div class="karte"><h2>Ausgaben${kostenFilter ? ' · ' + KOSTEN_KAT[kostenFilter][1] + ` <button class="link" style="color:var(--kosten)" onclick="kostenFilter='';zeigeProfil()">alle zeigen</button>` : ''}</h2>
      <ul class="liste kosten-liste">${listHtml || '<li class="plan">Noch keine Ausgaben eingetragen.</li>'}</ul></div>`;
}

function personOptionen(wahl) {
  return kostenDaten().personen.map(p => `<option value="${p.id}" ${wahl === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
}
function ausgabeDialog(id) {
  const k = kostenDaten(), a = id ? k.ausgaben.find(x => x.id === id) : null;
  const anteil = a?.anteile?.[0];
  const letzterZahler = [...k.ausgaben].sort((x, y) => x.datum.localeCompare(y.datum)).filter(x => eigenAnteil(x) > 0).at(-1)?.zahler || k.personen[0]?.id;
  const topfOpt = k.toepfe.map(t => { const r = topfStand(t).rest + (anteil?.topf === t.id ? anteil.betrag : 0);
    return `<option value="${t.id}" data-rest="${r}" ${anteil?.topf === t.id ? 'selected' : ''}>${esc(t.name)} (übrig ${euro(r)})</option>`; }).join('');
  dialog(`<h2>🧾 ${a ? 'Ausgabe bearbeiten' : 'Neue Ausgabe'}</h2>
    <label class="feld">Was?<input name="titel" value="${esc(a?.titel || '')}" placeholder="z. B. Kinderwagen" required></label>
    <div class="zeile2"><label class="feld">Betrag (€)<input name="betrag" inputmode="decimal" value="${eingabeEuro(a?.betrag)}" placeholder="z. B. 1.800" required oninput="kostenTopfVorschlag()"></label>
      <label class="feld">Datum<input type="date" name="datum" value="${esc(a?.datum || tagKey(Date.now()))}" required></label></div>
    <label class="feld">Kategorie<select name="kategorie">${Object.entries(KOSTEN_KAT).map(([key, [e, n]]) => `<option value="${key}" ${(a?.kategorie || 'ausstattung') === key ? 'selected' : ''}>${e} ${n}</option>`).join('')}</select></label>
    ${k.toepfe.length ? `<div class="zeile2"><label class="feld">Aus Zuschuss bezahlt<select name="topf" onchange="kostenTopfVorschlag(true)"><option value="">– nein –</option>${topfOpt}</select></label>
      <label class="feld">davon (€)<input name="anteil" inputmode="decimal" value="${eingabeEuro(anteil?.betrag)}" placeholder="0"></label></div>` : ''}
    <label class="feld">${k.toepfe.length ? 'Den Rest hat bezahlt' : 'Bezahlt von'}<select name="zahler">${personOptionen(a?.zahler || letzterZahler)}</select></label>
    <label class="feld">Notiz (optional)<input name="notiz" value="${esc(a?.notiz || '')}" placeholder="z. B. gebraucht gekauft, Garantie bis 2028"></label>
    <div class="dlg-knoepfe">${a ? '<button class="knopf gefahr" value="loeschen">Löschen</button>' : ''}<button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf kosten" value="ok">Speichern</button></div>`,
    (knopf, f) => {
      if (knopf === 'loeschen') { if (!confirm('Ausgabe löschen?')) return 'Nicht gelöscht.'; k.ausgaben = k.ausgaben.filter(x => x !== a); return; }
      const betrag = betragZahl(f.betrag.value);
      if (!f.titel.value.trim()) return 'Bitte angeben, wofür das Geld war.';
      if (!betrag) return 'Bitte einen Betrag eingeben, z. B. 1.500 oder 19,99.';
      if (!f.datum.value) return 'Bitte ein Datum wählen.';
      const d = { titel: f.titel.value.trim(), betrag, datum: f.datum.value, kategorie: f.kategorie.value, zahler: f.zahler.value, notiz: f.notiz.value.trim(), anteile: [] };
      if (f.topf && f.topf.value) {
        const an = betragZahl(f.anteil.value) ?? betrag;
        if (an > betrag) return 'Aus dem Zuschuss kann nicht mehr kommen, als die Ausgabe gekostet hat.';
        const rest = +f.topf.selectedOptions[0].dataset.rest;
        if (an > rest + 0.005 && !confirm(`Im Zuschuss sind nur noch ${euro(rest)} übrig. Trotzdem ${euro(an)} daraus buchen?`)) return 'Bitte den Betrag aus dem Zuschuss anpassen.';
        if (an > 0) d.anteile = [{ topf: f.topf.value, betrag: an }];
      }
      if (a) Object.assign(a, d); else k.ausgaben.push({ id: neueId(), ...d });
    });
}
// Wählt man einen Zuschuss, wird „davon“ mit dem passenden Betrag vorbelegt (höchstens, was noch übrig ist)
function kostenTopfVorschlag(neu) {
  const f = $('#dlg-form'); if (!f.topf) return;
  if (!f.topf.value) { if (neu) f.anteil.value = ''; return; }
  const betrag = betragZahl(f.betrag.value) || 0, rest = +f.topf.selectedOptions[0].dataset.rest;
  if (neu || !f.anteil.value) f.anteil.value = eingabeEuro(Math.max(0, Math.min(betrag, rest)));
}
function topfDialog(id) {
  const k = kostenDaten(), t = id ? k.toepfe.find(x => x.id === id) : null, st = t ? topfStand(t) : null;
  dialog(`<h2>💶 ${t ? 'Zuschuss bearbeiten' : 'Zuschuss oder Geldgeschenk'}</h2>
    <label class="feld">Name<input name="name" value="${esc(t?.name || '')}" placeholder="z. B. Zuschuss Eltern Anna" required></label>
    <div class="zeile2"><label class="feld">Betrag (€)<input name="betrag" inputmode="decimal" value="${eingabeEuro(t?.betrag)}" placeholder="z. B. 2.000" required></label>
      <label class="feld">Erhalten am<input type="date" name="datum" value="${esc(t?.datum || tagKey(Date.now()))}"></label></div>
    <label class="feld">Von wem?<input name="von" value="${esc(t?.von || '')}" placeholder="z. B. Oma und Opa"></label>
    <label class="feld">Notiz (optional)<input name="notiz" value="${esc(t?.notiz || '')}" placeholder="z. B. gedacht für Kinderwagen und Bett"></label>
    ${st ? `<p class="leise klein">Daraus bezahlt: ${euro(st.verbraucht)} · noch übrig: <b>${euro(st.rest)}</b></p>` : ''}
    <div class="dlg-knoepfe">${t ? '<button class="knopf gefahr" value="loeschen">Löschen</button>' : ''}<button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf kosten" value="ok">Speichern</button></div>`,
    (knopf, f) => {
      if (knopf === 'loeschen') {
        if (st.genutzt.length && !confirm(`Aus diesem Zuschuss wurden ${st.genutzt.length} Ausgaben bezahlt. Beim Löschen gelten sie als selbst bezahlt. Trotzdem löschen?`)) return 'Nicht gelöscht.';
        if (!st.genutzt.length && !confirm('Zuschuss löschen?')) return 'Nicht gelöscht.';
        for (const a of k.ausgaben) a.anteile = (a.anteile || []).filter(x => x.topf !== t.id);
        k.toepfe = k.toepfe.filter(x => x !== t); return;
      }
      const betrag = betragZahl(f.betrag.value);
      if (!f.name.value.trim()) return 'Bitte einen Namen eingeben.';
      if (!betrag) return 'Bitte einen Betrag eingeben.';
      const d = { name: f.name.value.trim(), betrag, datum: f.datum.value, von: f.von.value.trim(), notiz: f.notiz.value.trim() };
      if (t) Object.assign(t, d); else k.toepfe.push({ id: 't' + neueId(), ...d });
    });
}
function personenDialog() {
  const k = kostenDaten();
  const zeilen = k.personen.map((p, i) => `<label class="feld">Person ${i + 1}<input name="p_${p.id}" value="${esc(p.name)}" placeholder="leer = entfernen"></label>`).join('');
  dialog(`<h2>Wer zahlt?</h2><p class="leise klein" style="margin:0">Namen ändern, leeren zum Entfernen (nur wenn noch nichts eingetragen ist), unten neue anlegen.</p>
    ${zeilen}<label class="feld">Neue Person<input name="neu" placeholder="z. B. Oma Gerda"></label>
    <div class="dlg-knoepfe"><button class="knopf rand" value="abbrechen" formnovalidate>Abbrechen</button><button class="knopf kosten" value="ok">Speichern</button></div>`,
    (knopf, f) => {
      const neu = [];
      for (const p of k.personen) {
        const n = f['p_' + p.id].value.trim();
        if (n) neu.push({ ...p, name: n });
        else if (k.ausgaben.some(a => a.zahler === p.id && eigenAnteil(a) > 0)) return `${p.name} hat schon Ausgaben bezahlt und kann nicht entfernt werden.`;
      }
      if (f.neu.value.trim()) neu.push({ id: 'p' + neueId(), name: f.neu.value.trim() });
      if (!neu.length) return 'Mindestens eine Person wird gebraucht.';
      k.personen = neu;
    });
}
