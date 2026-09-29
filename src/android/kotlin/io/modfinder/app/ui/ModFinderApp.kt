package io.modfinder.app.ui

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import io.modfinder.app.AppState
import io.modfinder.app.BuildConfig
import io.modfinder.app.ModFinderViewModel
import io.modfinder.app.data.*
import kotlinx.coroutines.flow.distinctUntilChanged
import java.text.NumberFormat

class UiStrings(private val catalog: Catalog?, val locale: String) { operator fun invoke(key: String) = catalog?.text(locale, key) ?: key }
val LocalStrings = staticCompositionLocalOf { UiStrings(null, "ko") }

@Composable fun ModFinderApp(vm: ModFinderViewModel) {
    val state by vm.state.collectAsStateWithLifecycle()
    val catalog = state.catalog
    val palette = catalog?.theme(state.local.theme) ?: Palette("magenta", "마젠타", "Magenta", "#f564a1", "#ff9d6d")
    val primary = Color(android.graphics.Color.parseColor(palette.primary))
    val secondary = Color(android.graphics.Color.parseColor(palette.secondary))
    var size by remember { mutableStateOf(IntSize.Zero) }
    val photos = remember(catalog, state.spec.gameId, state.spec.genre) { catalog?.photos(state.spec).orEmpty() }
    val scene = rememberGlassScene(photos, palette, size, state.page == "discover" && state.overlay == null && state.detail == null)
    val strings = remember(catalog, state.locale) { UiStrings(catalog, state.locale) }
    val snackbars = remember { SnackbarHostState() }
    LaunchedEffect(state.notice) { state.notice?.let { snackbars.showSnackbar(strings(it)); vm.notice(null) } }
    BackHandler(state.detail != null || state.overlay != null || state.page != "discover" || state.submitted) { vm.back() }
    MaterialTheme(colorScheme = darkColorScheme(primary = primary, secondary = secondary, background = Color(0xFF080D18), surface = Color(0xFF131A29), onSurface = Color(0xFFF1F3FA))) {
        CompositionLocalProvider(LocalGlass provides GlassStyle(scene, primary, secondary), LocalStrings provides strings) {
            Box(Modifier.fillMaxSize().background(Color(0xFF080D18)).onSizeChanged { size = it }) {
                SceneBackground(scene)
                if (catalog == null) CircularProgressIndicator(Modifier.align(Alignment.Center)) else Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
                    val home = state.page == "discover" && !state.submitted && state.overlay == null
                    if (home) {
                        Spacer(Modifier.height(22.dp))
                        BrandLogo(Modifier.size(104.dp).align(Alignment.CenterHorizontally))
                        Spacer(Modifier.height(8.dp))
                    } else Spacer(Modifier.height(12.dp))
                    SearchBar(state, vm)
                    Box(Modifier.weight(1f).fillMaxWidth()) {
                        when (state.overlay) {
                            "games" -> GamePicker(state, vm)
                            "settings" -> SettingsDeck(vm)
                            "theme" -> ThemePicker(state, vm)
                            "language" -> LanguagePicker(state, vm)
                            "filters" -> FilterPanel(state, vm)
                            "compare" -> Comparison(state, vm)
                            else -> when (state.page) {
                                "favorites" -> Favorites(state, vm)
                                "recent" -> History(state, vm)
                                else -> if (state.submitted) Results(state, vm) else Rankings(state, vm)
                            }
                        }
                    }
                    if (state.local.compared.isNotEmpty() && state.overlay == null) Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(state.local.compared.joinToString(" · ") { catalog.listingText(it, state.locale).first }, Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 12.sp)
                        TextButton(onClick = { vm.overlay("compare") }) { Text(strings("비교하기")) }
                        SmallIcon(Icons.Outlined.Close, strings("비교 선택 초기화"), vm::clearComparison)
                    }
                    BottomNavigation(state, vm)
                }
                state.detail?.let { Detail(it, state, vm) }
                SnackbarHost(snackbars, Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = 78.dp))
            }
        }
    }
}

@Composable fun BrandLogo(modifier: Modifier = Modifier) {
    val colors = LocalGlass.current
    val path = remember { PathParser().parsePathString("M72 368V144H124L186 232L248 144H440V196H300V232H412V284H300V368H248V238L186 322L124 238V368H72Z").toPath() }
    Canvas(modifier.semantics { contentDescription = "Mod Finder" }) {
        scale(size.width / 512f, size.height / 512f, androidx.compose.ui.geometry.Offset.Zero) { drawPath(path, Brush.linearGradient(listOf(colors.primary, colors.secondary), end = androidx.compose.ui.geometry.Offset(512f, 512f))) }
    }
}

@Composable private fun SmallIcon(icon: ImageVector, label: String, click: () -> Unit, tint: Color = MaterialTheme.colorScheme.onSurface, enabled: Boolean = true) {
    IconButton(onClick = click, enabled = enabled, modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp)) { Icon(icon, label, tint = if (enabled) tint else tint.copy(alpha = .3f), modifier = Modifier.size(22.dp)) }
}
@Composable private fun GameImage(game: Game?, modifier: Modifier = Modifier, logo: Boolean = false) {
    if (game == null) Icon(Icons.Outlined.Apps, null, modifier, tint = LocalGlass.current.primary)
    else AsyncImage("file:///android_asset/${(if (logo) game.logo ?: game.image else game.image)?.removePrefix("/")}", null, modifier, contentScale = ContentScale.Fit)
}

@Composable private fun SearchBar(state: AppState, vm: ModFinderViewModel) {
    val t = LocalStrings.current; val focus = LocalFocusManager.current
    val submit = { focus.clearFocus(); vm.submit() }
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        GlassSurface(Modifier.weight(1f).heightIn(min = 60.dp), radius = 30.dp) {
            Row(Modifier.fillMaxWidth().padding(start = 2.dp, end = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { focus.clearFocus(); vm.overlay("games") }, modifier = Modifier.testTag("game-picker").size(48.dp)) { GameImage(state.catalog?.game(state.spec.gameId), Modifier.size(29.dp).semantics { contentDescription = t("게임 바꾸기") }) }
                androidx.compose.foundation.text.BasicTextField(value = state.input, onValueChange = vm::input,
                    modifier = Modifier.weight(1f).padding(vertical = 18.dp).testTag("search-input").semantics { contentDescription = t("모드 검색어") }, singleLine = true,
                    textStyle = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurface), cursorBrush = Brush.verticalGradient(listOf(LocalGlass.current.primary, LocalGlass.current.secondary)),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { submit() }),
                    decorationBox = { field -> Box { if (state.input.isEmpty()) Text(t("검색할 모드를 입력하세요."), color = Color.White.copy(alpha = .48f), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis); field() } })
                SmallIcon(Icons.AutoMirrored.Outlined.ArrowForward, t("모드 검색"), submit, LocalGlass.current.primary)
            }
        }
        GlassSurface(Modifier.size(54.dp).testTag("filters"), radius = 27.dp, onClick = { focus.clearFocus(); vm.overlay("filters") }) {
            Icon(Icons.Outlined.Tune, t("검색 필터"), Modifier.align(Alignment.Center).size(23.dp), tint = LocalGlass.current.primary)
        }
    }
}

@Composable private fun BottomNavigation(state: AppState, vm: ModFinderViewModel) {
    val t = LocalStrings.current
    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
        listOf(Triple("discover", "탐색", Icons.Outlined.Explore), Triple("favorites", "즐겨찾기", Icons.Outlined.BookmarkBorder), Triple("recent", "최근 검색", Icons.Outlined.History), Triple("settings", "설정", Icons.Outlined.Tune)).forEach { (id, label, icon) ->
            val selected = if (id == "settings") state.overlay in listOf("settings", "theme", "language") else state.page == id && state.overlay == null
            Column(Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).clickable { if (id == "settings") vm.overlay("settings") else vm.page(id) }.padding(vertical = 7.dp).testTag("nav-$id"), horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(icon, null, Modifier.size(23.dp), tint = if (selected) LocalGlass.current.primary else Color.White.copy(alpha = .48f))
                Spacer(Modifier.height(4.dp)); Text(t(label), fontSize = 10.sp, color = if (selected) LocalGlass.current.primary else Color.White.copy(alpha = .58f))
            }
        }
    }
}

@Composable private fun OverlayHeader(title: String, close: () -> Unit, back: (() -> Unit)? = null) {
    val t = LocalStrings.current
    Row(Modifier.fillMaxWidth().padding(start = 12.dp, end = 8.dp, top = 14.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        if (back != null) SmallIcon(Icons.AutoMirrored.Outlined.ArrowBack, t("뒤로"), back)
        Text(t(title), Modifier.weight(1f).padding(start = 8.dp), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        SmallIcon(Icons.Outlined.Close, t("닫기"), close)
    }
}

@Composable private fun DeckCard(label: String, selected: Boolean = false, onClick: () -> Unit, image: @Composable () -> Unit) {
    GlassSurface(Modifier.width(196.dp).height(246.dp), onClick = onClick) {
        Column(Modifier.fillMaxSize().padding(22.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.height(88.dp).fillMaxWidth(), contentAlignment = Alignment.Center) { image() }
            Spacer(Modifier.height(36.dp))
            Text(label, fontSize = 15.sp, fontWeight = FontWeight.Medium, maxLines = 2, color = if (selected) LocalGlass.current.primary else Color.White)
        }
    }
}

@Composable private fun GamePicker(state: AppState, vm: ModFinderViewModel) {
    val catalog = state.catalog!!; val t = LocalStrings.current
    var query by remember { mutableStateOf("") }
    val games = catalog.games.filter { game -> query.isBlank() || (listOf(game.name, game.koreanName) + game.aliases).any { normalized(it).contains(normalized(query)) } }
    Column(Modifier.fillMaxSize()) {
        OverlayHeader("게임 선택", { vm.overlay(null) })
        SearchField(query, { query = it }, t("게임 검색"))
        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
            LazyRow(contentPadding = PaddingValues(horizontal = 24.dp, vertical = 20.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                if (query.isBlank()) item { DeckCard(t("전체 게임"), state.spec.gameId == "all", { vm.chooseGame("all") }) { Icon(Icons.Outlined.Apps, null, Modifier.size(64.dp), tint = LocalGlass.current.primary) } }
                items(games, key = { it.id }) { game -> DeckCard(game.label(state.locale), game.id == state.spec.gameId, { vm.chooseGame(game.id) }) { GameImage(game, Modifier.fillMaxSize(), logo = true) } }
            }
        }
    }
}

@Composable private fun SettingsDeck(vm: ModFinderViewModel) {
    val t = LocalStrings.current
    Column(Modifier.fillMaxSize()) {
        OverlayHeader("설정", { vm.overlay(null) })
        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
            LazyRow(contentPadding = PaddingValues(horizontal = 24.dp, vertical = 20.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                items(listOf(Triple("discover", "모드 둘러보기", Icons.Outlined.Explore), Triple("favorites", "즐겨찾기", Icons.Outlined.BookmarkBorder), Triple("recent", "최근 기록", Icons.Outlined.History), Triple("theme", "테마", Icons.Outlined.Palette), Triple("language", "언어", Icons.Outlined.Language))) { (id, label, icon) ->
                    DeckCard(t(label), onClick = { if (id in listOf("theme", "language")) vm.overlay(id) else vm.page(id) }) { Icon(icon, null, Modifier.size(62.dp), tint = LocalGlass.current.primary) }
                }
            }
        }
    }
}

@Composable private fun ThemePicker(state: AppState, vm: ModFinderViewModel) {
    Column {
        OverlayHeader("테마", { vm.overlay(null) }, { vm.overlay("settings") })
        LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(state.catalog!!.themes, key = { it.id }) { theme ->
                GlassSurface(Modifier.fillMaxWidth(), onClick = { vm.theme(theme.id) }) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(34.dp).clip(CircleShape).background(Brush.linearGradient(listOf(Color(android.graphics.Color.parseColor(theme.primary)), Color(android.graphics.Color.parseColor(theme.secondary))))))
                        Text(if (state.locale == "ko") theme.ko else theme.en, Modifier.weight(1f).padding(horizontal = 16.dp))
                        if (theme.id == state.local.theme) Icon(Icons.Outlined.Check, null, tint = LocalGlass.current.primary)
                    }
                }
            }
        }
    }
}
@Composable private fun LanguagePicker(state: AppState, vm: ModFinderViewModel) {
    val t = LocalStrings.current
    Column {
        OverlayHeader("언어", { vm.overlay(null) }, { vm.overlay("settings") })
        LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(listOf("auto" to t("자동 선택")) + state.catalog!!.languages) { (id, label) ->
                GlassSurface(Modifier.fillMaxWidth(), onClick = { vm.language(id) }) {
                    Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) { Text(label, Modifier.weight(1f)); if (id == state.local.language) Icon(Icons.Outlined.Check, null, tint = LocalGlass.current.primary) }
                }
            }
        }
    }
}

@Composable private fun SearchField(value: String, change: (String) -> Unit, label: String) {
    OutlinedTextField(value, change, Modifier.fillMaxWidth().padding(horizontal = 20.dp), placeholder = { Text(label) }, singleLine = true, shape = RoundedCornerShape(24.dp), leadingIcon = { Icon(Icons.Outlined.Search, null) })
}

@Composable private fun FilterPanel(state: AppState, vm: ModFinderViewModel) {
    val t = LocalStrings.current; val catalog = state.catalog!!
    var filters by remember { mutableStateOf(state.spec.filters) }
    var categories by remember { mutableStateOf(state.spec.categories) }
    var sort by remember { mutableStateOf(state.spec.sort) }
    var genre by remember { mutableStateOf(state.spec.genre) }
    var query by remember { mutableStateOf("") }
    var selectVersion by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize()) {
        OverlayHeader("검색 필터", { vm.overlay(null) })
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
            ChoiceRail("정렬", listOf("relevance" to t("관련도"), "downloads" to t("다운로드"), "popular" to t("인기순"), "updated" to t("최근 업데이트")), sort) { sort = it }
            if (state.spec.gameId == "minecraft-java") {
                Spacer(Modifier.height(14.dp))
                GlassSurface(Modifier.fillMaxWidth(), onClick = { selectVersion = !selectVersion }) {
                    Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) { Text(t("게임 버전"), Modifier.weight(1f)); Text(filters["version"] ?: t("전체"), color = LocalGlass.current.primary); Icon(Icons.Outlined.ExpandMore, null) }
                }
                if (selectVersion) {
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth(), placeholder = { Text(t("게임 버전")) }, singleLine = true, shape = RoundedCornerShape(18.dp))
                    if (state.versionsLoading) LinearProgressIndicator(Modifier.fillMaxWidth())
                    LazyColumn(Modifier.heightIn(max = 190.dp)) {
                        item { TextButton(onClick = { filters = filters - "version"; selectVersion = false }) { Text(t("전체")) } }
                        items(state.versions.filter { it.contains(query, ignoreCase = true) }) { version -> TextButton(onClick = { filters = filters + ("version" to version); selectVersion = false }) { Text(version) } }
                    }
                }
                ChoiceRail("로더", listOf("" to t("전체"), "fabric" to "Fabric", "forge" to "Forge", "neoforge" to "NeoForge", "quilt" to "Quilt"), filters["loader"].orEmpty()) { filters = filters + ("loader" to it) }
                ChoiceRail("종류", listOf("" to t("전체"), "mod" to t("모드"), "modpack" to t("모드팩"), "resourcepack" to t("리소스팩"), "shader" to t("셰이더")), filters["kind"].orEmpty()) { filters = filters + ("kind" to it) }
            }
            if (state.spec.gameId == "all") ChoiceRail("장르", listOf("all" to t("전체")) + catalog.genres.map { it.id to it.label(state.locale) }, genre) { genre = it }
            else {
                Spacer(Modifier.height(12.dp))
                catalog.categories(state.spec.gameId).chunked(2).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) { row.forEach { category ->
                        FilterChip(category.id in categories, { categories = if (category.id in categories) categories - category.id else categories + category.id }, { Text(category.label(state.locale), maxLines = 1, overflow = TextOverflow.Ellipsis) }, modifier = Modifier.weight(1f))
                    }; if (row.size == 1) Spacer(Modifier.weight(1f)) }
                }
            }
        }
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(onClick = { filters = emptyMap(); categories = emptySet(); sort = "downloads"; genre = "all" }, modifier = Modifier.weight(1f)) { Text(t("필터 초기화")) }
            Button(onClick = { vm.filters(filters, categories, sort, genre) }, modifier = Modifier.weight(1f)) { Text(t("적용")) }
        }
    }
}

@Composable private fun ChoiceRail(label: String, values: List<Pair<String, String>>, selected: String, choose: (String) -> Unit) {
    val t = LocalStrings.current
    Text(t(label), Modifier.padding(top = 16.dp, bottom = 4.dp), style = MaterialTheme.typography.labelLarge, color = Color.White.copy(alpha = .65f))
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) { values.forEach { (id, name) -> FilterChip(id == selected, { choose(id) }, { Text(name) }) } }
}

@Composable private fun Rankings(state: AppState, vm: ModFinderViewModel) {
    val t = LocalStrings.current; val catalog = state.catalog!!
    Column(Modifier.fillMaxSize().padding(top = 22.dp)) {
        if (state.spec.gameId == "minecraft-java") Row(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            FilterChip(state.rankingTab == "search", { vm.rankingTab("search") }, { Text(t("검색 순위")) })
            FilterChip(state.rankingTab == "downloads", { vm.rankingTab("downloads") }, { Text(t("다운로드 순위")) })
        }
        if (state.spec.gameId == "minecraft-java" && state.rankingTab == "search") {
            LazyColumn(contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                items(catalog.rankings, key = { it.first }) { (id, name) ->
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).clickable { vm.submit(name, "minecraft-java", "all", emptySet(), "modpack") }.padding(vertical = 16.dp, horizontal = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(catalog.packName(id, name, state.locale), Modifier.weight(1f), fontSize = 15.sp, fontWeight = FontWeight.Medium)
                        Icon(Icons.AutoMirrored.Outlined.ArrowForward, null, Modifier.size(18.dp), tint = LocalGlass.current.primary)
                    }
                    HorizontalDivider(color = LocalGlass.current.primary.copy(alpha = .15f))
                }
            }
        } else Results(state, vm, ranking = true)
    }
}

@Composable private fun Results(state: AppState, vm: ModFinderViewModel, ranking: Boolean = false) {
    val t = LocalStrings.current; val context = LocalContext.current
    val scroll = rememberLazyListState()
    LaunchedEffect(state.spec, state.submitted) { scroll.scrollToItem(0) }
    LaunchedEffect(scroll, state.hasMore, state.loading, state.groups.size) {
        snapshotFlow { scroll.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1 }.distinctUntilChanged().collect { last -> if (state.groups.isNotEmpty() && last >= state.groups.size - 2 && state.hasMore && !state.loading) vm.loadMore() }
    }
    LazyColumn(Modifier.fillMaxSize().testTag("results-list"), scroll, contentPadding = PaddingValues(horizontal = 16.dp, vertical = 18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(if (ranking) state.groups.filter { it.item.downloads != null } else state.groups, key = { it.id }) { group -> ModRow(group.item, state, vm, group.listings) }
        if (state.loading) item { Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(Modifier.size(26.dp), strokeWidth = 2.dp) } }
        if (!state.loading && state.groups.isEmpty()) item {
            Column(Modifier.fillMaxWidth().padding(vertical = 36.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Outlined.Search, null, Modifier.size(32.dp), tint = LocalGlass.current.primary)
                Spacer(Modifier.height(14.dp))
                Text(t(if (state.buckets.values.any { it.result?.status == "error" }) "잠시 검색에 연결하지 못했어요" else "검색 결과가 없어요"), fontSize = 14.sp)
                TextButton(onClick = vm::retry) { Text(t("다시 시도")) }
            }
        }
        val failures = state.buckets.values.filter { it.result?.status !in listOf("success", "empty") && it.result != null }
        if (failures.isNotEmpty() && state.groups.isNotEmpty()) item { TextButton(onClick = vm::retry) { Icon(Icons.Outlined.Refresh, null, Modifier.size(16.dp)); Spacer(Modifier.width(8.dp)); Text(t("다시 시도")) } }
        failures.mapNotNull { bucket -> bucket.result?.externalUrl?.let { bucket.request.source to it } }.distinct().forEach { (source, url) ->
            item { OutlinedButton(onClick = { openSource(context, url, vm) }) { Text(sourceNames[source].orEmpty()); Spacer(Modifier.width(8.dp)); Icon(Icons.AutoMirrored.Outlined.OpenInNew, null, Modifier.size(16.dp)) } }
        }
        if (state.hasMore && !state.loading) item { TextButton(onClick = vm::loadMore, modifier = Modifier.fillMaxWidth()) { Text(t("모드 더 보기")) } }
    }
}

@Composable private fun ModRow(item: Listing, state: AppState, vm: ModFinderViewModel, alternatives: List<Listing> = listOf(item), move: (() -> Unit)? = null) {
    val t = LocalStrings.current; val context = LocalContext.current
    val text = state.catalog!!.listingText(item, state.locale)
    val candidate = alternatives.firstOrNull { it.canPersist(BuildConfig.THUNDERSTORE_PERSISTENCE) }
    val saved = state.local.favorites.any { it.key == candidate?.key }
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Color(0x660B1220)).border(1.dp, LocalGlass.current.primary.copy(alpha = .25f), RoundedCornerShape(24.dp)).padding(14.dp), verticalAlignment = Alignment.Top) {
        AsyncImage(item.iconUrl, text.first, Modifier.size(54.dp).clip(RoundedCornerShape(15.dp)).background(LocalGlass.current.primary.copy(alpha = .10f)).clickable { openSource(context, item.url, vm) }, contentScale = ContentScale.Fit)
        Spacer(Modifier.width(13.dp))
        Column(Modifier.weight(1f).clickable { vm.detail(item) }.padding(vertical = 3.dp)) {
            Text(text.first, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (text.second.isNotEmpty()) { Spacer(Modifier.height(7.dp)); Text(text.second, fontSize = 12.sp, lineHeight = 18.sp, color = Color.White.copy(alpha = .65f), maxLines = 3, overflow = TextOverflow.Ellipsis) }
        }
        Column {
            if (candidate != null) SmallIcon(if (saved) Icons.Outlined.Bookmark else Icons.Outlined.BookmarkBorder, t(if (saved) "저장 해제" else "즐겨찾기"), { vm.toggleFavorite(candidate) }, if (saved) LocalGlass.current.primary else Color.White.copy(alpha = .6f), state.hydrated)
            if (move != null) SmallIcon(Icons.Outlined.FolderOpen, t("폴더로 이동"), move)
        }
    }
}

private fun openSource(context: Context, url: String, vm: ModFinderViewModel) {
    val safe = safeExternalUrl(url)
    if (safe == null) { vm.notice("링크를 열지 못했어요. 주소를 확인해 주세요."); return }
    try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(safe)).addCategory(Intent.CATEGORY_BROWSABLE)) }
    catch (_: ActivityNotFoundException) { vm.notice("링크를 열지 못했어요. 주소를 확인해 주세요.") }
}

@Composable private fun Favorites(state: AppState, vm: ModFinderViewModel) {
    val t = LocalStrings.current
    var editing by remember { mutableStateOf<String?>(null) }
    var folderName by remember { mutableStateOf("") }
    var moving by remember { mutableStateOf<String?>(null) }
    val selected = state.local.folders.find { it.id == state.selectedFolder }
    val visible = state.local.favorites.filter { item -> when (state.selectedFolder) { "all" -> true; "unfiled" -> state.local.folders.none { item.key in it.keys }; else -> selected?.keys?.contains(item.key) == true } }
    Column {
        Row(Modifier.fillMaxWidth().padding(start = 20.dp, top = 18.dp, end = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(t("즐겨찾기"), Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
            SmallIcon(Icons.Outlined.CreateNewFolder, t("새 폴더"), { editing = ""; folderName = "" }, enabled = state.hydrated)
            if (selected != null) { SmallIcon(Icons.Outlined.Edit, t("폴더 이름 변경"), { editing = selected.id; folderName = selected.name }); SmallIcon(Icons.Outlined.DeleteOutline, t("폴더 삭제"), { vm.deleteFolder(selected.id) }) }
        }
        LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(listOf("all" to t("전체"), "unfiled" to t("미분류")) + state.local.folders.map { it.id to it.name }) { (id, name) -> FilterChip(state.selectedFolder == id, { vm.folder(id) }, { Text(name) }) }
        }
        LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(visible, key = { it.key }) { item -> ModRow(item, state, vm, move = { moving = item.key }) }
            if (visible.isEmpty()) item { Box(Modifier.fillMaxWidth().padding(60.dp), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.BookmarkBorder, t("아직 저장한 모드가 없어요"), Modifier.size(36.dp), tint = LocalGlass.current.primary) } }
        }
    }
    if (editing != null) AlertDialog(onDismissRequest = { editing = null }, title = { Text(t(if (editing!!.isEmpty()) "새 폴더" else "폴더 이름 변경")) }, text = { OutlinedTextField(folderName, { folderName = it.take(40) }, singleLine = true) }, confirmButton = { TextButton(onClick = { if (vm.saveFolder(editing!!.ifEmpty { null }, folderName)) editing = null }) { Text(t("저장")) } }, dismissButton = { TextButton(onClick = { editing = null }) { Text(t("닫기")) } })
    if (moving != null) AlertDialog(onDismissRequest = { moving = null }, title = { Text(t("폴더로 이동")) }, text = { Column(Modifier.verticalScroll(rememberScrollState())) { (listOf<String?>(null) + state.local.folders.map { it.id }).forEach { id -> TextButton(onClick = { vm.moveFavorite(moving!!, id); moving = null }) { Text(state.local.folders.find { it.id == id }?.name ?: t("미분류")) } } } }, confirmButton = { TextButton(onClick = { moving = null }) { Text(t("닫기")) } })
}

@Composable private fun History(state: AppState, vm: ModFinderViewModel) {
    val t = LocalStrings.current
    Column {
        Row(Modifier.fillMaxWidth().padding(start = 20.dp, top = 18.dp, end = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(t("최근 검색"), Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
            if (state.local.history.isNotEmpty()) SmallIcon(Icons.Outlined.DeleteOutline, t("검색 기록 지우기"), vm::clearHistory)
        }
        LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(state.local.history) { entry -> GlassSurface(Modifier.fillMaxWidth(), onClick = { vm.submit(entry.query, entry.gameId, entry.genre, entry.categories) }) {
                Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Outlined.History, null, tint = LocalGlass.current.primary); Column(Modifier.weight(1f).padding(horizontal = 14.dp)) { Text(entry.query, maxLines = 2); Text(state.catalog!!.game(entry.gameId)?.label(state.locale) ?: t("전체 게임"), fontSize = 11.sp, color = Color.White.copy(alpha = .5f)) }; Icon(Icons.AutoMirrored.Outlined.ArrowForward, null, Modifier.size(18.dp)) }
            } }
            if (state.local.history.isEmpty()) item { Box(Modifier.fillMaxWidth().padding(60.dp), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.History, t("새로운 발견을 시작해 보세요"), Modifier.size(36.dp), tint = LocalGlass.current.primary) } }
        }
    }
}

@Composable private fun Detail(item: Listing, state: AppState, vm: ModFinderViewModel) {
    val t = LocalStrings.current; val context = LocalContext.current; val catalog = state.catalog!!
    val text = catalog.listingText(item, state.locale)
    var original by remember(item.key) { mutableStateOf(false) }
    val saved = state.local.favorites.any { it.key == item.key }
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .55f)).clickable { vm.detail(null) }) {
        GlassSurface(Modifier.align(Alignment.BottomCenter).fillMaxWidth().fillMaxHeight(.88f).navigationBarsPadding().clickable { }, radius = 28.dp) {
            Column(Modifier.fillMaxSize()) {
                OverlayHeader(text.first, { vm.detail(null) })
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        AsyncImage(item.iconUrl, null, Modifier.size(72.dp).clip(RoundedCornerShape(20.dp)), contentScale = ContentScale.Fit)
                        Column(Modifier.padding(start = 18.dp)) { Text(sourceNames[item.source].orEmpty(), color = LocalGlass.current.primary); Text(item.author ?: t("제작자 정보 없음"), fontSize = 12.sp, color = Color.White.copy(alpha = .65f)) }
                    }
                    Spacer(Modifier.height(24.dp))
                    Text(if (original) item.summary else text.second.ifEmpty { t("원본 사이트에서 자세한 설명을 확인해 주세요.") }, fontSize = 14.sp, lineHeight = 23.sp)
                    if (text.second != item.summary) TextButton(onClick = { original = !original }) { Text(t("원문 보기")) }
                    Spacer(Modifier.height(18.dp))
                    DetailValue(t("게임"), catalog.game(item.gameId)?.label(state.locale) ?: t("정보 없음"))
                    DetailValue(t("게임 버전"), item.versions?.joinToString(", ")?.ifEmpty { null } ?: t("정보 없음"))
                    DetailValue(t("로더"), item.loaders?.joinToString(", ")?.ifEmpty { null } ?: t("정보 없음"))
                    DetailValue(t("업데이트"), item.updatedAt?.take(10) ?: t("정보 없음"))
                    DetailValue(t("조회 시각"), item.fetchedAt.replace('T', ' ').take(19))
                    item.metrics.forEach { DetailValue(t(it.label), NumberFormat.getNumberInstance().format(it.value)) }
                    Spacer(Modifier.height(12.dp)); Text(t("버전 정보가 표시되어도 다른 모드와의 호환성을 보장하지 않아요."), fontSize = 11.sp, color = Color.White.copy(alpha = .5f))
                    if (item.canPersist(BuildConfig.THUNDERSTORE_PERSISTENCE)) TextButton(onClick = { vm.compare(item) }, enabled = state.hydrated && (state.local.compared.size < 3 || state.local.compared.any { it.key == item.key })) { Icon(Icons.Outlined.CompareArrows, null); Spacer(Modifier.width(8.dp)); Text(t("비교하기")); if (state.local.compared.any { it.key == item.key }) Icon(Icons.Outlined.Check, null) }
                }
                Row(Modifier.fillMaxWidth().padding(18.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (item.canPersist(BuildConfig.THUNDERSTORE_PERSISTENCE)) OutlinedButton(onClick = { vm.toggleFavorite(item) }, enabled = state.hydrated) { Icon(if (saved) Icons.Outlined.Bookmark else Icons.Outlined.BookmarkBorder, t("즐겨찾기")) }
                    Button(onClick = { openSource(context, item.url, vm) }, modifier = Modifier.weight(1f)) { Text(t("원본 사이트에서 보기"), maxLines = 1); Spacer(Modifier.width(8.dp)); Icon(Icons.AutoMirrored.Outlined.OpenInNew, null, Modifier.size(16.dp)) }
                }
            }
        }
    }
}
@Composable private fun DetailValue(name: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 9.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) { Text(name, Modifier.width(86.dp), fontSize = 12.sp, color = Color.White.copy(alpha = .6f)); Text(value, Modifier.weight(1f), fontSize = 12.sp) }
}
@Composable private fun Comparison(state: AppState, vm: ModFinderViewModel) {
    val t = LocalStrings.current
    Column {
        OverlayHeader("비교하기", { vm.overlay(null) })
        LazyRow(contentPadding = PaddingValues(20.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            items(state.local.compared, key = { it.key }) { item -> GlassSurface(Modifier.width(260.dp)) {
                Column(Modifier.padding(18.dp).verticalScroll(rememberScrollState())) {
                    Text(state.catalog!!.listingText(item, state.locale).first, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(18.dp))
                    DetailValue(t("출처"), sourceNames[item.source].orEmpty())
                    DetailValue(t("게임 버전"), item.versions?.joinToString(", ") ?: t("정보 없음"))
                    DetailValue(t("로더"), item.loaders?.joinToString(", ") ?: t("정보 없음"))
                    DetailValue(t("다운로드"), item.downloads?.let { NumberFormat.getNumberInstance().format(it) } ?: t("정보 없음"))
                    TextButton(onClick = { vm.detail(item) }) { Text(t("자세히 보기")) }
                }
            } }
        }
    }
}
