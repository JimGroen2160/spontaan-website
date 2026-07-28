# Sanity Studio – spontaan-website

Deze map bevat de Sanity Content Studio voor de publieke website van Zanggroep Spontaan.

Zanggroep Spontaan is een mannenkoor.

## Omgevingen en datasets

De Studio gebruikt het Sanity-project van spontaan-website.

Ondersteunde datasets:

- `development` voor ontwikkeling, testcontent en gecontroleerde validatie;
- `production` voor definitieve productiecontent.

De build bepaalt gecontroleerd welke dataset wordt gebruikt. Een ongeldige datasetnaam moet als fout worden behandeld.

## Build-time contentarchitectuur

Publieke CMS-content wordt waar mogelijk tijdens de sitebuild verwerkt.

Belangrijke uitgangspunten:

- de gegenereerde pagina’s komen in `dist`;
- pagina’s halen niet onnodig opnieuw content op tijdens runtime;
- fallbackcontent blijft beschikbaar wanneer dat volgens de buildarchitectuur nodig is;
- CMS-developmentdata, testfixtures, fallbackcontent en productiecontent blijven afzonderlijke categorieën.

## Muziek en repertoire

Voor de pagina **Muziek en repertoire** is het Sanity-type `repertoirePage` aanwezig.

De pagina wordt tijdens de build samengesteld. De gevalideerde buildmelding is:

`REPERTOIRE BUILD: cms -> dist/pages/repertoire.html`

De repertoirepagina voert tijdens runtime geen Sanity-ophaalverzoeken uit.

De afgeronde implementatie is opgenomen in:

- PR #55;
- mergecommit `cfa6ff5`;
- bindende wireframe:
  `docs/wireframes/repertoire/repertoire-definitief-v1.png`.

## Developmentcontent en productievoorwaarde

De developmentdataset bevat momenteel nog herkenbare `[TEST]`-teksten en testaudio.

Deze gegevens:

- zijn uitsluitend bedoeld voor ontwikkeling en validatie;
- mogen niet als definitieve productiecontent worden gepubliceerd;
- moeten vóór productie worden vervangen;
- vereisen na vervanging opnieuw een productiegerichte CMS-buildcontrole;
- vereisen daarna opnieuw controle van paginaweergave, audio, accessibility en Lighthouse.

## Security en beheer

- Plaats geen tokens, wachtwoorden of andere secrets in de repository.
- Gebruik geen `npm audit fix --force`.
- Nieuwe onbekende high- of critical-securitybevindingen zijn blokkerend.
- Bekende transitieve bevindingen in ontwikkeltooling mogen alleen gecontroleerd en gedocumenteerd worden geaccepteerd.
- Wijzig schema’s, datasets of buildgedrag alleen via een gecontroleerde featurebranch en met passende tests.

## Lokale Studio

Gebruik de bestaande npm-scripts en configuratie in deze map. Installeer dependencies niet opnieuw zonder noodzaak en voeg geen packages toe zonder impactanalyse en expliciet akkoord.
