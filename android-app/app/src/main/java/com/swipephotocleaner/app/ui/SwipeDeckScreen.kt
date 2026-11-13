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
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
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
    val scope = rememberCoroutineScope()

    LaunchedEffect(uiState.statusMessage) {
        val msg = uiState.statusMessage ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(msg)
        onClearStatusMessage()
    }

    val topItem = uiState.deckItems.firstOrNull()
    LaunchedEffect(topItem?.id) {
        for (upcoming in uiState.deckItems.take(3)) {
            launch { bitmapLoader.loadPreview(upcoming) }
        }
    }

    // Shared fly-out trigger for both drag and bottom action buttons
    var pendingButtonAction by remember { mutableStateOf<Pair<Long, SwipeDecision>?>(null) }

    Scaffold(
        containerColor = CleanerColors.Bg,
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .statusBarsPadding()
                .navigationBarsPadding()
        ) {
            // Top bar
            TopHeaderBar(
                uiState = uiState,
                onRefresh = onRefresh,
                onOpenReview = onOpenReview
            )

            if (hasPartialPermission) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0x28F59E0B))
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Bạn đang cấp quyền chọn ảnh giới hạn",
                        color = Color(0xFFFDE68A),
                        fontSize = 12.sp,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = "Chọn thêm ảnh",
                        color = CleanerColors.SkyAccent,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable(onClick = onRequestMoreAccess)
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            // Filter row
            FilterChipsRow(
                activeFilter = uiState.activeFilter,
                onSelectFilter = onSelectFilter
            )

            // Month strip
            MonthBucketsStrip(
                buckets = uiState.monthBuckets,
                selectedMonth = uiState.selectedMonth,
                onSelectMonth = onSelectMonth
            )

            // Main swipe card stage
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 8.dp),
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
                        // Render back card first
                        if (visibleStack.size > 1) {
                            SwipePhotoCard(
                                item = visibleStack[1],
                                bitmapLoader = bitmapLoader,
                                isTop = false,
                                externalAction = null,
                                onConsumeExternalAction = {},
                                onSwiped = {},
                                modifier = Modifier
                                    .fillMaxSize()
                                    .graphicsLayer {
                                        scaleX = 0.94f
                                        scaleY = 0.94f
                                        translationY = 22f
                                        alpha = 0.55f
                                    }
                            )
                        }

                        val activeItem = visibleStack[0]
                        SwipePhotoCard(
                            item = activeItem,
                            bitmapLoader = bitmapLoader,
                            isTop = true,
                            externalAction = pendingButtonAction?.takeIf { it.first == activeItem.id }?.second,
                            onConsumeExternalAction = { pendingButtonAction = null },
                            onSwiped = { decision -> onDecide(activeItem.id, decision) },
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }
            }

            // Bottom tactile action dock
            ActionDock(
                canUndo = uiState.canUndo,
                hasCard = topItem != null,
                onUndo = onUndo,
                onTrash = {
                    if (topItem != null) pendingButtonAction = topItem.id to SwipeDecision.TRASH
                },
                onFavorite = {
                    if (topItem != null) pendingButtonAction = topItem.id to SwipeDecision.FAVORITE
                },
                onKeep = {
                    if (topItem != null) pendingButtonAction = topItem.id to SwipeDecision.KEEP
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
    onRefresh: () -> Unit,
    onOpenReview: () -> Unit
) {
    val trashCount = uiState.summary.pendingTrashItems.size
    val favCount = uiState.summary.pendingFavoriteItems.size
    val freedPreview = MediaFormatters.formatBytes(uiState.summary.pendingTrashBytes)
    val hasPending = trashCount > 0 || favCount > 0

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Swipe Dọn Ảnh",
                color = CleanerColors.TextPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.ExtraBold
            )
            val sub = if (uiState.lifetimeFreedBytes > 0L) {
                "Đã dọn: ${MediaFormatters.formatBytes(uiState.lifetimeFreedBytes)} • ${uiState.totalMediaCount} mục"
            } else {
                "${uiState.totalMediaCount} ảnh/video trên máy"
            }
            Text(
                text = sub,
                color = CleanerColors.TextMuted,
                fontSize = 11.5.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .clip(CircleShape)
                    .background(CleanerColors.SurfaceAlt)
                    .border(1.dp, CleanerColors.Border, CircleShape)
                    .clickable(onClick = onRefresh)
                    .padding(horizontal = 10.dp, vertical = 8.dp)
            ) {
                Text("↻", color = CleanerColors.TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
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
                    .padding(horizontal = 13.dp, vertical = 8.dp)
            ) {
                Text(
                    text = if (trashCount > 0) {
                        "🗑️ $trashCount • $freedPreview"
                    } else if (favCount > 0) {
                        "♥ $favCount Yêu thích"
                    } else {
                        "🗑️ 0 chờ xóa"
                    },
                    color = if (hasPending) Color.White else CleanerColors.TextMuted,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun FilterChipsRow(
    activeFilter: MediaFilter,
    onSelectFilter: (MediaFilter) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        val options = listOf(
            MediaFilter.ALL to "Tất cả",
            MediaFilter.SCREENSHOT to "📱 Chụp màn hình",
            MediaFilter.VIDEO to "🎬 Video"
        )
        for ((filter, label) in options) {
            val selected = filter == activeFilter
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(if (selected) Color(0x2E38BDF8) else CleanerColors.SurfaceAlt)
                    .border(
                        1.dp,
                        if (selected) Color(0x8838BDF8) else CleanerColors.Border,
                        RoundedCornerShape(999.dp)
                    )
                    .clickable { onSelectFilter(filter) }
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(
                    text = label,
                    color = if (selected) Color(0xFF7DD3FC) else CleanerColors.TextMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
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
    val totalAll = buckets.sumOf { it.totalCount }

    LazyRow(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item(key = "all") {
            val active = selectedMonth == "all"
            MonthPill(
                title = "Tất cả tháng",
                subtitle = "Còn $totalRemaining/$totalAll",
                trashBadge = null,
                active = active,
                done = totalRemaining == 0 && totalAll > 0,
                onClick = { onSelectMonth("all") }
            )
        }

        items(buckets, key = { it.monthKey }) { bucket ->
            val isDone = bucket.remainingCount == 0
            val trashTag = if (bucket.pendingTrashCount > 0) {
                "-${bucket.pendingTrashCount} • ${MediaFormatters.formatBytes(bucket.pendingTrashBytes)}"
            } else null

            MonthPill(
                title = if (isDone) "${bucket.label} ✓" else bucket.label,
                subtitle = if (isDone) {
                    "Xong (${bucket.totalCount})"
                } else {
                    "Còn ${bucket.remainingCount}/${bucket.totalCount} • ${MediaFormatters.formatBytes(bucket.totalBytes)}"
                },
                trashBadge = trashTag,
                active = selectedMonth == bucket.monthKey,
                done = isDone,
                onClick = { onSelectMonth(bucket.monthKey) }
            )
        }
    }
}

@Composable
private fun MonthPill(
    title: String,
    subtitle: String,
    trashBadge: String?,
    active: Boolean,
    done: Boolean,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(
                when {
                    active -> Color(0x2C38BDF8)
                    done -> Color(0x99121826)
                    else -> CleanerColors.Surface
                }
            )
            .border(
                1.dp,
                if (active) Color(0xAA38BDF8) else CleanerColors.Border,
                RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 7.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = title,
                color = CleanerColors.TextPrimary,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Bold
            )
            if (trashBadge != null) {
                Text(
                    text = trashBadge,
                    color = Color(0xFFFDA4AF),
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(Color(0x38F43F5E))
                        .padding(horizontal = 6.dp, vertical = 1.dp)
                )
            }
        }
        Text(
            text = subtitle,
            color = CleanerColors.TextMuted,
            fontSize = 11.sp
        )
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
    val offsetX = remember(item.id) { Animatable(0f) }
    val offsetY = remember(item.id) { Animatable(0f) }
    var isAnimatingOut by remember(item.id) { mutableStateOf(false) }
    var zoomed by remember(item.id) { mutableStateOf(false) }

    val preview by produceState<ImageBitmap?>(initialValue = null, key1 = item.id) {
        value = bitmapLoader.loadPreview(item)
    }

    suspend fun flyOutAndCommit(decision: SwipeDecision) {
        if (isAnimatingOut) return
        isAnimatingOut = true
        coroutineScope {
            when (decision) {
                SwipeDecision.KEEP -> {
                    launch { offsetY.animateTo(-40f, tween(190)) }
                    offsetX.animateTo(1100f, tween(210))
                }
                SwipeDecision.TRASH -> {
                    launch { offsetY.animateTo(-40f, tween(190)) }
                    offsetX.animateTo(-1100f, tween(210))
                }
                SwipeDecision.FAVORITE -> {
                    offsetY.animateTo(-1250f, tween(210))
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

    val dragModifier = if (isTop) {
        Modifier.pointerInput(item.id) {
            detectDragGestures(
                onDragEnd = {
                    if (isAnimatingOut) return@detectDragGestures
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
                    scope.launch {
                        launch { offsetX.animateTo(0f, spring()) }
                        launch { offsetY.animateTo(0f, spring()) }
                    }
                },
                onDrag = { change, dragAmount ->
                    if (isAnimatingOut) return@detectDragGestures
                    change.consume()
                    scope.launch {
                        offsetX.snapTo(offsetX.value + dragAmount.x)
                        offsetY.snapTo(offsetY.value + dragAmount.y)
                    }
                }
            )
        }
    } else {
        Modifier
    }

    Column(
        modifier = modifier
            .graphicsLayer {
                translationX = dx
                translationY = dy
                rotationZ = dx * 0.025f
            }
            .then(dragModifier)
            .clip(RoundedCornerShape(24.dp))
            .background(Color(0xFF0C101B))
            .border(1.dp, Color(0x28FFFFFF), RoundedCornerShape(24.dp))
    ) {
        // Photo/Video preview area
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(Color(0xFF060810)),
            contentAlignment = Alignment.Center
        ) {
            if (preview != null) {
                Image(
                    bitmap = preview!!,
                    contentDescription = item.displayName,
                    contentScale = if (zoomed) ContentScale.Crop else ContentScale.Fit,
                    modifier = Modifier
                        .fillMaxSize()
                        .graphicsLayer {
                            if (zoomed) {
                                scaleX = 1.45f
                                scaleY = 1.45f
                            }
                        }
                )
            } else {
                CircularProgressIndicator(
                    color = CleanerColors.SkyAccent,
                    modifier = Modifier.size(32.dp)
                )
            }

            // Top badges
            Row(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    CardBadge(
                        text = MediaFormatters.formatMonthLabel(item.monthKey),
                        bg = Color(0xCC090D16),
                        fg = Color(0xFFF1F5F9)
                    )
                    if (item.isScreenshot) {
                        CardBadge(
                            text = "📱 Ảnh chụp màn hình",
                            bg = Color(0x55F59E0B),
                            fg = Color(0xFFFDE68A)
                        )
                    }
                    if (item.isVideo) {
                        val dur = MediaFormatters.formatDuration(item.durationMs)
                        CardBadge(
                            text = if (dur.isNotEmpty()) "🎬 Video $dur" else "🎬 Video",
                            bg = Color(0x55A855F7),
                            fg = Color(0xFFE9D5FF)
                        )
                    }
                    if (item.isAlreadyFavorite) {
                        CardBadge(
                            text = "♥ Đã thích",
                            bg = Color(0x55F43F5E),
                            fg = Color(0xFFFDA4AF)
                        )
                    }
                }

                CardBadge(
                    text = MediaFormatters.formatBytes(item.sizeBytes),
                    bg = Color(0xE00F172A),
                    fg = Color(0xFF7DD3FC)
                )
            }

            // Bottom-right quick inspect / play controls
            if (isTop) {
                Row(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (item.isVideo) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color(0xD8090D16))
                                .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(10.dp))
                                .clickable {
                                    runCatching {
                                        val intent = Intent(Intent.ACTION_VIEW).apply {
                                            setDataAndType(Uri.parse(item.contentUriString), "video/*")
                                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                        }
                                        context.startActivity(intent)
                                    }
                                }
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text("▶ Xem video", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0xD8090D16))
                            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(10.dp))
                            .clickable { zoomed = !zoomed }
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = if (zoomed) "Thu vừa" else "🔍 Soi nét",
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            // Directional Stamps
            if (keepAlpha > 0.02f) {
                SwipeStamp(
                    text = "GIỮ LẠI ✓",
                    color = CleanerColors.KeepGreen,
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(top = 64.dp, start = 20.dp)
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
                        .padding(top = 64.dp, end = 20.dp)
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

        // Card Footer
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(CleanerColors.Surface)
                .padding(horizontal = 16.dp, vertical = 10.dp)
        ) {
            Text(
                text = MediaFormatters.formatDateTime(item.dateTakenMs),
                color = CleanerColors.TextPrimary,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "${item.displayName}${if (item.relativePath.isNotBlank()) " • ${item.relativePath}" else ""}",
                color = CleanerColors.TextMuted,
                fontSize = 11.5.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun CardBadge(text: String, bg: Color, fg: Color) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .border(1.dp, Color(0x22FFFFFF), RoundedCornerShape(999.dp))
            .padding(horizontal = 9.dp, vertical = 4.dp)
    ) {
        Text(text = text, color = fg, fontSize = 11.5.sp, fontWeight = FontWeight.Bold)
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
            .padding(horizontal = 14.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        DockButton(
            icon = "↶",
            label = "Hoàn tác",
            enabled = canUndo,
            accent = CleanerColors.TextMuted,
            onClick = onUndo,
            modifier = Modifier.weight(0.8f)
        )
        DockButton(
            icon = "🗑️",
            label = "Chờ xóa",
            enabled = hasCard,
            accent = CleanerColors.TrashRose,
            onClick = onTrash,
            modifier = Modifier.weight(1.1f)
        )
        DockButton(
            icon = "♥",
            label = "Yêu thích",
            enabled = hasCard,
            accent = CleanerColors.FavoriteAmber,
            onClick = onFavorite,
            modifier = Modifier.weight(1.05f)
        )
        DockButton(
            icon = "✓",
            label = "Giữ lại",
            enabled = hasCard,
            accent = CleanerColors.KeepGreen,
            onClick = onKeep,
            modifier = Modifier.weight(1.1f)
        )
    }
}

@Composable
private fun DockButton(
    icon: String,
    label: String,
    enabled: Boolean,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .alpha(if (enabled) 1f else 0.35f)
            .clip(RoundedCornerShape(16.dp))
            .background(accent.copy(alpha = 0.14f))
            .border(1.dp, accent.copy(alpha = 0.45f), RoundedCornerShape(16.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Text(icon, fontSize = 19.sp, color = accent, fontWeight = FontWeight.Bold)
        Text(label, fontSize = 11.5.sp, color = CleanerColors.TextPrimary, fontWeight = FontWeight.Bold)
    }
}
