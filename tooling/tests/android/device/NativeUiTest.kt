package io.modfinder.app

import android.app.Application
import android.graphics.RuntimeShader
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModelStore
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import io.modfinder.app.data.*
import io.modfinder.app.ui.LIQUID_GLASS_SHADER
import io.modfinder.app.ui.ModFinderApp
import kotlinx.coroutines.delay
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.CopyOnWriteArrayList

@RunWith(AndroidJUnit4::class)
class NativeUiTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val store = ViewModelStore()
    private val requests = CopyOnWriteArrayList<SearchRequest>()
    private lateinit var vm: ModFinderViewModel
    private fun start() {
        val app = ApplicationProvider.getApplicationContext<Application>()
        val fake = object : ModRepository {
            override suspend fun versions(locale: String) = listOf("1.21.11", "1.21.1", "1.20.1")
            override suspend fun search(request: SearchRequest, locale: String): SearchResult {
                requests.add(request)
                delay(if (request.query == "slow") 900 else 30)
                if (request.source != "modrinth") return SearchResult("external", emptyList(), null, "https://www.curseforge.com/minecraft/search", "")
                val id = if (request.cursor == null) "native-fixture" else "native-fixture-page2"
                val item = Listing.parse(JSONObject().put("key", "modrinth:minecraft:$id").put("source", "modrinth").put("scope", "minecraft").put("id", id).put("gameId", request.gameId)
                    .put("title", "Native ${request.query} ${if (request.cursor == null) "first" else "second"}").put("summary", "A deterministic native search result.")
                    .put("url", "https://modrinth.com/mod/sodium").put("author", "Test author").put("iconUrl", JSONObject.NULL).put("versions", JSONObject.NULL).put("loaders", JSONObject.NULL)
                    .put("updatedAt", JSONObject.NULL).put("fetchedAt", "2026-09-30T00:00:00Z").put("kind", "mod").put("tags", JSONArray()).put("metrics", JSONArray()).put("rank", 1))
                return SearchResult("success", listOf(item), if (request.cursor == null) "page2" else null, null, "")
            }
        }
        compose.runOnUiThread { vm = ModFinderViewModel(app, SavedStateHandle(), fake); store.put("test", vm) }
        compose.setContent { ModFinderApp(vm) }
        compose.waitUntil(20_000) { vm.state.value.catalog != null && vm.state.value.hydrated }
        compose.runOnIdle { vm.language("ko") }
    }
    @After fun dispose() { compose.runOnUiThread { store.clear() } }
    @Test fun navigationKeepsSearchAndRendersNativeGlass() {
        start()
        compose.onNodeWithTag("search-input").performTextInput("kept query")
        compose.onNodeWithTag("nav-settings").performClick()
        compose.onNodeWithTag("search-input").assertTextContains("kept query")
        compose.onNodeWithText("모드 둘러보기").assertExists()
        screenshot("settings")
        compose.runOnIdle { vm.overlay("theme") }
        compose.onNodeWithText("바이올렛").performClick()
        compose.runOnIdle { assertEquals("violet", vm.state.value.local.theme) }
        compose.runOnIdle { vm.overlay("games") }
        compose.onNodeWithText("전체 게임").assertExists()
        compose.onNodeWithTag("search-input").assertTextContains("kept query")
        screenshot("games")
        if (Build.VERSION.SDK_INT >= 33) RuntimeShader(LIQUID_GLASS_SHADER)
    }
    @Test fun searchPaginationFiltersFavoritesAndCancellation() {
        start()
        compose.runOnIdle { vm.submit("slow"); vm.submit("Sodium") }
        compose.waitUntil(15_000) { !vm.state.value.loading && vm.state.value.items.isNotEmpty() }
        compose.runOnIdle { assertTrue(vm.state.value.items.all { "Sodium" in it.title }); assertFalse(vm.state.value.items.any { "slow" in it.title }); vm.loadMore() }
        compose.waitUntil(10_000) { !vm.state.value.loading && vm.state.value.items.size == 2 }
        compose.onNodeWithText("Native Sodium first").performClick()
        compose.onAllNodesWithText("정보 없음").assertCountEquals(3)
        screenshot("detail")
        compose.runOnIdle {
            val item = vm.state.value.items.first()
            val before = vm.state.value.local.favorites.any { it.key == item.key }
            vm.toggleFavorite(item)
            assertEquals(!before, vm.state.value.local.favorites.any { it.key == item.key })
            vm.toggleFavorite(item)
            vm.detail(null)
            vm.filters(mapOf("version" to "1.21.1", "loader" to "fabric"), setOf("modrinth:optimization"), "relevance", "all")
        }
        compose.waitUntil(10_000) { !vm.state.value.loading }
        assertTrue(requests.any { it.filters["version"] == "1.21.1" && it.filters["category"] == "modrinth:optimization" })
        screenshot("results")
    }
    @Test fun keyboardAndBackPreserveGameSelection() {
        start()
        compose.runOnIdle { vm.chooseGame("valheim"); vm.overlay("settings") }
        compose.runOnIdle { assertTrue(vm.back()); assertEquals("valheim", vm.state.value.spec.gameId); assertNull(vm.state.value.overlay) }
        compose.onNodeWithTag("search-input").performTextInput("test")
        compose.onNodeWithTag("search-input").performImeAction()
        compose.waitUntil(10_000) { !vm.state.value.loading }
        compose.runOnIdle { assertEquals("test", vm.state.value.spec.query); assertEquals("valheim", vm.state.value.spec.gameId) }
    }
    private fun screenshot(name: String) {
        compose.waitForIdle()
        val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
        val dir = File(compose.activity.getExternalFilesDir(null), "verification").apply { mkdirs() }
        File(dir, "$name.png").outputStream().use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
    }
}
