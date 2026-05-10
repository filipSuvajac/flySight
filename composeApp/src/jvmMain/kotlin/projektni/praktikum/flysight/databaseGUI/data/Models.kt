package projektni.praktikum.flysight.databaseGUI.data

import kotlinx.serialization.Serializable

@Serializable
data class Bird(
    val name: String,
    val latinName: String,
    val description: String = "",
    val imageUrl: String? = null,
    val familyName: String = "",
    val familyLatinName: String = "",
    val familySlug: String = ""
)

@Serializable
data class BirdFamily(
    val slug: String,
    val name: String,
    val latinName: String,
    val birds: List<Bird> = emptyList()
)

data class TableSchema(
    val name: String,
    val label: String,
    val columns: List<String>,
    val editableColumns: List<String> = columns.filterNot { it == "id" }
)

data class TableData(
    val schema: TableSchema,
    val rows: MutableList<MutableMap<String, String>>
)

@Serializable
data class GeneratorSettings(
    val count: Int,
    val minLatitude: Double,
    val maxLatitude: Double,
    val minLongitude: Double,
    val maxLongitude: Double,
    val minObserved: Int,
    val maxObserved: Int
)

val flySightSchemas = listOf(
    TableSchema(
        name = "bird_family",
        label = "Bird families",
        columns = listOf("id", "name", "latin_name", "slug")
    ),
    TableSchema(
        name = "bird_info",
        label = "Bird info",
        columns = listOf("id", "name", "latin_name", "family_id", "description", "image_url")
    ),
    TableSchema(
        name = "location",
        label = "Locations",
        columns = listOf("id", "name", "latitude", "longitude")
    ),
    TableSchema(
        name = "observation",
        label = "Observations",
        columns = listOf("id", "bird_id", "location_id", "observed_count", "event_date", "source")
    )
)
