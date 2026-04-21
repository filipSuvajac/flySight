package projektni.praktikum.flysight.databaseGUI

import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application

fun main() = application {
    Window(
        onCloseRequest = ::exitApplication,
        title = "Database Manager",
    ) {
        App()
    }
}