# Chille quotes under Tor Gunnar

## Hva dette er

En liten samling rolige «ta det med ro»-sitater som vises under Tor Gunnar-overskriften
(der det i dag står den faste teksten «Ingenting haster akkurat nå» 🌿).

Appen fungerer som en sekretær som skal ta stress **av** brukeren (og av de som hjelper
til med å minne om ting). Sitatene skal forsterke det: korte, rolige, med litt punch —
alle dreier seg om å senke skuldrene og ikke stresse.

Bladet-emojien (🌿) beholdes som i dag.

**Viktig – alltid synlig:** Quoten skal vises **hver dag, uansett** hvor mye som står
på lista. Den er *ikke* en tom-tilstand-melding («ingen oppgaver i dag»). Den ligger fast
under Tor Gunnar-overskriften enten det er null, én eller mange oppgaver den dagen.
Poenget er å dempe stress også (særlig) på dager med mye å gjøre.

## Hvordan det skal implementeres

**Rotasjon: én quote per dag.**

- Velg quote basert på datoen, ikke tilfeldig per refresh og ikke på timer.
- Samme quote gjennom hele dagen, uansett hvor mange ganger appen åpnes/refreshes.
  Den skal aldri bytte mens brukeren ser på den — det er hele poenget med en *rolig* app.
- Ny quote neste dag.

**Hvorfor daglig (og ikke per refresh / 10-min-timer):**

- Per refresh = teksten «blinker»/endrer seg, trekker blikket, signaliserer uro.
- 10-min-timer = subtil nedtellingsfølelse + kan bytte midt mens du ser på den.
- Daglig = helt stabil og forutsigbar, men fersk hver dag som et lite dagsrituale.

### Redigering i Innstillinger

Quote-lista skal kunne **redigeres i Settings/Innstillinger** (ikke bare i denne
md-filen). Lista her i md-filen er bare *standardverdien* / utgangspunktet.

- I Innstillinger: et tekstfelt (textarea) med **én quote per linje**. Brukeren kan
  endre tekst, legge til og fjerne linjer fritt.
- Lagres i `localStorage` (f.eks. nøkkel `tg-quotes`). Tomme linjer ignoreres.
- Faller tilbake til standardlista (de 30 under) hvis `localStorage` er tom eller alt
  slettes. Gjerne en «Tilbakestill til standard»-knapp.
- Rotasjonen (daglig, se under) kjører på den redigerte lista.

### Manuell «roter nå»

I tillegg til den daglige rotasjonen skal brukeren kunne **hoppe til en ny tilfeldig
quote når som helst** — f.eks. ved å trykke på selve quoten eller en liten 🔄-knapp ved
siden av 🌿.

- Trykk → velg en **tilfeldig** quote fra lista (ikke den som vises nå, så det alltid
  føles som en endring).
- Det manuelle valget **pinnes resten av dagen** (lagres, f.eks. `tg-quote-pin` med
  dato) slik at et refresh ikke overstyrer det du nettopp valgte.
- Neste dag res/startes pinningen, og den vanlige daglige rotasjonen tar over igjen.

**Forslag til utvelgelse (deterministisk daglig + manuell pin):**

```js
const DEFAULT_QUOTES = [ /* de 30 under */ ];

function getQuotes() {
  const raw = (localStorage.getItem('tg-quotes') || '').trim();
  const list = raw
    ? raw.split('\n').map(s => s.trim()).filter(Boolean)
    : DEFAULT_QUOTES;
  return list.length ? list : DEFAULT_QUOTES;
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// Daglig, deterministisk: samme dato → samme quote (ingen flimring ved refresh)
function quoteForToday(date = new Date()) {
  const quotes = getQuotes();
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / 86400000);
  return quotes[dayOfYear % quotes.length];
}

// Det som faktisk vises: respekter en manuell pin fra i dag, ellers dagens quote
function currentQuote() {
  try {
    const pin = JSON.parse(localStorage.getItem('tg-quote-pin') || 'null');
    if (pin && pin.date === todayKey() && pin.text) return pin.text;
  } catch {}
  return quoteForToday();
}

// «Roter nå»: tilfeldig quote ≠ den som vises, pinnes resten av dagen
function rotateNow() {
  const quotes = getQuotes();
  const now = currentQuote();
  const options = quotes.length > 1 ? quotes.filter(q => q !== now) : quotes;
  const next = options[Math.floor(Math.random() * options.length)];
  localStorage.setItem('tg-quote-pin', JSON.stringify({ date: todayKey(), text: next }));
  return next;
}
```

Oppsummert:
- **Standard:** én fast quote per dag (stabil, ingen flimring ved refresh).
- **Manuelt:** 🔄 gir en ny tilfeldig quote som holder resten av dagen.
- **Innstillinger:** hele lista kan redigeres; md-filen er bare startverdien.

## Quotes (30)

Rediger fritt — endre tekst, legg til eller fjern linjer. Antallet trenger ikke være 30;
modulo-formelen over tilpasser seg automatisk til lengden på lista.

1. Ingenting haster akkurat nå.
2. Én ting av gangen.
3. Pust. Resten venter.
4. Det løser seg alltid.
5. Ro er også fremgang.
6. Du rekker det du rekker.
7. Ta det med ro – jeg har oversikten.
8. Verden kan vente litt.
9. Ingenting brenner i dag.
10. Sakte er fort nok.
11. Du trenger ikke gjøre alt nå.
12. Hvil != sløs.
13. Det viktigste er at du puster.
14. La skuldrene senke seg.
15. Alt som må huskes, husker jeg.
16. Ett steg. Så ett til.
17. Stress løser ingenting.
18. Gjør lite, gjør det rolig.
19. I morgen finnes også.
20. Du har tid.
21. Ro i kroppen, ro i hodet.
22. Det haster sjeldnere enn du tror.
23. Pause er lov.
24. Senk tempoet, ikke ambisjonene.
25. En ting mindre å bekymre seg for.
26. Det kommer til å gå bra.
27. Pust inn. Pust ut. Fortsett.
28. Du er god nok og du gjør nok.
29. La dagen komme til deg.
30. Rolig puls, klart hode.
