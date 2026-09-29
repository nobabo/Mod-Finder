package io.modfinder.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.Coil
import coil.ImageLoader
import io.modfinder.app.ui.ModFinderApp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Provider assets stay out of a persistent shared HTTP/image cache.
        Coil.setImageLoader(ImageLoader.Builder(applicationContext).diskCache(null).build())
        setContent { ModFinderApp(viewModel()) }
    }
}
