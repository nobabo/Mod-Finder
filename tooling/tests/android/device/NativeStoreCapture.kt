package io.modfinder.app

import android.content.ContentValues
import android.graphics.Bitmap
import android.provider.MediaStore
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.lifecycle.ViewModelProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Opt-in live capture: real Activity, production API and unmodified rendered screens. */
@RunWith(AndroidJUnit4::class)
class NativeStoreCapture {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    @Test fun captureRealAppScreens() {
        assumeTrue(InstrumentationRegistry.getArguments().getString("captureStore") == "true")
        lateinit var vm: ModFinderViewModel
        compose.runOnUiThread { vm = ViewModelProvider(compose.activity)[ModFinderViewModel::class.java] }
        compose.waitUntil(30_000) { vm.state.value.catalog != null && vm.state.value.hydrated }
        compose.runOnIdle { vm.language("ko"); vm.theme("magenta"); vm.chooseGame("minecraft-java"); vm.page("discover") }
        capture("01-home")
        compose.runOnIdle { vm.overlay("games") }
        capture("02-games")
        compose.runOnIdle { vm.submit("Sodium", "minecraft-java", kind = "mod") }
        compose.waitUntil(60_000) { !vm.state.value.loading && vm.state.value.items.any { it.source == "modrinth" } }
        capture("03-search")
        compose.runOnIdle { vm.detail(vm.state.value.items.first { it.source == "modrinth" }) }
        capture("04-details")
        compose.runOnIdle { vm.detail(null); vm.overlay("settings") }
        capture("05-settings")
    }
    private fun capture(name: String) {
        compose.waitForIdle()
        // Coil decodes provider artwork independently of the Compose idle tracker.
        Thread.sleep(1200)
        // Capture the displayed window so retained graphics layers and Coil artwork are included.
        val bitmap = checkNotNull(InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot())
        val resolver = compose.activity.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, "$name.png")
            put(MediaStore.Downloads.MIME_TYPE, "image/png")
            put(MediaStore.Downloads.RELATIVE_PATH, "Download/ModFinderStore")
        }
        val uri = checkNotNull(resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values))
        checkNotNull(resolver.openOutputStream(uri)).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
