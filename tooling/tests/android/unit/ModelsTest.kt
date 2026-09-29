package io.modfinder.app.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class ModelsTest {
    private fun listing(source: String = "modrinth", id: String = "900719925474099312345", game: String = "minecraft-java", title: String = "Identical title"): Listing {
        val host = when (source) { "curseforge" -> "www.curseforge.com"; "thunderstore" -> "thunderstore.io"; else -> "modrinth.com" }
        return Listing.parse(JSONObject().put("source", source).put("scope", "minecraft").put("id", id).put("key", "$source:minecraft:$id").put("gameId", game)
            .put("title", title).put("summary", "Sample").put("author", JSONObject.NULL).put("url", "https://$host/mod/$id")
            .put("iconUrl", JSONObject.NULL).put("versions", JSONObject.NULL).put("loaders", JSONObject.NULL).put("updatedAt", JSONObject.NULL)
            .put("kind", JSONObject.NULL).put("fetchedAt", "2026-09-30T00:00:00Z").put("tags", JSONArray()).put("metrics", JSONArray()).put("rank", 1))
    }
    @Test fun largeIdsAndUnknownCompatibilityRemainUnchanged() {
        val item = listing()
        assertEquals("900719925474099312345", item.id)
        assertNull(item.versions); assertNull(item.loaders); assertNull(item.downloads)
        val invalid = JSONObject(item.raw).put("id", 42)
        assertThrows(Exception::class.java) { Listing.parse(invalid) }
        assertThrows(Exception::class.java) { Listing.parse(JSONObject(item.raw).put("key", "wrong:scope:id")) }
    }
    @Test fun neverMergeByTitleAndNeverMergeAcrossGames() {
        val a = listing(); val b = listing("curseforge", "22")
        assertEquals(2, groupListings(listOf(a, b), emptyList(), SearchSpec()).size)
        val verified = VerifiedLink(listOf(a.key, b.key), "https://modrinth.com/mod/project")
        assertEquals(1, groupListings(listOf(a, b), listOf(verified), SearchSpec()).size)
        val otherGame = b.copy(gameId = "valheim")
        assertEquals(2, groupListings(listOf(a, otherGame), listOf(verified), SearchSpec()).size)
        assertEquals(2, groupListings(listOf(a, b), listOf(verified.copy(evidence = "http://unverified")), SearchSpec()).size)
    }
    @Test fun externalStatusesCannotSupplyListingsOrPagination() {
        val item = listing()
        val json = JSONObject().put("source", item.source).put("status", "external").put("items", JSONArray().put(JSONObject(item.raw))).put("nextCursor", "fake")
        val result = parseSearchResult(json, SearchRequest(item.gameId, item.source, "", emptyMap(), "downloads"))
        assertTrue(result.items.isEmpty()); assertNull(result.nextCursor)
    }
    @Test fun paginationDeduplicatesOnlyScopedIdsAndCombinesCategories() {
        val item = listing().copy(categories = setOf("modrinth:adventure"))
        val next = item.copy(categories = setOf("modrinth:magic"))
        val differentSource = listing("curseforge")
        val merged = mergeListings(listOf(item), listOf(next, differentSource, next))
        assertEquals(2, merged.size)
        assertEquals(setOf("modrinth:adventure", "modrinth:magic"), merged[0].categories)
    }
    @Test fun persistencePoliciesApplyAtTheStorageBoundary() {
        val allowed = listing(); val curse = listing("curseforge"); val thunder = listing("thunderstore")
        val local = LocalState(favorites = listOf(allowed, curse, thunder), compared = listOf(curse), folders = listOf(Folder("f", "Folder", listOf(allowed.key, curse.key, thunder.key))))
        val serialized = serializeLocalState(local, false)
        assertFalse(serialized.contains("curseforge")); assertFalse(serialized.contains("thunderstore"))
        val restored = parseLocalState(serialized, setOf("minecraft-java"), false)
        assertEquals(listOf(allowed.key), restored.favorites.map { it.key })
        assertEquals(listOf(allowed.key), restored.folders.single().keys)
        assertTrue(restored.compared.isEmpty())
        assertEquals(2, parseLocalState(serializeLocalState(local, true), setOf("minecraft-java"), true).favorites.size)
    }
    @Test fun malformedSnapshotsFailInsteadOfReplacingExistingData() {
        assertThrows(Exception::class.java) { parseLocalState("{}", setOf("minecraft-java"), false) }
        val raw = JSONObject(serializeLocalState(LocalState(favorites = listOf(listing())), false))
        raw.getJSONArray("favorites").getJSONObject(0).put("key", "bad")
        assertThrows(Exception::class.java) { parseLocalState(raw.toString(), setOf("minecraft-java"), false) }
    }
    @Test fun externalNavigationRejectsCredentialsSpoofedHostsAndSchemes() {
        assertNotNull(safeExternalUrl("https://modrinth.com/mod/sodium"))
        listOf("javascript:alert(1)", "http://modrinth.com", "https://modrinth.com.evil.example/mod/a", "https://user:pass@modrinth.com", "https://modrinth.com:444/mod/a").forEach { assertNull(safeExternalUrl(it)) }
    }
    @Test fun missingAndNullMetricsNeverBecomeZero() {
        val raw = JSONObject(listing().raw).put("metrics", JSONArray().put(JSONObject().put("label", "다운로드").put("value", JSONObject.NULL)))
        assertNull(Listing.parse(raw).downloads)
    }
    @Test fun koreanKeyboardCorrectionPreservesLiteralIds() {
        assertEquals("sodium", koreanKeyboardToEnglish("내야ㅕㅡ"))
        assertEquals("900719925474099312345", koreanKeyboardToEnglish("900719925474099312345"))
    }
}
