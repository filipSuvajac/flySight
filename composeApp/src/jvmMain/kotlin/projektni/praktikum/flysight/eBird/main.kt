package projektni.praktikum.flysight.eBird

import java.io.File
import java.io.PrintStream

data class Occurrence(
    val family: String?,
    val genus: String?,
    val species: String?,
    val locality: String?,
    val latitude: Double?,
    val longitude: Double?,
    val individualCount: Int?,
    val eventDate: String?
)

fun main() {
    System.setOut(PrintStream(System.out, true, "UTF-8"))

    val filePath = "data.csv"
    val lines = File(filePath).readLines()

    val header = lines.first().split("\t")

    fun indexOf(column: String) = header.indexOf(column)

    val familyIdx = indexOf("family")
    val genusIdx = indexOf("genus")
    val speciesIdx = indexOf("species")
    val localityIdx = indexOf("locality")
    val latIdx = indexOf("decimalLatitude")
    val lonIdx = indexOf("decimalLongitude")
    val countIdx = indexOf("individualCount")
    val dateIdx = indexOf("eventDate")

    fun get(cols: List<String>, idx: Int): String? =
        if (idx in cols.indices && cols[idx].isNotBlank()) cols[idx] else null

    val results = lines.drop(1).mapNotNull { line ->
        val cols = line.split("\t")

        Occurrence(
            family = get(cols, familyIdx),
            genus = get(cols, genusIdx),
            species = get(cols, speciesIdx),
            locality = get(cols, localityIdx),
            latitude = get(cols, latIdx)?.toDoubleOrNull(),
            longitude = get(cols, lonIdx)?.toDoubleOrNull(),
            individualCount = get(cols, countIdx)?.toIntOrNull(),
            eventDate = get(cols, dateIdx)
        )
    }

    println("\n===== EBIRD REPORT =====\n")

    results.forEachIndexed { i, o ->
        println("Record #${i + 1}")
        println("Species : ${o.species ?: "unknown"}")
        println("Family  : ${o.family ?: "unknown"}")
        println("Genus   : ${o.genus ?: "unknown"}")
        println("Locality: ${o.locality ?: "unknown"}")
        println("Coordinates   : ${o.latitude ?: "?"}, ${o.longitude ?: "?"}")
        println("Count   : ${o.individualCount ?: "?"}")
        println("Date    : ${o.eventDate ?: "?"}")
        println("──────────────────────────────")
    }

    println("\nTotal records: ${results.size}")
}