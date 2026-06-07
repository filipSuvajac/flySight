package projektni.praktikum.flysight.databaseGUI

import androidx.compose.foundation.HorizontalScrollbar
import androidx.compose.foundation.VerticalScrollbar
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollbarAdapter
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.AlertDialog
import androidx.compose.material.Button
import androidx.compose.material.Checkbox
import androidx.compose.material.Divider
import androidx.compose.material.DropdownMenu
import androidx.compose.material.DropdownMenuItem
import androidx.compose.material.Icon
import androidx.compose.material.IconButton
import androidx.compose.material.MaterialTheme
import androidx.compose.material.OutlinedTextField
import androidx.compose.material.Surface
import androidx.compose.material.Tab
import androidx.compose.material.TabRow
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import flysight.composeapp.generated.resources.Res
import flysight.composeapp.generated.resources.add
import flysight.composeapp.generated.resources.delete
import flysight.composeapp.generated.resources.edit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.jetbrains.compose.resources.painterResource
import projektni.praktikum.flysight.databaseGUI.data.Bird
import projektni.praktikum.flysight.databaseGUI.data.BirdFamily
import projektni.praktikum.flysight.databaseGUI.data.EbirdObservation
import projektni.praktikum.flysight.databaseGUI.data.FlySightApiClient
import projektni.praktikum.flysight.databaseGUI.data.FlySightRepository
import projektni.praktikum.flysight.databaseGUI.data.GeneratorSettings
import projektni.praktikum.flysight.databaseGUI.data.TableData

private enum class Screen(val title: String) {
    Database("Database"),
    Scraper("Scraper"),
    Ebird("eBird"),
    Generator("Generator"),
    Service("Web service")
}

private const val DatabaseCellLimit = 90

@Composable
fun App() {
    MaterialTheme {
        val repository = remember { FlySightRepository() }
        var screen by remember { mutableStateOf(Screen.Database) }
        var status by remember { mutableStateOf("Ready") }
        var apiBaseUrl by remember { mutableStateOf("http://localhost") }
        var authToken by remember { mutableStateOf("") }
        var authEmail by remember { mutableStateOf("") }

        Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFFF7F8FA)) {
            Column(Modifier.fillMaxSize()) {
                Header(status)
                TabRow(selectedTabIndex = screen.ordinal, backgroundColor = Color.White) {
                    Screen.entries.forEach { item ->
                        Tab(
                            selected = item == screen,
                            onClick = { screen = item },
                            text = { Text(item.title) }
                        )
                    }
                }

                Box(Modifier.fillMaxSize().padding(16.dp)) {
                    when (screen) {
                        Screen.Database -> DatabaseScreen(repository, apiBaseUrl, authToken, onStatus = { status = it })
                        Screen.Scraper -> ScraperScreen(repository, apiBaseUrl, authToken, onStatus = { status = it })
                        Screen.Ebird -> EbirdScreen(repository, apiBaseUrl, authToken, onStatus = { status = it })
                        Screen.Generator -> GeneratorScreen(repository, apiBaseUrl, authToken, onStatus = { status = it })
                        Screen.Service -> ServiceScreen(
                            repository = repository,
                            apiBaseUrl = apiBaseUrl,
                            authToken = authToken,
                            authEmail = authEmail,
                            onApiBaseUrlChange = { apiBaseUrl = it },
                            onAuthChange = { email, token ->
                                authEmail = email
                                authToken = token
                            },
                            onStatus = { status = it }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun Header(status: String) {
    Row(
        modifier = Modifier.fillMaxWidth().background(Color(0xFF263238)).padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text("FlySight", color = Color.White, fontWeight = FontWeight.Bold)
            Text("Desktop database manager", color = Color(0xFFCFD8DC))
        }
        Text(status, color = Color(0xFFFFF59D))
    }
}

@Composable
private fun DatabaseScreen(
    repository: FlySightRepository,
    apiBaseUrl: String,
    authToken: String,
    onStatus: (String) -> Unit
) {
    var selectedTable by remember { mutableStateOf(repository.tables.first()) }
    var expanded by remember { mutableStateOf(false) }
    var editingRow by remember { mutableStateOf<Map<String, String>?>(null) }
    var showForm by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<Map<String, String>?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(apiBaseUrl, authToken) {
        onStatus("Loading database tables...")
        val message = withContext(Dispatchers.IO) {
            refreshAllTables(repository, apiBaseUrl, authToken)
        }
        onStatus(message)
    }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box {
                Button(onClick = { expanded = true }) {
                    Text("${selectedTable.schema.label} (${selectedTable.rows.size})")
                }
                DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    repository.tables.forEach { table ->
                        DropdownMenuItem(
                            onClick = {
                                selectedTable = table
                                expanded = false
                            }
                        ) {
                            Text(table.schema.label)
                        }
                    }
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Button(
                    onClick = {
                        scope.launch {
                            onStatus("Refreshing ${selectedTable.schema.name}...")
                            val message = withContext(Dispatchers.IO) {
                                refreshAllTables(repository, apiBaseUrl, authToken)
                            }
                            onStatus(message)
                        }
                    }
                ) {
                    Text("Refresh")
                }

                IconButton(
                    onClick = {
                        editingRow = null
                        showForm = true
                    }
                ) {
                    Icon(
                        painter = painterResource(Res.drawable.add),
                        contentDescription = "Add",
                        modifier = Modifier.size(28.dp),
                        tint = Color(0xFF263238)
                    )
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        DynamicTable(
            table = selectedTable,
            onEdit = { row ->
                editingRow = row.toMap()
                showForm = true
            },
            onDelete = { row ->
                deleteTarget = row.toMap()
            }
        )
    }

    if (showForm) {
        DynamicFormDialog(
            table = selectedTable,
            rowData = editingRow,
            onDismiss = { showForm = false },
            onSave = { values ->
                scope.launch {
                    val tableName = selectedTable.schema.name
                    onStatus("Saving $tableName...")
                    val result = withContext(Dispatchers.IO) {
                        val api = FlySightApiClient(apiBaseUrl, authToken)
                        if (editingRow == null) {
                            api.createRow(tableName, values)
                        } else {
                            api.updateRow(tableName, editingRow?.get("id").orEmpty(), values)
                        }.fold(
                            onSuccess = {
                                refreshAllTables(repository, apiBaseUrl, authToken)
                                "Saved row in $tableName"
                            },
                            onFailure = { "Save failed: ${it.message}" }
                        )
                    }
                    onStatus(result)
                    showForm = false
                }
            }
        )
    }

    deleteTarget?.let { row ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Confirm delete") },
            text = { Text("Delete row #${row["id"].orEmpty()} from ${selectedTable.schema.name}?") },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            val tableName = selectedTable.schema.name
                            onStatus("Deleting row from $tableName...")
                            val message = withContext(Dispatchers.IO) {
                                FlySightApiClient(apiBaseUrl, authToken)
                                    .deleteRow(tableName, row["id"].orEmpty())
                                    .fold(
                                        onSuccess = {
                                            refreshAllTables(repository, apiBaseUrl, authToken)
                                            "Deleted row from $tableName"
                                        },
                                        onFailure = { "Delete failed: ${it.message}" }
                                    )
                            }
                            onStatus(message)
                            deleteTarget = null
                        }
                    }
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                Button(onClick = { deleteTarget = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun DynamicTable(
    table: TableData,
    onEdit: (Map<String, String>) -> Unit,
    onDelete: (Map<String, String>) -> Unit
) {
    val horizontalScroll = rememberScrollState()

    Box(Modifier.fillMaxSize().border(1.dp, Color(0xFFE0E0E0)).background(Color.White)) {
        Column(Modifier.fillMaxSize().horizontalScroll(horizontalScroll).padding(8.dp)) {
            Row(Modifier.fillMaxWidth().background(Color(0xFFEEF2F4)).padding(8.dp)) {
                table.schema.columns.forEach { column ->
                    Text(column, modifier = Modifier.width(170.dp), fontWeight = FontWeight.Bold)
                }
                Text("Actions", modifier = Modifier.width(120.dp), fontWeight = FontWeight.Bold)
            }

            Divider()

            LazyColumn(Modifier.fillMaxHeight()) {
                items(table.rows, key = { it["id"].orEmpty() }) { row ->
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 8.dp ,vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        table.schema.columns.forEach { column ->
                            Text(
                                row[column].orEmpty().limitForCell(),
                                modifier = Modifier.width(170.dp).padding(end = 12.dp),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        Row(Modifier.width(120.dp)) {
                            IconButton(onClick = { onEdit(row) }) {
                                Icon(
                                    painter = painterResource(Res.drawable.edit),
                                    contentDescription = "Edit",
                                    modifier = Modifier.size(24.dp),
                                    tint = Color(0xFF455A64)
                                )
                            }
                            IconButton(onClick = { onDelete(row) }) {
                                Icon(
                                    painter = painterResource(Res.drawable.delete),
                                    contentDescription = "Delete",
                                    modifier = Modifier.size(24.dp),
                                    tint = Color(0xFF8E2430)
                                )
                            }
                        }
                    }
                    Divider(color = Color(0xFFF1F1F1))
                }
            }
        }

        HorizontalScrollbar(
            adapter = rememberScrollbarAdapter(horizontalScroll),
            modifier = Modifier.align(Alignment.BottomStart).fillMaxWidth()
        )
    }
}

private fun String.limitForCell(limit: Int = DatabaseCellLimit): String {
    val clean = replace("\n", " ").replace(Regex("\\s+"), " ").trim()
    return if (clean.length <= limit) clean else clean.take(limit).trimEnd() + "..."
}

@Composable
private fun DynamicFormDialog(
    table: TableData,
    rowData: Map<String, String>?,
    onDismiss: () -> Unit,
    onSave: (Map<String, String>) -> Unit
) {
    val inputs = remember { mutableStateMapOf<String, String>() }

    LaunchedEffect(table.schema.name, rowData) {
        inputs.clear()
        table.schema.editableColumns.forEach { column ->
            inputs[column] = rowData?.get(column).orEmpty()
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (rowData == null) "Add ${table.schema.label}" else "Edit ${table.schema.label}") },
        text = {
            LazyColumn(Modifier.widthIn(min = 460.dp, max = 720.dp)) {
                items(table.schema.editableColumns) { column ->
                    OutlinedTextField(
                        value = inputs[column].orEmpty(),
                        onValueChange = { inputs[column] = it },
                        label = { Text(column) },
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                    )
                }
            }
        },
        confirmButton = {
            Button(onClick = { onSave(inputs.toMap()) }) {
                Text("Save")
            }
        },
        dismissButton = {
            Button(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
private fun ScraperScreen(
    repository: FlySightRepository,
    apiBaseUrl: String,
    authToken: String,
    onStatus: (String) -> Unit
) {
    val families = remember { repository.loadScrapedFamilies() }
    var query by remember { mutableStateOf("") }
    var sortBy by remember { mutableStateOf("name") }
    val scope = rememberCoroutineScope()

    val birds = remember(families, query, sortBy) {
        val filtered = families.flatMap { it.birds }.filter { bird ->
            val text = "${bird.name} ${bird.latinName} ${bird.familyName}".lowercase()
            text.contains(query.lowercase())
        }
        when (sortBy) {
            "latin" -> filtered.sortedBy { it.latinName }
            "family" -> filtered.sortedBy { it.familyName }
            else -> filtered.sortedBy { it.name }
        }
    }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("Filter scraped birds") },
                modifier = Modifier.width(360.dp)
            )
            Spacer(Modifier.width(12.dp))
            Button(onClick = { sortBy = "name" }) { Text("Name") }
            Spacer(Modifier.width(8.dp))
            Button(onClick = { sortBy = "latin" }) { Text("Latin") }
            Spacer(Modifier.width(8.dp))
            Button(onClick = { sortBy = "family" }) { Text("Family") }
            Spacer(Modifier.width(12.dp))
            Button(
                enabled = birds.isNotEmpty(),
                onClick = {
                    scope.launch {
                        onStatus("Importing scraped DOPPS data...")
                        val message = withContext(Dispatchers.IO) {
                            FlySightApiClient(apiBaseUrl, authToken).importDoppsFamilies(families).fold(
                                onSuccess = {
                                    refreshAllTables(repository, apiBaseUrl, authToken)
                                    "Imported scraped data: $it"
                                },
                                onFailure = { "Import failed: ${it.message}" }
                            )
                        }
                        onStatus(message)
                    }
                }
            ) {
                Text("Import")
            }
        }

        Spacer(Modifier.height(12.dp))
        Text("Loaded ${families.size} families and ${families.sumOf { it.birds.size }} birds from ptice_slovenije.json")
        Spacer(Modifier.height(8.dp))
        ScrapedBirdList(birds)
    }
}

@Composable
private fun ScrapedBirdList(birds: List<Bird>) {
    val scrollState = rememberScrollState()
    Box(Modifier.fillMaxSize().background(Color.White).border(1.dp, Color(0xFFE0E0E0))) {
        LazyColumn(Modifier.fillMaxSize().padding(8.dp)) {
            items(birds) { bird ->
                Column(Modifier.fillMaxWidth().padding(8.dp)) {
                    Text("${bird.name} (${bird.latinName})", fontWeight = FontWeight.Bold)
                    Text("${bird.familyName} - ${bird.familyLatinName}", color = Color(0xFF455A64))
                    Text(bird.description.take(220), maxLines = 3)
                }
                Divider(color = Color(0xFFF1F1F1))
            }
        }
        VerticalScrollbar(
            adapter = rememberScrollbarAdapter(scrollState),
            modifier = Modifier.align(Alignment.CenterEnd).fillMaxHeight()
        )
    }
}

@Composable
private fun EbirdScreen(
    repository: FlySightRepository,
    apiBaseUrl: String,
    authToken: String,
    onStatus: (String) -> Unit
) {
    var observations by remember { mutableStateOf<List<EbirdObservation>>(emptyList()) }
    var speciesFilter by remember { mutableStateOf("") }
    var locationFilter by remember { mutableStateOf("") }
    var dateFilter by remember { mutableStateOf("") }
    var sourceFilter by remember { mutableStateOf("") }
    var recentDays by remember { mutableStateOf("30") }
    var maxResults by remember { mutableStateOf("500") }
    var minCount by remember { mutableStateOf("") }
    var onlyWithCoordinates by remember { mutableStateOf(false) }
    var statusFilter by remember { mutableStateOf("all") }
    var sortBy by remember { mutableStateOf("date") }
    val scope = rememberCoroutineScope()

    val filteredObservations = remember(
        observations,
        speciesFilter,
        locationFilter,
        dateFilter,
        sourceFilter,
        minCount,
        onlyWithCoordinates,
        statusFilter,
        sortBy
    ) {
        val species = speciesFilter.trim().lowercase()
        val location = locationFilter.trim().lowercase()
        val date = dateFilter.trim()
        val source = sourceFilter.trim().lowercase()
        val minimumCount = minCount.toIntOrNull()

        val filtered = observations.filter { observation ->
            val observedDate = observation.observedAt.take(10)
            val count = observation.count ?: 0

            val speciesMatch = species.isBlank() ||
                observation.slovenianName.lowercase().contains(species) ||
                observation.commonName.lowercase().contains(species) ||
                observation.scientificName.lowercase().contains(species) ||
                observation.speciesCode.lowercase().contains(species)

            val locationMatch = location.isBlank() ||
                observation.city.lowercase().contains(location) ||
                observation.locationName.lowercase().contains(location) ||
                observation.region.lowercase().contains(location)

            val dateMatch = date.isBlank() || observedDate == date
            val sourceMatch = source.isBlank() || "ebird".contains(source)
            val countMatch = minimumCount == null || count >= minimumCount
            val coordinateMatch = !onlyWithCoordinates || observation.latitude != null && observation.longitude != null
            val statusMatch = when (statusFilter) {
                "reviewed" -> observation.reviewed
                "valid" -> observation.valid
                "pending" -> !observation.valid && !observation.reviewed
                else -> true
            }

            speciesMatch && locationMatch && dateMatch && sourceMatch && countMatch && coordinateMatch && statusMatch
        }

        when (sortBy) {
            "species" -> filtered.sortedBy { it.slovenianName.ifBlank { it.commonName } }
            "location" -> filtered.sortedBy { it.locationName }
            "count" -> filtered.sortedByDescending { it.count ?: 0 }
            else -> filtered.sortedByDescending { it.observedAt }
        }
    }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Field("Recent days", recentDays, { recentDays = it }, Modifier.width(130.dp))
            Field("Max results", maxResults, { maxResults = it }, Modifier.width(140.dp))
            Button(
                onClick = {
                    scope.launch {
                        onStatus("Fetching eBird observations...")
                        val result = withContext(Dispatchers.IO) {
                            FlySightApiClient(apiBaseUrl, authToken).fetchRecentEbirdObservations(
                                days = recentDays.toIntOrNull() ?: 30,
                                maxResults = maxResults.toIntOrNull() ?: 500
                            )
                        }
                        result.fold(
                            onSuccess = {
                                observations = it
                                onStatus("Fetched ${it.size} eBird observations")
                            },
                            onFailure = { onStatus("eBird fetch failed: ${it.message}") }
                        )
                    }
                }
            ) {
                Text("Fetch eBird")
            }
            Spacer(Modifier.width(8.dp))
            Button(
                enabled = filteredObservations.isNotEmpty(),
                onClick = {
                    scope.launch {
                        onStatus("Importing filtered eBird observations...")
                        val message = withContext(Dispatchers.IO) {
                            FlySightApiClient(apiBaseUrl, authToken).importEbirdObservations(filteredObservations).fold(
                                onSuccess = {
                                    refreshAllTables(repository, apiBaseUrl, authToken)
                                    "Imported eBird observations: $it"
                                },
                                onFailure = { "eBird import failed: ${it.message}" }
                            )
                        }
                        onStatus(message)
                    }
                }
            ) {
                Text("Import filtered")
            }
        }

        Spacer(Modifier.height(10.dp))

        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Field("Species", speciesFilter, { speciesFilter = it }, Modifier.width(230.dp))
            Field("Location", locationFilter, { locationFilter = it }, Modifier.width(230.dp))
            Field("Date YYYY-MM-DD", dateFilter, { dateFilter = it }, Modifier.width(180.dp))
            Field("Source", sourceFilter, { sourceFilter = it }, Modifier.width(120.dp))
            Field("Min count", minCount, { minCount = it }, Modifier.width(130.dp))
        }

        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Status:", fontWeight = FontWeight.Bold)
            Spacer(Modifier.width(8.dp))
            Button(onClick = { statusFilter = "all" }) { Text("All") }
            Spacer(Modifier.width(6.dp))
            Button(onClick = { statusFilter = "valid" }) { Text("Valid") }
            Spacer(Modifier.width(6.dp))
            Button(onClick = { statusFilter = "reviewed" }) { Text("Reviewed") }
            Spacer(Modifier.width(6.dp))
            Button(onClick = { statusFilter = "pending" }) { Text("Pending") }
            Spacer(Modifier.width(18.dp))
            Checkbox(checked = onlyWithCoordinates, onCheckedChange = { onlyWithCoordinates = it })
            Text("With coordinates")
            Spacer(Modifier.width(18.dp))
            Text("Sort:", fontWeight = FontWeight.Bold)
            Spacer(Modifier.width(8.dp))
            Button(onClick = { sortBy = "date" }) { Text("Date") }
            Spacer(Modifier.width(6.dp))
            Button(onClick = { sortBy = "species" }) { Text("Species") }
            Spacer(Modifier.width(6.dp))
            Button(onClick = { sortBy = "location" }) { Text("Location") }
            Spacer(Modifier.width(6.dp))
            Button(onClick = { sortBy = "count" }) { Text("Count") }
        }

        Spacer(Modifier.height(10.dp))
        Text("Showing ${filteredObservations.size} of ${observations.size} eBird observations")
        Spacer(Modifier.height(8.dp))
        EbirdObservationTable(filteredObservations)
    }
}

@Composable
private fun EbirdObservationTable(observations: List<EbirdObservation>) {
    val horizontalScroll = rememberScrollState()

    Box(Modifier.fillMaxSize().background(Color.White).border(1.dp, Color(0xFFE0E0E0))) {
        Column(Modifier.fillMaxSize().horizontalScroll(horizontalScroll).padding(8.dp)) {
            Row(Modifier.fillMaxWidth().background(Color(0xFFEEF2F4)).padding(8.dp)) {
                Text("Species", modifier = Modifier.width(240.dp), fontWeight = FontWeight.Bold)
                Text("Location", modifier = Modifier.width(260.dp), fontWeight = FontWeight.Bold)
                Text("Date", modifier = Modifier.width(150.dp), fontWeight = FontWeight.Bold)
                Text("Count", modifier = Modifier.width(80.dp), fontWeight = FontWeight.Bold)
                Text("Status", modifier = Modifier.width(110.dp), fontWeight = FontWeight.Bold)
                Text("Coordinates", modifier = Modifier.width(190.dp), fontWeight = FontWeight.Bold)
            }

            Divider()

            LazyColumn(Modifier.fillMaxHeight()) {
                items(observations) { observation ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.width(240.dp).padding(end = 8.dp)) {
                            Text(observation.slovenianName.ifBlank { observation.commonName }, fontWeight = FontWeight.Bold)
                            Text(observation.commonName, color = Color(0xFF455A64))
                            Text(observation.scientificName.ifBlank { observation.speciesCode }, color = Color(0xFF607D8B))
                        }
                        Column(Modifier.width(260.dp).padding(end = 8.dp)) {
                            Text(observation.city.ifBlank { observation.locationName }, fontWeight = FontWeight.Bold)
                            Text(observation.locationName, color = Color(0xFF455A64))
                            Text(observation.region, color = Color(0xFF607D8B))
                        }
                        Text(observation.observedAt, modifier = Modifier.width(150.dp).padding(end = 8.dp))
                        Text((observation.count ?: 0).toString(), modifier = Modifier.width(80.dp))
                        Text(ebirdStatus(observation), modifier = Modifier.width(110.dp))
                        Text(
                            "${observation.latitude ?: "?"}, ${observation.longitude ?: "?"}",
                            modifier = Modifier.width(190.dp)
                        )
                    }
                    Divider(color = Color(0xFFF1F1F1))
                }
            }
        }

        HorizontalScrollbar(
            adapter = rememberScrollbarAdapter(horizontalScroll),
            modifier = Modifier.align(Alignment.BottomStart).fillMaxWidth()
        )
    }
}

private fun ebirdStatus(observation: EbirdObservation): String =
    when {
        observation.reviewed -> "Reviewed"
        observation.valid -> "Valid"
        else -> "Pending"
    }

@Composable
private fun GeneratorScreen(
    repository: FlySightRepository,
    apiBaseUrl: String,
    authToken: String,
    onStatus: (String) -> Unit
) {
    var count by remember { mutableStateOf("10") }
    var minLat by remember { mutableStateOf("45.4") }
    var maxLat by remember { mutableStateOf("46.9") }
    var minLon by remember { mutableStateOf("13.4") }
    var maxLon by remember { mutableStateOf("16.6") }
    var minObserved by remember { mutableStateOf("1") }
    var maxObserved by remember { mutableStateOf("12") }
    val scope = rememberCoroutineScope()

    Column(Modifier.fillMaxSize().background(Color.White).padding(16.dp)) {
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
            Field("Count", count, { count = it }, Modifier.width(130.dp))
            Field("Min latitude", minLat, { minLat = it }, Modifier.width(160.dp))
            Field("Max latitude", maxLat, { maxLat = it }, Modifier.width(160.dp))
        }
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
            Field("Min longitude", minLon, { minLon = it }, Modifier.width(160.dp))
            Field("Max longitude", maxLon, { maxLon = it }, Modifier.width(160.dp))
            Field("Min count", minObserved, { minObserved = it }, Modifier.width(140.dp))
            Field("Max count", maxObserved, { maxObserved = it }, Modifier.width(140.dp))
        }

        Spacer(Modifier.height(16.dp))
        Button(
            onClick = {
                val settings = GeneratorSettings(
                    count = count.toIntOrNull()?.coerceAtLeast(0) ?: 0,
                    minLatitude = minLat.toDoubleOrNull() ?: 45.4,
                    maxLatitude = maxLat.toDoubleOrNull() ?: 46.9,
                    minLongitude = minLon.toDoubleOrNull() ?: 13.4,
                    maxLongitude = maxLon.toDoubleOrNull() ?: 16.6,
                    minObserved = minObserved.toIntOrNull() ?: 1,
                    maxObserved = maxObserved.toIntOrNull() ?: 12
                )
                scope.launch {
                    onStatus("Generating observations through API...")
                    val message = withContext(Dispatchers.IO) {
                        FlySightApiClient(apiBaseUrl, authToken).generateObservations(settings).fold(
                            onSuccess = {
                                refreshAllTables(repository, apiBaseUrl, authToken)
                                "Generated observations: $it"
                            },
                            onFailure = { "Generation failed: ${it.message}" }
                        )
                    }
                    onStatus(message)
                }
            }
        ) {
            Text("Generate observations")
        }

        Spacer(Modifier.height(16.dp))
        Text("Generated data is inserted through the web service into PostgreSQL.")
    }
}

@Composable
private fun ServiceScreen(
    repository: FlySightRepository,
    apiBaseUrl: String,
    authToken: String,
    authEmail: String,
    onApiBaseUrlChange: (String) -> Unit,
    onAuthChange: (String, String) -> Unit,
    onStatus: (String) -> Unit
) {
    var response by remember { mutableStateOf("No request sent yet.") }
    var email by remember { mutableStateOf(if (authEmail.isBlank()) "demo@flysight.test" else authEmail) }
    var name by remember { mutableStateOf("Demo User") }
    var password by remember { mutableStateOf("password123") }
    val scope = rememberCoroutineScope()

    Column(Modifier.fillMaxSize().background(Color.White).padding(16.dp)) {
        OutlinedTextField(
            value = apiBaseUrl,
            onValueChange = onApiBaseUrlChange,
            label = { Text("Web service base URL") },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(Modifier.height(12.dp))

        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Field("Email", email, { email = it }, Modifier.width(260.dp))
            Field("Name", name, { name = it }, Modifier.width(220.dp))
            Field("Password", password, { password = it }, Modifier.width(220.dp))
        }

        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Button(
                onClick = {
                    scope.launch {
                        onStatus("Registering user...")
                        response = withContext(Dispatchers.IO) {
                            FlySightApiClient(apiBaseUrl).register(email, name, password).fold(
                                onSuccess = { token ->
                                    onAuthChange(email, token)
                                    "Registered and authenticated as $email"
                                },
                                onFailure = { "Register failed: ${it.message}" }
                            )
                        }
                        onStatus(response)
                    }
                }
            ) {
                Text("Register")
            }

            Spacer(Modifier.width(8.dp))

            Button(
                onClick = {
                    scope.launch {
                        onStatus("Logging in...")
                        response = withContext(Dispatchers.IO) {
                            FlySightApiClient(apiBaseUrl).login(email, password).fold(
                                onSuccess = { token ->
                                    onAuthChange(email, token)
                                    "Logged in as $email"
                                },
                                onFailure = { "Login failed: ${it.message}" }
                            )
                        }
                        onStatus(response)
                    }
                }
            ) {
                Text("Login")
            }

            Spacer(Modifier.width(12.dp))
            Text(if (authToken.isBlank()) "Not authenticated" else "Authenticated: $authEmail")
        }

        Spacer(Modifier.height(12.dp))

        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
            Button(
                onClick = {
                    scope.launch {
                        onStatus("Checking web service...")
                        response = withContext(Dispatchers.IO) {
                            FlySightApiClient(apiBaseUrl).healthCheck().fold(
                                onSuccess = { "Service response: $it" },
                                onFailure = { "Service unavailable: ${it.message}" }
                            )
                        }
                        onStatus("Web service check finished")
                    }
                }
            ) {
                Text("Check service")
            }

            Spacer(Modifier.width(8.dp))

            Button(
                onClick = {
                    scope.launch {
                        onStatus("Pushing table snapshot...")
                        response = withContext(Dispatchers.IO) {
                            refreshAllTables(repository, apiBaseUrl, authToken)
                        }
                        onStatus(response)
                    }
                }
            ) {
                Text("Refresh tables")
            }

            Spacer(Modifier.width(8.dp))

            Button(
                onClick = {
                    scope.launch {
                        onStatus("Pushing scraped data...")
                        val families = repository.loadScrapedFamilies()
                        response = withContext(Dispatchers.IO) {
                            FlySightApiClient(apiBaseUrl, authToken).importDoppsFamilies(families).fold(
                                onSuccess = {
                                    refreshAllTables(repository, apiBaseUrl, authToken)
                                    "Scraped data imported: $it"
                                },
                                onFailure = { "Could not import scraped data: ${it.message}" }
                            )
                        }
                        onStatus("Scraped data sync finished")
                    }
                }
            ) {
                Text("Push scraped")
            }
        }

        Spacer(Modifier.height(16.dp))
        Text(response)
        Spacer(Modifier.height(16.dp))
        Text("Expected service endpoints: GET /health, CRUD /api/{table}, POST /api/import/dopps, POST /api/generate/observations.")
    }
}

private suspend fun refreshAllTables(repository: FlySightRepository, apiBaseUrl: String, authToken: String): String {
    val api = FlySightApiClient(apiBaseUrl, authToken)
    val tableRows = withContext(Dispatchers.IO) {
        repository.tables.associate { table ->
            val rows = api.fetchRows(table.schema.name).getOrElse {
                return@withContext Result.failure<Map<String, List<Map<String, String>>>>(it)
            }
            table.schema.name to rows
        }
            .let { Result.success(it) }
    }.getOrElse { return "Refresh failed: ${it.message}" }

    withContext(Dispatchers.Main) {
        tableRows.forEach { (tableName, rows) ->
            repository.replaceRows(tableName, rows)
        }
    }
    return "Loaded database tables from API"
}

@Composable
private fun Field(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        modifier = modifier.padding(4.dp)
    )
}
