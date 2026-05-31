package projektni.praktikum.flysight.cityinfra

import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.tan

data class CityProgram(
    val name: String,
    val items: List<CityItem>,
)

sealed interface CityItem

data class District(
    val name: String,
    val items: List<CityItem>,
) : CityItem

data class Road(
    val name: String,
    val type: String,
    val speed: Double,
    val commands: List<PathCommand>,
    val metadata: List<Metadata>,
) : CityItem

data class Building(
    val name: String,
    val floors: Int,
    val use: String,
    val commands: List<AreaCommand>,
    val metadata: List<Metadata>,
) : CityItem

data class Park(
    val name: String,
    val commands: List<AreaCommand>,
    val metadata: List<Metadata>,
) : CityItem

data class Water(
    val name: String,
    val type: String,
    val commands: List<PathCommand>,
    val metadata: List<Metadata>,
) : CityItem

data class Utility(
    val name: String,
    val type: String,
    val material: String,
    val commands: List<PathCommand>,
    val metadata: List<Metadata>,
) : CityItem

data class Stop(
    val name: String,
    val mode: String,
    val at: Coordinates,
) : CityItem

data class Poi(
    val name: String,
    val kind: String,
    val at: Coordinates,
) : CityItem

data class Sensor(
    val name: String,
    val kind: String,
    val at: Coordinates,
    val metadata: List<Metadata>,
) : CityItem

data class Bridge(
    val name: String,
    val type: String,
    val commands: List<PathCommand>,
    val metadata: List<Metadata>,
) : CityItem

data class Roundabout(
    val name: String,
    val type: String,
    val circle: Circle,
    val metadata: List<Metadata>,
) : CityItem

data class MetadataItem(val metadata: Metadata) : CityItem

data class Metadata(
    val key: String,
    val value: MetadataValue,
)

sealed interface MetadataValue {
    data class Text(val value: String) : MetadataValue
    data class NumberValue(val value: Double) : MetadataValue
    data class Identifier(val value: String) : MetadataValue
    data object Nil : MetadataValue
}

sealed interface PathCommand
sealed interface AreaCommand

data class Line(val start: Coordinates, val end: Coordinates) : PathCommand, AreaCommand
data class Bend(val start: Coordinates, val end: Coordinates, val relativeAngle: Double) : PathCommand, AreaCommand
data class Polyline(val points: List<Coordinates>) : PathCommand
data class Box(val first: Coordinates, val second: Coordinates) : AreaCommand
data class Polygon(val points: List<Coordinates>) : AreaCommand
data class Circle(val center: Coordinates, val radiusKm: Double) : AreaCommand

data class Coordinates(val lon: Double, val lat: Double) {
    operator fun plus(other: Coordinates) = Coordinates(lon + other.lon, lat + other.lat)
    operator fun minus(other: Coordinates) = Coordinates(lon - other.lon, lat - other.lat)
    operator fun times(value: Double) = Coordinates(lon * value, lat * value)

    fun dist(other: Coordinates): Double = hypot(lon - other.lon, lat - other.lat)
    fun angle(other: Coordinates): Double = atan2(other.lat - lat, other.lon - lon)
    fun offset(distance: Double, angle: Double): Coordinates =
        Coordinates(lon + cos(angle) * distance, lat + sin(angle) * distance)
}

class Bezier(
    private val p0: Coordinates,
    private val p1: Coordinates,
    private val p2: Coordinates,
    private val p3: Coordinates,
) {
    fun at(t: Double): Coordinates =
        p0 * (1.0 - t).pow(3.0) +
            p1 * 3.0 * (1.0 - t).pow(2.0) * t +
            p2 * 3.0 * (1.0 - t) * t.pow(2.0) +
            p3 * t.pow(3.0)

    fun toPoints(segmentsCount: Int): List<Coordinates> =
        (0..segmentsCount).map { i -> at(i / segmentsCount.toDouble()) }

    fun approxLength(): Double {
        val midpoint = at(0.5)
        return p0.dist(midpoint) + midpoint.dist(p3)
    }

    fun resolutionToSegmentsCount(resolution: Double): Int =
        (resolution * approxLength()).coerceAtLeast(2.0).toInt()

    companion object {
        fun bend(t0: Coordinates, t1: Coordinates, relativeAngleDegrees: Double): Bezier {
            val relativeAngle = Math.toRadians(relativeAngleDegrees)
            val oppositeRelativeAngle = PI - relativeAngle
            val angle = t0.angle(t1)
            val dist = t0.dist(t1)
            val constant = (4.0 / 3.0) * tan(PI / 8.0)

            val c0 = t0.offset(constant * dist, angle + relativeAngle)
            val c1 = t1.offset(constant * dist, angle + oppositeRelativeAngle)

            return Bezier(t0, c0, c1, t1)
        }
    }
}


