package projektni.praktikum.flysight

import com.fleeksoft.ksoup.Ksoup
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.Serializable
import okhttp3.OkHttpClient
import okhttp3.Request
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

fun printAllData(families: List<BirdFamily>) {
    println("\n" + "=".repeat(80))
    println("IZPIS VSEH PODATKOV")
    println("=".repeat(80))
    families.forEach { family ->
        println("\nDRUŽINA: ${family.name} (${family.latinName}) [slug: ${family.slug}]")
        println("   Število ptic: ${family.birds.size}")
        family.birds.forEachIndexed { idx, bird ->
            println("   ${idx + 1}. ${bird.name} (${bird.latinName})")
            val shortDesc = if (bird.description.length > 100) bird.description.take(100) + "…" else bird.description
            println("      Opis: $shortDesc")
            if (bird.imageUrl != null) {
                println("      Slika: ${bird.imageUrl}")
            }
        }
    }
    println("\n" + "=".repeat(80))
    println("SKUPAJ DRUŽIN: ${families.size}, SKUPAJ PTIC: ${families.sumOf { it.birds.size }}")
    println("=".repeat(80))
}

fun main() = runBlocking {
    System.setOut(java.io.PrintStream(System.out, true, "UTF-8"))
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

    println("Skupaj pobranih ptic: ${families.sumOf { it.birds.size }}")

    printAllData(families)
}

