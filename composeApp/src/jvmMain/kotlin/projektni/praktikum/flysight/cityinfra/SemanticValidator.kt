package projektni.praktikum.flysight.cityinfra

import kotlin.math.abs

class SemanticException(message: String) : RuntimeException(message)

object SemanticValidator {
    fun validate(program: CityProgram) {
        validateItems(program.items, "city '${program.name}'")
    }

    private fun validateItems(items: List<CityItem>, scope: String) {
        val names = mutableSetOf<Pair<String, String>>()
        for (item in items) {
            item.namedTypeAndName()?.let { key ->
                if (!names.add(key)) {
                    throw SemanticException("Duplicate ${key.first} named '${key.second}' in $scope")
                }
            }

            when (item) {
                is District -> validateItems(item.items, "district '${item.name}'")
                is Road -> {
                    if (item.speed < 0.0) throw SemanticException("Road '${item.name}' has negative speed")
                }
                is Building -> {
                    if (item.floors <= 0) throw SemanticException("Building '${item.name}' must have positive floors")
                    validateAreaCommands(item.name, item.commands)
                }
                is Park -> validateAreaCommands(item.name, item.commands)
                is Zone -> validateAreaCommands(item.name, item.commands)
                is MetadataItem,
                is Poi,
                is Sensor,
                is Stop,
                is Utility,
                is Water,
                -> Unit
            }
        }
    }

    private fun validateAreaCommands(name: String, commands: List<AreaCommand>) {
        commands.filterIsInstance<Circle>().forEach {
            if (it.radiusKm <= 0.0) throw SemanticException("Circle in '$name' must have positive radius")
        }

        if (commands.all { it is Line || it is Bend }) {
            val points = commands.flatMapCommandPoints()
            if (points.size < 3 || !points.first().almostEquals(points.last())) {
                throw SemanticException("Area '$name' must be closed when it is described with lines or bends")
            }
        }
    }

    private fun CityItem.namedTypeAndName(): Pair<String, String>? =
        when (this) {
            is District -> "district" to name
            is Road -> "road" to name
            is Building -> "building" to name
            is Park -> "park" to name
            is Water -> "water" to name
            is Utility -> "utility" to name
            is Stop -> "stop" to name
            is Poi -> "poi" to name
            is Sensor -> "sensor" to name
            is Zone -> "zone" to name
            is MetadataItem -> null
        }

    private fun List<AreaCommand>.flatMapCommandPoints(): List<Coordinates> =
        flatMap { command ->
            when (command) {
                is Line -> listOf(command.start, command.end)
                is Bend -> listOf(command.start, command.end)
                is Box,
                is Circle,
                is Polygon,
                -> emptyList()
            }
        }.deduplicateNeighbors()

    private fun List<Coordinates>.deduplicateNeighbors(): List<Coordinates> =
        fold(emptyList()) { acc, point ->
            if (acc.lastOrNull()?.almostEquals(point) == true) acc else acc + point
        }

    private fun Coordinates.almostEquals(other: Coordinates): Boolean =
        abs(lon - other.lon) < 0.0000001 && abs(lat - other.lat) < 0.0000001
}
