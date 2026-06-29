# FlySight

FlySight je prototip digitalnega dvojčka za podatke o pticah v Sloveniji. Aplikacija združuje podatke iz različnih virov, jih pretvori v enoten podatkovni model ter omogoča pregled, filtriranje in vizualizacijo opažanj ptic na zemljevidu.

Projekt vključuje spletni vmesnik, backend REST API, PostgreSQL podatkovno bazo, namizno administratorsko aplikacijo in dodaten CityInfra DSL modul za opis prostorske infrastrukture ter izvoz v GeoJSON.

---

## Vsebina

* [Opis projekta](#opis-projekta)
* [Ključne funkcionalnosti](#ključne-funkcionalnosti)
* [Arhitektura](#arhitektura)
* [Tehnologije](#tehnologije)
* [Struktura repozitorija](#struktura-repozitorija)
* [Dostop do aplikacije](#dostop-do-aplikacije)
* [Prijava in uporaba sistema](#prijava-in-uporaba-sistema)
* [Lokalni zagon](#lokalni-zagon)
* [Lokalni razvoj](#lokalni-razvoj)
* [CityInfra DSL](#cityinfra-dsl)
* [Ključni primeri uporabe](#ključni-primeri-uporabe)
* [Varnost](#varnost)
* [Projektno vodenje](#projektno-vodenje)
* [Git workflow](#git-workflow)
* [CI/CD](#cicd)
* [Status projekta](#status-projekta)
* [Ekipa](#ekipa)

---

## Opis projekta

FlySight je namenjen pregledovanju in upravljanju podatkov o pticah, njihovih lokacijah in opažanjih. Podatki se pridobivajo iz zunanjih virov, ročnih vnosov uporabnikov ter testnih podatkov, pripravljenih za demonstracijo sistema.

Glavni cilj projekta je prikazati, kako je mogoče podatke o opazovanju ptic povezati v enoten sistem, kjer jih uporabnik lahko pregleduje na interaktivnem zemljevidu, filtrira po različnih kriterijih in dopolnjuje z lastnimi opažanji.

Sistem podpira tudi administratorski del, ki omogoča pregled podatkov, upravljanje virov in razvojna opravila prek namizne aplikacije.

---

## Ključne funkcionalnosti

* registracija in prijava uporabnikov,
* JWT avtentikacija,
* ločitev navadnih uporabnikov in administratorjev,
* pregled ptic, lokacij in opažanj,
* prikaz opažanj na interaktivnem zemljevidu,
* filtriranje opažanj po vrsti, lokaciji, datumu in viru,
* dodajanje osebnih opažanj,
* shranjevanje priljubljenih ptic,
* administratorski pregled podatkovnih tabel,
* uvoz in obdelava podatkov iz zunanjih virov,
* eBird integracija prek REST API-ja,
* WebSocket povezava za eBird podatke,
* Docker okolje za lokalni zagon,
* Nginx reverse proxy,
* Kotlin Compose Desktop aplikacija,
* CityInfra DSL z izvozom v GeoJSON.

---

## Arhitektura

```text
Uporabnik
  |
  |-- React frontend + Leaflet zemljevid
  |-- Kotlin Compose Desktop aplikacija
            |
            |-- HTTP REST + JWT
            |-- WebSocket
            |
        Nginx reverse proxy
            |
            |-- Express backend API
                    |
                    |-- PostgreSQL podatkovna baza
                    |-- eBird API
                    |-- podatkovni uvoz
                    |-- CityInfra DSL modul
```

Frontend in desktop aplikacija komunicirata z backendom prek REST API-ja. Backend skrbi za avtentikacijo, dostop do podatkovne baze, obdelavo podatkovnih virov in izpostavljanje endpointov za spletni vmesnik.

Nginx deluje kot reverse proxy in usmerja promet med frontend aplikacijo, backend API-jem in WebSocket povezavami.

---

## Tehnologije

### Frontend

* React
* TypeScript
* Vite
* Leaflet
* React Leaflet

### Backend

* Node.js
* Express
* TypeScript
* JWT
* bcrypt
* WebSocket

### Podatkovna baza

* PostgreSQL

### Desktop aplikacija

* Kotlin
* Jetpack Compose Desktop
* Gradle

### DevOps

* Docker
* Docker Compose
* Nginx
* GitHub Actions

### DSL modul

* Kotlin lexer
* parser
* AST
* semantična validacija
* GeoJSON exporter

---

## Struktura repozitorija

```text
.
├── frontend/              # React + TypeScript spletni vmesnik
├── backend/               # Node.js + Express backend API
├── composeApp/            # Kotlin Compose Desktop aplikacija in DSL modul
├── docs/                  # Dokumentacija in primeri
├── scripts/               # Pomožne skripte
├── .github/workflows/     # GitHub Actions workflow datoteke
├── docker-compose.yml     # Lokalno Docker okolje
├── nginx.conf             # Nginx reverse proxy konfiguracija
└── README.md
```

| Pot                  | Namen                                          |
| -------------------- | ---------------------------------------------- |
| `frontend/`          | spletni uporabniški vmesnik                    |
| `backend/`           | REST API, avtentikacija in povezava z bazo     |
| `composeApp/`        | namizna aplikacija, scraperji in CityInfra DSL |
| `docs/`              | dodatna dokumentacija in primeri               |
| `.github/workflows/` | CI/CD workflow datoteke                        |
| `docker-compose.yml` | lokalni zagon sistema                          |
| `nginx.conf`         | reverse proxy konfiguracija                    |

---

## Dostop do aplikacije

Spletna aplikacija je namenjena uporabi prek brskalnika.

```text
URL aplikacije: http://68.210.204.107/
```

Če javni URL ni na voljo, se aplikacija zažene lokalno z Docker Compose okoljem.

---

## Prijava in uporaba sistema

Uporabnik lahko v aplikaciji ustvari račun ali se prijavi z obstoječim računom.

Po prijavi lahko navaden uporabnik:

* pregleduje opažanja ptic,
* uporablja zemljevid,
* filtrira podatke,
* dodaja lastna opažanja,
* ureja profil,
* shranjuje priljubljene ptice.

Administrator ima dodatno dostop do:

* pregleda podatkovnih tabel,
* upravljanja podatkovnih virov,
* generiranja testnih podatkov,
* administratorskih funkcionalnosti v spletni ali namizni aplikaciji.

Administratorski dostopi niso javno objavljeni v repozitoriju. Po potrebi se posredujejo ločeno ob demonstraciji projekta.

---

## Lokalni zagon

Najbolj enostaven način za lokalni zagon celotnega sistema je Docker Compose.

### Zahteve

Za lokalni zagon potrebujete:

* Docker,
* Docker Compose,
* `.env` datoteko, ustvarjeno iz `.env.example`.

### Priprava konfiguracije

V korenu projekta kopirajte primer konfiguracije:

```bash
cp .env.example .env
```

Na Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Datoteka `.env.example` vsebuje seznam potrebnih spremenljivk. Prava `.env` datoteka ni del repozitorija in ne sme biti objavljena.

Za lokalni zagon nastavite potrebne vrednosti za:

* podatkovno bazo,
* JWT skrivnost,
* CORS origin,
* eBird API ključ, če uporabljate eBird funkcionalnosti.

### Zagon sistema

```bash
docker compose up --build
```

Po zagonu je aplikacija dostopna na:

```text
http://localhost
```

Backend health endpoint:

```text
http://localhost/health
```

### Ustavitev sistema

```bash
docker compose down
```

Za ustavitev in brisanje lokalnega podatkovnega volumna:

```bash
docker compose down -v
```

Ukaz `docker compose down -v` izbriše lokalne podatke baze, zato ga uporabite samo, ko želite začeti s prazno bazo.

---

## Lokalni razvoj

Lokalni razvoj je namenjen razvijalcem, ki želijo posamezne dele sistema poganjati brez Docker Compose okolja.

### Backend

```bash
cd backend
npm install
npm run dev
```

Backend privzeto teče na portu:

```text
http://localhost:3000
```

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

Vite razvojni strežnik je običajno dostopen na:

```text
http://localhost:5173
```

Preverjanje tipov in build:

```bash
npm run typecheck
npm run build
```

### Desktop aplikacija

Namizna aplikacija se nahaja v modulu `composeApp`.

Linux/macOS:

```bash
./gradlew :composeApp:run
```

Windows:

```powershell
.\gradlew.bat :composeApp:run
```

Namizna aplikacija uporablja backend API, zato mora biti backend pred uporabo zagnan.

---

## CityInfra DSL

CityInfra DSL je dodatni modul za opis prostorske infrastrukture in izvoz v GeoJSON.

Tok obdelave:

```text
DSL zapis -> lexer -> parser -> AST -> semantična validacija -> GeoJSON
```

Demo lahko zaženete z:

Linux/macOS:

```bash
./gradlew :composeApp:cityInfraDemo
```

Windows:

```powershell
.\gradlew.bat :composeApp:cityInfraDemo
```

Primer vhodne datoteke je v dokumentacijskem delu projekta.

---

## Ključni primeri uporabe

### 1. Registracija in prijava

Uporabnik odpre aplikacijo, ustvari račun ali se prijavi z obstoječimi podatki. Backend preveri prijavne podatke in ob uspešni prijavi vrne JWT token, ki se uporablja pri zaščitenih zahtevkih.

```text
Uporabnik -> Frontend -> Backend -> PostgreSQL
```

### 2. Pregled opažanj na zemljevidu

Uporabnik odpre zemljevid in pregleda opažanja ptic. Opažanja so prikazana kot markerji, uporabnik pa lahko klikne posamezen marker za dodatne informacije.

```text
Frontend -> Backend API -> PostgreSQL -> Leaflet zemljevid
```

### 3. Filtriranje podatkov

Uporabnik lahko opažanja filtrira po vrsti ptice, lokaciji, datumu ali viru podatkov. Frontend filtre pošlje backendu, backend pa vrne samo ustrezne rezultate.

```text
Frontend filtri -> Backend poizvedba -> Filtrirani rezultati
```

### 4. Dodajanje lastnega opažanja

Prijavljen uporabnik lahko doda svoje opažanje ptice z lokacijo, datumom in dodatnimi podatki. Opažanje se shrani v podatkovno bazo in je povezano z uporabnikom.

```text
Uporabnik -> POST zahtevek -> Backend -> PostgreSQL
```

### 5. Priljubljene ptice

Uporabnik lahko ptice doda med priljubljene in jih kasneje pregleda na ločeni strani.

```text
Uporabnik -> Favorites -> Backend -> PostgreSQL
```

### 6. Pregled eBird podatkov

Aplikacija lahko pridobi aktualna eBird opažanja in jih prikaže v uporabniškem vmesniku.

```text
Frontend -> Backend -> eBird API -> Frontend
```

### 7. Administracija podatkov

Administrator ima dostop do dodatnih pogledov za pregled in upravljanje podatkovnih tabel ter podatkovnih virov.

```text
Admin -> Admin UI -> Backend -> PostgreSQL
```

---

## Varnost

Projekt uporablja več osnovnih varnostnih mehanizmov:

* JWT avtentikacijo,
* bcrypt hashiranje gesel,
* ločitev uporabniških vlog,
* zaščitene administratorske poti,
* CORS konfiguracijo,
* varnostne HTTP headerje,
* rate limiting,
* okoljske spremenljivke za občutljive nastavitve.

Občutljive vrednosti, kot so gesla, JWT skrivnosti, API ključi in produkcijski deployment podatki, niso vključene v README in ne smejo biti objavljene v repozitoriju.

Za lokalni razvoj se uporablja `.env.example`, prava `.env` datoteka pa mora ostati lokalna.

---

## Projektno vodenje

Za vodenje razvoja smo uporabljali Jira board. Delo je bilo razdeljeno na več večjih sklopov:

* razvoj backend API-ja,
* razvoj frontend vmesnika,
* razvoj Kotlin Compose Desktop aplikacije,
* priprava podatkovnega modela,
* Dockerizacija aplikacije,
* namestitev aplikacije na Azure VM,
* CI/CD postopek z GitHub Actions, Docker Hub in webhookom,
* priprava dokumentacije in predstavitev.

Naloge so bile organizirane v statuse:

```text
To Do -> In Progress -> Review -> Done
```

Za večje tehnične sklope so bili uporabljeni epici, na primer:

```text
Docker and Azure deployment
CI/CD deployment with Docker Hub and GitHub Actions
CityInfra DSL
```

Podrobnejša dokumentacija projektnega vodenja in zaslonske slike Jira boarda so shranjene v mapi `docs/`.

---

## Git workflow

Razvoj projekta je potekal prek GitHub repozitorija. Glavna veja projekta je:

```text
master
```

Za razvoj posameznih funkcionalnosti so se uporabljale ločene razvojne oziroma feature veje. Tipičen potek dela je bil:

```text
feature branch -> commit -> push -> pull request / merge -> master
```

Primer osnovnega Git postopka:

```bash
git status
git add .
git commit -m "Opis spremembe"
git push origin master
```

Za večje spremembe se je uporabljal pregled sprememb prek GitHub commitov in primerjava datotek. Pri razvoju smo pazili, da občutljive datoteke, kot so `.env`, lokalni build outputi in `node_modules`, niso vključene v repozitorij.

---

## CI/CD

Za projekt je bil pripravljen osnovni CI/CD postopek za backend aplikacijo.

CI/CD tok:

```text
GitHub push
   ↓
GitHub Actions
   ↓
Docker build backend slike
   ↓
Push slike na Docker Hub
   ↓
Webhook zahteva na Azure VM
   ↓
Deploy skripta na strežniku
   ↓
Posodobitev backend containerja
```

Backend Docker image se objavi v Docker Hub repozitorij:

```text
filipsuvajac/flysight-backend
```

Uporabljena sta dva taga:

```text
latest
<git-commit-sha>
```

Tag `latest` se uporablja za deployment na Azure VM, commit SHA tag pa omogoča sledljivost posamezne verzije.

Workflow datoteka se nahaja v:

```text
.github/workflows/deploy-backend.yml
```

Workflow se sproži ob pushu na vejo `master` ali ročno prek `workflow_dispatch`.

Za občutljive podatke se uporabljajo GitHub Secrets:

```text
DOCKERHUB_USERNAME
DOCKERHUB_TOKEN
WEBHOOK_SECRET
WEBHOOK_URL
```

Na Azure VM teče Python webhook server, ki sprejme deploy zahtevo, preveri HMAC SHA-256 podpis in nato zažene deploy skripto. S tem webhook ni odprt za nepodpisane zahteve.

Glavne datoteke za CI/CD:

```text
.github/workflows/deploy-backend.yml
scripts/webhook-server.py
scripts/deploy-backend.sh
docker-compose.prod.yml
```

---

## Deployment

Aplikacija je pripravljena za zagon v Docker okolju. Lokalno se uporablja:

```bash
docker compose up --build
```

Na Azure VM je aplikacija nameščena v Docker containerjih:

```text
flysight-postgres
flysight-backend
flysight-frontend
flysight-proxy
```

Javni dostop do aplikacije poteka prek Nginx reverse proxyja na portu `80`.

```text
http://68.210.204.107
```

Backend health endpoint:

```text
http://68.210.204.107/health
```

Na strežniku je mogoče stanje preveriti z:

```bash
docker ps
curl http://localhost/health
```

Za webhook service:

```bash
sudo systemctl status flysight-webhook --no-pager
journalctl -u flysight-webhook -n 120 --no-pager
```

Podrobnejša dokumentacija Azure namestitve, Docker konfiguracije, webhooka in CI/CD postopka je v mapi `docs/`.

---

## Dokumentacija

Dodatna dokumentacija se nahaja v mapi:

```text
docs/
```

Priporočena struktura dokumentacije:

```text
docs/
├── sistemska-administracija/
│   ├── azure.md
│   ├── cicd.md
│   └── slike/
├── cityinfra/
├── porocila/
└── primeri/
```

V glavni README so vključeni samo ključni podatki za razumevanje in zagon projekta, daljša poročila in zaslonske slike pa so shranjene v dokumentacijskih datotekah.


## Status projekta

Projekt vključuje implementirane glavne dele sistema:

* spletni frontend,
* backend REST API,
* PostgreSQL podatkovni model,
* Docker okolje,
* namizno aplikacijo,
* eBird integracijo,
* uvoz in obdelavo podatkov,
* osebna opažanja uporabnikov,
* priljubljene ptice,
* administratorske funkcionalnosti,
* CityInfra DSL modul.

Določeni deli projekta so lahko prototipni oziroma namenjeni demonstraciji v okviru študentskega projekta.

---

## Ekipa

- Filip Suvajac
- Niko Ogrizek
- Enej Kacijan

---

## Koristni ukazi

```bash
# Celoten sistem
docker compose up --build

# Ustavitev sistema
docker compose down

# Ustavitev sistema in brisanje podatkovne baze
docker compose down -v

# Backend razvoj
cd backend
npm install
npm run dev

# Backend preverjanje
npm run typecheck
npm run build

# Frontend razvoj
cd frontend
npm install
npm run dev

# Frontend preverjanje
npm run typecheck
npm run build

# Desktop aplikacija
./gradlew :composeApp:run

# CityInfra demo
./gradlew :composeApp:cityInfraDemo
```

---

## Opomba

Ta projekt je nastal kot študentski projektni prototip. Namenjen je prikazu povezovanja podatkovnih virov, spletne vizualizacije, backend storitev, podatkovne baze, namiznega vmesnika in dodatnega DSL modula v enoten sistem.
