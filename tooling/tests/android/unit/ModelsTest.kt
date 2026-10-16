package io.modfinder.app.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class ModelsTest {
    @Test fun relevanceUsesProviderRanksAndLocalizedTerms() {
        val early = listing(id = "zzz", title = "Magic tools").copy(rank = 1)
        val late = listing(id = "aaa", title = "Magic items").copy(rank = 40)
        assertEquals(early.key, groupListings(listOf(late, early), emptyList(), SearchSpec(query = "Magic", sort = "relevance")).first().item.key)
        val exact = late.copy(title = "Magic")
        assertEquals(exact.key, groupListings(listOf(early, exact), emptyList(), SearchSpec(query = "Magic", sort = "relevance")).first().item.key)
        val sodium = late.copy(title = "Sodium")
        val localized = groupListings(listOf(early, sodium), emptyList(), SearchSpec(query = "소듐", sort = "relevance")) { RankingHints(listOf("Sodium")) }
        assertEquals(sodium.key, localized.first().item.key)
    }
    @Test fun offlinePlannerSharesKoreanSpacingCommunityNamesAndNumberVariants() {
        val catalog = Catalog(JSONObject(File(requireNotNull(System.getProperty("modfinder.catalog"))).readText()))
        val minecraft = catalog.game("minecraft-java")!!
        val stardew = catalog.game("stardew-valley")!!
        assertEquals("Sodium", catalog.providerQuery("소 듐", minecraft, "modrinth"))
        assertEquals("Stardew Valley Expanded", catalog.providerQuery("대 확장", stardew, "nexus"))
        assertEquals(listOf("zombie", "zombies"), catalog.providerQueries("zombie", minecraft, "modrinth"))
        assertEquals(listOf("wolves", "wolf"), catalog.providerQueries("wolves", minecraft, "modrinth"))
        assertEquals(listOf("Sodium"), catalog.providerQueries("Sodium", minecraft, "modrinth"))
        val requests = catalog.searchPlan(SearchSpec(query = "zombie"))
        assertTrue(requests.any { it.source == "modrinth" && it.query == "zombies" })
        val data = JSONObject(File(requireNotNull(System.getProperty("modfinder.catalog"))).readText())
        val community = data.getJSONObject("communityMods").getJSONArray("minecraft-java").objects().first { !it.text("koreanName").isNullOrEmpty() }
        assertTrue(catalog.providerQueries(community.getString("koreanName"), minecraft, "modrinth").contains(community.getString("name")))
    }
    @Test fun mergedBookmarksAndShortcutFoldersSurvivePersistence() {
        val first = listing(id = "first"); val saved = listing("curseforge", "22")
        assertEquals(saved, favoriteCandidate(first, listOf(first, saved), listOf(saved)))
        val local = LocalState(favorites = listOf(saved), folders = listOf(Folder("f", "Folder", listOf(saved.key))), shortcutFolderId = "f")
        val restored = parseLocalState(serializeLocalState(local, false), setOf("minecraft-java"), false)
        assertEquals("f", restored.shortcutFolderId)
        assertEquals(listOf(saved.key), shortcutFavorites(restored).map { it.key })
    }
    @Test fun recommendationsExtractTopicsAndKeepSignalsBoundedWithoutProviderPayloads() {
        val item = listing(title = "Magic spells").copy(summary = "Adventure dungeons", tags = emptyList())
        val now = System.currentTimeMillis()
        val events = recordInterest(emptyList(), item.gameId, item = item, now = now)
        assertEquals(listOf("magic", "exploration"), events.single().topics)
        assertEquals(listOf("magic", "adventure"), recommendationQueries(events, item.gameId, now))
        assertEquals(events, recordInterest(events, item.gameId, item = item, now = now + 10))
        assertEquals(200, validInterests(List(250) { events.single() }, now).size)
        assertTrue(validInterests(events, now + 91L * 86400000).isEmpty())
        val local = LocalState(favorites = listOf(listing("curseforge", title = "Magic spells").copy(summary = "Adventure dungeons")), interests = events)
        val raw = serializeLocalState(local, false)
        assertFalse(raw.contains("Magic spells")); assertFalse(raw.contains("Adventure dungeons"))
        assertEquals(events, parseLocalState(raw, setOf(item.gameId), false).interests)
        assertTrue(parseLocalState(serializeLocalState(local.copy(interests = emptyList()), false), setOf(item.gameId), false).interests.isEmpty())
    }
    @Test fun searchVariantsKeepIndependentPaginationAndShareSourceEligibility() {
        val row = JSONObject().put("gameId", "minecraft-java").put("source", "modrinth").put("query", "zombie").put("sort", "downloads").put("filters", JSONObject().put("loader", "fabric"))
        val variants = JSONArray().put(row).put(JSONObject(row.toString()).put("query", "zombies"))
        val json = JSONObject().put("original", variants).put("corrections", JSONArray()).put("fuzzy", JSONArray())
        val plan = parseSearchPlan(json)
        assertEquals(2, plan.original.map { it.bucket }.toSet().size)
        assertEquals(1, plan.original.map { it.sourceBucket }.toSet().size)
        assertEquals("fabric", plan.original[1].filters["loader"])
        row.put("source", "unknown")
        assertThrows(Exception::class.java) { parseSearchPlan(json) }
    }
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
        val stored = JSONObject(serialized).getJSONArray("favorites").objects()
        assertTrue(stored[1].getBoolean("referenceOnly")); assertFalse(stored[1].has("summary")); assertFalse(stored[1].has("title"))
        assertTrue(stored[2].getBoolean("referenceOnly")); assertFalse(stored[2].has("metrics"))
        val restored = parseLocalState(serialized, setOf("minecraft-java"), false)
        assertEquals(listOf(allowed.key, curse.key, thunder.key), restored.favorites.map { it.key })
        assertEquals(listOf(allowed.key, curse.key, thunder.key), restored.folders.single().keys)
        assertTrue(restored.compared.isEmpty())
        assertFalse(JSONObject(serializeLocalState(local, true)).getJSONArray("favorites").getJSONObject(2).has("referenceOnly"))
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
    @Test fun rankingRejectsMissingMetricsAndOtherScopesAndUsesSteamSubscriptions() {
        val minecraft = Game("minecraft-java", "Minecraft", "마인크래프트", emptyList(), emptyList(), null, null, mapOf("modrinth" to "minecraft", "curseforge" to "432"))
        val pack = listing().copy(kind = "modpack", metrics = listOf(Metric("다운로드", 100.0)))
        assertTrue(isRankingListing(pack, minecraft, "modrinth"))
        assertFalse(isRankingListing(pack.copy(scope = "other"), minecraft, "modrinth"))
        assertFalse(isRankingListing(pack.copy(kind = "mod"), minecraft, "modrinth"))
        assertFalse(isRankingListing(pack.copy(metrics = emptyList()), minecraft, "modrinth"))
        assertFalse(isRankingListing(pack.copy(metrics = listOf(Metric("다운로드", -1.0))), minecraft, "modrinth"))
        val steamGame = minecraft.copy(id = "rimworld", providers = mapOf("nexus" to "rimworld", "steam" to "294100"))
        assertEquals(listOf("steam"), rankingSources(steamGame))
        val steam = pack.copy(source = "steam", gameId = "rimworld", scope = "294100", key = "steam:294100:${pack.id}", kind = "mod")
        assertFalse(isRankingListing(steam, steamGame, "steam"))
        assertTrue(isRankingListing(steam.copy(metrics = listOf(Metric("누적 구독자", 50.0))), steamGame, "steam"))
    }
}
