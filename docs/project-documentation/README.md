# Website Spontaan — projectdocumentatie

Deze map is de centrale repositorylocatie voor de geselecteerde canonieke
projectdocumentatie van Website Spontaan.

## Actuele documentatieset

De actuele bronset in deze repository is documentatieset **v0.86**:

`current/v0.86/`

Deze map bevat:
- de 13 afzonderlijk leesbare documenten uit de canonieke v0.86-set;
- het canonieke ZIP-pakket;
- het externe pakket-hashbestand.

De bestanden zijn byte-exact uit de gevalideerde bronset overgenomen.
Historische inhoud in deze documenten wordt niet tijdens centralisatie
stilzwijgend aangepast.

### Belangrijke statusnuance

`current/v0.86/documentatie-status.json` is eveneens byte-exact overgenomen.
Het bestand bevat de status zoals die in de oorspronkelijke v0.86-bronset
was vastgelegd, waaronder de toenmalige staging-/activatiecontext.

De plaatsing van v0.86 onder `current/` in deze repository is een later,
expliciet genomen centralisatiebesluit. Dat besluit verandert niet met
terugwerkende kracht de inhoud van het oorspronkelijke statusbestand.

## Actuele contentmanagerhandleiding

De geselecteerde actuele handleiding staat onder:

`current/manual/Contentmanager-handleiding_v1.7M.pdf`

## Historische documentatiesets

Onder `history/` staat per aantoonbare historische pakketversie maximaal
één geselecteerd canoniek pakket.

Aanwezige versies:

v0.35, v0.55, v0.61, v0.65, v0.66, v0.67, v0.68, v0.69,
v0.70, v0.71, v0.72, v0.73, v0.74, v0.75, v0.76, v0.77,
v0.78, v0.79, v0.80, v0.81, v0.82, v0.83, v0.84 en v0.85.

Bij versies waarvoor meerdere pakketvarianten bestonden is alleen de
eerder bewezen canonieke variant opgenomen. Voorbeelden:
- v0.67: de correctieversie;
- v0.72: r4;
- v0.85: de actieve/canonieke v0.85-set van 25 oktober 2026.

v0.86 staat uitsluitend onder `current/` en niet tevens onder `history/`.

## Historische contentmanagerhandleidingen

`history/manual/` bevat de geselecteerde historische handleidingmijlpalen
vanaf concept v1.4 tot en met v1.7L.

Exacte bestandsnamen en SHA-256-hashes staan in:

`inventory/canonieke-documentatie-inventaris.csv`

De inventaris bevat de 58 gemigreerde bronbestanden. `README.md` en de
inventaris-CSV zelf zijn geen bronrecords en worden daarom niet
zelf-refererend in de inventaris opgenomen.

## Evidence

`evidence/` bevat afzonderlijk geselecteerde projectdocumenten die
relevant zijn als bewijs, beheerinput of kwaliteitsbasis maar geen
zelfstandig canoniek documentatiepakket vormen.

## Bestaande wireframes

De bestaande repositorystructuur:

`docs/wireframes/`

blijft een afzonderlijke documentatiecategorie en is door deze
centralisatie niet gewijzigd.

## Niet opgenomen

Niet in deze centrale projectdocumentatie opgenomen zijn onder andere:
- niet-canonieke of vervangen pakketvarianten;
- exacte duplicaten;
- QE/Evidasure-documentatie;
- verenigingsdocumenten zoals statuten/WBTR;
- repertoire- en muziekbestanden;
- installers;
- tijdelijke patches/scripts;
- persoonlijke of securitygevoelige bestanden;
- tijdelijke screenshots en werkartefacten die niet als canoniek bewijs
  zijn geselecteerd.

## Integriteit

Voor ieder gemigreerd bronbestand wordt in
`inventory/canonieke-documentatie-inventaris.csv` minimaal vastgelegd:
- categorie;
- versie;
- repositorypad;
- bestandsnaam;
- bestandsgrootte;
- SHA-256.

De migratieset is vóór opname gecontroleerd op bronintegriteit,
canonicaliteit en gevoelige gegevens.

## Governance

De actuele projectdocumentatie, prompt en rules blijven leidend binnen hun
geldende scope. Historische documentatiesets blijven ongewijzigd bewaard
voor traceability.

Een historisch document is niet zelfstandig bewijs van de actuele
repository-, runtime-, platform- of infrastructuurstatus. Actuele feiten
moeten steeds opnieuw tegen de werkelijke omgeving worden geverifieerd.

Staging, commit, push, pull request, merge en deployment zijn afzonderlijke
Git-/releasepoorten en volgen niet automatisch uit documentcentralisatie.
