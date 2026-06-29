# FlySight

FlySight je prototip digitalnega dvojčka za podatke o pticah v Sloveniji. Projekt združuje podatke iz virov, kot sta DOPPS oziroma ptice.si in eBird, jih pretvori v enoten podatkovni model ter omogoča pregled, filtriranje, administracijo in vizualizacijo opažanj na zemljevidu.

Sistem je sestavljen iz spletnega vmesnika, backend REST API-ja, PostgreSQL podatkovne baze, namizne administratorske aplikacije in dodatnega CityInfra DSL modula za opis prostorske infrastrukture ter izvoz v GeoJSON.

## Ključne funkcionalnosti

- prijava in registracija uporabnikov z JWT avtentikacijo,
- pregled ptic, lokacij in opažanj na interaktivnem zemljevidu,
- filtriranje opažanj po vrsti, lokaciji, datumu in viru podatkov,
- dodajanje lastnih opažanj in priljubljenih ptic,
- administratorski pregled podatkovnih tabel,
- uvoz podatkov iz DOPPS/ptice.si in eBird,
- generator testnih opažanj,
- eBird integracija prek REST API-ja in WebSocket povezave,
- Docker okolje z Nginx reverse proxyjem,
- CityInfra DSL: `.flyinfra` -> tokeni -> AST -> validacija -> GeoJSON.

## Arhitektura

```text
Uporabnik
  |-- React frontend + Leaflet zemljevid
  |-- Kotlin Compose desktop aplikacija

React / Desktop
  |-- HTTP REST + JWT
  |-- WebSocket /ws/ebird

Nginx reverse proxy
  |-- /auth, /api, /health, /ws -> Express backend
  |-- / -> React frontend

Express backend
  |-- PostgreSQL podatkovna baza
  |-- eBird API
  |-- DOPPS/eBird import
```

Glavni deli repozitorija:

| Pot                  | Namen                                                         |
| -------------------- | ------------------------------------------------------------- |
| `frontend/`          | React + TypeScript spletni vmesnik                            |
| `backend/`           | Node.js, Express in TypeScript REST API                       |
| `composeApp/`        | Kotlin Compose Desktop aplikacija, scraperji in CityInfra DSL |
| `docs/`              | dokumentacija in primeri za CityInfra DSL                     |
| `docker-compose.yml` | lokalno Docker okolje za frontend, backend, bazo in Nginx     |
| `nginx.conf`         | reverse proxy konfiguracija                                   |

## Tehnologije

- Frontend: React, TypeScript, Vite, Leaflet, React Leaflet
- Backend: Node.js, Express, TypeScript, WebSocket, JWT, bcrypt
- Baza: PostgreSQL
- Desktop: Kotlin, Jetpack Compose Desktop
- Podatki: DOPPS/ptice.si, eBird API, CSV/JSON uvoz
- DevOps: Docker, Docker Compose, Nginx
- DSL: Kotlin lexer, parser, AST, semantični validator in GeoJSON exporter

## Zahteve

Za Docker namestitev potrebujete:

- Docker Desktop ali Docker Engine,
- Docker Compose.

Za lokalni razvoj brez Dockerja potrebujete:

- Node.js,
- npm,
- JDK,
- Gradle wrapper je že vključen v repozitorij,
- lokalno PostgreSQL bazo ali Docker PostgreSQL container.

## Namestitev z Dockerjem

Najpreprostejši zagon celotnega sistema je prek Docker Compose.

1. Kopirajte primer konfiguracije:

```bash
cp .env.example .env
```

Na Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

2. Po potrebi uredite `.env`:

```env
POSTGRES_DB=flysight
POSTGRES_USER=flysight
POSTGRES_PASSWORD=flysight
DATABASE_URL=postgres://flysight:flysight@postgres:5432/flysight
JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=2h
CORS_ORIGIN=http://localhost
RATE_LIMIT_MAX=300
EBIRD_API_KEY=your-ebird-api-key
EBIRD_MAX_RESULTS=500
```

3. Zaženite aplikacijo:

```bash
docker compose up --build
```

4. Odprite aplikacijo:

```text
http://localhost
```

Uporabni endpointi:

```text
GET http://localhost/health
GET http://localhost/api/...
POST http://localhost/auth/login
WS  ws://localhost/ws/ebird
```

Za ustavitev okolja:

```bash
docker compose down
```

Za ustavitev in brisanje podatkovne baze:

```bash
docker compose down -v
```

## Lokalni razvoj

### Backend

```bash
cd backend
npm install
npm run dev
```

Backend privzeto teče na portu `3000`. Pri lokalnem zagonu mora biti `DATABASE_URL` nastavljen na dostopno PostgreSQL bazo.

Preverjanje tipov in build:

```bash
npm run typecheck
npm run build
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite običajno zažene aplikacijo na:

```text
http://localhost:5173
```

Preverjanje tipov in produkcijski build:

```bash
npm run typecheck
npm run build
```

### Namizna aplikacija

Namizna aplikacija je v modulu `composeApp` in uporablja Kotlin Compose Desktop. Za zagon iz korena repozitorija uporabite:

```bash
./gradlew :composeApp:run
```

Na Windows:

```powershell
.\gradlew.bat :composeApp:run
```

Aplikacija se poveže na FlySight backend prek REST API-ja. Pred uporabo naj bo backend že zagnan, uporabnik pa se prijavi z veljavnim računom oziroma administratorskim dostopom.

### CityInfra DSL demo

CityInfra demo prebere primer DSL zapisa in izpiše GeoJSON rezultat.

```bash
./gradlew :composeApp:cityInfraDemo
```

Na Windows:

```powershell
.\gradlew.bat :composeApp:cityInfraDemo
```

Primer DSL datoteke je v:

```text
docs/cityinfra-demo.ci
```

## Ključni primeri uporabe

### 1. Prijava uporabnika

Uporabnik odpre spletno ali namizno aplikacijo, vnese email in geslo, aplikacija pa pošlje zahtevek na backend.

```text
Uporabnik -> Frontend/Desktop -> POST /auth/login -> Backend -> PostgreSQL
```

Backend preveri uporabnika, primerja hash gesla in ob uspešni prijavi vrne JWT token. Token se nato uporablja pri zaščitenih API zahtevkih.

### 2. Pregled opažanj na zemljevidu

Uporabnik odpre spletno aplikacijo, kjer frontend pridobi opažanja in jih prikaže na Leaflet zemljevidu.

```text
Frontend -> GET /api/visualization/observations -> Backend -> PostgreSQL -> Leaflet zemljevid
```

Uporabnik lahko opažanja filtrira po vrsti ptice, lokaciji, datumu in viru podatkov.

### 3. Prikaz svežih eBird podatkov

Frontend ali desktop aplikacija zahteva sveža eBird opažanja za Slovenijo.

```text
Frontend/Desktop -> GET /api/ebird/recent -> Backend -> eBird API
```

Backend podatke normalizira in jih vrne aplikaciji, kjer se prikažejo v tabeli ali na zemljevidu. Spletni vmesnik uporablja tudi WebSocket pot `/ws/ebird` za eBird način delovanja.

### 4. Uvoz DOPPS podatkov

Namizna aplikacija prebere lokalno datoteko s podatki iz DOPPS/ptice.si, uporabnik podatke pregleda in sproži uvoz.

```text
DOPPS scraper -> ptice_slovenije.json -> Desktop app -> POST /api/import/dopps -> Backend -> PostgreSQL
```

Backend shrani družine in vrste ptic v podatkovno bazo.

### 5. Administracija podatkov

Administrator se prijavi v desktop ali spletni admin pogled in upravlja podatkovne tabele.

```text
Admin -> Desktop/Admin UI -> GET/POST/PUT/DELETE /api/:table -> Backend -> PostgreSQL
```

Podprti so pregled, dodajanje, urejanje in brisanje zapisov, odvisno od tabele in uporabniške vloge.

### 6. Dodajanje lastnega opažanja

Prijavljen uporabnik lahko doda svoje opažanje ptice z lokacijo, datumom in dodatnimi metapodatki.

```text
Uporabnik -> POST /api/me/observations -> Backend -> PostgreSQL
```

Opažanje se lahko nato uporabi v osebnem pregledu in vizualizaciji podatkov.

### 7. CityInfra DSL izvoz

Razvijalec zapiše mestno infrastrukturo v `.flyinfra` oziroma `.ci` datoteki, CityInfra modul pa jo pretvori v GeoJSON.

```text
.flyinfra -> Lexer -> Parser -> AST -> SemanticValidator -> GeoJsonExporter -> GeoJSON
```

Ta del prikazuje prevajalski tok: tokenizacijo, parsanje, semantično validacijo in generiranje izhodnega formata za zemljevid.

## Varnost

FlySight uporablja več osnovnih varnostnih mehanizmov:

- JWT tokeni za avtentikacijo,
- ločitev navadnih uporabnikov in administratorjev,
- bcrypt hashiranje gesel,
- zaščitene admin API poti,
- CORS konfiguracija,
- Helmet varnostni headerji,
- rate limiting,
- občutljive vrednosti v `.env` oziroma GitHub Secrets.

Opomba: vrednosti iz `.env.example` so namenjene lokalnemu razvoju. Za produkcijo nastavite lastne skrivnosti, gesla in eBird API ključ.

## Koristni ukazi

```bash
# Celoten sistem z Dockerjem
docker compose up --build

# Backend
cd backend
npm install
npm run dev
npm run typecheck
npm run build

# Frontend
cd frontend
npm install
npm run dev
npm run typecheck
npm run build

# Desktop aplikacija
./gradlew :composeApp:run

# CityInfra demo
./gradlew :composeApp:cityInfraDemo
```
