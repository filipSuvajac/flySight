# 4. Dokumentacija izvedenih lastnosti

V tem poglavju so opisane glavne funkcionalnosti, ki so bile izvedene v projektu. Pri vsaki funkcionalnosti je najprej razloženo, zakaj smo jo potrebovali, nato pa še, kako je narejena in kako se uporablja.

## 4.1 Avtentikacija z JWT

### Namen implementacije

To funkcionalnost smo potrebovali zato, da aplikacija ne bi bila odprta brez prijave. Uporabnik mora imeti svoj račun, backend pa mora znati preveriti, ali ima zahtevek veljaven token.

### Način implementacije in uporabe

Backend uporablja endpointa `POST /auth/register` in `POST /auth/login`. Gesla se hashirajo z `bcrypt`, po uspešni prijavi pa backend vrne JWT token. Token se pri zahtevkih pošlje v headerju:

```text
Authorization: Bearer <token>
```

Middleware `requireAuth` preveri veljavnost tokena, `requireAdmin` pa preveri administratorski dostop. Frontend token shrani lokalno in ga uporablja pri klicih zaščitenih endpointov.

## 4.2 Uporabniške vloge in administratorski dostop

### Namen implementacije

Ta del loči navadno uporabo aplikacije od administratorskih funkcij. Navaden uporabnik naj vidi predvsem zemljevid, svoja opažanja, profil in priljubljene ptice, administrator pa še upravljanje virov in podatkov.

### Način implementacije in uporabe

Tabela `users` vsebuje polje `role`. Backend ima pripravljene administratorske račune za razvoj:

- `filip@flysight.test`,
- `niko@flysight.test`,
- `enej@flysight.test`.

Frontend z `isAdminUser` določi, katere strani se uporabniku prikažejo. Navadni uporabnik vidi osnovne strani, administrator pa dodatno vidi `Analytics`, `Data`, `Admin` in `CityInfra`.

## 4.3 PostgreSQL podatkovni model

### Namen implementacije

Namen je shraniti podatke o uporabnikih, pticah, lokacijah, opažanjih, profilih, priljubljenih pticah in podatkovnih virih v strukturirano relacijsko bazo.

### Način implementacije in uporabe

Backend ob zagonu izvede `ensureSchema()` iz `backend/src/schema.ts`. Ustvarijo se tabele:

- `users`,
- `bird_family`,
- `bird_info`,
- `location`,
- `observation`,
- `import_batch`,
- `data_source_settings`,
- `user_profiles`,
- `favorite_bird`.

Ustvarijo se tudi `updated_at` triggerji. Podatki o pticah se ob prvem zagonu napolnijo iz `composeApp/ptice_slovenije.json`.

## 4.4 DOPPS katalog ptic

### Namen implementacije

Namen je zagotoviti slovenski katalog ptic z družinami, vrstami, latinskimi imeni, opisi in slikami.

### Način implementacije in uporabe

Katalog je shranjen v `composeApp/ptice_slovenije.json`. Backend ga pri inicializaciji prebere in shrani v tabeli `bird_family` in `bird_info`. Podatki se nato uporabljajo pri:

- prikazu vrst,
- dodajanju osebnih opažanj,
- priljubljenih pticah,
- povezovanju eBird podatkov s slovenskimi imeni in slikami.

## 4.5 Interaktivni zemljevid

### Namen implementacije

Namen je uporabniku omogočiti prostorski pregled opažanj ptic.

### Način implementacije in uporabe

Frontend uporablja Leaflet in React Leaflet. Komponenta zemljevida pridobi podatke prek:

```text
GET /api/visualization/observations
```

Backend združi podatke iz tabel `observation`, `bird_info`, `bird_family`, `location` in `favorite_bird`. Uporabnik na strani `Explore` vidi markerje in ob kliku pregleda podrobnosti opažanja.

## 4.6 Filtriranje opažanj

### Namen implementacije

Namen je omogočiti pregled samo tistih opažanj, ki ustrezajo izbranim kriterijem.

### Način implementacije in uporabe

Frontend pošilja filtre kot query parametre:

```text
species
location
source
from
to
limit
```

Backend funkcija `buildVisualizationFilters` iz parametrov sestavi SQL pogoje. Vrednosti so poslane kot parametri poizvedbe, zato se uporabniški vnosi ne lepijo neposredno v SQL.

## 4.7 Osebna opažanja

### Namen implementacije

Namen je omogočiti uporabniku, da vodi lasten dnevnik opažanj ptic.

### Način implementacije in uporabe

Frontend stran `MySightingsPage` uporablja endpointa:

```text
GET /api/me/observations
POST /api/me/observations
DELETE /api/me/observations/:id
```

Pri dodajanju backend preveri ptico, lokacijo, koordinate, datum in število osebkov. Če uporabnik vnese novo vrsto ptice, jo backend shrani kot uporabniški vir. Uporabnik lahko svoja opažanja tudi izbriše.

## 4.8 Priljubljene ptice

### Namen implementacije

Namen je omogočiti osebni seznam ptic, ki jih uporabnik želi spremljati ali si jih zapomniti.

### Način implementacije in uporabe

Priljubljene ptice so shranjene v tabeli `favorite_bird`, ki povezuje uporabnika in ptico. Backend endpointi:

```text
GET /api/me/favorites
POST /api/me/favorites
DELETE /api/me/favorites/:birdId
```

Frontend jih prikaže na strani `Favorites`. Uporabnik lahko vrsto doda ali odstrani.

## 4.9 Urejanje profila

### Namen implementacije

Namen je omogočiti uporabniku urejanje osnovnih osebnih podatkov.

### Način implementacije in uporabe

Backend uporablja:

```text
GET /api/me/profile
PUT /api/me/profile
```

Podatki profila so razdeljeni med tabeli `users` in `user_profiles`. Uporabnik lahko spremeni ime, email, opis, lokacijo in geslo. Če se spremeni email ali geslo, backend vrne tudi nov JWT token.

## 4.10 eBird REST integracija

### Namen implementacije

Namen je pridobiti aktualna opažanja in hotspote iz eBird za Slovenijo.

### Način implementacije in uporabe

Backend uporablja eBird API in izpostavi endpointa:

```text
GET /api/ebird/recent
GET /api/ebird/hotspots
GET /api/ebird/hotspots/:locId/recent
```

Regija je nastavljena na `SI`. Backend podatke normalizira v enoten format, frontend pa jih prikaže v eBird panelu.

## 4.11 eBird WebSocket povezava

### Namen implementacije

Namen je omogočiti osveževanje eBird podatkov prek WebSocket povezave.

### Način implementacije in uporabe

Backend ustvari WebSocket strežnik na:

```text
/ws/ebird
```

Token se pošlje kot query parameter. Če token manjka ali ni veljaven, backend zapre povezavo. Ob veljavni povezavi backend pošlje stanje nalaganja in nato eBird opažanja.

## 4.12 Administracija podatkovnih virov

### Namen implementacije

Namen je administratorju omogočiti nadzor nad viri podatkov.

### Način implementacije in uporabe

Tabela `data_source_settings` hrani vire:

- `ebird`,
- `dopps`,
- `generated`,
- `cityinfra`.

Frontend stran `AdminPage` omogoča urejanje stanja vira, regije, največjega števila rezultatov in števila dni. Administrator lahko sproži akcije, kot so osvežitev eBird podatkov, generiranje testnih opažanj ali označitev vira kot sinhroniziranega.

## 4.13 Generiranje testnih opažanj

### Namen implementacije

Namen je hitro pripraviti testne podatke za demonstracijo in razvoj.

### Način implementacije in uporabe

Backend endpoint:

```text
POST /api/generate/observations
```

Generira opažanja na podlagi obstoječih ptic in lokacij. Če lokacije še ne obstajajo, backend ustvari nekaj generiranih lokacij. Administrator lahko generiranje sproži iz strani `Admin`.

## 4.14 Generični CRUD API

### Namen implementacije

Namen je administratorju omogočiti upravljanje osnovnih podatkovnih tabel brez ločenega endpointa za vsako tabelo.

### Način implementacije in uporabe

Backend uporablja konfiguracijo v `backend/src/tables.ts`. Dovoljene tabele so:

- `bird_family`,
- `bird_info`,
- `location`,
- `observation`,
- `app_event`.

Funkcija `requireTable` preveri, ali je tabela dovoljena, `sanitizeBody` pa spusti samo dovoljena zapisljiva polja. S tem se prepreči poljuben dostop do baze.

## 4.15 Kotlin Compose Desktop aplikacija

### Namen implementacije

Namen je podpreti administratorska in razvojna opravila v namiznem vmesniku.

### Način implementacije in uporabe

Namizna aplikacija je v modulu `composeApp`. Uporablja Kotlin, Jetpack Compose Desktop, OkHttp, kotlinx.serialization in coroutines. Zažene se z:

```powershell
.\gradlew.bat :composeApp:run
```

Aplikacija komunicira z backend API-jem, zato mora biti backend pred uporabo zagnan.

## 4.16 CityInfra DSL

### Namen implementacije

Namen je prikazati dodatni del projekta, povezan z digitalnimi dvojčki in opisom prostorske infrastrukture.

### Način implementacije in uporabe

CityInfra modul vsebuje:

- `Lexer.kt`,
- `Parser.kt`,
- `Ast.kt`,
- `SemanticValidator.kt`,
- `GeoJsonExporter.kt`,
- `CityInfraMain.kt`.

Tok obdelave:

```text
.ci zapis -> tokeni -> AST -> semantična validacija -> GeoJSON
```

Demo se zažene z:

```powershell
.\gradlew.bat :composeApp:cityInfraDemo
```

Vhodni primer je v `docs/cityinfra-demo.ci`.

## 4.17 Docker Compose okolje

### Namen implementacije

Namen je poenostaviti zagon celotnega sistema.

### Način implementacije in uporabe

`docker-compose.yml` definira servise:

- `postgres`,
- `backend`,
- `frontend`,
- `proxy`.

Nginx proxy usmerja:

- `/` na frontend,
- `/api/` na backend,
- `/auth/` na backend,
- `/health` na backend,
- `/ws/` na backend WebSocket.

Zagon:

```bash
docker compose up --build
```

## 4.18 Produkcijski Docker Compose

### Namen implementacije

Namen je omogočiti produkcijski zagon backend storitve iz že zgrajene Docker Hub slike.

### Način implementacije in uporabe

`docker-compose.prod.yml` uporablja:

```text
${DOCKERHUB_USERNAME}/flysight-backend:latest
```

Produkcijski compose definira `postgres` in `backend`. PostgreSQL je na gostitelju izpostavljen na portu `5433`, backend pa na portu `3000`.

Zagon:

```bash
docker compose -f docker-compose.prod.yml up -d
```

## 4.19 GitHub Actions CI/CD

### Namen implementacije

Namen je avtomatizirati build in deployment backend aplikacije.

### Način implementacije in uporabe

Workflow je v:

```text
.github/workflows/deploy-backend.yml
```

Sproži se ob pushu na vejo `master` ali ročno prek `workflow_dispatch`. Ima dva joba:

1. `build-and-push`,
2. `notify-server`.

Prvi job zgradi backend Docker sliko in jo objavi na Docker Hub z oznakama:

```text
flysight-backend:latest
flysight-backend:<github_sha>
```

Drugi job pošlje podpisan webhook zahtevek na Azure VM.

Uporabljeni GitHub Secrets:

| Secret | Namen |
| --- | --- |
| `DOCKERHUB_USERNAME` | Docker Hub uporabniško ime |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `WEBHOOK_URL` | URL webhook endpointa |
| `WEBHOOK_SECRET` | Skrivnost za HMAC podpis |

## 4.20 Webhook deployment

### Namen implementacije

Namen je omogočiti, da GitHub Actions varno sproži posodobitev backend containerja na strežniku.

### Način implementacije in uporabe

Webhook strežnik je v:

```text
scripts/webhook-server.py
```

Endpointi:

```text
GET /health
POST /deploy
```

Webhook preveri header:

```text
X-FlySight-Signature
```

Podpis se preveri z HMAC SHA-256 in `WEBHOOK_SECRET`. Če podpis ni pravilen, webhook vrne `401 invalid signature`. Če deployment že poteka, vrne `409 deployment already running`.

## 4.21 Deploy skripta

### Namen implementacije

Namen je avtomatsko prenesti najnovejšo backend sliko in zamenjati obstoječi backend container.

### Način implementacije in uporabe

Deploy skripta je:

```text
scripts/deploy-backend.sh
```

Izvede:

1. premik v `/home/flysight/flySight`,
2. `docker compose -f docker-compose.prod.yml pull backend`,
3. ustavitev trenutnega backend containerja,
4. odstranitev starega backend containerja,
5. zagon novega backend containerja,
6. čiščenje starih Docker slik,
7. preverjanje `http://localhost/health`.

Skripto kliče webhook strežnik po uspešno preverjenem podpisu.
