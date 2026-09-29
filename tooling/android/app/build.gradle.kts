plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val workspace = rootDir.resolve("../..").canonicalFile
layout.buildDirectory.set(workspace.resolve("output/android/gradle/app"))
val endpoint = System.getenv("MODFINDER_API_URL") ?: "https://modfinder.pages.dev"
val api = java.net.URI(endpoint)
require(api.scheme == "https" && !api.host.isNullOrBlank() && api.userInfo == null && api.query == null && api.fragment == null) {
    "MODFINDER_API_URL must be an HTTPS origin."
}
val signingValues = listOf("MODFINDER_KEYSTORE_PATH", "MODFINDER_KEYSTORE_PASSWORD", "MODFINDER_KEY_ALIAS", "MODFINDER_KEY_PASSWORD").map(System::getenv)
require(signingValues.all { it.isNullOrBlank() } || signingValues.all { !it.isNullOrBlank() }) { "Provide all four Android signing variables." }

android {
    namespace = "io.modfinder.app"
    compileSdk = 36
    defaultConfig {
        applicationId = "io.modfinder.app"
        minSdk = 29
        targetSdk = 36
        versionCode = 2000
        versionName = "0.2.0"
        buildConfigField("String", "API_BASE", "\"${api.toASCIIString().trimEnd('/')}\"")
        buildConfigField("boolean", "THUNDERSTORE_PERSISTENCE", "false")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    sourceSets {
        getByName("main") {
            manifest.srcFile(workspace.resolve("src/android/AndroidManifest.xml"))
            java.setSrcDirs(listOf(workspace.resolve("src/android/kotlin")))
            res.setSrcDirs(listOf(workspace.resolve("src/android/res")))
            assets.setSrcDirs(listOf(workspace.resolve("output/android/assets")))
        }
        getByName("test").java.setSrcDirs(listOf(workspace.resolve("tooling/tests/android/unit")))
        getByName("androidTest").java.setSrcDirs(listOf(workspace.resolve("tooling/tests/android/device")))
    }
    signingConfigs {
        if (!signingValues[0].isNullOrBlank()) create("release") {
            storeFile = file(signingValues[0]!!)
            storePassword = signingValues[1]
            keyAlias = signingValues[2]
            keyPassword = signingValues[3]
        }
    }
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.findByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
    packaging { resources.excludes += setOf("META-INF/AL2.0", "META-INF/LGPL2.1") }
    lint { abortOnError = true; checkReleaseBuilds = true }
}

val prepareAssets by tasks.registering(Exec::class) {
    workingDir(workspace)
    commandLine(System.getenv("NODE_BINARY") ?: "node", "node_modules/tsx/dist/cli.mjs", "tooling/scripts/prepare-android.ts")
    inputs.dir(workspace.resolve("src/shared"))
    inputs.dir(workspace.resolve("src/web/public"))
    inputs.file(workspace.resolve("src/web/lib/themes.ts"))
    inputs.file(workspace.resolve("tooling/scripts/prepare-android.ts"))
    outputs.dir(workspace.resolve("output/android/assets"))
}
tasks.named("preBuild").configure { dependsOn(prepareAssets) }

dependencies {
    val compose = platform("androidx.compose:compose-bom:2025.05.01")
    implementation(compose)
    androidTestImplementation(compose)
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.coil-kt:coil-compose:2.7.0")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
}
