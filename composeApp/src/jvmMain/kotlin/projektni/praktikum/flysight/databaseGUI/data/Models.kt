package projektni.praktikum.flysight.databaseGUI.data

import androidx.compose.runtime.snapshots.SnapshotStateList
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
    val rows: SnapshotStateList<MutableMap<String, String>>
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

@Serializable
data class EbirdObservation(
    val id: String,
    val speciesCode: String = "",
    val commonName: String = "",
    val slovenianName: String = "",
    val imageUrl: String = "",
    val scientificName: String = "",
    val locationName: String = "",
    val city: String = "",
    val observedAt: String = "",
    val count: Int? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val region: String = "",
    val valid: Boolean = false,
    val reviewed: Boolean = false
)

@Serializable
data class AnalyticsResponse(
    val generatedAt: String = "",
    val database: DatabaseAnalytics = DatabaseAnalytics(),
    val activity: ActivityAnalytics = ActivityAnalytics()
)

@Serializable
data class DatabaseAnalytics(
    val tableCounts: List<AnalyticsCount> = emptyList(),
    val observationsBySource: List<AnalyticsCount> = emptyList(),
    val topSpecies: List<AnalyticsCount> = emptyList(),
    val topLocations: List<AnalyticsCount> = emptyList(),
    val monthlyTrend: List<AnalyticsCount> = emptyList()
)

@Serializable
data class ActivityAnalytics(
    val total: Int = 0,
    val today: Int = 0,
    val week: Int = 0,
    val eventsByDay: List<AnalyticsCount> = emptyList(),
    val eventsByType: List<AnalyticsCount> = emptyList(),
    val recentEvents: List<ActivityEvent> = emptyList()
)

@Serializable
data class AnalyticsCount(
    val label: String = "",
    val total: Int = 0
)

@Serializable
data class ActivityEvent(
    val id: Int = 0,
    val eventType: String = "",
    val source: String = "",
    val actor: String = "",
    val createdAt: String = "",
    val metadataText: String = ""
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
    ),
    TableSchema(
        name = "app_event",
        label = "Activity events",
        columns = listOf("id", "event_type", "source", "user_id", "metadata", "created_at"),
        editableColumns = listOf("event_type", "source", "user_id")
    )
)
