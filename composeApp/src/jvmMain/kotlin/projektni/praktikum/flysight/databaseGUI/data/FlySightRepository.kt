package projektni.praktikum.flysight.databaseGUI.data

import androidx.compose.runtime.mutableStateListOf
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.time.LocalDate
import kotlin.random.Random

class FlySightRepository {
    private val json = Json {
        ignoreUnknownKeys = true
        prettyPrint = true
    }

    val tables: MutableList<TableData> = flySightSchemas.map { schema ->
        TableData(schema, mutableStateListOf())
    }.toMutableList()

    fun table(name: String): TableData = tables.first { it.schema.name == name }

    fun replaceRows(tableName: String, rows: List<Map<String, String>>) {
        val table = table(tableName)
        table.rows.clear()
        table.rows.addAll(rows.map { it.toMutableMap() })
    }

    fun addRow(table: TableData, values: Map<String, String>) {
        val row = mutableMapOf<String, String>()
        row["id"] = nextId(table).toString()
        table.schema.editableColumns.forEach { column ->
            row[column] = values[column].orEmpty()
        }
        table.rows.add(row)
    }

    fun updateRow(table: TableData, original: Map<String, String>, values: Map<String, String>) {
        val index = table.rows.indexOfFirst { it["id"] == original["id"] }
        if (index == -1) return
        val updated = table.rows[index].toMutableMap()
        table.schema.editableColumns.forEach { column ->
            updated[column] = values[column].orEmpty()
        }
        table.rows[index] = updated
    }

    fun deleteRow(table: TableData, row: Map<String, String>) {
        table.rows.removeAll { it["id"] == row["id"] }
    }

    fun loadScrapedFamilies(): List<BirdFamily> {
        val candidates = listOf(
            File("composeApp/ptice_slovenije.json"),
            File("ptice_slovenije.json"),
            File("../composeApp/ptice_slovenije.json")
        )
        val file = candidates.firstOrNull { it.exists() } ?: return emptyList()
        return json.decodeFromString(file.readText(Charsets.UTF_8))
    }

    fun importBirds(families: List<BirdFamily>, limit: Int = Int.MAX_VALUE): Int {
        val familyTable = table("bird_family")
        val birdTable = table("bird_info")
        var imported = 0

        families.forEach { family ->
            val familyId = findOrCreateFamily(familyTable, family)
            family.birds.take(limit - imported).forEach { bird ->
                if (birdTable.rows.none { it["latin_name"] == bird.latinName && it["name"] == bird.name }) {
                    addRow(
                        birdTable,
                        mapOf(
                            "name" to bird.name,
                            "latin_name" to bird.latinName,
                            "family_id" to familyId,
                            "description" to bird.description,
                            "image_url" to bird.imageUrl.orEmpty()
                        )
                    )
                    imported++
                }
            }
            if (imported >= limit) return imported
        }

        return imported
    }

    fun generateObservations(settings: GeneratorSettings): Int {
        val locationTable = table("location")
        val observationTable = table("observation")
        ensureGeneratedLocations(locationTable, settings)

        val birdIds = table("bird_info").rows.mapNotNull { it["id"] }.ifEmpty { listOf("1", "2") }
        val locationIds = locationTable.rows.mapNotNull { it["id"] }

        repeat(settings.count) {
            addRow(
                observationTable,
                mapOf(
                    "bird_id" to birdIds.random(),
                    "location_id" to locationIds.random(),
                    "observed_count" to Random.nextInt(settings.minObserved, settings.maxObserved + 1).toString(),
                    "event_date" to LocalDate.now().minusDays(Random.nextLong(0, 365)).toString(),
                    "source" to "generated"
                )
            )
        }

        return settings.count
    }

    fun tablesSnapshot(): Map<String, List<Map<String, String>>> =
        tables.associate { it.schema.name to it.rows.map { row -> row.toMap() } }

    fun scrapedPayload(families: List<BirdFamily>): String = json.encodeToString(families)

    private fun findOrCreateFamily(table: TableData, family: BirdFamily): String {
        val existing = table.rows.firstOrNull { it["slug"] == family.slug }
        if (existing != null) return existing["id"].orEmpty()

        addRow(
            table,
            mapOf(
                "name" to family.name,
                "latin_name" to family.latinName,
                "slug" to family.slug
            )
        )
        return table.rows.last()["id"].orEmpty()
    }

    private fun ensureGeneratedLocations(table: TableData, settings: GeneratorSettings) {
        if (table.rows.isNotEmpty()) return
        repeat(3) { index ->
            addRow(
                table,
                mapOf(
                    "name" to "Generated location ${index + 1}",
                    "latitude" to randomDouble(settings.minLatitude, settings.maxLatitude).toString(),
                    "longitude" to randomDouble(settings.minLongitude, settings.maxLongitude).toString()
                )
            )
        }
    }

    private fun nextId(table: TableData): Int =
        (table.rows.mapNotNull { it["id"]?.toIntOrNull() }.maxOrNull() ?: 0) + 1

    private fun randomDouble(min: Double, max: Double): Double {
        val low = min.coerceAtMost(max)
        val high = max.coerceAtLeast(min)
        return low + Random.nextDouble() * (high - low)
    }
}

class FlySightApiClient(
    private val baseUrl: String,
    private val authToken: String = ""
) {
    private val client = OkHttpClient()
    private val json = Json {
        prettyPrint = true
        ignoreUnknownKeys = true
    }
    private val mediaType = "application/json; charset=utf-8".toMediaType()

    fun healthCheck(): Result<String> = runCatching {
        val request = requestBuilder("/health")
            .url("${baseUrl.trimEnd('/')}/health")
            .get()
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) error("HTTP ${response.code}")
            response.body?.string().orEmpty().ifBlank { "OK" }
        }
    }

    fun register(email: String, name: String, password: String): Result<String> = runCatching {
        authRequest("/auth/register", mapOf("email" to email, "name" to name, "password" to password))
    }

    fun login(email: String, password: String): Result<String> = runCatching {
        authRequest("/auth/login", mapOf("email" to email, "password" to password))
    }

    fun fetchRows(tableName: String): Result<List<Map<String, String>>> = runCatching {
        val request = requestBuilder("/api/$tableName")
            .url("${baseUrl.trimEnd()}/api/$tableName")
            .get()
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) error("HTTP ${response.code}: ${response.body?.string().orEmpty()}")
            val payload = response.body?.string().orEmpty()
            val array = json.parseToJsonElement(payload) as? JsonArray ?: return@use emptyList()
            array.mapNotNull { element ->
                val obj = element as? JsonObject ?: return@mapNotNull null
                obj.mapValues { (_, value) -> value.asDisplayString() }
            }
        }
    }

    fun createRow(tableName: String, values: Map<String, String>): Result<Map<String, String>> = runCatching {
        requestRow("POST", "/api/$tableName", values)
    }

    fun updateRow(tableName: String, id: String, values: Map<String, String>): Result<Map<String, String>> = runCatching {
        requestRow("PUT", "/api/$tableName/$id", values)
    }

    fun deleteRow(tableName: String, id: String): Result<Unit> = runCatching {
        val request = requestBuilder("/api/$tableName/$id")
            .url("${baseUrl.trimEnd()}/api/$tableName/$id")
            .delete()
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) error("HTTP ${response.code}: ${response.body?.string().orEmpty()}")
        }
    }

    fun importDoppsFamilies(families: List<BirdFamily>): Result<String> = runCatching {
        postJson("/api/import/dopps", json.encodeToString(families))
    }

    fun fetchRecentEbirdObservations(days: Int, maxResults: Int): Result<List<EbirdObservation>> = runCatching {
        val safeDays = days.coerceIn(1, 30)
        val safeMaxResults = maxResults.coerceIn(1, 10000)
        val request = requestBuilder("/api/ebird/recent")
            .url("${baseUrl.trimEnd()}/api/ebird/recent?days=$safeDays&maxResults=$safeMaxResults")
            .get()
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) error("HTTP ${response.code}: ${response.body?.string().orEmpty()}")
            val payload = response.body?.string().orEmpty()
            val obj = json.parseToJsonElement(payload) as? JsonObject ?: return@use emptyList()
            val observations = obj["observations"] as? JsonArray ?: return@use emptyList()
            observations.mapNotNull { element ->
                runCatching { json.decodeFromJsonElement(EbirdObservation.serializer(), element) }.getOrNull()
            }
        }
    }

    fun importEbirdObservations(observations: List<EbirdObservation>): Result<String> = runCatching {
        postJson("/api/import/ebird", json.encodeToString(mapOf("observations" to observations)))
    }

    fun generateObservations(settings: GeneratorSettings): Result<String> = runCatching {
        postJson("/api/generate/observations", json.encodeToString(settings))
    }

    fun fetchDesktopAnalytics(): Result<AnalyticsResponse> = runCatching {
        val request = requestBuilder("/api/analytics/desktop")
            .url("${baseUrl.trimEnd()}/api/analytics/desktop")
            .get()
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                val errorBody = response.body?.string().orEmpty()
                val cleanMessage = when {
                    response.code == 404 && errorBody.contains("Cannot GET /api/analytics/desktop") ->
                        "HTTP 404: analytics endpoint is missing on the running backend. Rebuild and restart the backend."
                    errorBody.trimStart().startsWith("<!DOCTYPE") || errorBody.trimStart().startsWith("<html") ->
                        "HTTP ${response.code}: ${response.message}"
                    else -> "HTTP ${response.code}: $errorBody"
                }
                error(cleanMessage)
            }
            val payload = response.body?.string().orEmpty()
            json.decodeFromString<AnalyticsResponse>(payload)
        }
    }

    private fun requestRow(method: String, path: String, values: Map<String, String>): Map<String, String> {
        val body = json.encodeToString(values)
        val request = requestBuilder(path)
            .url("${baseUrl.trimEnd()}$path")
            .method(method, body.toRequestBody(mediaType))
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) error("HTTP ${response.code}: ${response.body?.string().orEmpty()}")
            val payload = response.body?.string().orEmpty()
            val obj = json.parseToJsonElement(payload) as? JsonObject ?: return emptyMap()
            return obj.mapValues { (_, value) -> value.asDisplayString() }
        }
    }

    private fun postJson(path: String, body: String): String {
        val request = requestBuilder(path)
            .url("${baseUrl.trimEnd()}$path")
            .post(body.toRequestBody(mediaType))
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) error("HTTP ${response.code}: ${response.body?.string().orEmpty()}")
            return response.body?.string().orEmpty().ifBlank { "OK" }
        }
    }

    private fun authRequest(path: String, body: Map<String, String>): String {
        val request = Request.Builder()
            .url("${baseUrl.trimEnd()}$path")
            .post(json.encodeToString(body).toRequestBody(mediaType))
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) error("HTTP ${response.code}: ${response.body?.string().orEmpty()}")
            val payload = response.body?.string().orEmpty()
            val obj = json.parseToJsonElement(payload) as? JsonObject ?: error("Invalid auth response")
            return obj["token"]?.jsonPrimitive?.contentOrNull ?: error("Auth response did not include token")
        }
    }

    private fun requestBuilder(path: String): Request.Builder {
        val builder = Request.Builder()
        if (path.startsWith("/api") && authToken.isNotBlank()) {
            builder.header("Authorization", "Bearer $authToken")
        }
        return builder
    }

    private fun String.trimEnd(): String = trimEnd('/')

    private fun JsonElement.asDisplayString(): String {
        val primitive = this as? JsonPrimitive
        if (primitive != null) {
            primitive.contentOrNull?.let { return it }
            primitive.intOrNull?.let { return it.toString() }
            primitive.doubleOrNull?.let { return it.toString() }
            primitive.booleanOrNull?.let { return it.toString() }
        }
        return toString()
    }
}
