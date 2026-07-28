# Definitieve wireframe – Muziek en repertoire

Status: GOEDGEKEURD
Versie: 1.0
Datum goedkeuring: 24-07-2026
Bindende referentieafbeelding: `repertoire-definitief-v1.png`
SHA-256: `095eaeab29a45c947c0bc6749a168cd47f9b5b3172832e73edd6434de06743e4`

## Bindende status

Deze wireframe is de verplichte visuele referentie voor iedere analyse, wijziging, test en goedkeuring van de pagina **Muziek en repertoire**.

Afwijkingen zijn uitsluitend toegestaan na expliciete goedkeuring van de opdrachtgever.

## Verplicht te toetsen onderdelen

De wireframe is bindend voor:

- paginavolgorde en sectie-opbouw;
- herohoogte, compositie, beeldkadrering, titelpositie en golf;
- breedte, hoogte en afwisseling van contentkaarten;
- verticale tussenruimtes en totale compactheid;
- audiosectie;
- processectie;
- repertoireselectie;
- quote en dirigentfoto;
- CTA;
- overgang naar de gedeelde footer;
- footerhoogte, golfvorm en positionering van de inhoud.

## Herbruikbare onderdelen

De bestaande gedeelde onderdelen blijven leidend:

- header en navigatie;
- buttons;
- audio-player;
- footercomponent;
- CMS- en buildarchitectuur;
- algemene responsive basisregels.

Pagina-specifieke CSS mag deze componenten alleen positioneren of laten aansluiten. Duplicatie of een aparte repertoirevariant is niet toegestaan zonder expliciete goedkeuring.

## Verplichte referentievolgorde

Bij iedere volgende stap geldt deze volgorde:

1. deze goedgekeurde wireframe;
2. dit besluitdocument;
3. een later goedgekeurde browserbaseline;
4. de implementatie in HTML, CSS, JavaScript en CMS.

## Controle vóór iedere wijziging

Voor iedere wijziging moet expliciet worden vastgesteld:

- welk zichtbaar onderdeel van de wireframe wordt gecorrigeerd;
- welke bestaande herbruikbare delen geraakt kunnen worden;
- welke bestanden noodzakelijk zijn;
- hoe na afloop visueel en technisch wordt bewezen dat de wijziging dichter bij de wireframe ligt.

## Goedkeuringsregel

De pagina is pas gereed wanneer de browseruitwerking als geheel aantoonbaar overeenkomt met deze wireframe en de technische, responsive, accessibility- en Lighthouse-controles zijn geslaagd.

## Definitieve implementatiestatus

Status: **GEÏMPLEMENTEERD EN AFGEROND**

De pagina **Muziek en repertoire** is functioneel, visueel en technisch afgerond volgens deze bindende wireframe.

Git-status van de afgeronde fase:

- pull request: **PR #55**;
- status pull request: gemerged en gesloten;
- mergecommit: `cfa6ff5`;
- voormalige featurebranch: `o/repertoire-layout-wireframe-herstel`;
- featurebranch lokaal en remote verwijderd.

### Gerealiseerde visuele afspraken

- desktop, tablet en mobiel zijn afzonderlijk gevalideerd;
- repertoireselectie, quote en CTA gebruiken dezelfde horizontale containerbreedte;
- de CTA–golf–footer-overgang sluit aan op de goedgekeurde wireframe;
- `components/footer.html` blijft de enige gedeelde footerbron;
- zichtbare audiostatussen zijn:
  - `Gereed`;
  - `Afspelen`;
  - `Gepauzeerd`;
  - `Afgelopen`;
- de mobiele quote-afbeelding is gevalideerd op:
  - natuurlijke afmetingen `1200 × 900`;
  - `object-fit: cover`;
  - `object-position: 50% 32%`.

### CMS en build

- het Sanity-paginadocument en het schema voor repertoire zijn aanwezig;
- repertoire wordt tijdens de build opgebouwd;
- gevalideerde buildmelding:

  `REPERTOIRE BUILD: cms -> dist/pages/repertoire.html`

- de repertoirepagina haalt tijdens runtime geen content op bij Sanity;
- de developmentdataset bevat nog herkenbare `[TEST]`-teksten en testaudio;
- deze testcontent moet vóór productie worden vervangen door definitieve content.

### Validatieresultaten

- `npm run build`: geslaagd;
- gerichte repertoiretests: **24/24 geslaagd** op Chromium, Firefox en WebKit;
- geen horizontale overflow;
- visuele controles op desktop, tablet en mobiel: geslaagd;
- productieaudit: **0 kwetsbaarheden**.

Mediaan van drie Lighthouse-desktopruns:

- Performance: **100**;
- Accessibility: **100**;
- Best Practices: **100**;
- SEO: **100**;
- FCP: **402 ms**;
- LCP: **816 ms**;
- CLS: **0**.

Gevalideerd LCP-element:

`body > header.repertoire-hero > img.repertoire-hero__image`

### Resterend productiepunt

De pagina-implementatie is afgerond. Voor productie moeten uitsluitend de `[TEST]`-teksten en testaudio in de gebruikte Sanity-dataset worden vervangen en opnieuw productiegericht worden gevalideerd.
