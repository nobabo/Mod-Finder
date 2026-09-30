package io.modfinder.app

import android.content.Context
import android.content.ContextWrapper
import android.database.sqlite.SQLiteDatabase
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import io.modfinder.app.data.LocalStore
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.nio.file.Files

@RunWith(AndroidJUnit4::class)
class LocalStoreDeviceTest {
    @Test fun sqliteUpgradePreservesReferencesAndOriginalDatabase() {
        val app = ApplicationProvider.getApplicationContext<Context>()
        val directory = Files.createTempDirectory(app.cacheDir.toPath(), "native-migration-").toFile()
        val context = object : ContextWrapper(app) {
            override fun getFilesDir() = File(directory, "files").apply { mkdirs() }
            override fun getDatabasePath(name: String) = File(directory, name)
        }
        val original = context.getDatabasePath("modfinder.db")
        SQLiteDatabase.openOrCreateDatabase(original, null).use {
            it.execSQL("CREATE TABLE local_state (id INTEGER PRIMARY KEY, data TEXT NOT NULL)")
            it.execSQL("INSERT INTO local_state VALUES(1, ?)", arrayOf("""{"favorites":[{"source":"curseforge","scope":"432","id":"9007199254740993","key":"curseforge:432:9007199254740993","gameId":"minecraft-java","referenceOnly":true}],"folders":[{"id":"folder-1","name":"Saved","keys":["curseforge:432:9007199254740993"]}],"history":[{"gameId":"minecraft-java","query":"sodium"}],"favoriteGames":["minecraft-java"],"compared":[]}"""))
        }
        val before = original.readBytes()
        val store = LocalStore(context, setOf("minecraft-java"))
        val migrated = store.load()
        assertEquals("9007199254740993", migrated.favorites.single().id)
        assertEquals(migrated.favorites.single().key, migrated.folders.single().keys.single())
        assertEquals("sodium", migrated.history.single().query)
        assertArrayEquals(before, original.readBytes())
        store.save(migrated.copy(theme = "violet"))
        assertEquals("violet", LocalStore(context, setOf("minecraft-java")).load().theme)
        assertArrayEquals(before, original.readBytes())
        val snapshot = File(context.filesDir, "native-state-v1.json")
        snapshot.writeText("broken snapshot")
        assertThrows(Exception::class.java) { store.load() }
        assertEquals("broken snapshot", snapshot.readText())
    }
}
