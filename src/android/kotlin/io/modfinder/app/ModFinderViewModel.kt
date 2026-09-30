package io.modfinder.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.viewModelScope
import io.modfinder.app.data.*
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import java.util.UUID

data class Bucket(val request: SearchRequest, val loading: Boolean = true, val result: SearchResult? = null)
data class AppState(
    val catalog: Catalog? = null, val local: LocalState = LocalState(), val hydrated: Boolean = false,
    val spec: SearchSpec = SearchSpec(), val input: String = "", val submitted: Boolean = false,
    val page: String = "discover", val overlay: String? = null, val detail: Listing? = null,
    val items: List<Listing> = emptyList(), val groups: List<ResultGroup> = emptyList(),
    val buckets: Map<String, Bucket> = emptyMap(), val loading: Boolean = false,
    val versions: List<String> = emptyList(), val versionsLoading: Boolean = false,
    val selectedFolder: String = "all", val notice: String? = null,
    val rankingTab: String = "search",
) { val hasMore get() = buckets.values.any { it.result?.nextCursor != null }; val locale get() = catalog?.locale(local.language) ?: "ko" }

class ModFinderViewModel @JvmOverloads constructor(application: Application, private val saved: SavedStateHandle, private val api: ModRepository = ModApi()) : AndroidViewModel(application) {
    private val mutable = MutableStateFlow(AppState(input = saved["input"] ?: "", spec = SearchSpec(gameId = saved["game"] ?: "minecraft-java")))
    val state = mutable.asStateFlow()
    private lateinit var store: LocalStore
    private val writes = Channel<LocalState>(Channel.CONFLATED)
    private var searchJob: Job? = null
    private var generation = 0
    private var links = emptyList<VerifiedLink>()
    private val cursors = mutableMapOf<String, MutableSet<String>>()
    init {
        viewModelScope.launch {
            val catalog = withContext(Dispatchers.IO) { Catalog(application) }
            store = LocalStore(application, catalog.games.map { it.id }.toSet())
            val loaded = withContext(Dispatchers.IO) { runCatching { store.load() } }
            mutable.update { it.copy(catalog = catalog, local = loaded.getOrDefault(LocalState()), hydrated = loaded.isSuccess, rankingTab = if (catalog.hasCommunityRanking(it.spec.gameId)) "search" else "downloads", notice = if (loaded.isFailure) "저장된 정보를 읽지 못했어요. 저장 공간을 확인해 주세요." else null) }
            withContext(Dispatchers.IO) { state.value.local.favorites.map { it.gameId }.distinct().forEach { catalog.loadSummaries(it) } }
            val permits = Semaphore(4)
            state.value.local.favorites.filter { it.referenceOnly }.forEach { bookmark -> launch {
                permits.withPermit {
                    try {
                        val fresh = api.details(bookmark, state.value.locale)
                        mutable.update { current -> current.copy(local = current.local.copy(favorites = current.local.favorites.map { if (it.key == bookmark.key) fresh else it })) }
                    } catch (cancelled: CancellationException) { throw cancelled } catch (_: Exception) { /* Keep the user's reference available offline. */ }
                }
            } }
            if (!state.value.submitted) loadRanking()
        }
        viewModelScope.launch(Dispatchers.IO) {
            for (snapshot in writes) try { store.save(snapshot) } catch (_: Exception) { mutable.update { it.copy(notice = "변경사항을 저장하지 못했어요. 저장 공간을 확인해 주세요.") } }
        }
    }
    fun text(key: String) = state.value.catalog?.text(state.value.locale, key) ?: key
    fun input(value: String) { val clipped = value.take(200); saved["input"] = clipped; mutable.update { it.copy(input = clipped) } }
    fun notice(message: String?) { mutable.update { it.copy(notice = message) } }
    fun overlay(value: String?) { mutable.update { it.copy(overlay = value) }; if (value == "filters" && state.value.spec.gameId == "minecraft-java" && state.value.versions.isEmpty()) loadVersions() }
    fun detail(value: Listing?) { mutable.update { it.copy(detail = value) } }
    fun back(): Boolean {
        val current = state.value
        when {
            current.detail != null -> detail(null)
            current.overlay in listOf("theme", "language") -> overlay("settings")
            current.overlay != null -> overlay(null)
            current.page != "discover" -> page("discover")
            current.submitted -> page("discover")
            else -> return false
        }
        return true
    }
    fun page(value: String) {
        if (value == "discover") {
            input("")
            mutable.update { it.copy(page = value, overlay = null, submitted = false, spec = it.spec.copy(query = "", filters = emptyMap(), categories = emptySet())) }
            loadRanking()
        } else mutable.update { it.copy(page = value, overlay = null) }
    }
    fun chooseGame(id: String) {
        if (id != "all" && state.value.catalog?.game(id) == null) return
        saved["game"] = id
        mutable.update { it.copy(spec = it.spec.copy(gameId = id, genre = "all", filters = emptyMap(), categories = emptySet()), page = "discover", overlay = null, rankingTab = if (it.catalog?.hasCommunityRanking(id) == true) "search" else "downloads") }
        if (state.value.submitted) runSearch() else loadRanking()
    }
    fun submit(value: String = state.value.input, gameId: String = state.value.spec.gameId, genre: String = state.value.spec.genre, categories: Set<String> = state.value.spec.categories, kind: String? = null) {
        val query = value.trim().take(200)
        input(query); saved["game"] = gameId
        mutable.update { it.copy(spec = it.spec.copy(gameId = gameId, genre = genre, query = query, categories = categories, filters = if (kind != null) mapOf("kind" to kind) else if (gameId != it.spec.gameId) emptyMap() else it.spec.filters), submitted = true, page = "discover", overlay = null) }
        if (query.isNotEmpty()) updateLocal { local -> val entry = HistoryEntry(gameId, query, genre, categories); local.copy(history = (listOf(entry) + local.history.filter { it != entry }).take(20)) }
        runSearch()
    }
    fun filters(filters: Map<String, String>, categories: Set<String>, sort: String, genre: String) {
        mutable.update { it.copy(spec = it.spec.copy(filters = filters.filterValues { value -> value.isNotBlank() }, categories = categories, sort = sort, genre = genre), overlay = null, submitted = it.submitted || categories.isNotEmpty()) }
        if (state.value.submitted) runSearch() else loadRanking()
    }
    fun rankingTab(tab: String) { mutable.update { it.copy(rankingTab = tab) }; loadRanking() }
    private fun loadRanking() {
        val current = state.value
        val catalog = current.catalog ?: return
        searchJob?.cancel(); val run = ++generation
        val game = catalog.game(current.spec.gameId)
        mutable.update { it.copy(items = emptyList(), groups = emptyList(), buckets = emptyMap(), loading = false) }
        if (game == null || (catalog.hasCommunityRanking(game.id) && current.rankingTab == "search")) return
        val spec = current.spec.copy(query = "", sort = "downloads", categories = emptySet(), filters = if (game.id == "minecraft-java") mapOf("kind" to "modpack") else emptyMap())
        mutable.update { it.copy(loading = true) }
        searchJob = viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) { catalog.loadSummaries(game.id) }
                val batches = coroutineScope {
                    rankingSources(game).map { source -> async {
                        val request = SearchRequest(game.id, source, "", spec.filters, "downloads")
                        val collected = mutableListOf<Listing>()
                        val verified = mutableListOf<VerifiedLink>()
                        val seen = mutableSetOf<String>()
                        var cursor: String? = null
                        var last = SearchResult("empty", emptyList(), null, null, "")
                        for (page in 0 until 3) {
                            last = try { api.search(request.copy(cursor = cursor), state.value.locale) }
                                catch (cancelled: CancellationException) { throw cancelled }
                                catch (_: Exception) { SearchResult("error", emptyList(), null, null, "순위를 불러오지 못했어요.") }
                            if (last.status !in listOf("success", "empty")) break
                            collected += last.items.filter { isRankingListing(it, game, source) }
                            verified += last.verifiedLinks
                            val next = last.nextCursor ?: break
                            if (!seen.add(next)) break
                            cursor = next
                        }
                        Bucket(request, false, last.copy(items = collected, nextCursor = null, verifiedLinks = verified))
                    } }.awaitAll()
                }
                currentCoroutineContext().ensureActive()
                if (generation == run) {
                    val items = mergeListings(emptyList(), batches.flatMap { it.result!!.items })
                    val verified = catalog.verifiedLinks + batches.flatMap { it.result!!.verifiedLinks }
                    mutable.update { it.copy(items = items, groups = groupListings(items, verified, spec).take(30), buckets = batches.associateBy { it.request.bucket }) }
                }
            } finally { if (generation == run) mutable.update { it.copy(loading = false) } }
        }
    }
    fun retry() { if (state.value.submitted) runSearch() else loadRanking() }
    private fun runSearch() {
        val catalog = state.value.catalog ?: return
        searchJob?.cancel(); val run = ++generation
        val spec = state.value.spec
        links = catalog.verifiedLinks
        cursors.clear()
        mutable.update { it.copy(items = emptyList(), groups = emptyList(), buckets = emptyMap(), loading = true) }
        searchJob = viewModelScope.launch {
            try {
                var eligible: Set<String>? = null
                val tried = mutableSetOf<SearchRequest>()
                for (query in listOf(spec.query) + catalog.correctedQueries(spec)) {
                    val requests = catalog.searchPlan(spec.copy(query = query)).filter { (eligible == null || it.bucket in eligible!!) && tried.add(it) }
                    if (requests.isEmpty()) break
                    withContext(Dispatchers.IO) { requests.map { it.gameId }.distinct().forEach { catalog.loadSummaries(it) } }
                    mutable.update { it.copy(buckets = it.buckets + requests.associate { request -> request.bucket to Bucket(request) }) }
                    val permits = Semaphore(4)
                    coroutineScope { requests.map { request -> launch { permits.withPermit { runRequest(request, spec, run) } } }.joinAll() }
                    if (state.value.items.isNotEmpty()) break
                    eligible = requests.filter { state.value.buckets[it.bucket]?.result?.status in listOf("success", "empty") }.map { it.bucket }.toSet()
                }
            } finally { if (generation == run) mutable.update { it.copy(loading = false) } }
        }
    }
    private suspend fun runRequest(request: SearchRequest, spec: SearchSpec, run: Int) {
        var result = try { api.search(request, state.value.locale) } catch (cancelled: CancellationException) { throw cancelled } catch (_: Exception) { SearchResult("error", emptyList(), null, null, "검색에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.") }
        currentCoroutineContext().ensureActive()
        if (generation != run) return
        val seen = cursors.getOrPut(request.bucket) { mutableSetOf() }
        if (result.status == "success" && result.nextCursor != null && (result.nextCursor == request.cursor || !seen.add(result.nextCursor!!))) result = result.copy(nextCursor = null)
        links = links + result.verifiedLinks
        mutable.update { previous ->
            val items = mergeListings(previous.items, result.items)
            previous.copy(items = items, groups = groupListings(items, links, spec), buckets = previous.buckets + (request.bucket to Bucket(request.copy(cursor = null), false, result)))
        }
    }
    fun loadMore() {
        val current = state.value
        if (current.loading || !current.hasMore) return
        val requests = current.buckets.values.mapNotNull { bucket -> bucket.result?.nextCursor?.let { bucket.request.copy(cursor = it) } }
        val run = generation
        mutable.update { it.copy(loading = true) }
        searchJob = viewModelScope.launch {
            try {
                val permits = Semaphore(4)
                coroutineScope { requests.map { request -> launch { permits.withPermit { runRequest(request, current.spec, run) } } }.joinAll() }
            } finally { if (generation == run) mutable.update { it.copy(loading = false) } }
        }
    }
    private fun loadVersions() {
        if (state.value.versionsLoading) return
        mutable.update { it.copy(versionsLoading = true) }
        viewModelScope.launch {
            try { val versions = api.versions(state.value.locale); mutable.update { it.copy(versions = versions) } }
            catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { notice("버전 목록을 불러오지 못했어요.") }
            finally { mutable.update { it.copy(versionsLoading = false) } }
        }
    }
    private fun updateLocal(transform: (LocalState) -> LocalState) {
        if (!state.value.hydrated) return
        mutable.update { it.copy(local = transform(it.local)) }
        writes.trySend(state.value.local)
    }
    fun theme(id: String) { updateLocal { it.copy(theme = id) } }
    fun language(id: String) { updateLocal { it.copy(language = id) } }
    fun toggleFavorite(item: Listing) {
        updateLocal { local -> val exists = local.favorites.any { it.key == item.key }; local.copy(favorites = if (exists) local.favorites.filter { it.key != item.key } else listOf(item) + local.favorites, folders = if (exists) local.folders.map { it.copy(keys = it.keys - item.key) } else local.folders) }
    }
    fun clearHistory() { updateLocal { it.copy(history = emptyList()) } }
    fun folder(id: String) { mutable.update { it.copy(selectedFolder = id) } }
    fun saveFolder(id: String?, name: String): Boolean {
        val trimmed = name.trim().take(40)
        if (trimmed.isEmpty()) { notice("폴더명을 입력하세요."); return false }
        if (state.value.local.folders.any { it.id != id && normalized(it.name) == normalized(trimmed) }) { notice("같은 이름의 폴더가 있어요."); return false }
        updateLocal { local -> local.copy(folders = if (id == null) local.folders + Folder("folder-${UUID.randomUUID()}", trimmed, emptyList()) else local.folders.map { if (it.id == id) it.copy(name = trimmed) else it }) }
        return true
    }
    fun deleteFolder(id: String) { updateLocal { it.copy(folders = it.folders.filter { folder -> folder.id != id }) }; folder("unfiled") }
    fun moveFavorite(key: String, id: String?) { updateLocal { local -> local.copy(folders = local.folders.map { it.copy(keys = (it.keys - key) + if (it.id == id) listOf(key) else emptyList()) }) } }
    fun compare(item: Listing) { updateLocal { val exists = it.compared.any { other -> other.key == item.key }; it.copy(compared = if (exists) it.compared.filter { other -> other.key != item.key } else (it.compared + item).take(3)) } }
    fun clearComparison() { updateLocal { it.copy(compared = emptyList()) } }
}
