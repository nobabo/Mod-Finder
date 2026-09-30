package io.modfinder.app.data

import io.modfinder.app.BuildConfig
import org.junit.Assert.*
import org.junit.Test

class ArtworkUrlTest {
    @Test fun catalogArtworkUsesVersionedWorkerUrlsOnly() {
        val revision = "ab".repeat(32)
        assertEquals("${BuildConfig.API_BASE}/logos/minecraft-java.svg?v=$revision", artworkUrl("/logos/minecraft-java.svg", revision))
        listOf("https://example.com/game.png", "//example.com/game.png", "/games/../private.png", "/games/%2e%2e/private.png", "/api/icon.png", "/games/game.png?other=1").forEach {
            assertNull(artworkUrl(it, revision))
        }
        assertNull(artworkUrl("/games/minecraft-java.png", null))
        assertNull(artworkUrl("/games/minecraft-java.png", "not-a-content-hash"))
        assertNotEquals(artworkUrl("/games/minecraft-java.png", revision), artworkUrl("/games/minecraft-java.png", "cd".repeat(32)))
    }
}
