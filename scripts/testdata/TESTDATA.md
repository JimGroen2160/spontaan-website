# Testgebruikers en testdata - ledenbeheer

## Doel

Deze afspraken beschrijven gecontroleerde testgebruikers en testdata voor het ledenbeheer (adminomgeving, ledenlijst, auth-flows en Playwright-regressie).

Doel van de testgebruikers:

- lokaal en in CI kunnen inloggen als admin en als lid;
- ledenbeheer-UI en autorisatie testen (filters, sortering, modals, status, role);
- regressie uitvoeren zonder afhankelijkheid van willekeurige echte leden in de database.

Testgebruikers zijn geen productieleden. Ze bestaan alleen om ontwikkeling, test en acceptatie te ondersteunen.

## Tijdelijk karakter

- Testgebruikers zijn tijdelijk.
- Ze mogen geen echte persoonsgegevens bevatten (geen echte namen, adressen of prive-e-mailadressen van bestaande leden).
- Gebruik herkenbare testidentiteiten, bijvoorbeeld:
  - e-mail: `test-admin@example.test`, `test-member-active@example.test` (of vergelijkbaar testdomein);
  - weergavenaam: `Test Admin Spontaan`, `Tester Spontaan` (placeholders, geen echte personen).
- Voor definitieve productie-gereedmelding moeten alle testgebruikers en bijbehorende testprofielen uit Supabase Auth en `public.profiles` zijn verwijderd of gedeactiveerd volgens het releaseproces.

## Vaste testrollen en statussen

Voor ledenbeheer en Playwright zijn minimaal deze combinaties nodig (elk als aparte Auth-user met bijpassend profiel in `public.profiles`):

| Gebruik | `role` | `status` | Opmerking |
|--------|--------|----------|-----------|
| Test admin | `admin` | `active` | Inloggen adminomgeving; ledenlijst lezen/bewerken waar tests dat vereisen. |
| Active test member | `member` | `active` | Inloggen ledenportaal; geen admin-toegang. |
| Pending test member | `member` | `pending` | Eerste login/activeer-flow via `activate_current_user_profile` (dashboard). |
| Inactive test member | `member` | `inactive` | Geen normale toegang tot ledenportaal; test van geblokkeerde toegang. |

Credentials voor admin en active member staan in omgevingsvariabelen (zie `.env.example`). Pending en inactive leden zijn vooral nodig voor gerichte scenarios; ze hoeven niet allemaal in CI-secrets te staan, maar moeten wel bewust in Supabase bestaan als ze getest worden.

### Profielbewerking test member

Voor de Playwright-test van profielgegevens bewerken wordt een aparte actieve member gebruikt. Deze testidentiteit is bedoeld voor het gecontroleerd wijzigen en terugzetten van toegestane profielvelden via de admin-UI. De test gebruikt geen standaard member, geen statusmutatie-member, geen pending member en geen inactive member.

| Testgebruiker | Role | Status | Doel |
|---|---|---|---|
| Profielbewerking test member (`TEST_PROFILE_MEMBER_EMAIL`, `TEST_PROFILE_MEMBER_PASSWORD`, `TEST_PROFILE_MEMBER_DISPLAY_NAME`) | `member` | `active` | Testen dat een admin toegestane profielvelden kan wijzigen, opslaan, controleren en terugzetten. |


### Create-member testidentity

Voor de Playwright-test van de nieuw-lid-aanmaakflow wordt een aparte testidentity gebruikt. Deze identity is bedoeld om via de admin-UI en de Supabase Edge Function `create-member` een nieuw lid uit te nodigen en als `member` met `status = pending` in `public.profiles` te controleren.

Deze testidentity hoort bewust **niet** in `scripts/testdata/manifest.json`, omdat het seed-script voor manifest-users een wachtwoord verwacht en deze flow via `inviteUserByEmail` werkt. Voor deze invite-flow is geen lokaal wachtwoord nodig.

| Testidentity | Doel | Opmerking |
|---|---|---|
| `TEST_CREATE_MEMBER_EMAIL`, `TEST_CREATE_MEMBER_DISPLAY_NAME` | E2E-test nieuw lid toevoegen via admin-UI en `create-member` | Tijdelijke Auth-user en profiel worden vóór en na de test opgeschoond. |

Aanvullende afspraken:

- Gebruik geen standaard admin, member, pending member, inactive member, statusmutatie-member of profielbewerking-member voor deze test.
- De test gebruikt een apart test-e-mailadres en geen echte persoonsgegevens.
- De test kan een Supabase Auth-user, een uitnodiging en een `public.profiles`-record aanmaken.
- Cleanup moet zowel Supabase Auth (`auth.users`) als `public.profiles` controleren.
- De test draait standaard Chromium-only, omdat deze Supabase Auth en `public.profiles` muteert.
- De test is opt-in en draait alleen als `TEST_CREATE_MEMBER_E2E_ENABLED=true` is gezet. Standaard staat deze test uit om onbedoelde uitnodigingsmails en Supabase mail-rate-limits te voorkomen.
- Als cleanup faalt, moet dit als risico worden onderzocht voordat de test opnieuw wordt gebruikt.

## Consistentie Auth en profiles

Supabase Auth (`auth.users`) en `public.profiles` moeten consistent zijn:

- Elke testuser heeft een `auth.users`-record met het test-e-mailadres.
- Elk profiel heeft `auth_user_id` gelijk aan `auth.users.id`.
- `email` in `profiles` komt overeen met het Auth-e-mailadres.
- `role` en `status` in `profiles` volgen de tabel hierboven.
- Verwijderen of resetten gebeurt op beide plekken (Auth + profiel), anders ontstaan weesrecords of mislukte logins.

Wijzig testdata niet handmatig in alleen een van de twee tabellen zonder de andere te controleren.

## Geheimen en service_role

- `SUPABASE_SERVICE_ROLE_KEY` mag nooit in Git staan: niet in een commit, pull request, logbestand of terminaluitvoer.
- Voor het seed-script staat deze sleutel uitsluitend lokaal in `.env.testdata`, dat door Git wordt genegeerd, of later in expliciet goedgekeurde beveiligde CI-secrets.
- `.env` blijft bedoeld voor lokale Playwright- en E2E-configuratie. Het seed-script leest `.env` niet.
- Gebruik voor seed- en muterende testdata nooit de productie-service-role-key.
- De publishable/anon key in de frontend (`js/auth.js`) is geen service_role en blijft gescheiden van seed- en beheerscripts.

## Seed-script

Het seed-script is aanwezig als `scripts/testdata/seed-test-users.mjs`. De toegestane gebruikers, rollen, statussen en env-keys staan in `scripts/testdata/manifest.json`.

Veiligheidsafspraken:

- Zonder argument of met `--dry-run` voert het script geen Supabase-mutaties uit.
- Het script leest lokale seedconfiguratie uitsluitend uit `.env.testdata`.
- Alleen het afgescheiden Supabase-testproject `https://lldmyfvhjypomxfpltlx.supabase.co` is toegestaan.
- Het manifest en `SUPABASE_URL` moeten beide exact naar dit testproject verwijzen.
- Productie en ieder onbekend Supabase-project worden vóór een Auth-lookup of mutatie geweigerd.
- `--apply` moet expliciet worden opgegeven voordat Auth-users kunnen worden aangemaakt of bijgewerkt.
- Het script logt geen wachtwoorden en geen service-role-key.
- De huidige apply-functionaliteit beheert uitsluitend gecontroleerde Supabase Auth-users.
- Het script voert momenteel geen mutaties uit op `public.profiles`.
- Verwijderen en cleanup van Auth-users of profielen gebeurt niet automatisch door dit seed-script.

Voer altijd eerst uit:

`node scripts/testdata/seed-test-users.mjs --dry-run`

Gebruik `--apply` pas nadat de project-URL, het manifest, de geplande acties en de testidentiteiten zijn gecontroleerd.

## Playwright en echte leden

Playwright-tests (`tests/auth.spec.ts`) mogen niet structureel leunen op echte leden in de database (bijv. namen of e-mailadressen van bestaande productieleden).

- Gebruik vaste testidentiteiten en omgevingsvariabelen (`TEST_*` in `.env.example`).
- Display names voor assertions horen bij testaccounts (`TEST_ADMIN_DISPLAY_NAME`, `TEST_MEMBER_DISPLAY_NAME`), niet bij willekeurige leden in de lijst.
- CI levert credentials via GitHub Secrets; de onderliggende Supabase-data moet de vaste testrollen/statussen respecteren.

## Lokale setup (O)

1. Kopieer `.env.example` naar `.env` voor lokale Playwright- en E2E-tests. Commit dit bestand niet.
2. Kopieer `.env.testdata.example` naar `.env.testdata` voor seed- en testdatabeheer. Commit dit bestand niet.
3. Vul `.env.testdata` uitsluitend met de service-role-key en testidentiteiten van het afgescheiden Supabase-testproject.
4. Controleer dat `SUPABASE_URL` in `.env.testdata` exact `https://lldmyfvhjypomxfpltlx.supabase.co` is.
5. Voer eerst `node scripts/testdata/seed-test-users.mjs --dry-run` uit.
6. Beoordeel alle validatiemeldingen en geplande acties voordat bewust `--apply` wordt gebruikt.
7. Zorg dat Supabase Auth en `public.profiles` consistent zijn voordat Playwright-regressie wordt uitgevoerd.
8. Start de site lokaal op `http://localhost:5500` en voer bijvoorbeeld `npx playwright test tests/auth.spec.ts` uit.

## OTAP-impact

| Omgeving | Impact |
|----------|--------|
| **O - Ontwikkel** | `.env` wordt gebruikt voor lokale Playwright- en E2E-configuratie. `.env.testdata` wordt afzonderlijk gebruikt voor seed- en testdatabeheer tegen uitsluitend het afgescheiden Supabase-testproject. |
| **T - Test** | GitHub Actions gebruikt bestaande repository secrets voor de huidige regressietests. Er is in deze fase nog geen automatisch muterend seed-proces. Een toekomstige muterende workflow mag uitsluitend beschermd en tegen het afgescheiden testproject draaien. |
| **A - Acceptatie** | Vercel Preview en functionele acceptatietests gebruiken alleen herkenbare testidentiteiten en geen echte persoonsgegevens. Mutaties mogen niet naar productie worden geleid. |
| **P - Productie** | Productie is geen seed-, testdata- of mutatieomgeving. Het seed-script blokkeert de productieproject-URL. Testgebruikers en testprofielen horen niet als structurele productiedata aanwezig te zijn. |

## Referenties in de codebase

- Seed-script: `scripts/testdata/seed-test-users.mjs`
- Seed-manifest: `scripts/testdata/manifest.json`
- Veilige voorbeeldconfiguratie: `.env.testdata.example`
- Playwright-configuratie: `.env.example`
- Playwright: `tests/auth.spec.ts`
- CI-secrets en bestaande pipeline: `.github/workflows/ci.yml`
- Auth/profielen: `js/auth.js`, `leden/dashboard.html`
- Ledenbeheer: `admin/ledenbeheer.js`
- Edge Function-broncode: `scripts/create-member/`, `scripts/resend-member-invite/`
- Actuele databasebasis: `supabase/migrations/`
### Resend-member-invite opt-in test

De test voor opnieuw uitnodigen van pending leden is bewust opt-in.

Gebruikte instelling:

- `TEST_RESEND_MEMBER_INVITE_E2E_ENABLED=false`

Standaard blijft deze test uitgeschakeld, omdat de flow via `resend-member-invite` een echte Supabase Auth reset-/uitnodigingsmail kan versturen en daardoor e-mail-rate-limits kan raken.

De test gebruikt de bestaande pending testidentity:

- `TEST_MEMBER_PENDING_EMAIL`
- `TEST_MEMBER_PENDING_DISPLAY_NAME`

De test hoort niet standaard in de volledige regressie actief te zijn. Alleen bewust inschakelen als runtime-validatie van de resend-flow nodig is.

## Read-only profielcontrole

Gebruik: `node scripts/testdata/seed-test-users.mjs --profiles-dry-run`

Deze modus leest uitsluitend de zes Auth-users en de gekoppelde records uit `public.profiles`.
Er worden geen Auth-users of profielen aangemaakt, bijgewerkt of verwijderd.

Mogelijke resultaten:

- `missing`: profiel ontbreekt;
- `matching`: profiel komt volledig overeen;
- `different`: profiel wijkt af;
- `conflict`: koppeling op Auth-id en e-mail is niet eenduidig;
- `error`: de read-only query is mislukt;
- `auth-missing`: de vereiste Auth-user ontbreekt.

`--apply` blijft uitsluitend Auth-users aanmaken of bijwerken.
Er bestaat nog geen profielmutatiemodus.
