package io.modfinder.app.data

import org.json.JSONArray
import org.json.JSONObject
import java.net.URI
import java.text.Normalizer

val sources = listOf("modrinth", "curseforge", "thunderstore", "nexus", "steam")
val sourceNames = mapOf("modrinth" to "Modrinth", "curseforge" to "CurseForge", "thunderstore" to "Thunderstore", "nexus" to "Nexus Mods", "steam" to "Steam Workshop")
private val externalHosts = setOf("modrinth.com", "www.modrinth.com", "curseforge.com", "www.curseforge.com", "thunderstore.io", "nexusmods.com", "www.nexusmods.com", "next.nexusmods.com", "steamcommunity.com")
fun safeExternalUrl(value: String): String? = runCatching {
    URI(value).takeIf { it.scheme == "https" && it.host?.lowercase() in externalHosts && it.userInfo == null && it.port in setOf(-1, 443) }?.toASCIIString()
}.getOrNull()
fun normalized(value: String) = Normalizer.normalize(value, Normalizer.Form.NFKC).lowercase().replace(Regex("\\s+"), " ").trim()
fun JSONObject.text(key: String): String? = if (isNull(key)) null else opt(key) as? String
fun JSONArray.objects(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }
fun JSONArray.strings(): List<String> = (0 until length()).mapNotNull { opt(it) as? String }
fun JSONObject.stringList(key: String): List<String>? = optJSONArray(key)?.strings()

data class Game(val id: String, val name: String, val koreanName: String, val aliases: List<String>, val genres: List<String>, val image: String?, val logo: String?, val providers: Map<String, String>) {
    fun label(locale: String) = if (locale == "ko") koreanName else name
}
data class Choice(val id: String, val ko: String, val en: String) { fun label(locale: String) = if (locale == "ko") ko else en }
data class Category(val id: String, val source: String, val value: String, val ko: String, val en: String) { fun label(locale: String) = if (locale == "ko") ko else en }
data class Palette(val id: String, val ko: String, val en: String, val primary: String, val secondary: String)
data class Metric(val label: String, val value: Double)
fun rankingSources(game: Game): List<String> = if ("steam" in game.providers) listOf("steam") else sources.filter { it in game.providers }
fun isRankingListing(item: Listing, game: Game, source: String): Boolean = item.gameId == game.id && item.source == source && item.scope == game.providers[source] &&
    item.key == "$source:${item.scope}:${item.id}" && (game.id != "minecraft-java" || item.kind == "modpack") && (item.downloads?.let { it.isFinite() && it >= 0 } == true)
data class Listing(
    val key: String, val source: String, val scope: String, val id: String, val gameId: String,
    val title: String, val author: String?, val summary: String, val url: String, val iconUrl: String?,
    val versions: List<String>?, val loaders: List<String>?, val updatedAt: String?, val fetchedAt: String,
    val kind: String?, val metrics: List<Metric>, val tags: List<String>, val rank: Int, val raw: String,
    val categories: Set<String> = emptySet(),
) {
    val referenceOnly: Boolean get() = JSONObject(raw).optBoolean("referenceOnly", false)
    val downloads: Double? get() = metrics.find { it.label == if (source == "steam") "누적 구독자" else "다운로드" }?.value
    fun canPersist(thunderstoreOptIn: Boolean) = source != "curseforge" && (source != "thunderstore" || thunderstoreOptIn)
    companion object {
        fun parse(json: JSONObject): Listing {
            val source = json.getString("source")
            val scope = json.get("scope") as? String ?: error("Invalid scope")
            val id = json.get("id") as? String ?: error("Invalid ID")
            require(source in sources && id.isNotEmpty() && scope.isNotEmpty())
            val key = json.getString("key")
            require(key == "$source:$scope:$id")
            if (json.optBoolean("referenceOnly", false)) {
                val url = when (source) {
                    "curseforge" -> { require(id.matches(Regex("[0-9]+"))); "https://www.curseforge.com/projects/$id" }
                    "thunderstore" -> { require(scope.matches(Regex("[a-z0-9-]+"))); "https://thunderstore.io/c/$scope/" }
                    else -> error("Unsupported bookmark reference")
                }
                return Listing(key, source, scope, id, json.getString("gameId"), "$id · ${sourceNames[source]}", null, "", url, null, null, null, null, "", null, emptyList(), emptyList(), 0, json.toString())
            }
            val url = safeExternalUrl(json.getString("url")) ?: error("Invalid source URL")
            val icon = json.text("iconUrl")?.takeIf { runCatching { URI(it).scheme == "https" && URI(it).userInfo == null }.getOrDefault(false) }
            return Listing(key, source, scope, id, json.getString("gameId"), json.getString("title"), json.text("author"),
                json.getString("summary"), url, icon, json.stringList("versions"), json.stringList("loaders"),
                json.text("updatedAt"), json.getString("fetchedAt"), json.text("kind"),
                json.optJSONArray("metrics")?.objects()?.mapNotNull { metric ->
                    (metric.opt("value") as? Number)?.toDouble()?.takeIf(Double::isFinite)?.let { Metric(metric.getString("label"), it) }
                }.orEmpty(), json.stringList("tags").orEmpty(), json.optInt("rank", 0), json.toString())
        }
    }
}
fun bookmarkJson(item: Listing, thunderstoreOptIn: Boolean): JSONObject = if (item.canPersist(thunderstoreOptIn)) JSONObject(item.raw) else JSONObject()
    .put("key", item.key).put("source", item.source).put("scope", item.scope).put("id", item.id).put("gameId", item.gameId).put("referenceOnly", true)
data class SearchSpec(val gameId: String = "minecraft-java", val genre: String = "all", val query: String = "", val filters: Map<String, String> = emptyMap(), val categories: Set<String> = emptySet(), val sort: String = "downloads")
data class SearchRequest(val gameId: String, val source: String, val query: String, val filters: Map<String, String>, val sort: String, val cursor: String? = null) {
    val bucket get() = "$gameId:$source:${filters["category"].orEmpty()}"
}
data class SearchResult(val status: String, val items: List<Listing>, val nextCursor: String?, val externalUrl: String?, val message: String, val unsupportedFilters: List<String> = emptyList(), val verifiedLinks: List<VerifiedLink> = emptyList())
data class VerifiedLink(val keys: List<String>, val evidence: String)
data class ResultGroup(val id: String, val listings: List<Listing>) { val item get() = listings.first() }
data class Folder(val id: String, val name: String, val keys: List<String>)
data class HistoryEntry(val gameId: String, val query: String, val genre: String = "all", val categories: Set<String> = emptySet())
data class LocalState(val favorites: List<Listing> = emptyList(), val folders: List<Folder> = emptyList(), val compared: List<Listing> = emptyList(), val favoriteGames: List<String> = listOf("minecraft-java"), val history: List<HistoryEntry> = emptyList(), val theme: String = "magenta", val language: String = "auto")

fun mergeListings(current: List<Listing>, incoming: List<Listing>): List<Listing> {
    val map = LinkedHashMap<String, Listing>()
    (current + incoming).forEach { item -> map[item.key] = map[item.key]?.let { old -> old.copy(categories = old.categories + item.categories) } ?: item }
    return map.values.toList()
}

fun groupListings(items: List<Listing>, links: List<VerifiedLink>, spec: SearchSpec): List<ResultGroup> {
    val parents = mutableMapOf<String, String>()
    fun root(key: String): String { val parent = parents[key] ?: return key; return root(parent).also { parents[key] = it } }
    links.filter { it.evidence.startsWith("https://") && it.keys.isNotEmpty() }.forEach { link ->
        link.keys.drop(1).forEach { val a = root(link.keys[0]); val b = root(it); if (a != b) parents[b] = a }
    }
    val query = normalized(spec.query)
    fun match(item: Listing): Int {
        if (query.isEmpty()) return 3
        val title = normalized(item.title).contains(query)
        val summary = normalized(item.summary).contains(query)
        return if (title && summary) 0 else if (title) 1 else if (summary) 2 else 3
    }
    val groups = items.distinctBy { it.key }.groupBy { "${it.gameId}:${root(it.key)}" }.map { (key, values) ->
        ResultGroup(key, values.sortedWith(compareByDescending<Listing> { it.downloads ?: -1.0 }.thenBy { it.key }))
    }
    return groups.sortedWith { a, b ->
        val category = b.listings.maxOf { it.categories.intersect(spec.categories).size }.compareTo(a.listings.maxOf { it.categories.intersect(spec.categories).size })
        if (category != 0) category else when (spec.sort) {
            "downloads" -> (b.item.downloads ?: -1.0).compareTo(a.item.downloads ?: -1.0)
            "updated" -> b.item.updatedAt.orEmpty().compareTo(a.item.updatedAt.orEmpty())
            "popular" -> a.item.rank.compareTo(b.item.rank)
            else -> a.listings.minOf(::match).compareTo(b.listings.minOf(::match))
        }.takeIf { it != 0 } ?: a.id.compareTo(b.id)
    }
}
