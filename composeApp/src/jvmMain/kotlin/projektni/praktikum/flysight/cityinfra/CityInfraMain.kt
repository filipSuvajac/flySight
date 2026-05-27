package projektni.praktikum.flysight.cityinfra

import java.nio.file.Files
import java.nio.file.Path

fun parseCityInfra(source: String): CityProgram =
    Parser(Lexer(source).tokenize()).parseProgram()

fun cityInfraToGeoJson(source: String, validate: Boolean = true): String {
    val program = parseCityInfra(source)
    if (validate) SemanticValidator.validate(program)
    return GeoJsonExporter.export(program)
}

fun main(args: Array<String>) {
    val source = if (args.isNotEmpty()) {
        Files.readString(Path.of(args[0]))
    } else {
        demoProgram
    }

    val geoJson = cityInfraToGeoJson(source)

    if (args.size >= 2) {
        Files.writeString(Path.of(args[1]), geoJson)
        println("GeoJSON written to ${args[1]}")
    } else {
        println(geoJson)
    }
}

private val demoProgram =
    """
    city "Maribor Center" {
      road "Slovenska ulica" type street speed 30 {
        line((15.646, 46.558), (15.649, 46.559));
        bend((15.649, 46.559), (15.653, 46.558), -25);
      };

      building "Univerza" floors 4 use education {
        box((15.647, 46.559), (15.648, 46.558));
      };

      park "Mestni park" {
        polygon((15.641, 46.563), (15.646, 46.564), (15.647, 46.561), (15.642, 46.560));
      };

      water "Drava" type river {
        polyline((15.620, 46.555), (15.640, 46.557), (15.660, 46.556), (15.680, 46.554));
      };

      stop "Glavni trg" mode bus at (15.645, 46.557);

      sensor "Prometni senzor 1" kind traffic at (15.647, 46.559) {
        set("unit", "vehicles_per_hour");
        set("provider", "Mestna občina");
      };
    }
    """.trimIndent()
