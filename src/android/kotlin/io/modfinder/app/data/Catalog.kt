package io.modfinder.app.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

data class CommunityRankingEntry(val id: String, val name: String, val koreanName: String?, val kind: String)

class Catalog(private val context: Context) {
    private val data = context.assets.open("catalog.json").bufferedReader().use { JSONObject(it.readText()) }
    val games = data.getJSONArray("games").objects().map { item ->
        val providers = item.getJSONObject("sources")
        Game(item.getString("id"), item.getString("name"), item.getString("koreanName"), item.stringList("aliases").orEmpty(), item.stringList("genres").orEmpty(),
            item.text("image"), data.getJSONObject("logos").optJSONObject(item.getString("id"))?.text("src"), providers.keys().asSequence().associateWith { providers.getJSONObject(it).getString("scope") })
    }
    val genres = data.getJSONArray("genres").objects().map { Choice(it.getString("id"), it.getString("ko"), it.getString("en")) }
    val themes = data.getJSONArray("themes").objects().map { Palette(it.getString("id"), it.getString("ko"), it.getString("en"), it.getString("primary"), it.getString("secondary")) }
    val languages = data.getJSONArray("languages").objects().map { it.getString("id") to it.getString("name") }
    val verifiedLinks = data.getJSONArray("verifiedLinks").objects().map { VerifiedLink(it.stringList("listingKeys").orEmpty(), it.getString("evidenceUrl")) }
    fun hasCommunityRanking(gameId: String) = data.getJSONObject("rankings").has(gameId)
    fun rankings(gameId: String) = data.getJSONObject("rankings").optJSONObject(gameId)?.getJSONArray("entries")?.objects()?.map {
        CommunityRankingEntry(it.getString("id"), it.getString("name"), it.text("koreanName"), it.optString("kind", "mod"))
    }.orEmpty()
    fun rankingName(entry: CommunityRankingEntry, gameId: String, locale: String) = if (locale == "ko") entry.koreanName
        ?: (if (gameId == "minecraft-java") data.getJSONObject("packNames").optString(entry.id, entry.name) else entry.name) else entry.name
    fun game(id: String) = games.find { it.id == id }
    fun theme(id: String) = themes.find { it.id == id } ?: themes.first { it.id == "magenta" }
    fun categories(id: String) = data.getJSONObject("categories").optJSONArray(id)?.objects()?.map { Category(it.getString("id"), it.getString("source"), it.getString("value"), it.getString("ko"), it.getString("en")) }.orEmpty()
    fun locale(preference: String): String {
        if (languages.any { it.first == preference }) return preference
        val language = Locale.getDefault().language
        return if (language == "zh") "zh-CN" else language.takeIf { candidate -> languages.any { it.first == candidate } } ?: "en"
    }
    fun text(locale: String, key: String): String {
        val dictionaries = data.getJSONObject("dictionaries")
        return dictionaries.optJSONObject(locale)?.text(key) ?: dictionaries.getJSONObject("en").text(key) ?: key
    }
    fun photos(spec: SearchSpec): List<String> {
        val scope = games.filter { if (spec.gameId == "all") spec.genre == "all" || spec.genre in it.genres else it.id == spec.gameId }
        return (0 until 6).flatMap { index -> scope.mapNotNull { data.getJSONObject("backgrounds").optJSONObject(it.id)?.optJSONArray("screenshots")?.optJSONObject(index)?.text("src") } }
    }
    fun providerQuery(query: String, game: Game, source: String): String {
        val q = normalized(query)
        val mods = data.getJSONObject("mods")
        val prefix = "$source:${game.providers[source]}:"
        val terms = mods.keys().asSequence().filter { it.startsWith(prefix) }.map { mods.getJSONObject(it) }
            .filter { entry -> (listOfNotNull(entry.text("title")) + entry.stringList("aliases").orEmpty()).any { normalized(it) == q } }
            .map { it.getString("searchTerm") }.toSet()
        if (terms.size > 1) return query
        if (terms.size == 1) return terms.first()
        return data.getJSONObject("gameSearch").optJSONObject(game.id)?.text(q) ?: data.getJSONObject("search").text(q) ?: query
    }
    fun searchPlan(spec: SearchSpec): List<SearchRequest> {
        val scope = games.filter { if (spec.gameId == "all") spec.genre == "all" || spec.genre in it.genres else it.id == spec.gameId }
        val selections = if (spec.categories.isEmpty()) listOf<String?>(null) else spec.categories.toList()
        return selections.flatMap { selected ->
            val category = categories(spec.gameId).find { it.id == selected }
            if (selected != null && category == null) emptyList() else scope.flatMap { game ->
                sources.filter { it in game.providers && (category == null || it == category.source) }.map { source ->
                    SearchRequest(game.id, source, providerQuery(spec.query, game, source), if (spec.gameId == "all") emptyMap() else spec.filters + (category?.let { mapOf("category" to it.id) } ?: emptyMap()), if (source == "thunderstore" && spec.sort == "relevance") "updated" else spec.sort)
                }
            }
        }
    }
    fun correctedQueries(spec: SearchSpec): List<String> {
        val corrections = data.getJSONObject("corrections")
        val scope = game(spec.gameId)?.genres ?: if (spec.genre != "all") listOf(spec.genre) else genres.map { it.id }
        fun correct(value: String): String {
            fun lookup(word: String): String {
                corrections.getJSONObject("common").text(word.lowercase())?.let { return it }
                val matches = scope.mapNotNull { corrections.getJSONObject("genres").optJSONObject(it)?.text(word.lowercase()) }.toSet()
                return matches.singleOrNull() ?: word
            }
            return Regex("[A-Za-z]+").replace(lookup(value)) { lookup(it.value) }
        }
        return listOf(correct(spec.query), correct(koreanKeyboardToEnglish(spec.query))).distinct().filter { normalized(it) != normalized(spec.query) }
    }
    private val summaries = mutableMapOf<String, Map<String, List<JSONArray>>>()
    private fun summaryKey(title: String, summary: String) = title.trim() + "\u0000" + summary.take(1800).replace(Regex("<[^>]*>|\\[/?[a-z][^]]*]", RegexOption.IGNORE_CASE), "").replace(Regex("\\s+"), " ").trim()
    // Called on the IO dispatcher before a search; only the selected games are indexed.
    @Synchronized fun loadSummaries(gameId: String) {
        if (gameId in summaries) return
        val rows = context.assets.open("summaries/$gameId.json").bufferedReader().use { JSONArray(it.readText()) }
        summaries[gameId] = (0 until rows.length()).map { rows.getJSONArray(it) }.groupBy { summaryKey(it.getString(0), it.getString(1)) }
    }
    @Synchronized fun listingText(item: Listing, locale: String): Pair<String, String> {
        if (locale != "ko") return item.title to item.summary
        val reviewed = data.getJSONObject("mods").optJSONObject(item.key)
        val matches = summaries[item.gameId]?.get(summaryKey(item.title, item.summary)).orEmpty()
        val exact = matches.filter { !it.isNull(3) && it.getString(3) == item.key }
        val translated = (exact.ifEmpty { matches.filter { it.isNull(3) } }).map { it.getString(2) }.distinct().singleOrNull()
        return (reviewed?.text("title") ?: item.title) to (reviewed?.text("summary") ?: translated ?: item.summary)
    }
}

fun koreanKeyboardToEnglish(value: String): String {
    val initials = listOf("r", "R", "s", "e", "E", "f", "a", "q", "Q", "t", "T", "d", "w", "W", "c", "z", "x", "v", "g")
    val vowels = listOf("k", "o", "i", "O", "j", "p", "u", "P", "h", "hk", "ho", "hl", "y", "n", "nj", "np", "nl", "b", "m", "ml", "l")
    val finals = listOf("", "r", "R", "rt", "s", "sw", "sg", "e", "f", "fr", "fa", "fq", "ft", "fx", "fv", "fg", "a", "q", "qt", "t", "T", "d", "w", "c", "z", "x", "v", "g")
    val consonants = listOf("r", "R", "rt", "s", "sw", "sg", "e", "E", "f", "fr", "fa", "fq", "ft", "fx", "fv", "fg", "a", "q", "Q", "qt", "t", "T", "d", "w", "W", "c", "z", "x", "v", "g")
    return java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFC).map { char ->
        val code = char.code
        when (code) {
            in 0xac00..0xd7a3 -> { val offset = code - 0xac00; initials[offset / 588] + vowels[offset % 588 / 28] + finals[offset % 28] }
            in 0x3131..0x314e -> consonants[code - 0x3131]
            in 0x314f..0x3163 -> vowels[code - 0x314f]
            in 0x1100..0x1112 -> initials[code - 0x1100]
            in 0x1161..0x1175 -> vowels[code - 0x1161]
            in 0x11a8..0x11c2 -> finals[code - 0x11a7]
            else -> char.toString()
        }
    }.joinToString("")
}
