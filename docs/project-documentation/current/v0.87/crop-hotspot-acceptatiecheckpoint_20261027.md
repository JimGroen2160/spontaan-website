# Spontaan — crop/hotspot acceptatiecheckpoint

Datum: 27-10-2026
Repository: spontaan-website
Branch: feat/hero-crop-hotspot
Baseline vóór lokale commit: 2b51562081869c193a06e95a30e28cb6a72d24a9

## Doel

Hero-afbeeldingen die vanuit Sanity CMS worden beheerd moeten de door de
contentmanager ingestelde Crop & Hotspot kunnen gebruiken. De contentmanager
moet de normale werkwijze kunnen volgen:

1. Production Sanity Studio openen.
2. Hero-afbeelding kiezen.
3. Crop en/of hotspot handmatig instellen.
4. Publish kiezen.
5. De bestaande production-publicatieketen brengt de wijziging naar live.
6. De website past de opgeslagen crop/hotspot automatisch toe.

De contentmanager hoeft hiervoor geen kennis te hebben van GitHub, Vercel,
datasets, PowerShell of deploymenttechniek.

## Scope

De wijziging geldt uitsluitend voor de acht hero-contexten:

1. Homepage
2. Over Spontaan
3. Agenda
4. Beeld en Geluid
5. Repertoire
6. Nieuws
7. Vrienden
8. Contact

Andere managed-image-contexten vallen buiten deze wijziging.

## Technische oplossing

Gedeelde helper:

- js/sanity-hero-image.js

Functie:

- valideert uitsluitend veilige Sanity CDN-afbeeldingen;
- verwerkt een geldige Sanity crop naar een CDN `rect=`-parameter;
- behoudt bestaande veilige queryparameters;
- voegt `auto=format` toe;
- berekent bij een geldige hotspot een relatieve responsive positie;
- zet geen vaste viewportafmetingen in de Sanity URL;
- gebruikt geen geforceerde `w`, `h`, `fit`, `crop`, `fp-x` of `fp-y`;
- past crop niet gedeeltelijk toe wanneer brondimensies ontbreken.

## Build-time hero's

De volgende zes hero's worden in scripts/build-site.mjs ondersteund:

- Homepage
- Over Spontaan
- Beeld en Geluid
- Repertoire
- Vrienden
- Contact

De build transporteert:

- heroImageDimensions
- heroImageCrop
- heroImageHotspot

De bestaande pagina-specifieke positionering blijft behouden wanneer geen
geldige hotspot is opgeslagen.

## Runtime hero's

De volgende twee hero's worden runtime ondersteund:

- Agenda
- Nieuws

Betrokken bestanden:

- js/agenda.js
- js/nieuws.js
- pages/agenda.html
- pages/nieuws.html

De gedeelde helper wordt vóór de runtime-app geladen.

## Backward compatibility

Wanneer geen crop en geen hotspot in Sanity zijn opgeslagen:

- blijft de bestaande afbeelding gebruikt;
- blijft bestaande CSS-positionering behouden;
- ontstaat geen nieuwe inline positionering.

Wanneer alleen crop aanwezig is:

- wordt de bronuitsnede via Sanity `rect=` toegepast;
- blijft bestaande CSS-positionering behouden.

Wanneer alleen hotspot aanwezig is:

- blijft de volledige bronafbeelding behouden;
- wordt de hotspot als responsive positionering gebruikt.

## Productie-inventarisatie

Op 27-10-2026 zijn de acht actuele Production hero-assets read-only
gecontroleerd tegen de live website.

Alle acht Sanity production-assets kwamen exact overeen met live en alle
assets waren bereikbaar.

Van de acht hero's had op dat moment alleen Nieuws een opgeslagen crop en
hotspot.

### Nieuws production

Document:

- newsPage-main

Titel:

- Nieuws uit de wereld van Spontaan

Subtitel:

- Verhalen, optredens en meer achter de muziek.

Asset:

- fa73d5a6859b883da1b85889e12cee660b87a72c
- 2856 x 2142

Crop:

- top: 0.30110928617686206
- bottom: 0.08108106128237633
- left: 0
- right: 0

Hotspot:

- x: 0.5
- y: 0.6100141124472429
- width: 1
- height: 0.6178096525407616

Managed glow:

- none

Legacy glow:

- none

## Testbewijs

### Foundation

14/14 PASS.

Hiermee zijn onder andere bewezen:

- geen crop/hotspot;
- geldige crop;
- crop zonder hotspot;
- hotspot zonder crop;
- crop + hotspot;
- hotspot buiten crop;
- ongeldige crop;
- ongeldige hotspot;
- crop zonder dimensions;
- behoud veilige queryparameters;
- geen vaste viewport-crop;
- begrensde responsive positionering.

### Build-time contract

9/9 PASS.

Bewezen:

- exact zes build-time queries transporteren dimensions/crop/hotspot;
- exact zes normalizers transporteren de waarden;
- zes renderers gebruiken de gedeelde adapter;
- positionering wordt uitsluitend bij geldige hotspot toegepast.

### Runtime contract

11/11 PASS.

Bewezen:

- Agenda queryt dimensions/crop/hotspot;
- Nieuws queryt dimensions/crop/hotspot;
- beide gebruiken de gedeelde helper;
- hotspot-positionering is conditioneel;
- managed glow new-first/legacy-fallback blijft behouden;
- helper wordt vóór runtime-app geladen.

### Integrale browserregressie P4

42/42 PASS:

- Chromium 14/14;
- Firefox 14/14;
- WebKit 14/14.

Getest:

- alle acht hero's;
- desktop;
- mobiel;
- crop + hotspot;
- crop zonder hotspot;
- hotspot zonder crop;
- crop zonder dimensions;
- managed glow.

### Bestaande browserregressie

258/258 PASS.

### Encoding

3/3 PASS.

## P5 acceptatie

De eerste brede P5-captures zijn niet als acceptatiebewijs gebruikt omdat
testcontent en/of synthetische afbeeldingen de live productie niet één-op-één
representeerden.

Daarna is bewust teruggeschakeld naar één pilotpagina: Nieuws.

Voor Nieuws is read-only bewezen:

- Sanity production titel = live titel;
- Sanity production subtitel = live subtitel;
- Sanity production hero asset = live hero asset;
- production crop aanwezig;
- production hotspot aanwezig;
- browser page errors = 0;
- repository bleef ongewijzigd.

De lokale branch past vervolgens dezelfde production crop/hotspot functioneel
toe.

De visuele keuze van de uiteindelijke uitsnede is bewust geen hardcoded
productbeslissing. De contentmanager stelt de crop en hotspot handmatig in
Sanity af. De software moet betrouwbaar uitvoeren wat in het CMS is opgeslagen.

## Acceptatiebesluit

Functionele crop/hotspot-ondersteuning:

PASS.

Handmatige visuele afstelling per foto:

CMS-verantwoordelijkheid van de contentmanager.

De huidige productie-crop van Nieuws hoeft daarom niet door productcode te
worden gecorrigeerd.

## Publicatie

De crop/hotspot-code staat op dit checkpoint nog niet live.

Vervolg:

1. lokale commit;
2. push + pull request als aparte akkoordpoort;
3. verplichte checks/review;
4. merge/deployment als aparte akkoordpoort;
5. Production contentmanagerproef:
   - hero openen;
   - crop/hotspot handmatig aanpassen;
   - Publish;
   - live resultaat controleren.

## Bescherming

Tijdens P0 t/m P5 zijn voor deze feature geen:

- ongeautoriseerde Production writes;
- commits;
- pushes;
- merges;
- deployments;
- Supabase writes

uitgevoerd.

De bestaande v0.87-documentatieset blijft historisch byte-ongewijzigd.
Dit bestand is een aanvullend repositorycheckpoint voor de na v0.87 afgeronde
crop/hotspot-functionaliteit en herschrijft documentatie-status.json uit v0.87
niet retroactief.