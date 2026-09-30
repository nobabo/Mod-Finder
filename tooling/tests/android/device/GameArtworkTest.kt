package io.modfinder.app.data

import android.graphics.Bitmap
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import coil.decode.DataSource
import coil.annotation.ExperimentalCoilApi
import coil.imageLoader
import coil.request.CachePolicy
import coil.request.ImageRequest
import coil.request.SuccessResult
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.atomic.AtomicInteger

@RunWith(AndroidJUnit4::class)
@OptIn(ExperimentalCoilApi::class)
class GameArtworkTest {
    @Test fun workerArtworkSurvivesOfflineWithoutCachingProviderIcons() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val requests = AtomicInteger()
        val pixels = ByteArrayOutputStream().also { output ->
            Bitmap.createBitmap(16, 16, Bitmap.Config.ARGB_8888).apply { eraseColor(0xffd04090.toInt()) }
                .compress(Bitmap.CompressFormat.PNG, 100, output)
        }.toByteArray()
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            requests.incrementAndGet()
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .header("Content-Type", "image/png").header("Cache-Control", "no-store")
                .body(pixels.toResponseBody("image/png".toMediaType())).build()
        }.build()
        val loader = GameArtwork.createLoader(context, File(context.cacheDir, "artwork-test-${System.nanoTime()}"), client)
        try {
            val url = artworkUrl("/games/minecraft-java.png", "ab".repeat(32))!!
            val request = ImageRequest.Builder(context).data(url).size(16).allowHardware(false).memoryCachePolicy(CachePolicy.DISABLED)
            val first = loader.execute(request.build())
            assertTrue(first is SuccessResult)
            assertEquals(DataSource.NETWORK, (first as SuccessResult).dataSource)
            val offline = loader.execute(request.networkCachePolicy(CachePolicy.DISABLED).build())
            assertTrue(offline is SuccessResult)
            assertEquals(DataSource.DISK, (offline as SuccessResult).dataSource)
            assertEquals(1, requests.get())
            assertNull(context.imageLoader.diskCache)
        } finally {
            loader.diskCache?.clear()
            loader.shutdown()
        }
    }
}
