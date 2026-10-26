# BINDEND ADDENDUM — PROJECTBREDE TEST- EN KWALITEITSNORM
Project: spontaan-website
Datum: 2026-08-21
Status: bindend vanaf akkoord op 2026-08-21

## 1. Doel
Voor iedere nieuwe, gewijzigde of bestaande functionaliteit die naar een volgende OTAP-fase wordt gebracht, moet passende en aantoonbare testdekking aanwezig zijn.

## 2. Verplichte testdekking

### Technisch
- syntax, build, configuratie en relevante statische controles;
- data- en integriteitscontroles;
- encoding;
- API/backend-contracten;
- database/RLS/RBAC;
- securitygrenzen;
- regressie van gedeelde componenten, buildketen en infrastructuur.

### Functioneel
- testen vanuit daadwerkelijk gebruikersgedrag;
- relevante links, CTA's en buttons daadwerkelijk aanklikken;
- na klik de juiste bestemming, statuswijziging of actie bewijzen;
- alleen aanwezigheid of een href-attribuut controleren is onvoldoende voor een kritieke gebruikersflow.

### Happy flow
- complete succesvolle gebruikersprocessen end-to-end doorlopen;
- tussenstappen en eindresultaat controleren.

### Unhappy flow
Waar van toepassing minimaal:
- ongeldige invoer;
- ontbrekende of lege data;
- foutresponsen;
- niet-beschikbare resources;
- ongeautoriseerde toegang;
- onjuiste rollen/statussen;
- veilige fallbacks;
- geen onbehandelde fouten of datalekken.

### Rollen en autorisatie
Waar rollen van toepassing zijn worden de relevante scenario's voor member, contentmanager en admin getest, inclusief negatieve autorisatietests.

### Responsive
Minimaal:
- desktop;
- tablet;
- mobiel;
- horizontale overflow;
- bruikbaarheid van interactieve onderdelen.

### Browserdekking
Chromium, Firefox en WebKit worden toegepast waar functionaliteit of regressierisico's browserafhankelijk kunnen zijn.

### Accessibility
- Axe/WCAG op relevante pagina's en interactieve toestanden;
- gerichte toetsenbord- en focuscontroles waar interactie aanwezig is.

### Lighthouse en performance
Iedere relevante eindgebruikerspagina wordt opgenomen in Lighthouse-dekking.

Minimaal beoordelen en rapporteren:
- Performance;
- Accessibility;
- Best Practices;
- SEO voor publieke pagina's;
- FCP;
- LCP;
- CLS;
- overige relevante Web Vitals waar technisch beschikbaar/toepasselijk.

Voor beveiligde pagina's wordt een reproduceerbare authenticated Lighthouse-route gebruikt wanneer anonieme toegang niet mogelijk is.

### Regressie
Nieuwe functionaliteit mag bestaande functionaliteit niet aantoonbaar verslechteren. Voor integratie, PR/merge en OTAP-doorgang wordt een passende regressieset uitgevoerd.

### Testskips
Een relevante test mag niet stilzwijgend ontbreken of worden overgeslagen. Iedere bewuste skip bevat:
- reden;
- risico;
- eventuele afhankelijkheid;
- moment waarop de test alsnog wordt uitgevoerd.

### Acceptatiecriterium
Een functionaliteit geldt technisch niet als afgerond wanneer belangrijke technische, functionele, security-, accessibility-, responsive- of performancetestdekking ontbreekt.

Ontbrekende belangrijke testdekking is minimaal P1 en moet vóór definitieve acceptatie/Production worden opgelost of expliciet als restrisico worden geaccepteerd.

### Bewijs
Aanwezigheid van testcode zonder bewezen uitvoering geldt niet als voldoende bewijs.

## 3. Invoeringsbesluit en planning

### Per direct
Deze norm geldt vanaf 2026-08-21 voor alle nieuwe en gewijzigde functionaliteit.

### Huidige feature: Muziek en Smoelenboek
Muziek en Smoelenboek worden eerst technisch en functioneel compleet gemaakt en moeten vóór afronding volledig aan deze norm voldoen.

Volgorde:
1. Supabase TEST-database en echte backendintegratie afronden;
2. functionele gebruikersflows afronden;
3. click-through van relevante links, CTA's en buttons;
4. happy en unhappy flows;
5. member/contentmanager/admin-RBAC;
6. responsive en browserdekking;
7. Axe/WCAG;
8. authenticated Lighthouse waar nodig;
9. regressie van bestaande ledenfunctionaliteit.

### Projectbrede herstelronde
Direct nadat Muziek en Smoelenboek compleet en groen zijn, maar vóór PR/merge, wordt projectbreed:
1. een testmatrix/gapanalyse uitgevoerd;
2. alleen ontbrekende testdekking toegevoegd;
3. volledige relevante regressie uitgevoerd;
4. projectbrede Lighthouse-dekking aangevuld en gevalideerd.

Bestaande geldige tests worden hergebruikt en niet onnodig opnieuw ontworpen.

## 4. Documentatieconsolidatie
Dit addendum is direct bindend.
Bij het eerstvolgende volledige documentatiecheckpoint wordt deze norm integraal verwerkt in:
- de leidende ontwikkelprompt;
- het leidende stappenplan/afrondingsplan;
- relevante kwaliteits-/testdocumentatie;
- het checkpoint/logboek.

Daarna vervangt de geconsolideerde documentatieset dit addendum als primaire bron.
