package io.modfinder.app.data

import android.content.Context
import coil.ImageLoader
import coil.decode.SvgDecoder
import coil.disk.DiskCache
import coil.memory.MemoryCache
import io.modfinder.app.BuildConfig
import okhttp3.OkHttpClient
import java.io.File
import java.util.concurrent.TimeUnit

/** Only catalog artwork on our HTTPS origin enters the persistent image cache. */
fun artworkUrl(path: String, revision: String?): String? {
    if (!Regex("^/(games|logos|backgrounds)/[a-zA-Z0-9/_-]+\\.(png|jpe?g|webp|avif|gif|svg)$").matches(path)) return null
    if (revision == null || !Regex("^[a-f0-9]{64}$").matches(revision)) return null
    return "${BuildConfig.API_BASE}$path?v=$revision"
}

object GameArtwork {
    @Volatile private var instance: ImageLoader? = null

    fun loader(context: Context): ImageLoader = instance ?: synchronized(this) {
        instance ?: createLoader(context.applicationContext, File(context.cacheDir, "game-artwork")).also { instance = it }
    }

    internal fun createLoader(context: Context, directory: File, client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS).readTimeout(12, TimeUnit.SECONDS).callTimeout(15, TimeUnit.SECONDS).build()): ImageLoader =
        ImageLoader.Builder(context)
            .components { add(SvgDecoder.Factory()) }
            .okHttpClient(client)
            .memoryCache { MemoryCache.Builder(context).maxSizeBytes(8 * 1024 * 1024).build() }
            .diskCache { DiskCache.Builder().directory(directory).maxSizeBytes(24L * 1024 * 1024).build() }
            // Content hashes in catalog URLs invalidate artwork when a new app ships.
            // Provider mod icons use the separate, disk-cache-free application loader.
            .respectCacheHeaders(false)
            .build()
}
