package projektni.praktikum.flysight.databaseGUI


import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.AlertDialog
import androidx.compose.material.Button
import androidx.compose.material.Divider
import androidx.compose.material.DropdownMenu
import androidx.compose.material.DropdownMenuItem
import androidx.compose.material.Icon
import androidx.compose.material.IconButton
import androidx.compose.material.OutlinedTextField
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import flysight.composeapp.generated.resources.Res
import flysight.composeapp.generated.resources.add
import flysight.composeapp.generated.resources.delete
import flysight.composeapp.generated.resources.edit
import org.jetbrains.compose.resources.painterResource

data class TableData(
    val name: String,
    val columns: List<String>,
    val rows: MutableList<MutableMap<String, Any>>
)


@Composable
fun App() {
    val tables = remember {
        mutableStateListOf(
            TableData(
                name = "bird_info",
                columns = listOf("id", "name", "latin_name"),
                rows = mutableStateListOf(
                    mutableMapOf("id" to 1, "name" to "Brglez", "latin_name" to "Sitta europaea"),
                    mutableMapOf("id" to 2, "name" to "Kos", "latin_name" to "Turdus merula")
                )
            ),
            TableData(
                name = "location",
                columns = listOf("id", "name", "latitude", "longitude"),
                rows = mutableStateListOf(
                    mutableMapOf("id" to 1, "name" to "Maribor", "latitude" to 46.55, "longitude" to 15.65),
                    mutableMapOf("id" to 2, "name" to "Ljubljana", "latitude" to 46.05, "longitude" to 14.51)
                )
            )
        )
    }

    var selectedTable by remember { mutableStateOf(tables.first()) }
    var expanded by remember { mutableStateOf(false) }

    var showDialog by remember { mutableStateOf(false) }
    var editingRow by remember { mutableStateOf<MutableMap<String, Any>?>(null) }

    var showDeleteDialog by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<Map<String, Any>?>(null) }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp)
    ){
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ){
            Box{
                Button(onClick = { expanded = true}){
                    Text(selectedTable.name)
                }

                DropdownMenu(
                    expanded = expanded, onDismissRequest = { expanded = false }
                ){
                    tables.forEach {
                        DropdownMenuItem(onClick = {
                            selectedTable = it
                            expanded = false
                        }){
                            Text(it.name)
                        }
                    }
                }
            }

            IconButton(onClick = {
                editingRow = null
                showDialog = true
            }) {
                Icon(
                    painter = painterResource(Res.drawable.add),
                    contentDescription = "Add",
                    modifier = Modifier.size(28.dp),
                    tint = Color(0xFF363434)
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        DynamicTable(
            table = selectedTable,
            onEdit = {
                editingRow = it
                showDialog = true
            },
            onDelete = { row ->
                deleteTarget = row
                showDeleteDialog = true
            }
        )
    }

    if (showDialog) {
        DynamicFormDialog(
            table = selectedTable,
            rowData = editingRow,
            onDismiss = { showDialog = false },
            onSave = { newData ->

                if (editingRow == null) {

                    val newId = (selectedTable.rows.maxOfOrNull { it["id"] as Int } ?: 0) + 1

                    val newRow = mutableMapOf<String, Any>()

                    newRow["id"] = newId

                    newData.forEach { (k, v) ->
                        if (k != "id") {
                            newRow[k] = v
                        }
                    }

                    selectedTable.rows.add(newRow)
                } else {
                    val index = selectedTable.rows.indexOf(editingRow)

                    if (index != -1) {
                        val updatedRow = editingRow!!.toMutableMap()

                        newData.forEach { (k, v) ->
                            updatedRow[k] = v
                        }

                        selectedTable.rows[index] = updatedRow
                    }
                }

                showDialog = false
            }
        )
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = {
                Text("Confirm delete")
            },
            text = {
                Text("Are you sure you want to delete this row?")
            },
            confirmButton = {
                Button(onClick = {
                    deleteTarget?.let { row ->
                        selectedTable.rows.remove(row)
                    }
                    showDeleteDialog = false
                    deleteTarget = null
                }) {
                    Text("Delete")
                }
            },
            dismissButton = {
                Button(onClick = {
                    showDeleteDialog = false
                    deleteTarget = null
                }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
fun DynamicTable(
    table: TableData,
    onEdit: (MutableMap<String, Any>) -> Unit,
    onDelete: (Map<String, Any>) -> Unit
    ){
    Column(
        modifier = Modifier.fillMaxSize()
    ){
        Row(
            modifier = Modifier.fillMaxWidth().padding(8.dp)
        ){
            table.columns.forEach {
                Text(it, modifier = Modifier.weight(1f))
            }
            Text("Actions", modifier = Modifier.width(150.dp))
        }

        Divider()

        LazyColumn {
            items(table.rows){
                row ->
                DynamicRow(row, table.columns, onEdit, onDelete)
            }
        }
    }
}

@Composable
fun DynamicRow(
    row: MutableMap<String, Any>,
    columns: List<String>,
    onEdit: (MutableMap<String, Any>) -> Unit,
    onDelete: (Map<String, Any>) -> Unit
    ){
    Row(
        Modifier.fillMaxWidth().padding(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ){
        columns.forEach {
            Text(row[it]?.toString()?:"", modifier = Modifier.weight(1f))
        }

        Row(
            modifier = Modifier.width(150.dp)
        ){
            IconButton(onClick = { onEdit(row) }){
                Icon(
                    painter = painterResource(Res.drawable.edit),
                    contentDescription = "Edit",
                    modifier = Modifier.size(28.dp),
                    tint = Color(0xFF4B2E83)
                )
            }

            Spacer(Modifier.width(8.dp))

            IconButton(onClick = { onDelete(row) }){
                Icon(
                    painter = painterResource(Res.drawable.delete),
                    contentDescription = "Delete",
                    modifier = Modifier.size(28.dp),
                    tint = Color(0xFF4B2E83)
                )
            }
        }

    }
}

@Composable
fun DynamicFormDialog(
    table: TableData,
    rowData: Map<String, Any>?,
    onDismiss: () -> Unit,
    onSave: (Map<String, Any>) -> Unit
){
    val inputs = remember {
        mutableStateMapOf<String, String>()
    }

    LaunchedEffect(rowData){
        inputs.clear()
        table.columns.forEach {
            column ->
            inputs[column] = rowData?.get(column)?.toString()?:""
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(if (rowData == null) "Add Row" else "Edit Row")
        },
        text = {
            Column{
                table.columns.forEach {
                    column ->
                    if (column == "id") return@forEach

                    OutlinedTextField(
                        value = inputs[column]?:"",
                        onValueChange = { inputs[column] = it },
                        label = { Text(column) },
                        modifier = Modifier.fillMaxWidth().padding(4.dp),
                    )
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                onSave(inputs)
            }){
                Text("Save")
            }
        },
        dismissButton = {
            Button(onClick = onDismiss){
                Text("Cancel")
            }
        }
    )
}
