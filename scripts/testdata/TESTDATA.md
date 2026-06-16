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

- `SUPABASE_SERVICE_ROLE_KEY` mag nooit in Git staan (geen commit, geen PR, geen log).
- Alleen lokaal in een niet-gecommit bestand (bijv. `.env`, lokaal genegeerd) of in beveiligde CI-secrets waar dat expliciet is goedgekeurd.
- De publishable/anon key in de frontend (`js/auth.js`) is geen service_role; die blijft gescheiden van seed/beheer-scripts.

## Seed-script (later)

Er is nog geen seed-script in deze repository.

Een toekomstig seed-script wordt apart ontworpen en:

- draait alleen gecontroleerd (handmatig lokaal of via vast proces);
- gebruikt `SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` uit de omgeving;
- is idempotent (veilig opnieuw uitvoerbaar);
- volgt de rollen/statussen in dit document.

Tot dat script er is: testaccounts handmatig aanmaken in Supabase volgens dit document, of bestaande testaccounts onderhouden.

## Playwright en echte leden

Playwright-tests (`tests/auth.spec.ts`) mogen niet structureel leunen op echte leden in de database (bijv. namen of e-mailadressen van bestaande productieleden).

- Gebruik vaste testidentiteiten en omgevingsvariabelen (`TEST_*` in `.env.example`).
- Display names voor assertions horen bij testaccounts (`TEST_ADMIN_DISPLAY_NAME`, `TEST_MEMBER_DISPLAY_NAME`), niet bij willekeurige leden in de lijst.
- CI levert credentials via GitHub Secrets; de onderliggende Supabase-data moet de vaste testrollen/statussen respecteren.

## Lokale setup (O)

1. Kopieer `.env.example` naar `.env` (niet committen).
2. Vul placeholders in met testcredentials en eventueel Supabase-URL (alleen lokaal).
3. Zorg dat de testaccounts in Supabase bestaan en consistent zijn met dit document.
4. Start de site lokaal (`http://localhost:5500`) en voer regressie uit, bijvoorbeeld:
   `npx playwright test tests/auth.spec.ts`

## OTAP-impact

| Omgeving | Impact |
|----------|--------|
| **O - Ontwikkel** | Lokale testdata in Supabase; `.env` lokaal; lokale Playwright-regressie tegen vaste testgebruikers. |
| **T - Test** | GitHub Actions gebruikt repository secrets (`TEST_ADMIN_*`, `TEST_MEMBER_*`); geen wijziging aan CI in stap 1. Data in Supabase moet testaccounts bevatten die aan dit contract voldoen. |
| **A - Acceptatie** | Testers kunnen later in de acceptatieomgeving (bijv. Vercel Preview) functioneel testen met dezelfde afspraken; nog steeds alleen testidentiteiten, geen echte persoonsgegevens. |
| **P - Productie** | Testgebruikers en testprofielen moeten voor productie-gereedmelding verwijderd zijn. Productie is geen primaire testomgeving. |

## Referenties in de codebase

- Playwright: `tests/auth.spec.ts`
- CI-secrets: `.github/workflows/ci.yml`
- Auth/profielen: `js/auth.js`, `leden/dashboard.html`
- Ledenbeheer: `admin/ledenbeheer.js`
- Edge Functions (productiepad lid aanmaken): `scripts/create-member/`, `scripts/resend-member-invite/`
- SQL (RLS/activatie): `scripts/supabase_ledenbeheer_step1_profiles.sql`, `scripts/supabase_ledenbeheer_step2_activate_profile.sql`

### Resend-member-invite opt-in test

De test voor opnieuw uitnodigen van pending leden is bewust opt-in.

Gebruikte instelling:

- `TEST_RESEND_MEMBER_INVITE_E2E_ENABLED=false`

Standaard blijft deze test uitgeschakeld, omdat de flow via `resend-member-invite` een echte Supabase Auth reset-/uitnodigingsmail kan versturen en daardoor e-mail-rate-limits kan raken.

De test gebruikt de bestaande pending testidentity:

- `TEST_MEMBER_PENDING_EMAIL`
- `TEST_MEMBER_PENDING_DISPLAY_NAME`

De test hoort niet standaard in de volledige regressie actief te zijn. Alleen bewust inschakelen als runtime-validatie van de resend-flow nodig is.
