package projektni.praktikum.flysight.cityinfra

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class CityInfraTest {
    @Test
    fun parsesCityAndBuildsAst() {
        val program = parseCityInfra(
            """
            city "Test" {
              road "A" type street speed 50 {
                line((15.0, 46.0), (15.1, 46.1));
              };
              stop "S" mode bus at (15.2, 46.2);
            }
            """.trimIndent(),
        )

        assertEquals("Test", program.name)
        assertEquals(2, program.items.size)
        assertTrue(program.items[0] is Road)
        assertTrue(program.items[1] is Stop)
    }

    @Test
    fun exportsGeoJsonFeatureCollection() {
        val geoJson = cityInfraToGeoJson(
            """
            city "Geo" {
              park "P" {
                polygon((15.0, 46.0), (15.1, 46.0), (15.1, 46.1));
              };
              sensor "PM10" kind air_quality at (15.2, 46.2) {
                set("unit", "ug/m3");
              };
            }
            """.trimIndent(),
        )

        assertTrue(geoJson.contains("\"type\": \"FeatureCollection\""))
        assertTrue(geoJson.contains("\"kind\":\"park\""))
        assertTrue(geoJson.contains("\"sensorKind\":\"air_quality\""))
        assertTrue(geoJson.contains("\"meta:unit\":\"ug/m3\""))
    }

    @Test
    fun rejectsInvalidSemantics() {
        assertFailsWith<SemanticException> {
            cityInfraToGeoJson(
                """
                city "Bad" {
                  building "B" floors 0 use residential {
                    box((15.0, 46.0), (15.1, 46.1));
                  };
                }
                """.trimIndent(),
            )
        }
    }

    @Test
    fun rejectsMissingRequiredGeometryDuringParsing() {
        assertFailsWith<ParseException> {
            parseCityInfra(
                """
                city "Bad" {
                  road "A" type street speed 50 {
                    set("status", "planned");
                  };
                }
                """.trimIndent(),
            )
        }
    }
}
