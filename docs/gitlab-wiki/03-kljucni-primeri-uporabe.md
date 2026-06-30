# 3. Ključni primeri uporabe

V nadaljevanju je predstavljenih pet najpogostejših načinov uporabe rešitve. Primeri so zapisani kot navodila po prijavi v sistem in sledijo isti strukturi: kaj uporabnik želi narediti, koraki izvedbe in rezultat.

## 3.1 Pregled opažanj ptic na zemljevidu

### Kaj uporabnik želi narediti

Uporabnik želi pregledati, kje v Sloveniji so bila zabeležena opažanja ptic.

### Koraki izvedbe

1. Uporabnik odpre `http://localhost`.
2. Prijavi se z obstoječim računom ali se registrira.
3. Po prijavi se odpre stran `Explore`.
4. Sistem naloži opažanja prek endpointa `/api/visualization/observations`.
5. Opažanja se prikažejo kot markerji na Leaflet zemljevidu.
6. Uporabnik klikne marker na zemljevidu.
7. Sistem prikaže podrobnosti opažanja: vrsto ptice, latinsko ime, lokacijo, datum, število osebkov in vir podatkov.

### Rezultat

Uporabnik vidi prostorski pregled opažanj in lahko razume, na katerih lokacijah so bile posamezne vrste opažene.

## 3.2 Filtriranje opažanj

### Kaj uporabnik želi narediti

Uporabnik želi poiskati samo tista opažanja, ki ustrezajo določenim kriterijem, na primer izbrani vrsti ptice ali lokaciji.

### Koraki izvedbe

1. Uporabnik se prijavi v sistem.
2. Odpre stran `Explore`.
3. V stranskem delu vnese ali izbere filtre:
   - vrsta ptice,
   - lokacija,
   - datum,
   - vir podatkov.
4. Frontend pošlje filtre kot query parametre na `/api/visualization/observations`.
5. Backend sestavi parametrizirano SQL poizvedbo.
6. Backend vrne samo opažanja, ki ustrezajo filtrom.
7. Zemljevid in rezultati se posodobijo.

### Rezultat

Uporabnik dobi pregled samo nad relevantnimi opažanji. To omogoča hitrejše raziskovanje podatkov in primerjavo med vrstami, lokacijami ter viri.

## 3.3 Dodajanje lastnega opažanja

### Kaj uporabnik želi narediti

Uporabnik želi shraniti ptico, ki jo je sam opazil.

### Koraki izvedbe

1. Uporabnik se prijavi v sistem.
2. V navigaciji odpre `My Sightings`.
3. V obrazcu izbere obstoječo ptico ali vnese novo vrsto.
4. Izbere datum opažanja.
5. Vnese število opaženih osebkov.
6. Vnese ime lokacije.
7. Vnese koordinate ročno, uporabi trenutno lokacijo ali izbere lokacijo na zemljevidu.
8. Klikne `Save Sighting`.
9. Frontend pošlje zahtevo na `/api/me/observations`.
10. Backend preveri podatke, po potrebi ustvari novo ptico ali lokacijo in shrani zapis v tabelo `observation`.

### Rezultat

Opažanje je shranjeno v bazi in se prikaže v uporabnikovem osebnem seznamu. Ker je povezano z uporabnikom, ga lahko uporabnik kasneje tudi izbriše.

## 3.4 Shranjevanje priljubljenih ptic

### Kaj uporabnik želi narediti

Uporabnik želi označiti ptice, ki so mu zanimive, in jih kasneje hitro najti.

### Koraki izvedbe

1. Uporabnik se prijavi v sistem.
2. Odpre stran `Explore`.
3. Poišče želeno ptico na zemljevidu ali v prikazu opažanj.
4. Klikne gumb za dodajanje med priljubljene.
5. Frontend pošlje zahtevo na `/api/me/favorites`.
6. Backend shrani povezavo med uporabnikom in ptico v tabelo `favorite_bird`.
7. Uporabnik odpre stran `Favorites`.
8. Sistem prikaže seznam priljubljenih ptic.
9. Uporabnik lahko ptico odstrani iz priljubljenih.

### Rezultat

Uporabnik ima oseben seznam priljubljenih vrst ptic, skupaj z imenom, latinskim imenom, družino, opisom in sliko, kadar so podatki na voljo.

## 3.5 Pregled eBird podatkov

### Kaj uporabnik želi narediti

Uporabnik želi pregledati aktualna opažanja in hotspote iz eBird za Slovenijo.

### Koraki izvedbe

1. Uporabnik se prijavi v sistem.
2. Odpre stran `Explore`.
3. V eBird delu izbere obdobje, na primer zadnjih 30 dni.
4. Frontend pokliče `/api/ebird/recent` ali uporabi WebSocket povezavo `/ws/ebird`.
5. Backend pošlje zahtevo na eBird API za regijo `SI`.
6. Backend normalizira odgovor in ga vrne frontendu.
7. Frontend prikaže opažanja v tabeli in jih poveže z zemljevidom.
8. Uporabnik lahko pregleda tudi hotspote prek `/api/ebird/hotspots`.

### Rezultat

Uporabnik vidi aktualne eBird podatke za Slovenijo, vključno z vrstami, lokacijami, datumi, koordinatami in veljavnostjo opažanj.
