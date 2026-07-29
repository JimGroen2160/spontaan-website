# Definitieve wireframe — Vrienden van Spontaan

Status: goedgekeurd en leidend
Versie: v1
Datum vastlegging: 28 juli 2026

## Bronbestand

`docs/wireframes/vrienden/vrienden-definitief-v1.png`

Dit bestand is de vaste visuele referentie voor de pagina **Vrienden van Spontaan**.

## Bindende ontwerpafspraken

- De gedeelde navigatie en gedeelde footer van de website blijven in gebruik.
- De hero gebruikt een mannenkoorfoto met dirigent, een donker paars-roze overlay en een golfvorm onderaan.
- De pagina bevat exact deze sectievolgorde:
  1. Hero
  2. Uw steun maakt dit mogelijk
  3. Onze vrienden en sponsors
  4. Word ook vriend van Spontaan
  5. Gedeelde footer
- De overgang naar de footer gebruikt een golfvorm.
- De sponsorsectie toont logo’s en/of foto’s in een horizontale presentatie met navigatiepijlen en paginapunten.
- Ontbrekende passende koorafbeeldingen worden gegenereerd zodat ze zo nauw mogelijk aansluiten op deze wireframe.
- Echte sponsorlogo’s worden nooit verzonnen. Voor ontwikkeling worden alleen neutrale of duidelijk als test herkenbare logo’s gebruikt.
- Er wordt niet visueel afgeweken zonder voorafgaande goedkeuring.
- Responsive uitwerking voor tablet en mobiel moet dezelfde visuele hiërarchie, inhoudsvolgorde en ontwerpintentie behouden.

## Definitieve teksten

### Hero

**Titel**

Vrienden van Spontaan

**Tekst**

Met de steun van onze vrienden kan Zanggroep Spontaan blijven zingen, groeien en mensen verbinden.

**Knoppen**

- Word vriend van Spontaan
- Meer informatie

### Uw steun maakt dit mogelijk

**Introductie**

Dankzij de vrienden van Spontaan kan Zanggroep Spontaan blijven investeren in muziek, optredens, nieuwe projecten en mooie zangmomenten.

#### Muziek maken

Zanggroep Spontaan blijft werken aan mooie muziek en bijzondere optredens.

#### Groei en ontwikkeling

Het mannenkoor investeert in repetities, muzikale begeleiding en verdere ontwikkeling.

#### Verbinden

Zanggroep Spontaan brengt mensen samen door muziek en ontmoeting.

#### Cultuur in de regio

De zanggroep draagt bij aan een rijk en levendig cultureel leven in de regio.

### Onze vrienden en sponsors

De namen, logo’s, foto’s, beschrijvingen, links, zichtbaarheid en sorteervolgorde worden beheerd via Sanity CMS.

### Word ook vriend van Spontaan

**Tekst**

Met uw bijdrage ondersteunt u Zanggroep Spontaan bij muzikale activiteiten, optredens en verdere ontwikkeling.

**Voordelen**

- U steunt een actief en enthousiast mannenkoor.
- Uw bijdrage helpt muzikale activiteiten mogelijk te maken.
- U blijft betrokken bij Zanggroep Spontaan.

**Knoppen**

- Word vriend van Spontaan
- Neem contact op

## Schrijfwijze

Gebruik **Zanggroep Spontaan** als hoofdvorm. Wissel waar natuurlijk af met **het mannenkoor** en **de zanggroep**. Gebruik “we” alleen wanneer een persoonlijke CTA of een citaat daar aantoonbaar om vraagt.

## Wijzigingsbeleid

De wireframe en bovenstaande teksten zijn goedgekeurd. Wijzigingen, afwijkingen of verbeteringen mogen alleen na voorafgaande expliciete goedkeuring worden doorgevoerd.

## Technische eindstatus

De pagina wordt tijdens de sitebuild samengesteld uit:

- `build/friends.template.html`;
- het Sanity-singletondocument `friendsPage-main`;
- gepubliceerde documenten van het type `friendItem`;
- `data/friends-fallback.json` als technische reserve.

De gegenereerde pagina staat in:

`dist/pages/vrienden.html`

De gevalideerde CMS-buildmelding is:

`FRIENDS BUILD: cms -> dist/pages/vrienden.html`

De pagina voert tijdens runtime geen Sanity-ophaalverzoeken uit.

### Developmentdata

De developmentdataset bevat:

- één gepubliceerd `friendsPage-main`-document;
- zeven gepubliceerde en actieve `friendItem`-documenten;
- negen geldige afbeeldingsreferenties;
- geen drafts of dangling assetreferenties.

De gebruikte sponsornamen en logo's zijn fictieve developmentdata en geen echte sponsors.

### Kwaliteitsresultaten

- accessibility: 0 overtredingen;
- Lighthouse-mediaan:
  - Performance 97;
  - Accessibility 100;
  - Best Practices 96;
  - SEO 100;
  - CLS 0;
- volledige Playwright-regressie:
  - 351 tests;
  - 337 geslaagd;
  - 14 overgeslagen;
  - 0 mislukt.

De pagina is technisch afgerond voor development. Definitieve productiecontent moet later redactioneel worden ingevoerd en opnieuw productiegericht worden gevalideerd.
