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
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class ModApi {
    private val client = OkHttpClient.Builder().cache(null).callTimeout(18, TimeUnit.SECONDS).connectTimeout(8, TimeUnit.SECONDS).build()
    private suspend fun get(path: String, params: Map<String, String>, locale: String): JSONObject {
        val url = BuildConfig.API_BASE.toHttpUrl().newBuilder().addPathSegments(path)
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
                            val bytes = body.byteStream().readNBytes(4 * 1024 * 1024 + 1)
                            if (bytes.size > 4 * 1024 * 1024) throw IOException("Response too large")
                            JSONObject(bytes.toString(Charsets.UTF_8))
                        }
                    }
                    if (continuation.isActive) result.fold(continuation::resume, continuation::resumeWithException)
                }
            })
        }
    }
    suspend fun search(request: SearchRequest, locale: String): SearchResult {
        val params = mapOf("gameId" to request.gameId, "source" to request.source, "query" to request.query, "sort" to request.sort) + request.filters + (request.cursor?.let { mapOf("cursor" to it) } ?: emptyMap())
        return parseSearchResult(get("v1/search", params, locale), request)
    }
    suspend fun versions(locale: String) = get("v1/minecraft/versions", emptyMap(), locale).stringList("versions").orEmpty()
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
