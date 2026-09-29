package io.modfinder.app.data

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.util.AtomicFile
import io.modfinder.app.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

fun parseLocalState(raw: String, validGames: Set<String>, thunderstoreOptIn: Boolean): LocalState {
    val value = JSONObject(raw)
    fun listings(key: String) = value.optJSONArray(key)?.objects()?.map { Listing.parse(it) }?.filter { it.gameId in validGames && it.canPersist(thunderstoreOptIn) }?.distinctBy { it.key }.orEmpty()
    require(value.optJSONArray("favorites") != null && value.optJSONArray("history") != null)
    val favorites = listings("favorites")
    val validKeys = favorites.map { it.key }.toSet()
    val claimed = mutableSetOf<String>()
    val folders = value.optJSONArray("folders")?.objects()?.map { folder ->
        val name = folder.getString("name").trim(); val id = folder.getString("id")
        require(name.isNotBlank() && name.length <= 40 && id.isNotBlank() && id.length <= 80)
        Folder(id, name, folder.stringList("keys").orEmpty().filter { it in validKeys && claimed.add(it) })
    }.orEmpty()
    require(folders.distinctBy { it.id }.size == folders.size)
    val history = value.getJSONArray("history").objects().filter { it.text("gameId") in validGames + "all" }.map {
        HistoryEntry(it.getString("gameId"), it.getString("query").take(200), it.text("genre") ?: "all", (it.stringList("categories") ?: listOfNotNull(it.text("category"))).toSet())
    }.take(20)
    return LocalState(favorites, folders, listings("compared").take(3), value.stringList("favoriteGames").orEmpty().filter { it in validGames }, history, value.text("theme") ?: "magenta", value.text("language") ?: "auto")
}
fun serializeLocalState(state: LocalState, thunderstoreOptIn: Boolean): String {
    val favorites = state.favorites.filter { it.canPersist(thunderstoreOptIn) }
    val keys = favorites.map { it.key }.toSet()
    return JSONObject().put("favorites", JSONArray(favorites.map { JSONObject(it.raw) }))
        .put("folders", JSONArray(state.folders.map { JSONObject().put("id", it.id).put("name", it.name).put("keys", JSONArray(it.keys.filter { key -> key in keys })) }))
        .put("compared", JSONArray(state.compared.filter { it.canPersist(thunderstoreOptIn) }.take(3).map { JSONObject(it.raw) }))
        .put("favoriteGames", JSONArray(state.favoriteGames))
        .put("history", JSONArray(state.history.take(20).map { JSONObject().put("gameId", it.gameId).put("query", it.query).put("genre", it.genre).put("categories", JSONArray(it.categories.toList())) }))
        .put("theme", state.theme).put("language", state.language).toString()
}

class LocalStore(private val context: Context, private val validGames: Set<String>) {
    private val file = AtomicFile(File(context.filesDir, "native-state-v1.json"))
    fun load(): LocalState {
        val raw = if (file.baseFile.exists() || File(file.baseFile.path + ".bak").exists()) file.openRead().bufferedReader().use { it.readText() } else readTauriState()
        return raw?.let { parseLocalState(it, validGames, BuildConfig.THUNDERSTORE_PERSISTENCE) } ?: LocalState()
    }
    private fun readTauriState(): String? {
        // Keep the original SQLite file untouched so existing installations can upgrade safely.
        val candidates = listOf(context.getDatabasePath("modfinder.db"), File(context.filesDir, "modfinder.db")) + context.filesDir.walkTopDown().maxDepth(4).filter { it.isFile && it.name == "modfinder.db" }.toList()
        val original = candidates.firstOrNull { it.exists() } ?: return null
        return SQLiteDatabase.openDatabase(original.path, null, SQLiteDatabase.OPEN_READONLY).use { database ->
            database.rawQuery("SELECT data FROM local_state WHERE id=1", null).use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
        }
    }
    fun save(state: LocalState) {
        val bytes = serializeLocalState(state, BuildConfig.THUNDERSTORE_PERSISTENCE).toByteArray(Charsets.UTF_8)
        val stream = file.startWrite()
        try { stream.write(bytes); file.finishWrite(stream) } catch (error: Exception) { file.failWrite(stream); throw error }
    }
}
