# CityInfra: opis domensko specifičnega jezika

## Namen

**CityInfra** je majhen domensko specifičen jezik za opis mestne infrastrukture. Z njim lahko v besedilni obliki zapišemo ceste, stavbe, parke, komunalne vode, postaje javnega prevoza, senzorje in druge prostorske elemente.

Glavna ideja jezika je preprost zapis, iz katerega je mogoče zgraditi notranji model mesta, preveriti osnovna pravila in podatke po potrebi izvoziti v obliko za prikaz na zemljevidu, na primer GeoJSON.

Primer osnovnega programa:

```cityinfra
city "Maribor Center" {
  road "Slovenska ulica" type street speed 30 {
    line((15.646, 46.558), (15.649, 46.559));
  };

  building "Univerza" floors 4 use education {
    box((15.647, 46.559), (15.648, 46.558));
  };

  park "Mestni park" {
    polygon((15.641, 46.563), (15.646, 46.564), (15.647, 46.561), (15.642, 46.560));
  };
}
```

## Osnovni elementi jezika

### Prazna vrednost

`nil` označuje prazno ali manjkajočo vrednost. Uporaben je predvsem pri metapodatkih, kadar nek podatek obstaja kot ključ, vrednost pa še ni znana.

### Števila

Števila se uporabljajo za koordinate, omejitve hitrosti, kapacitete, število nadstropij, polmere in podobne podatke. Podprta so cela in decimalna števila.

```cityinfra
12
46.559
-3.5
```

### Nizi

Nizi so zapisani v dvojnih narekovajih. Uporabljajo se za imena mest, cest, stavb, postaj in za besedilne vrednosti metapodatkov.

```cityinfra
"Glavni trg"
```

### Identifikatorji

Identifikatorji označujejo tipe, namembnosti, materiale in ključe metapodatkov.

```cityinfra
street
education
water
```

### Koordinate

Koordinate so zapisane kot `(lon, lat)`, torej najprej geografska dolžina in nato geografska širina.

```cityinfra
(15.646, 46.558)
```

## Infrastrukturni konstrukti

### Mesto

`city` je korenski blok programa. V njem so zapisani vsi ostali elementi.

```cityinfra
city "Ime mesta" {
  ELEMENTI
}
```

### Območje

`district` predstavlja mestno četrt ali logično območje. Vsebuje lahko iste elemente kot `city`, zato je uporaben za razdelitev večjega modela na manjše dele.

```cityinfra
district "Center" {
  ELEMENTI
}
```

### Cesta

`road` opisuje cestni odsek ali daljšo cesto. Ima ime, tip, omejitev hitrosti in geometrijo poti.

```cityinfra
road "Koroška cesta" type street speed 50 {
  line((15.640, 46.557), (15.650, 46.558));
}
```

Tip ceste je identifikator, na primer `street`, `avenue`, `highway`, `path` ali `bike_lane`.

### Stavba

`building` opisuje stavbo. Poleg imena ima še število nadstropij, namembnost in zaprto geometrijo.

```cityinfra
building "Gimnazija" floors 3 use education {
  box((15.644, 46.558), (15.646, 46.557));
}
```

### Zelena površina

`park` opisuje park ali drugo zeleno površino. Najpogosteje je zapisan s poligonom.

```cityinfra
park "Mestni park" {
  polygon((15.641, 46.563), (15.646, 46.564), (15.647, 46.561));
}
```

### Voda

`water` opisuje reko, jezero, kanal ali drugo vodno površino oziroma vodotok. Vrsta vode je podana z atributom `type`.

```cityinfra
water "Drava" type river {
  polyline((15.620, 46.555), (15.640, 46.557), (15.660, 46.556));
}
```

### Komunalni vod

`utility` opisuje infrastrukturne vode, na primer vodovod, elektriko, plin, kanalizacijo ali optiko. Zapis vsebuje tip voda, material in geometrijo trase.

```cityinfra
utility "Vodovod Center" type water material ductile_iron {
  line((15.642, 46.558), (15.650, 46.558));
}
```

### Postaja javnega prevoza

`stop` je točkovni element javnega prevoza. Ima ime, način prevoza in koordinato.

```cityinfra
stop "Glavni trg" mode bus at (15.645, 46.557);
```

### Pomembna točka

`poi` predstavlja točko interesa, na primer bolnišnico, šolo, trgovino, restavracijo ali polnilnico.

```cityinfra
poi "Zdravstveni dom" kind healthcare at (15.648, 46.556);
```

### Senzor

`sensor` opisuje merilno napravo v mestu, na primer senzor prometa, hrupa ali kakovosti zraka. Lahko vsebuje tudi metapodatke.

```cityinfra
sensor "Merilec PM10" kind air_quality at (15.647, 46.559) {
  set("unit", "ug/m3");
  set("provider", "Mestna občina");
}
```

### Območje namenske rabe

`zone` opisuje večje območje s predpisano namensko rabo, na primer stanovanjsko, industrijsko ali poslovno območje.

```cityinfra
zone "Industrijska cona" use industrial {
  polygon((15.660, 46.552), (15.670, 46.552), (15.670, 46.548), (15.660, 46.548));
}
```

## Geometrija

Geometrijski ukazi določajo obliko elementov. Linijski elementi uporabljajo `line`, `bend` in `polyline`; površinski elementi pa `box`, `polygon`, `circle` ali zaporedje linij.

### Ravna črta

`line` poveže dve točki z ravnim segmentom.

```cityinfra
line((15.640, 46.557), (15.650, 46.558));
```

### Ukrivljen segment

`bend` poveže dve točki z ukrivljenim segmentom. Tretja vrednost določa smer in stopnjo ukrivljenosti.

```cityinfra
bend((15.640, 46.557), (15.645, 46.559), 30);
```

### Pravokotnik

`box` ustvari pravokotnik iz dveh nasprotnih oglišč.

```cityinfra
box((15.644, 46.558), (15.646, 46.557));
```

### Poligon

`polygon` ustvari zaključeno površino iz seznama točk.

```cityinfra
polygon((15.641, 46.563), (15.646, 46.564), (15.647, 46.561));
```

### Lomljena črta

`polyline` ustvari pot iz več zaporednih točk.

```cityinfra
polyline((15.620, 46.555), (15.640, 46.557), (15.660, 46.556));
```

### Krog

`circle` ustvari krog s središčem in polmerom.

```cityinfra
circle((15.645, 46.557), 0.002);
```

## Metapodatki

`set` elementu doda poljuben podatek v obliki ključ-vrednost. Metapodatki ne spreminjajo geometrije, ampak samo dopolnijo opis elementa.

```cityinfra
set("owner", "Mestna občina");
set("status", "planned");
```

## Pravila preverjanja

1. Program ima natanko en korenski blok `city`.
2. `road`, `water` in `utility` morajo imeti vsaj en ukaz `line`, `bend` ali `polyline`.
3. `building`, `park` in `zone` morajo opisati zaključeno površino z `box`, `polygon`, `circle` ali zaporedjem linij, kjer je zadnja točka enaka prvi.
4. `stop`, `poi` in `sensor` so točkovni elementi in morajo imeti natanko eno koordinato za `at`.
5. Imena elementov znotraj istega bloka morajo biti unikatna za isti tip elementa.
6. Število nadstropij pri `building` mora biti pozitivno celo število.
7. Omejitev hitrosti pri `road` mora biti nenegativno število.
8. Polmer pri `circle` mora biti pozitivno število.
9. `district` lahko vsebuje druge elemente, ne sme pa neposredno vsebovati novega `city`.
10. Metapodatki služijo opisu elementov in ne vplivajo na njihovo geometrijo.

## Formalna definicija sintakse v BNF

```bnf
<program> ::= <city>

<city> ::= "city" <string> "{" <city_items> "}"

<city_items> ::= <city_item>
               | <city_item> <city_items>
               | <empty>

<city_item> ::= <district>
              | <road>
              | <building>
              | <park>
              | <water>
              | <utility>
              | <stop>
              | <poi>
              | <sensor>
              | <zone>
              | <metadata>

<district> ::= "district" <string> "{" <city_items> "}"

<road> ::= "road" <string> "type" <identifier> "speed" <number> "{" <path_commands> <metadata_items> "}" ";"

<building> ::= "building" <string> "floors" <integer> "use" <identifier> "{" <area_commands> <metadata_items> "}" ";"

<park> ::= "park" <string> "{" <area_commands> <metadata_items> "}" ";"

<water> ::= "water" <string> "type" <identifier> "{" <path_commands> <metadata_items> "}" ";"

<utility> ::= "utility" <string> "type" <identifier> "material" <identifier> "{" <path_commands> <metadata_items> "}" ";"

<stop> ::= "stop" <string> "mode" <identifier> "at" <point> ";"

<poi> ::= "poi" <string> "kind" <identifier> "at" <point> ";"

<sensor> ::= "sensor" <string> "kind" <identifier> "at" <point> "{" <metadata_items> "}" ";"
           | "sensor" <string> "kind" <identifier> "at" <point> ";"

<zone> ::= "zone" <string> "use" <identifier> "{" <area_commands> <metadata_items> "}" ";"

<path_commands> ::= <path_command>
                  | <path_command> <path_commands>

<path_command> ::= <line>
                 | <bend>
                 | <polyline>

<area_commands> ::= <area_command>
                  | <area_command> <area_commands>

<area_command> ::= <line>
                 | <bend>
                 | <box>
                 | <polygon>
                 | <circle>

<line> ::= "line" "(" <point> "," <point> ")" ";"

<bend> ::= "bend" "(" <point> "," <point> "," <number> ")" ";"

<box> ::= "box" "(" <point> "," <point> ")" ";"

<polygon> ::= "polygon" "(" <point_list> ")" ";"

<polyline> ::= "polyline" "(" <point_list> ")" ";"

<circle> ::= "circle" "(" <point> "," <number> ")" ";"

<metadata_items> ::= <metadata>
                   | <metadata> <metadata_items>
                   | <empty>

<metadata> ::= "set" "(" <string> "," <metadata_value> ")" ";"

<metadata_value> ::= <string>
                   | <number>
                   | <identifier>
                   | "nil"

<point_list> ::= <point> "," <point> "," <point_tail>

<point_tail> ::= <point>
               | <point> "," <point_tail>

<point> ::= "(" <number> "," <number> ")"

<number> ::= <integer>
           | <integer> "." <digits>
           | "-" <integer>
           | "-" <integer> "." <digits>

<integer> ::= <digit>
            | <nonzero_digit> <digits>

<digits> ::= <digit>
           | <digit> <digits>

<digit> ::= "0" | <nonzero_digit>

<nonzero_digit> ::= "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

<string> ::= "\"" <string_chars> "\""

<string_chars> ::= <string_char>
                 | <string_char> <string_chars>
                 | <empty>

<string_char> ::= <letter>
                | <digit>
                | " "
                | "_"
                | "-"

<identifier> ::= <letter>
               | <letter> <identifier_tail>

<identifier_tail> ::= <identifier_char>
                    | <identifier_char> <identifier_tail>

<identifier_char> ::= <letter>
                    | <digit>
                    | "_"

<letter> ::= "a" | "b" | "c" | "d" | "e" | "f" | "g"
           | "h" | "i" | "j" | "k" | "l" | "m" | "n"
           | "o" | "p" | "q" | "r" | "s" | "t" | "u"
           | "v" | "w" | "x" | "y" | "z"
           | "A" | "B" | "C" | "D" | "E" | "F" | "G"
           | "H" | "I" | "J" | "K" | "L" | "M" | "N"
           | "O" | "P" | "Q" | "R" | "S" | "T" | "U"
           | "V" | "W" | "X" | "Y" | "Z"

<empty> ::=
```

## Testni primeri

### 1. Minimalno mesto

Namen: preveri, da je dovoljen prazen mestni model.

```cityinfra
city "Prazno mesto" {
}
```

Rezultat: program je veljaven.

### 2. Cesta z ravnim segmentom

Namen: osnovna cesta z enim ravnim odsekom.

```cityinfra
city "Cesta" {
  road "Glavna cesta" type street speed 50 {
    line((15.640, 46.557), (15.650, 46.558));
  };
}
```

Rezultat: cesta je veljavna in ima eno pot.

### 3. Ukrivljena cesta

Namen: kombinacija ravnega in ukrivljenega segmenta.

```cityinfra
city "Ovinek" {
  road "Obvozna cesta" type avenue speed 60 {
    line((15.630, 46.550), (15.640, 46.552));
    bend((15.640, 46.552), (15.650, 46.551), -35);
  };
}
```

Rezultat: cesta je veljavna.

### 4. Stavba s pravokotnikom

Namen: stavba z geometrijo `box`.

```cityinfra
city "Stavbe" {
  building "Občina" floors 5 use administration {
    box((15.645, 46.558), (15.647, 46.556));
  };
}
```

Rezultat: stavba je veljavna.

### 5. Park s poligonom

Namen: zaprta zelena površina iz več točk.

```cityinfra
city "Zeleno mesto" {
  park "Mestni park" {
    polygon((15.641, 46.563), (15.646, 46.564), (15.647, 46.561), (15.642, 46.560));
  };
}
```

Rezultat: park je veljaven.

### 6. Reka kot vodna infrastruktura

Namen: vodotok, zapisan kot lomljena črta.

```cityinfra
city "Ob reki" {
  water "Drava" type river {
    polyline((15.620, 46.555), (15.640, 46.557), (15.660, 46.556), (15.680, 46.554));
  };
}
```

Rezultat: vodotok je veljaven.

### 7. Komunalni vodi

Namen: več komunalnih vodov z različnimi tipi in materiali.

```cityinfra
city "Komunala" {
  utility "Vodovod vzhod" type water material ductile_iron {
    line((15.642, 46.558), (15.650, 46.558));
  };

  utility "Optika center" type fiber material plastic {
    polyline((15.641, 46.557), (15.644, 46.558), (15.648, 46.559));
  };
}
```

Rezultat: oba voda sta veljavna.

### 8. Javni prevoz in pomembne točke

Namen: preverjanje točkovnih elementov.

```cityinfra
city "Mobilnost" {
  stop "Glavni trg" mode bus at (15.645, 46.557);
  stop "Kolodvor" mode train at (15.653, 46.561);
  poi "Zdravstveni dom" kind healthcare at (15.648, 46.556);
}
```

Rezultat: vsi točkovni elementi so veljavni.

### 9. Senzor z metapodatki

Namen: senzor z dodatnimi podatki.

```cityinfra
city "Pametno mesto" {
  sensor "Prometni senzor 1" kind traffic at (15.647, 46.559) {
    set("unit", "vehicles_per_hour");
    set("provider", "Mestna občina");
  };
}
```

Rezultat: senzor je veljaven in ima dva metapodatka.

### 10. Neveljavna stavba brez geometrije

Namen: primer sintaktično dovoljenega zapisa, ki pade pri semantičnem preverjanju.

```cityinfra
city "Napaka" {
  building "Manjkajoča geometrija" floors 2 use residential {
    set("status", "planned");
  };
}
```

Rezultat: program ni semantično veljaven, ker stavba nima ukaza za površinsko geometrijo.
