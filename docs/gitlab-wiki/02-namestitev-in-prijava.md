# 2. Navodila za namestitev in prijavo v sistem

V tem poglavju je opisan postopek, s katerim lahko nov uporabnik zažene FlySight in se prijavi v aplikacijo. Najbolj enostavna pot je Docker Compose, ker se s tem hkrati zaženejo baza, backend, frontend in Nginx proxy.

## 2.1 Predpogoji

Za priporočeni zagon z Dockerjem potrebujete:

- Docker Desktop ali Docker Engine,
- Docker Compose,
- kloniran repozitorij FlySight,
- `.env` datoteko v korenu projekta.

Za razvoj brez Dockerja potrebujete še:

- Node.js in npm,
- JDK,
- Gradle wrapper, ki je že vključen v projektu,
- lokalno PostgreSQL bazo ali PostgreSQL container.

## 2.2 Priprava `.env` datoteke

V korenu projekta kopirajte primer konfiguracije.

PowerShell:

```powershell
Copy-Item .env.example .env
```

Linux/macOS:

```bash
cp .env.example .env
```

Primer konfiguracije:

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

Za realno uporabo je treba nastaviti lastne vrednosti za `POSTGRES_PASSWORD`, `JWT_SECRET` in `EBIRD_API_KEY`. Datoteka `.env` ne sme biti objavljena v repozitoriju.

## 2.3 Lokalni zagon z Docker Compose

Iz korena projekta zaženite:

```bash
docker compose up --build
```

Docker Compose zažene:

| Container | Namen |
| --- | --- |
| `flysight-postgres` | PostgreSQL baza |
| `flysight-backend` | Express backend API |
| `flysight-frontend` | React frontend |
| `flysight-proxy` | Nginx reverse proxy |

Po zagonu odprite:

```text
http://localhost
```

Delovanje backenda preverite z:

```text
http://localhost/health
```

Pri pravilnem delovanju backend vrne status `ok` in informacijo, da je baza povezana.

## 2.4 Prijava v sistem

Po odprtju `http://localhost` se prikaže prijavni oziroma registracijski zaslon.

### Prijava kot administrator

Za razvoj so v backendu pripravljeni administratorski računi:

| Email | Geslo |
| --- | --- |
| `filip@flysight.test` | `FlySightAdmin123!` |
| `niko@flysight.test` | `FlySightAdmin123!` |
| `enej@flysight.test` | `FlySightAdmin123!` |

Administrator ima dostop do dodatnih strani:

- `Analytics`,
- `Data`,
- `Admin`,
- `CityInfra`.

### Registracija navadnega uporabnika

Če uporabnik nima računa, izbere registracijo in vnese:

1. ime,
2. email,
3. geslo z najmanj 8 znaki.

Po uspešni registraciji backend ustvari uporabnika, geslo shrani kot bcrypt hash in vrne JWT token. Uporabnik je nato prijavljen v aplikacijo.

## 2.5 Osnovna uporaba po prijavi

Po prijavi lahko navaden uporabnik uporablja:

- `Explore` za pregled zemljevida in eBird podatkov,
- `My Sightings` za dodajanje lastnih opažanj,
- `Favorites` za pregled priljubljenih ptic,
- `Profile` za urejanje osebnih podatkov.

Administrator lahko poleg tega uporablja še:

- `Analytics` za pregled podatkov,
- `Data` za pregled tabel,
- `Admin` za upravljanje podatkovnih virov,
- `CityInfra` za pregled infrastrukturnega dela.

## 2.6 Lokalni razvoj brez Dockerja

### Backend

```bash
cd backend
npm install
npm run dev
```

Backend privzeto teče na portu `3000`. Pri lokalnem zagonu mora biti `DATABASE_URL` nastavljen na dostopno PostgreSQL bazo.

Preverjanje:

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

Preverjanje:

```bash
npm run typecheck
npm run build
```

### Namizna aplikacija

Windows:

```powershell
.\gradlew.bat :composeApp:run
```

Linux/macOS:

```bash
./gradlew :composeApp:run
```

Namizna aplikacija uporablja backend API, zato mora biti backend pred uporabo zagnan.

### CityInfra demo

Windows:

```powershell
.\gradlew.bat :composeApp:cityInfraDemo
```

Linux/macOS:

```bash
./gradlew :composeApp:cityInfraDemo
```

Primer vhodne datoteke:

```text
docs/cityinfra-demo.ci
```

## 2.7 Produkcijski backend deployment

Na veji `master` je prisoten tudi produkcijski deployment backend storitve. Ta del ni potreben za običajno lokalno uporabo aplikacije, je pa pomemben za sistemsko administracijo in CI/CD del projekta.

Glavne datoteke:

| Datoteka | Namen |
| --- | --- |
| `.github/workflows/deploy-backend.yml` | GitHub Actions workflow |
| `docker-compose.prod.yml` | Produkcijski Compose za backend in PostgreSQL |
| `scripts/webhook-server.py` | Webhook endpoint `/deploy` |
| `scripts/deploy-backend.sh` | Posodobitev backend containerja |

Postopek:

1. razvijalec naredi `push` na vejo `master`,
2. GitHub Actions zgradi backend Docker sliko,
3. slika se objavi na Docker Hub kot `latest` in kot Git SHA tag,
4. GitHub Actions pošlje podpisan webhook na Azure VM,
5. Azure VM zažene deploy skripto,
6. backend container se posodobi.

## 2.8 Ustavitev sistema

Za ustavitev lokalnega Docker okolja:

```bash
docker compose down
```

Za ustavitev in brisanje lokalnih podatkov baze:

```bash
docker compose down -v
```

Ukaz `down -v` izbriše Docker volume z bazo, zato ga uporabite samo, ko želite začeti s prazno bazo.

## 2.9 Pogoste težave

| Težava | Rešitev |
| --- | --- |
| `http://localhost` se ne odpre | Preverite, ali je port `80` prost |
| Backend ne dostopa do baze | Preverite `.env` in stanje containerja `flysight-postgres` |
| eBird podatki se ne naložijo | Preverite `EBIRD_API_KEY` |
| Prijava ne deluje | Preverite `/health` in pravilnost emaila/gesla |
| Webhook ne deluje | Preverite `WEBHOOK_SECRET`, `WEBHOOK_URL`, port `9000` in systemd loge |
