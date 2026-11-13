package com.swipephotocleaner.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.swipephotocleaner.app.data.MediaBitmapLoader
import com.swipephotocleaner.app.model.LocalMediaItem
import com.swipephotocleaner.app.model.MediaFilter
import com.swipephotocleaner.app.model.MediaFormatters
import com.swipephotocleaner.app.model.MonthBucket
import com.swipephotocleaner.app.model.SwipeDecision
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.max

@Composable
fun SwipeDeckScreen(
    uiState: CleanerUiState,
    bitmapLoader: MediaBitmapLoader,
    hasPartialPermission: Boolean,
    onRequestMoreAccess: () -> Unit,
    onRefresh: () -> Unit,
    onSelectMonth: (String) -> Unit,
    onSelectFilter: (MediaFilter) -> Unit,
    onDecide: (Long, SwipeDecision) -> Unit,
    onUndo: () -> Unit,
    onOpenReview: () -> Unit,
    onCloseReview: () -> Unit,
    onRescueTrashItem: (Long) -> Unit,
    onRemoveFavoriteItem: (Long) -> Unit,
    onConfirmCommit: () -> Unit,
    onResetKept: () -> Unit,
    onClearStatusMessage: () -> Unit
) {
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(uiState.statusMessage) {
        val msg = uiState.statusMessage ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(msg)
        onClearStatusMessage()
    }

    val topItem = uiState.deckItems.firstOrNull()
    LaunchedEffect(topItem?.contentUriString) {
        for (upcoming in uiState.deckItems.take(3)) {
            launch { bitmapLoader.loadPreview(upcoming) }
        }
    }

    // Shared fly-out trigger for both drag and bottom action buttons
    var pendingButtonAction by remember { mutableStateOf<Pair<String, SwipeDecision>?>(null) }

    Scaffold(
        containerColor = CleanerColors.Bg,
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            TopHeaderBar(
                uiState = uiState,
                onSelectFilter = onSelectFilter,
                onRefresh = onRefresh,
                onOpenReview = onOpenReview
            )

            if (hasPartialPermission) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0x28F59E0B))
                        .padding(horizontal = 12.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Đang chọn ảnh giới hạn",
                        color = Color(0xFFFDE68A),
                        fontSize = 11.5.sp,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = "Chọn thêm ảnh",
                        color = CleanerColors.SkyAccent,
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable(onClick = onRequestMoreAccess)
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    )
                }
            }

            MonthBucketsStrip(
                buckets = uiState.monthBuckets,
                selectedMonth = uiState.selectedMonth,
                onSelectMonth = onSelectMonth
            )

            // Main photo stage maximized to fill available screen area
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp, vertical = 2.dp),
                contentAlignment = Alignment.Center
            ) {
                when {
                    uiState.isLoading && uiState.totalMediaCount == 0 -> {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            CircularProgressIndicator(color = CleanerColors.SkyAccent)
                            Text("Đang quét ảnh & video theo từng tháng...", color = CleanerColors.TextMuted)
                        }
                    }

                    uiState.deckItems.isEmpty() -> {
                        EmptyMonthCard(
                            uiState = uiState,
                            onSelectMonth = onSelectMonth,
                            onOpenReview = onOpenReview,
                            onResetKept = onResetKept
                        )
                    }

                    else -> {
                        val visibleStack = uiState.deckItems.take(2)
                        if (visibleStack.size > 1) {
                            val nextItem = visibleStack[1]
                            key(nextItem.contentUriString) {
                                SwipePhotoCard(
                                    item = nextItem,
                                    bitmapLoader = bitmapLoader,
                                    isTop = false,
                                    externalAction = null,
                                    onConsumeExternalAction = {},
                                    onSwiped = {},
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .graphicsLayer {
                                            scaleX = 0.97f
                                            scaleY = 0.97f
                                            translationY = 10f
                                            alpha = 0.35f
                                        }
                                )
                            }
                        }

                        val activeItem = visibleStack[0]
                        key(activeItem.contentUriString) {
                            SwipePhotoCard(
                                item = activeItem,
                                bitmapLoader = bitmapLoader,
                                isTop = true,
                                externalAction = pendingButtonAction?.takeIf { it.first == activeItem.contentUriString }?.second,
                                onConsumeExternalAction = { pendingButtonAction = null },
                                onSwiped = { decision -> onDecide(activeItem.id, decision) },
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                    }
                }
            }

            ActionDock(
                canUndo = uiState.canUndo,
                hasCard = topItem != null,
                onUndo = onUndo,
                onTrash = {
                    if (topItem != null) pendingButtonAction = topItem.contentUriString to SwipeDecision.TRASH
                },
                onFavorite = {
                    if (topItem != null) pendingButtonAction = topItem.contentUriString to SwipeDecision.FAVORITE
                },
                onKeep = {
                    if (topItem != null) pendingButtonAction = topItem.contentUriString to SwipeDecision.KEEP
                }
            )
        }
    }

    if (uiState.showReviewSheet) {
        ReviewTrashDialog(
            summary = uiState.summary,
            bitmapLoader = bitmapLoader,
            onRescueTrashItem = onRescueTrashItem,
            onRemoveFavoriteItem = onRemoveFavoriteItem,
            onConfirmCommit = onConfirmCommit,
            onDismiss = onCloseReview
        )
    }
}

@Composable
private fun TopHeaderBar(
    uiState: CleanerUiState,
    onSelectFilter: (MediaFilter) -> Unit,
    onRefresh: () -> Unit,
    onOpenReview: () -> Unit
) {
    val trashCount = uiState.summary.pendingTrashItems.size
    val favCount = uiState.summary.pendingFavoriteItems.size
    val freedPreview = MediaFormatters.formatBytes(uiState.summary.pendingTrashBytes)
    val hasPending = trashCount > 0 || favCount > 0
    var filterMenuExpanded by remember { mutableStateOf(false) }

    val activeFilterLabel = when (uiState.activeFilter) {
        MediaFilter.ALL -> "Tất cả"
        MediaFilter.SCREENSHOT -> "Chụp MH"
        MediaFilter.VIDEO -> "Video"
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Box {
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(CleanerColors.SurfaceAlt)
                    .border(1.dp, CleanerColors.Border, RoundedCornerShape(999.dp))
                    .clickable { filterMenuExpanded = true }
                    .padding(horizontal = 11.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Text(
                    text = "$activeFilterLabel (${uiState.deckItems.size})",
                    color = CleanerColors.TextPrimary,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "▾",
                    color = CleanerColors.TextMuted,
                    fontSize = 11.sp
                )
            }

            DropdownMenu(
                expanded = filterMenuExpanded,
                onDismissRequest = { filterMenuExpanded = false },
                containerColor = CleanerColors.Surface
            ) {
                val options = listOf(
                    MediaFilter.ALL to "Tất cả ảnh & video",
                    MediaFilter.SCREENSHOT to "📱 Ảnh chụp màn hình",
                    MediaFilter.VIDEO to "🎬 Video"
                )
                for ((filter, label) in options) {
                    val selected = filter == uiState.activeFilter
                    DropdownMenuItem(
                        text = {
                            Text(
                                text = label,
                                color = if (selected) CleanerColors.SkyAccent else CleanerColors.TextPrimary,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                                fontSize = 13.5.sp
                            )
                        },
                        onClick = {
                            filterMenuExpanded = false
                            onSelectFilter(filter)
                        }
                    )
                }
            }
        }

        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(CleanerColors.SurfaceAlt)
                    .border(1.dp, CleanerColors.Border, CircleShape)
                    .clickable(onClick = onRefresh),
                contentAlignment = Alignment.Center
            ) {
                Text("↻", color = CleanerColors.TextMuted, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(
                        if (hasPending) {
                            Brush.linearGradient(listOf(Color(0xFFF43F5E), Color(0xFFE11D48)))
                        } else {
                            Brush.linearGradient(listOf(CleanerColors.SurfaceAlt, CleanerColors.SurfaceAlt))
                        }
                    )
                    .border(1.dp, CleanerColors.Border, RoundedCornerShape(999.dp))
                    .clickable(onClick = onOpenReview)
                    .padding(horizontal = 11.dp, vertical = 6.dp)
            ) {
                Text(
                    text = if (trashCount > 0) {
                        "🗑️ $trashCount • $freedPreview"
                    } else if (favCount > 0) {
                        "♥ $favCount"
                    } else {
                        "🗑️ 0"
                    },
                    color = if (hasPending) Color.White else CleanerColors.TextMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun MonthBucketsStrip(
    buckets: List<MonthBucket>,
    selectedMonth: String,
    onSelectMonth: (String) -> Unit
) {
    val totalRemaining = buckets.sumOf { it.remainingCount }

    LazyRow(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 3.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        item(key = "all") {
            val active = selectedMonth == "all"
            CompactMonthPill(
                label = "Tất cả ($totalRemaining)",
                trashCount = 0,
                active = active,
                done = totalRemaining == 0 && buckets.isNotEmpty(),
                onClick = { onSelectMonth("all") }
            )
        }

        items(buckets, key = { it.monthKey }) { bucket ->
            val isDone = bucket.remainingCount == 0
            val shortName = MediaFormatters.formatShortMonthLabel(bucket.monthKey)
            val label = if (isDone) "$shortName ✓" else "$shortName (${bucket.remainingCount})"

            CompactMonthPill(
                label = label,
                trashCount = bucket.pendingTrashCount,
                active = selectedMonth == bucket.monthKey,
                done = isDone,
                onClick = { onSelectMonth(bucket.monthKey) }
            )
        }
    }
}

@Composable
private fun CompactMonthPill(
    label: String,
    trashCount: Int,
    active: Boolean,
    done: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(
                when {
                    active -> Color(0x2E38BDF8)
                    done -> Color(0x80121826)
                    else -> CleanerColors.Surface
                }
            )
            .border(
                1.dp,
                if (active) Color(0xAA38BDF8) else CleanerColors.Border,
                RoundedCornerShape(999.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Text(
            text = label,
            color = when {
                active -> Color(0xFFBAE6FD)
                done -> CleanerColors.TextMuted
                else -> CleanerColors.TextPrimary
            },
            fontSize = 11.5.sp,
            fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
            maxLines = 1
        )
        if (trashCount > 0) {
            Text(
                text = "-$trashCount",
                color = Color(0xFFFDA4AF),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(Color(0x40F43F5E))
                    .padding(horizontal = 5.dp, vertical = 1.dp)
            )
        }
    }
}

@Composable
private fun SwipePhotoCard(
    item: LocalMediaItem,
    bitmapLoader: MediaBitmapLoader,
    isTop: Boolean,
    externalAction: SwipeDecision?,
    onConsumeExternalAction: () -> Unit,
    onSwiped: (SwipeDecision) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val cardKey = item.contentUriString
    val offsetX = remember(cardKey) { Animatable(0f) }
    val offsetY = remember(cardKey) { Animatable(0f) }
    var isAnimatingOut by remember(cardKey) { mutableStateOf(false) }

    var zoomed by remember(cardKey) { mutableStateOf(false) }
    var panX by remember(cardKey) { mutableFloatStateOf(0f) }
    var panY by remember(cardKey) { mutableFloatStateOf(0f) }
    var stageSize by remember { mutableStateOf(IntSize.Zero) }

    var preview by remember(cardKey) { mutableStateOf(bitmapLoader.getCachedPreview(item)) }
    var loadFinished by remember(cardKey) { mutableStateOf(preview != null) }

    LaunchedEffect(cardKey) {
        if (preview == null) {
            preview = bitmapLoader.loadPreview(item)
        }
        loadFinished = true
    }

    suspend fun flyOutAndCommit(decision: SwipeDecision) {
        if (isAnimatingOut) return
        isAnimatingOut = true
        zoomed = false
        panX = 0f
        panY = 0f
        val flyX = max(stageSize.width.toFloat(), 1200f) + 250f
        val flyY = max(stageSize.height.toFloat(), 1400f) + 250f
        coroutineScope {
            when (decision) {
                SwipeDecision.KEEP -> {
                    launch { offsetY.animateTo(-40f, tween(180)) }
                    offsetX.animateTo(flyX, tween(200))
                }
                SwipeDecision.TRASH -> {
                    launch { offsetY.animateTo(-40f, tween(180)) }
                    offsetX.animateTo(-flyX, tween(200))
                }
                SwipeDecision.FAVORITE -> {
                    offsetY.animateTo(-flyY, tween(200))
                }
            }
        }
        onSwiped(decision)
    }

    LaunchedEffect(externalAction) {
        val action = externalAction ?: return@LaunchedEffect
        onConsumeExternalAction()
        flyOutAndCommit(action)
    }

    val dx = offsetX.value
    val dy = offsetY.value
    val keepAlpha = ((dx - 35f) / 180f).coerceIn(0f, 1f)
    val trashAlpha = ((-dx - 35f) / 180f).coerceIn(0f, 1f)
    val favAlpha = if (dy < -35f && abs(dy) > abs(dx) * 1.1f) {
        ((-dy - 35f) / 160f).coerceIn(0f, 1f)
    } else 0f

    val interactionModifier = if (isTop) {
        Modifier
            .pointerInput(cardKey, "tap") {
                detectTapGestures(
                    onDoubleTap = { tapOffset ->
                        if (isAnimatingOut) return@detectTapGestures
                        if (zoomed) {
                            zoomed = false
                            panX = 0f
                            panY = 0f
                        } else {
                            zoomed = true
                            val w = stageSize.width.toFloat().coerceAtLeast(1f)
                            val h = stageSize.height.toFloat().coerceAtLeast(1f)
                            val zoomFactor = 2.0f
                            val maxPanX = w * (zoomFactor - 1f) / 2f
                            val maxPanY = h * (zoomFactor - 1f) / 2f
                            panX = ((w / 2f - tapOffset.x) * (zoomFactor - 1f)).coerceIn(-maxPanX, maxPanX)
                            panY = ((h / 2f - tapOffset.y) * (zoomFactor - 1f)).coerceIn(-maxPanY, maxPanY)
                        }
                    }
                )
            }
            .pointerInput(cardKey, "drag") {
                detectDragGestures(
                    onDragEnd = {
                        if (isAnimatingOut || zoomed) return@detectDragGestures
                        scope.launch {
                            when {
                                offsetY.value < -185f && abs(offsetY.value) > abs(offsetX.value) * 1.1f -> {
                                    flyOutAndCommit(SwipeDecision.FAVORITE)
                                }
                                offsetX.value > 210f -> {
                                    flyOutAndCommit(SwipeDecision.KEEP)
                                }
                                offsetX.value < -210f -> {
                                    flyOutAndCommit(SwipeDecision.TRASH)
                                }
                                else -> {
                                    launch { offsetX.animateTo(0f, spring(stiffness = Spring.StiffnessMedium)) }
                                    launch { offsetY.animateTo(0f, spring(stiffness = Spring.StiffnessMedium)) }
                                }
                            }
                        }
                    },
                    onDragCancel = {
                        if (zoomed) return@detectDragGestures
                        scope.launch {
                            launch { offsetX.animateTo(0f, spring()) }
                            launch { offsetY.animateTo(0f, spring()) }
                        }
                    },
                    onDrag = { change, dragAmount ->
                        if (isAnimatingOut) return@detectDragGestures
                        change.consume()
                        if (zoomed) {
                            val zoomFactor = 2.0f
                            val maxPanX = stageSize.width.toFloat() * (zoomFactor - 1f) / 2f
                            val maxPanY = stageSize.height.toFloat() * (zoomFactor - 1f) / 2f
                            panX = (panX + dragAmount.x).coerceIn(-maxPanX, maxPanX)
                            panY = (panY + dragAmount.y).coerceIn(-maxPanY, maxPanY)
                        } else {
                            scope.launch {
                                offsetX.snapTo(offsetX.value + dragAmount.x)
                                offsetY.snapTo(offsetY.value + dragAmount.y)
                            }
                        }
                    }
                )
            }
    } else {
        Modifier
    }

    Box(
        modifier = modifier
            .graphicsLayer {
                translationX = dx
                translationY = dy
                rotationZ = dx * 0.025f
            }
            .onSizeChanged { stageSize = it }
            .then(interactionModifier)
            .clip(RoundedCornerShape(16.dp))
            .background(Color.Black)
            .border(0.5.dp, Color(0x18FFFFFF), RoundedCornerShape(16.dp)),
        contentAlignment = Alignment.Center
    ) {
        if (preview != null) {
            Image(
                bitmap = preview!!,
                contentDescription = item.displayName,
                contentScale = ContentScale.Fit,
                filterQuality = FilterQuality.High,
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        if (zoomed) {
                            scaleX = 2.0f
                            scaleY = 2.0f
                            translationX = panX
                            translationY = panY
                        }
                    }
            )
        } else if (!loadFinished) {
            CircularProgressIndicator(
                color = CleanerColors.SkyAccent,
                modifier = Modifier.size(30.dp)
            )
        } else {
            Text(
                text = "Không hiển thị được ảnh này\n(${item.displayName})",
                color = CleanerColors.TextMuted,
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(24.dp)
            )
        }

        // Subtle zoom hint pill only when zoomed in
        if (isTop && zoomed) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 12.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(Color(0xB8000000))
                    .clickable {
                        zoomed = false
                        panX = 0f
                        panY = 0f
                    }
                    .padding(horizontal = 10.dp, vertical = 4.dp)
            ) {
                Text(
                    text = "2x • Chạm đúp để thu vừa",
                    color = Color.White,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }

        // Minimal bottom whisper strip (zero extra vertical space stolen from photo)
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        listOf(Color.Transparent, Color(0x94000000))
                    )
                )
                .padding(horizontal = 12.dp, vertical = 9.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            val parts = buildList {
                val d = MediaFormatters.formatDateShort(item.dateTakenMs)
                if (d.isNotEmpty()) add(d)
                add(MediaFormatters.formatBytes(item.sizeBytes))
                if (item.isVideo) {
                    val dur = MediaFormatters.formatDuration(item.durationMs)
                    add(if (dur.isNotEmpty()) "🎬 $dur" else "🎬 Video")
                }
                if (item.isAlreadyFavorite) add("♥")
            }
            Text(
                text = parts.joinToString(" • "),
                color = Color(0xE0FFFFFF),
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )

            if (isTop && item.isVideo) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(Color(0xC80F172A))
                        .border(0.5.dp, Color(0x40FFFFFF), RoundedCornerShape(999.dp))
                        .clickable {
                            runCatching {
                                val intent = Intent(Intent.ACTION_VIEW).apply {
                                    setDataAndType(Uri.parse(item.contentUriString), "video/*")
                                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                }
                                context.startActivity(intent)
                            }
                        }
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text("▶ Phát", color = Color.White, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        // Directional stamps appear only while swiping
        if (keepAlpha > 0.02f) {
            SwipeStamp(
                text = "GIỮ LẠI ✓",
                color = CleanerColors.KeepGreen,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(top = 40.dp, start = 20.dp)
                    .alpha(keepAlpha)
                    .graphicsLayer { rotationZ = -12f }
            )
        }
        if (trashAlpha > 0.02f) {
            SwipeStamp(
                text = "CHỜ XÓA (-${MediaFormatters.formatBytes(item.sizeBytes)})",
                color = CleanerColors.TrashRose,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 40.dp, end = 20.dp)
                    .alpha(trashAlpha)
                    .graphicsLayer { rotationZ = 12f }
            )
        }
        if (favAlpha > 0.02f) {
            SwipeStamp(
                text = "YÊU THÍCH ♥",
                color = CleanerColors.FavoriteAmber,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 52.dp)
                    .alpha(favAlpha)
            )
        }
    }
}

@Composable
private fun SwipeStamp(text: String, color: Color, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(color.copy(alpha = 0.16f))
            .border(3.dp, color, RoundedCornerShape(12.dp))
            .padding(horizontal = 14.dp, vertical = 7.dp)
    ) {
        Text(
            text = text,
            color = color,
            fontSize = 19.sp,
            fontWeight = FontWeight.Black
        )
    }
}

@Composable
private fun EmptyMonthCard(
    uiState: CleanerUiState,
    onSelectMonth: (String) -> Unit,
    onOpenReview: () -> Unit,
    onResetKept: () -> Unit
) {
    val selectedLabel = MediaFormatters.formatMonthLabel(uiState.selectedMonth)
    val nextBucket = uiState.monthBuckets.firstOrNull {
        it.remainingCount > 0 && it.monthKey != uiState.selectedMonth
    }
    val hasPending = uiState.summary.pendingTrashItems.isNotEmpty() || uiState.summary.pendingFavoriteItems.isNotEmpty()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 10.dp)
            .clip(RoundedCornerShape(22.dp))
            .background(CleanerColors.Surface)
            .border(1.dp, CleanerColors.Border, RoundedCornerShape(22.dp))
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = if (uiState.totalMediaCount == 0) "📷" else "🎉",
            fontSize = 42.sp
        )
        Text(
            text = if (uiState.totalMediaCount == 0) {
                "Không tìm thấy ảnh/video nào trên máy"
            } else {
                "Đã quẹt xong $selectedLabel!"
            },
            color = CleanerColors.TextPrimary,
            fontSize = 18.sp,
            fontWeight = FontWeight.ExtraBold,
            textAlign = TextAlign.Center
        )
        Text(
            text = if (uiState.totalMediaCount == 0) {
                "Nếu bạn chọn bộ lọc Ảnh chụp màn hình / Video mà không có mục nào, thử chuyển sang Tất cả."
            } else {
                "Bạn có thể chuyển sang tháng tiếp theo hoặc mở Xem trước để dọn vào Thùng rác."
            },
            color = CleanerColors.TextMuted,
            fontSize = 13.sp,
            textAlign = TextAlign.Center
        )

        if (nextBucket != null) {
            Button(
                onClick = { onSelectMonth(nextBucket.monthKey) },
                colors = ButtonDefaults.buttonColors(containerColor = CleanerColors.SkyAccent, contentColor = Color(0xFF082F49))
            ) {
                Text("Sang ${nextBucket.label} (${nextBucket.remainingCount} mục)", fontWeight = FontWeight.Bold)
            }
        }

        if (hasPending) {
            Button(
                onClick = onOpenReview,
                colors = ButtonDefaults.buttonColors(containerColor = CleanerColors.TrashRose, contentColor = Color.White)
            ) {
                Text(
                    "Xem lại & Dọn (${uiState.summary.pendingTrashItems.size} mục • ${
                        MediaFormatters.formatBytes(uiState.summary.pendingTrashBytes)
                    })",
                    fontWeight = FontWeight.Bold
                )
            }
        }

        if (uiState.summary.keptCount > 0) {
            OutlinedButton(onClick = onResetKept) {
                Text("Quẹt lại ${uiState.summary.keptCount} ảnh đã Giữ", color = CleanerColors.TextPrimary)
            }
        }
    }
}

@Composable
private fun ActionDock(
    canUndo: Boolean,
    hasCard: Boolean,
    onUndo: () -> Unit,
    onTrash: () -> Unit,
    onFavorite: () -> Unit,
    onKeep: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        CircleActionBtn(
            icon = "↶",
            enabled = canUndo,
            accent = CleanerColors.TextMuted,
            onClick = onUndo
        )
        PillActionBtn(
            icon = "✕",
            label = "Xóa",
            enabled = hasCard,
            accent = CleanerColors.TrashRose,
            onClick = onTrash,
            modifier = Modifier.weight(1f)
        )
        CircleActionBtn(
            icon = "♥",
            enabled = hasCard,
            accent = CleanerColors.FavoriteAmber,
            onClick = onFavorite
        )
        PillActionBtn(
            icon = "✓",
            label = "Giữ",
            enabled = hasCard,
            accent = CleanerColors.KeepGreen,
            onClick = onKeep,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun CircleActionBtn(
    icon: String,
    enabled: Boolean,
    accent: Color,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(42.dp)
            .alpha(if (enabled) 1f else 0.35f)
            .clip(CircleShape)
            .background(accent.copy(alpha = 0.14f))
            .border(1.dp, accent.copy(alpha = 0.42f), CircleShape)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(icon, fontSize = 17.sp, color = accent, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun PillActionBtn(
    icon: String,
    label: String,
    enabled: Boolean,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .height(42.dp)
            .alpha(if (enabled) 1f else 0.35f)
            .clip(RoundedCornerShape(999.dp))
            .background(accent.copy(alpha = 0.14f))
            .border(1.dp, accent.copy(alpha = 0.45f), RoundedCornerShape(999.dp))
            .clickable(enabled = enabled, onClick = onClick),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(icon, fontSize = 15.sp, color = accent, fontWeight = FontWeight.Black)
        Text(label, fontSize = 13.5.sp, color = CleanerColors.TextPrimary, fontWeight = FontWeight.Bold)
    }
}
