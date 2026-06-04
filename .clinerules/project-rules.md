# Projectregels spontaan-website

## Basiswerkwijze

1. Controleer altijd eerst de actuele bestanden.
2. Analyseer altijd voor wijziging.
3. Doe geen wijziging zonder expliciet akkoord van Jim.
4. Benoem vooraf welke bestanden geraakt worden.
5. Voeg geen nieuwe dependency toe zonder uitleg en akkoord.
6. Respecteer de bestaande architectuur: GitHub, Vercel, Supabase, Playwright, Lighthouse, GitHub Actions en OTAP.

## Wijzigingen

1. Werk in kleine stappen.
2. Geef eerst een wijzigingsvoorstel.
3. Pas pas aan na akkoord.
4. Toon na wijziging altijd de geraakte bestanden, het doel, de risico's en de noodzakelijke tests.

## Git en branches

1. Werk nooit direct op main.
2. Controleer altijd eerst git status.
3. Controleer na wijzigingen altijd git diff.
4. Commit of push niets zonder expliciete opdracht van Jim.

## Testen

Gebruik bestaande Playwright-inrichting. Installeer Playwright niet opnieuw.

Bepaal per wijziging welke tests nodig zijn:
- Playwright-regressietest;
- Lighthouse;
- npm audit/security check;
- handmatige controle in browser;
- Supabase-runtimecontrole indien relevant.

## Supabase en ledenbeheer

Bij wijzigingen rond ledenbeheer, Supabase of public-tabellen altijd expliciet beoordelen:
1. RLS;
2. grants;
3. rechten voor authenticated/anon;
4. Security Advisor;
5. effect op bestaande ledenbeheerflow;
6. Playwright-test voor de flow;
7. risico op productie-effect.

## Documentatie en logging

Alle goedgekeurde wijzigingen moeten worden gelogd in het daglogboek.

Leg minimaal vast:
1. datum;
2. branch;
3. aanleiding;
4. analyse;
5. gewijzigde bestanden;
6. uitgevoerde controles;
7. testresultaten;
8. risico's;
9. openstaande punten;
10. expliciet gemaakte chatbesluiten.

## Anti-hallucinatie

1. Geen aannames doen over bestanden die niet zijn gecontroleerd.
2. Geen definitieve uitspraken doen zonder actuele broncontrole.
3. Bij ontbrekende informatie eerst aangeven wat ontbreekt.
4. Documentatie en laatste bijlagen zijn leidend.