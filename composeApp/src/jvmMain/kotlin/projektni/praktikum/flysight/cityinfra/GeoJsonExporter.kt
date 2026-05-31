package projektni.praktikum.flysight.cityinfra

import kotlin.math.PI
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin

object GeoJsonExporter {
    fun export(program: CityProgram): String {
        val features = mutableListOf<GeoJsonFeature>()
        collectFeatures(program.items, listOf(program.name), features)

        return buildString {
            append("{\n")
            append("  \"type\": \"FeatureCollection\",\n")
            append("  \"features\": [\n")
            features.forEachIndexed { index, feature ->
                append(feature.toJson("    "))
                if (index != features.lastIndex) append(",")
                append("\n")
            }
            append("  ]\n")
            append("}\n")
        }
    }

    private fun collectFeatures(items: List<CityItem>, scope: List<String>, features: MutableList<GeoJsonFeature>) {
        for (item in items) {
            when (item) {
                is District -> collectFeatures(item.items, scope + item.name, features)
                is Road -> features.add(
                    GeoJsonFeature(
                        lineString(item.commands.toLineString()),
                        baseProperties("road", item.name, scope) +
                            ("roadType" to item.type) +
                            ("speed" to item.speed) +
                            item.metadata.toProperties(),
                    ),
                )
                is Water -> features.add(
                    GeoJsonFeature(
                        lineString(item.commands.toLineString()),
                        baseProperties("water", item.name, scope) +
                            ("waterType" to item.type) +
                            item.metadata.toProperties(),
                    ),
                )
                is Utility -> features.add(
                    GeoJsonFeature(
                        lineString(item.commands.toLineString()),
                        baseProperties("utility", item.name, scope) +
                            ("utilityType" to item.type) +
                            ("material" to item.material) +
                            item.metadata.toProperties(),
                    ),
                )
                is Bridge -> features.add(
                    GeoJsonFeature(
                        lineString(item.commands.toLineString()),
                        baseProperties("bridge", item.name, scope) +
                            ("bridgeType" to item.type) +
                            item.metadata.toProperties(),
                    ),
                )
                is Building -> addAreaFeatures(features, item.name, "building", item.commands, scope, item.metadata, mapOf("floors" to item.floors, "use" to item.use))
                is Park -> addAreaFeatures(features, item.name, "park", item.commands, scope, item.metadata)
                is Roundabout -> features.add(
                    GeoJsonFeature(
                        polygonGeometry(item.circle.toRing()),
                        baseProperties("roundabout", item.name, scope) +
                            ("roundaboutType" to item.type) +
                            item.metadata.toProperties(),
                    ),
                )
                is Stop -> features.add(GeoJsonFeature(point(item.at), baseProperties("stop", item.name, scope) + ("mode" to item.mode)))
                is Poi -> features.add(GeoJsonFeature(point(item.at), baseProperties("poi", item.name, scope) + ("poiKind" to item.kind)))
                is Sensor -> features.add(GeoJsonFeature(point(item.at), baseProperties("sensor", item.name, scope) + ("sensorKind" to item.kind) + item.metadata.toProperties()))
                is MetadataItem -> Unit
            }
        }
    }

    private fun addAreaFeatures(
        features: MutableList<GeoJsonFeature>,
        name: String,
        kind: String,
        commands: List<AreaCommand>,
        scope: List<String>,
        metadata: List<Metadata>,
        additional: Map<String, Any?> = emptyMap(),
    ) {
        val geometries = commands.toAreaGeometries()
        geometries.forEachIndexed { index, geometry ->
            val indexedName = if (geometries.size == 1) name else "$name #${index + 1}"
            features.add(
                GeoJsonFeature(
                    geometry,
                    baseProperties(kind, indexedName, scope) + additional + metadata.toProperties(),
                ),
            )
        }
    }

    private fun List<PathCommand>.toLineString(): List<Coordinates> =
        flatMap { command ->
            when (command) {
                is Line -> listOf(command.start, command.end)
                is Bend -> Bezier.bend(command.start, command.end, command.relativeAngle).toPoints(16)
                is Polyline -> command.points
            }
        }.deduplicateNeighbors()

    private fun List<AreaCommand>.toAreaGeometries(): List<GeoJsonGeometry> {
        if (all { it is Line || it is Bend }) {
            return listOf(polygonGeometry(flatMapAreaPath().closed()))
        }

        return map { command ->
            when (command) {
                is Box -> polygonGeometry(command.toRing())
                is Polygon -> polygonGeometry(command.points.closed())
                is Circle -> polygonGeometry(command.toRing())
                is Line,
                is Bend,
                -> polygonGeometry(listOf(command).flatMapAreaPath().closed())
            }
        }
    }

    private fun List<AreaCommand>.flatMapAreaPath(): List<Coordinates> =
        flatMap { command ->
            when (command) {
                is Line -> listOf(command.start, command.end)
                is Bend -> Bezier.bend(command.start, command.end, command.relativeAngle).toPoints(16)
                is Box,
                is Circle,
                is Polygon,
                -> emptyList()
            }
        }.deduplicateNeighbors()

    private fun Box.toRing(): List<Coordinates> {
        val minLon = minOf(first.lon, second.lon)
        val maxLon = maxOf(first.lon, second.lon)
        val minLat = minOf(first.lat, second.lat)
        val maxLat = maxOf(first.lat, second.lat)
        return listOf(
            Coordinates(minLon, minLat),
            Coordinates(maxLon, minLat),
            Coordinates(maxLon, maxLat),
            Coordinates(minLon, maxLat),
            Coordinates(minLon, minLat),
        )
    }

    private fun Circle.toRing(segments: Int = 72): List<Coordinates> {
        val earthRadiusKm = 6371.0
        val radius = radiusKm / earthRadiusKm
        val centerLat = Math.toRadians(center.lat)
        val centerLon = Math.toRadians(center.lon)

        return (0..segments).map { i ->
            val beta = 2.0 * PI * i / segments
            val lat = asin(sin(centerLat) * cos(radius) + cos(centerLat) * sin(radius) * cos(beta))
            val lon = centerLon + atan2(
                sin(beta) * sin(radius) * cos(centerLat),
                cos(radius) - sin(centerLat) * sin(lat),
            )
            Coordinates(Math.toDegrees(lon), Math.toDegrees(lat))
        }
    }

    private fun List<Coordinates>.closed(): List<Coordinates> =
        if (isNotEmpty() && first() == last()) this else this + first()

    private fun List<Coordinates>.deduplicateNeighbors(): List<Coordinates> =
        fold(emptyList()) { acc, point ->
            if (acc.lastOrNull() == point) acc else acc + point
        }

    private fun baseProperties(kind: String, name: String, scope: List<String>): Map<String, Any?> =
        mapOf(
            "kind" to kind,
            "name" to name,
            "scope" to scope.joinToString(" / "),
        )

    private fun List<Metadata>.toProperties(): Map<String, Any?> =
        associate { metadata ->
            "meta:${metadata.key}" to when (val value = metadata.value) {
                is MetadataValue.Identifier -> value.value
                MetadataValue.Nil -> null
                is MetadataValue.NumberValue -> value.value
                is MetadataValue.Text -> value.value
            }
        }

    private fun point(coordinates: Coordinates): GeoJsonGeometry =
        GeoJsonGeometry("Point", coordinates.toJsonArray())

    private fun lineString(points: List<Coordinates>): GeoJsonGeometry =
        GeoJsonGeometry("LineString", points.joinToString(", ", prefix = "[", postfix = "]") { it.toJsonArray() })

    private fun polygonGeometry(ring: List<Coordinates>): GeoJsonGeometry =
        GeoJsonGeometry("Polygon", ring.joinToString(", ", prefix = "[[", postfix = "]]") { it.toJsonArray() })

    private fun Coordinates.toJsonArray(): String = "[$lon, $lat]"
}

private data class GeoJsonFeature(
    val geometry: GeoJsonGeometry,
    val properties: Map<String, Any?>,
) {
    fun toJson(indent: String): String =
        buildString {
            append(indent).append("{\n")
            append(indent).append("  \"type\": \"Feature\",\n")
            append(indent).append("  \"properties\": ")
            append(properties.toJsonObject())
            append(",\n")
            append(indent).append("  \"geometry\": ")
            append(geometry.toJson())
            append("\n")
            append(indent).append("}")
        }
}

private data class GeoJsonGeometry(
    val type: String,
    val coordinatesJson: String,
) {
    fun toJson(): String =
        "{\"type\":\"${type.escapeJson()}\",\"coordinates\":$coordinatesJson}"
}

private fun Map<String, Any?>.toJsonObject(): String =
    entries.joinToString(",", prefix = "{", postfix = "}") { (key, value) ->
        "\"${key.escapeJson()}\":${value.toJsonValue()}"
    }

private fun Any?.toJsonValue(): String =
    when (this) {
        null -> "null"
        is Number -> toString()
        is Boolean -> toString()
        else -> "\"${toString().escapeJson()}\""
    }

private fun String.escapeJson(): String =
    buildString {
        for (char in this@escapeJson) {
            when (char) {
                '\\' -> append("\\\\")
                '"' -> append("\\\"")
                '\n' -> append("\\n")
                '\t' -> append("\\t")
                else -> append(char)
            }
        }
    }


