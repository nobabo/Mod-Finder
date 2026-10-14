package io.modfinder.app.data

import io.modfinder.app.BuildConfig
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONObject
import org.json.JSONArray
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

interface ModRepository {
    suspend fun plan(spec: SearchSpec, locale: String): SearchPlan? = null
    suspend fun search(request: SearchRequest, locale: String): SearchResult
    suspend fun versions(locale: String): List<String>
    suspend fun details(item: Listing, locale: String): Listing = item
}

class ModApi : ModRepository {
    private val client = OkHttpClient.Builder().cache(null).callTimeout(18, TimeUnit.SECONDS).connectTimeout(8, TimeUnit.SECONDS).build()
    private suspend fun get(path: String, params: Map<String, String>, locale: String, segments: List<String> = emptyList()): JSONObject {
        val url = BuildConfig.API_BASE.toHttpUrl().newBuilder().addPathSegments(path)
        segments.forEach(url::addPathSegment)
        params.forEach { (key, value) -> url.addQueryParameter(key, value) }
        val call = client.newCall(Request.Builder().url(url.build()).header("Accept-Language", locale).header("Cache-Control", "no-store").build())
        return suspendCancellableCoroutine { continuation ->
            continuation.invokeOnCancellation { call.cancel() }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) { if (continuation.isActive) continuation.resumeWithException(e) }
                override fun onResponse(call: Call, response: Response) {
                    val result = runCatching {
                        response.use {
                            if (!it.isSuccessful) throw IOException("HTTP ${it.code}")
                            val body = it.body ?: throw IOException("Empty response")
                            if (body.contentLength() > 4 * 1024 * 1024) throw IOException("Response too large")
                            val buffer = okio.Buffer()
                            val source = body.source()
                            while (!source.exhausted()) {
                                source.read(buffer, 8192)
                                if (buffer.size > 4 * 1024 * 1024) throw IOException("Response too large")
                            }
                            JSONObject(buffer.readUtf8())
                        }
                    }
                    if (continuation.isActive) result.fold(continuation::resume, continuation::resumeWithException)
                }
            })
        }
    }
    override suspend fun plan(spec: SearchSpec, locale: String): SearchPlan {
        val params = mapOf("gameId" to spec.gameId, "genre" to spec.genre, "query" to spec.query, "sort" to spec.sort, "categories" to JSONArray(spec.categories.toList()).toString()) + spec.filters
        return parseSearchPlan(get("v1/search-plan", params, locale))
    }
    override suspend fun search(request: SearchRequest, locale: String): SearchResult {
        val params = mapOf("gameId" to request.gameId, "source" to request.source, "query" to request.query, "sort" to request.sort) + request.filters + (request.cursor?.let { mapOf("cursor" to it) } ?: emptyMap())
        return parseSearchResult(get("v1/search", params, locale), request)
    }
    override suspend fun versions(locale: String) = get("v1/minecraft/versions", emptyMap(), locale).stringList("versions").orEmpty()
    override suspend fun details(item: Listing, locale: String): Listing {
        val fresh = Listing.parse(get("v1/listings", emptyMap(), locale, listOf(item.source, item.scope, item.id)).getJSONObject("listing"))
        require(fresh.key == item.key && fresh.gameId == item.gameId)
        return fresh
    }
}

fun parseSearchPlan(json: JSONObject): SearchPlan {
    fun requests(rows: JSONArray): List<SearchRequest> {
        require(rows.length() <= 512)
        return (0 until rows.length()).map { index ->
            val row = rows.getJSONObject(index)
            val filters = row.getJSONObject("filters")
            val request = SearchRequest(row.getString("gameId"), row.getString("source"), row.getString("query"),
                filters.keys().asSequence().associateWith { filters.getString(it) }, row.getString("sort"))
            require(request.source in sources && request.gameId.length <= 80 && request.query.length <= 200)
            require(request.sort in listOf("relevance", "downloads", "updated", "popular"))
            require(request.filters.all { (key, value) -> key in listOf("version", "loader", "kind", "category") && value.length <= 160 })
            request
        }
    }
    val corrections = json.getJSONArray("corrections")
    require(corrections.length() <= 2)
    return SearchPlan(requests(json.getJSONArray("original")), (0 until corrections.length()).map { requests(corrections.getJSONArray(it)) }, requests(json.getJSONArray("fuzzy")))
}

fun parseSearchResult(json: JSONObject, request: SearchRequest): SearchResult {
    require(json.getString("source") == request.source)
    val status = json.getString("status")
    val items = if (status == "success") json.optJSONArray("items")?.objects()?.mapNotNull { runCatching { Listing.parse(it) }.getOrNull() }
        ?.filter { it.gameId == request.gameId && it.source == request.source }
        ?.map { it.copy(categories = request.filters["category"]?.let(::setOf).orEmpty()) }.orEmpty() else emptyList()
    return SearchResult(status, items, if (status == "success") json.text("nextCursor") else null, json.text("externalUrl")?.let(::safeExternalUrl), json.text("message").orEmpty(), json.stringList("unsupportedFilters").orEmpty(),
        json.optJSONArray("verifiedLinks")?.objects()?.map { VerifiedLink(it.stringList("listingKeys").orEmpty(), it.text("evidenceUrl").orEmpty()) }.orEmpty())
}
