package projektni.praktikum.flysight.Dopps

import com.fleeksoft.ksoup.Ksoup
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.PrintStream
import java.util.concurrent.TimeUnit

val client = OkHttpClient.Builder()
    .connectTimeout(10, TimeUnit.SECONDS)
    .readTimeout(10, TimeUnit.SECONDS)
    .followRedirects(true)
    .build()

@Serializable
data class Bird(
    val name: String,
    val latinName: String,
    val description: String,
    val imageUrl: String?,
    val familyName: String,
    val familyLatinName: String,
    val familySlug: String
)

@Serializable
data class BirdFamily(
    val slug: String,
    val name: String,
    val latinName: String,
    val birds: List<Bird>
)
suspend fun scrapeFamily(slug: String): BirdFamily? {
    val url = "https://ptice.si/ptice-in-ljudje/ptice-slovenije/$slug/"
    val request = Request.Builder()
        .url(url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()

    val response = client.newCall(request).execute()
    if (!response.isSuccessful) {
        System.err.println("HTTP $slug: ${response.code}")
        response.close()
        return null
    }
    val html = response.body?.string() ?: return null
    response.close()

    val doc = Ksoup.parse(html, url)

    val entries = doc.select("div.entry-content")
    if (entries.isEmpty()) {
        System.err.println("  [!] No div.entry-content found for $slug")
        return null
    }
    val entry = entries.last()
    val h1 = entry?.selectFirst("h1") ?: run {
        System.err.println("  [!] h1 not found inside entry-content for $slug")
        return null
    }

    val h1Html = h1.html()
    val strong = h1.selectFirst("strong")
    val familyName: String
    val familyLatinName: String

    if (strong != null) {
        familyName = strong.text().trim()
        familyLatinName = h1.text().removePrefix(familyName).trim()
    } else {
        val latinElem = h1.selectFirst("em, i")
        if (latinElem != null) {
            val latinHtml = latinElem.outerHtml()
            val index = h1Html.indexOf(latinHtml)
            familyName = if (index > 0) {
                Ksoup.parse(h1Html.substring(0, index)).text().trim()
            } else {
                h1.ownText().trim()
            }
            familyLatinName = latinElem.text().trim()
        } else {
            familyName = h1.text().trim()
            familyLatinName = ""
            System.err.println("  [!] Warning: no <strong> or <em>/<i> in h1 for $slug, using full text: '$familyName'")
        }
        println("  Debug h1 HTML for $slug: $h1Html")
    }

    val birds = mutableListOf<Bird>()
    val asides = doc.select("div.two-column aside").filter { it.selectFirst("h2") != null }

    for (aside in asides) {
        val h2 = aside.selectFirst("h2") ?: continue
        val birdName = h2.ownText().trim()
        val latinName = h2.selectFirst("em")?.text()?.trim()
            ?.removeSurrounding("(", ")")
            ?: h2.selectFirst("i")?.text()?.trim()?.removeSurrounding("(", ")")
            ?: ""
        val description = aside.select("p").joinToString("\n\n") { p ->
            p.select("span, strong, em").joinToString("") { it.text() }
                .ifBlank { p.text() }
        }

        val anchor = aside.selectFirst("figure div a")
            ?: aside.selectFirst("figure a")
        val imageUrl = anchor?.attr("data-src")?.takeIf { it.isNotBlank() }
            ?: anchor?.attr("href")?.takeIf { it.isNotBlank() }

        if (birdName.isNotBlank()) {
            birds.add(
                Bird(
                    name = birdName,
                    latinName = latinName,
                    description = description,
                    imageUrl = imageUrl,
                    familyName = familyName,
                    familyLatinName = familyLatinName,
                    familySlug = slug
                )
            )
        }
    }

    println("  Najdeno ${birds.size} ptic v družini '$familyName'")
    return BirdFamily(slug, familyName, familyLatinName, birds)
}



fun saveBirdsToJson(families: List<BirdFamily>, outputFile: File) {
    val json = Json { prettyPrint = true }
    outputFile.writeText(json.encodeToString(families), Charsets.UTF_8)
    println("\nJSON shranjen v: ${outputFile.absolutePath}")
}

fun main() = runBlocking {
    System.setOut(PrintStream(System.out, true, "UTF-8"))
    val familySlugs = listOf(
        "brglezi",
        "brkate-sinice",
        "caplje-in-bobnarice",
        "cigre",
        "cipe",
        "detli",
        "dolgorepke",
        "drozgi",
        "galebi",
        "golobi",
        "gosi",
        "hudourniki",
        "ibisi",
        "kobilarji",
        "koconoge-kure",
        "kormorani",
        "kozarke",
        "kraljicki",
        "kukavice",
        "labodi",
        "lastovke",
        "muharji",
        "orli-in-drugi",
        "pastirice",
        "pegami",
        "penice",
        "pevke",
        "plamenci",
        "plasice",
        "plezalcki",
        "pobrezniki",
        "podhujke",
        "poljske-kure",
        "ponirki",
        "povodni-kosi",
        "race-plovke",
        "race-potapljavke-in-druge",
        "scinkavci",
        "sinice-in-druge",
        "skalni-plezalcki",
        "skorci",
        "skrjanci",
        "slapniki",
        "sokoli",
        "sove",
        "srakoperji",
        "storklje",
        "strnadi",
        "strzki",
        "tukalice",
        "vijeglavke",
        "vodomci",
        "vpijati",
        "vrabci",
        "vrane",
        "zerjavi",
        "zlicarke",
        "zolne"
    )

    val families = familySlugs.mapNotNull { slug ->
        scrapeFamily(slug).also { delay(500) }
    }

    saveBirdsToJson(families, File("ptice_slovenije.json"))

    println("Skupaj pobranih ptic: ${families.sumOf { it.birds.size }}")
}

