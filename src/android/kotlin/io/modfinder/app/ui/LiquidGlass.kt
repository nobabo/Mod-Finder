package io.modfinder.app.ui

import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import android.graphics.BitmapShader
import android.graphics.Canvas as AndroidCanvas
import android.graphics.Color as AndroidColor
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.RuntimeShader
import android.graphics.Shader
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import coil.request.ImageRequest
import coil.size.Scale
import io.modfinder.app.data.GameArtwork
import io.modfinder.app.data.Palette
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

data class GlassScene(val bitmap: Bitmap, val screen: IntSize)
data class GlassStyle(val scene: GlassScene?, val primary: Color, val secondary: Color)
val LocalGlass = staticCompositionLocalOf { GlassStyle(null, Color(0xFFF564A1), Color(0xFFFF9D6D)) }

/** Download/decode off the main thread, then share one static backdrop across panels. */
@Composable
fun rememberGlassScene(photos: List<String>, palette: Palette, size: IntSize, playing: Boolean): GlassScene? {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var index by remember(photos) { mutableIntStateOf(0) }
    LaunchedEffect(photos, playing, lifecycle) {
        if (photos.size > 1 && playing) lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (isActive) { delay(20_000); index = (index + 1) % photos.size }
        }
    }
    var scene by remember(photos, palette.id, size) { mutableStateOf<GlassScene?>(null) }
    LaunchedEffect(photos.getOrNull(index), palette.id, size) {
        if (size.width <= 0 || size.height <= 0) return@LaunchedEffect
        val scale = min(1.0, min(1200.0 / max(size.width, size.height), sqrt(750_000.0 / size.width / size.height)))
        val width = max(1, (size.width * scale).toInt()); val height = max(1, (size.height * scale).toInt())
        suspend fun buildScene(photo: Bitmap?) = withContext(Dispatchers.Default) {
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = AndroidCanvas(bitmap)
            canvas.drawColor(AndroidColor.rgb(8, 13, 24))
            if (photo != null) {
                val zoom = max(width.toFloat() / photo.width, height.toFloat() / photo.height) * 1.04f
                val transform = Matrix().apply { setScale(zoom, zoom); postTranslate((width - photo.width * zoom) / 2, (height - photo.height * zoom) / 2) }
                canvas.drawBitmap(photo, transform, Paint(Paint.FILTER_BITMAP_FLAG).apply { alpha = 95 })
            }
            val primary = AndroidColor.parseColor(palette.primary)
            val secondary = AndroidColor.parseColor(palette.secondary)
            fun tint(color: Int, alpha: Int) = (color and 0x00ffffff) or (alpha shl 24)
            canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), Paint().apply {
                shader = RadialGradient(width * .17f, height * .22f, height * .65f, intArrayOf(tint(primary, 53), tint(primary, 0)), null, Shader.TileMode.CLAMP)
            })
            canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), Paint().apply {
                shader = RadialGradient(width * .95f, height * .63f, height * .6f, intArrayOf(tint(secondary, 39), tint(secondary, 0)), null, Shader.TileMode.CLAMP)
            })
            GlassScene(bitmap, size)
        }
        // Draw the theme immediately, and keep the previous photo during the next download.
        if (scene == null) scene = buildScene(null)
        photos.getOrNull(index)?.let { url ->
            val result = GameArtwork.loader(context).execute(ImageRequest.Builder(context).data(url)
                .size(width, height).scale(Scale.FILL).allowHardware(false).build())
            (result.drawable as? BitmapDrawable)?.bitmap?.let { scene = buildScene(it) }
        }
    }
    return scene
}

@Composable fun SceneBackground(scene: GlassScene?) {
    if (scene != null) Image(scene.bitmap.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = ContentScale.FillBounds)
    else Box(Modifier.fillMaxSize().background(Color(0xFF080D18)))
}

private interface Lens {
    fun draw(canvas: AndroidCanvas, scene: GlassScene, origin: Offset, width: Float, height: Float, radius: Float, primary: Color, secondary: Color, pressed: Float)
}

@RequiresApi(33)
private class RefractiveLens : Lens {
    // Three displaced samples reproduce dispersion. There is no full-screen shader,
    // framebuffer readback, runtime bitmap capture, or perpetual animation clock.
    private val shader = RuntimeShader(LIQUID_GLASS_SHADER)
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { shader = this@RefractiveLens.shader }
    private var bitmap: Bitmap? = null
    override fun draw(canvas: AndroidCanvas, scene: GlassScene, origin: Offset, width: Float, height: Float, radius: Float, primary: Color, secondary: Color, pressed: Float) {
        if (bitmap !== scene.bitmap) {
            shader.setInputShader("backdrop", BitmapShader(scene.bitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply { setFilterMode(BitmapShader.FILTER_MODE_LINEAR) })
            bitmap = scene.bitmap
        }
        shader.setFloatUniform("origin", origin.x, origin.y)
        shader.setFloatUniform("panelSize", width, height)
        shader.setFloatUniform("sceneScale", scene.bitmap.width.toFloat() / scene.screen.width, scene.bitmap.height.toFloat() / scene.screen.height)
        shader.setFloatUniform("radius", radius)
        shader.setFloatUniform("press", pressed)
        shader.setFloatUniform("tintA", primary.red, primary.green, primary.blue)
        shader.setFloatUniform("tintB", secondary.red, secondary.green, secondary.blue)
        canvas.drawRoundRect(0f, 0f, width, height, radius, radius, paint)
    }
}

private class FrostedLens : Lens {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val matrix = Matrix()
    private var bitmap: Bitmap? = null
    override fun draw(canvas: AndroidCanvas, scene: GlassScene, origin: Offset, width: Float, height: Float, radius: Float, primary: Color, secondary: Color, pressed: Float) {
        if (bitmap !== scene.bitmap) { paint.shader = BitmapShader(scene.bitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP); bitmap = scene.bitmap }
        matrix.setScale(scene.screen.width.toFloat() / scene.bitmap.width, scene.screen.height.toFloat() / scene.bitmap.height)
        matrix.postTranslate(-origin.x, -origin.y)
        paint.shader.setLocalMatrix(matrix)
        canvas.drawRoundRect(0f, 0f, width, height, radius, radius, paint)
    }
}

@Composable
fun GlassSurface(modifier: Modifier = Modifier, radius: Dp = 24.dp, onClick: (() -> Unit)? = null, content: @Composable BoxScope.() -> Unit) {
    val style = LocalGlass.current
    val origin = remember { mutableStateOf(Offset.Zero) }
    val interactions = remember { MutableInteractionSource() }
    val pressed by interactions.collectIsPressedAsState()
    val pressure = animateFloatAsState(if (pressed) 1f else 0f, spring(dampingRatio = .78f, stiffness = 450f), label = "Glass touch")
    val lens = remember { if (Build.VERSION.SDK_INT >= 33) runCatching<Lens> { RefractiveLens() }.getOrElse { FrostedLens() } else FrostedLens() }
    val shape = RoundedCornerShape(radius)
    Box(modifier
        .onGloballyPositioned { origin.value = it.positionInRoot() }
        .graphicsLayer { val scale = 1f - pressure.value * .012f; scaleX = scale; scaleY = scale }
        .clip(shape)
        .drawWithContent {
            style.scene?.let { scene -> drawIntoCanvas { lens.draw(it.nativeCanvas, scene, origin.value, size.width, size.height, min(radius.toPx(), size.minDimension / 2), style.primary, style.secondary, pressure.value) } }
            drawRect(Brush.linearGradient(listOf(style.primary.copy(alpha = .065f), Color.White.copy(alpha = .025f), style.secondary.copy(alpha = .06f))))
            drawContent()
        }
        .border(1.dp, Brush.linearGradient(listOf(style.primary.copy(alpha = .80f), Color.White.copy(alpha = .26f), style.secondary.copy(alpha = .48f))), shape)
        .then(if (onClick != null) Modifier.clickable(interactionSource = interactions, indication = null, onClick = onClick) else Modifier), content = content)
}

internal const val LIQUID_GLASS_SHADER = """
uniform shader backdrop;
uniform float2 origin;
uniform float2 panelSize;
uniform float2 sceneScale;
uniform float radius;
uniform float press;
uniform float3 tintA;
uniform float3 tintB;
half4 main(float2 pixel) {
    float2 halfSize = panelSize * 0.5;
    float2 p = pixel - halfSize;
    float2 q = abs(p) - halfSize + radius;
    float distance = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
    float2 corner = max(q, 0.0);
    float2 normal = length(corner) > 0.01 ? normalize(corner) * sign(p)
        : (abs(p.x) - halfSize.x > abs(p.y) - halfSize.y ? float2(sign(p.x), 0.0) : float2(0.0, sign(p.y)));
    float thickness = max(1.0, min(radius * 0.9, 28.0));
    float bevel = 1.0 - smoothstep(0.0, thickness, -distance);
    float2 face = p / max(halfSize, float2(1.0));
    float2 offset = normal * bevel * bevel * (thickness * 0.8 + press * 3.0) + face * 2.2;
    float2 samplePoint = (pixel + origin - offset) * sceneScale;
    float2 dispersion = offset * sceneScale * 0.08;
    half3 glass = half3(backdrop.eval(samplePoint - dispersion).r,
        backdrop.eval(samplePoint).g, backdrop.eval(samplePoint + dispersion).b);
    float light = pow(max(dot(normal, normalize(float2(-0.65, -0.85))), 0.0), 3.0);
    float rim = exp(-abs(distance + 1.2) * 0.7);
    float reflection = pow(max(0.0, 1.0 - abs(face.y + 0.7 + face.x * 0.16) * 2.8), 3.0);
    float3 tint = mix(tintA, tintB, smoothstep(-1.0, 1.0, face.x));
    glass = glass * 1.12 + half3(tint * (0.022 + rim * (0.1 + light * 0.5) + reflection * 0.035 + press * 0.028));
    return half4(glass, 1.0);
}
"""
