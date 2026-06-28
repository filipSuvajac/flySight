# FlySight - GitLab Wiki

Ta Wiki predstavlja zaključno dokumentacijo projekta FlySight. Dokumentacijo smo razdelili po sklopih, ki jih zahteva naloga: najprej so opisane specifikacije projekta, nato namestitev in prijava, za tem pet glavnih primerov uporabe, na koncu pa še izvedene funkcionalnosti.

FlySight smo razvijali kot študentski prototip digitalnega dvojčka za podatke o pticah v Sloveniji. V projektu smo povezali slovenski katalog ptic iz DOPPS oziroma ptice.si, eBird podatke, ročne vnose uporabnikov in generirana testna opažanja. Glavni namen aplikacije je, da se ta opažanja lahko pregledujejo na zemljevidu, filtrirajo, shranjujejo in upravljajo prek spletnega ter delno tudi namiznega vmesnika.

## Struktura Wiki dokumentacije

1. [Projektne specifikacije](01-projektne-specifikacije)
2. [Navodila za namestitev in prijavo v sistem](02-namestitev-in-prijava)
3. [Ključni primeri uporabe](03-kljucni-primeri-uporabe)
4. [Dokumentacija izvedenih lastnosti](04-dokumentacija-izvedenih-lastnosti)

## Osnovni podatki projekta

| Podatek | Vrednost |
| --- | --- |
| Ime projekta | FlySight |
| Tip projekta | Študentski projekt / prototip digitalnega dvojčka |
| Glavno področje | Podatki o pticah, opažanja, zemljevid, administracija podatkov |
| Repozitorij | `flySight` |
| Glavna veja | `master` |

## Glavni deli sistema

| Del | Namen |
| --- | --- |
| `frontend/` | React, TypeScript in Vite spletni vmesnik |
| `backend/` | Node.js, Express in TypeScript REST API |
| `composeApp/` | Kotlin Compose Desktop aplikacija, scraperji in CityInfra DSL |
| `docker-compose.yml` | Lokalni zagon celotnega sistema |
| `docker-compose.prod.yml` | Produkcijski zagon backend storitve iz Docker Hub slike |
| `.github/workflows/deploy-backend.yml` | GitHub Actions CI/CD workflow |
| `scripts/webhook-server.py` | Webhook strežnik za deployment na Azure VM |
| `scripts/deploy-backend.sh` | Skripta za posodobitev backend containerja |
| `nginx.conf` | Reverse proxy za frontend, backend, health endpoint in WebSocket |

## Povzetek rešitve

Uporabnik se v sistem prijavi v spletnem vmesniku. Po prijavi lahko pregleduje opažanja ptic na zemljevidu, uporablja filtre, dodaja svoja opažanja, ureja profil in shranjuje priljubljene vrste. Administrator ima dodatno dostop do podatkovnih virov, osnovnega pregleda tabel, generiranja testnih podatkov in CI/CD dela, ki je bil pripravljen za backend deployment. Backend skrbi za avtentikacijo, komunikacijo s PostgreSQL bazo, eBird integracijo, nalaganje DOPPS kataloga in WebSocket povezavo za eBird podatke.
