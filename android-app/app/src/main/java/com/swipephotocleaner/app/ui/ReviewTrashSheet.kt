package com.swipephotocleaner.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.swipephotocleaner.app.data.MediaBitmapLoader
import com.swipephotocleaner.app.model.CleanerSummary
import com.swipephotocleaner.app.model.LocalMediaItem
import com.swipephotocleaner.app.model.MediaFormatters

@Composable
fun ReviewTrashDialog(
    summary: CleanerSummary,
    bitmapLoader: MediaBitmapLoader,
    onRescueTrashItem: (Long) -> Unit,
    onRemoveFavoriteItem: (Long) -> Unit,
    onConfirmCommit: () -> Unit,
    onDismiss: () -> Unit
) {
    val freedLabel = MediaFormatters.formatBytes(summary.pendingTrashBytes)
    val trashCount = summary.pendingTrashItems.size
    val favCount = summary.pendingFavoriteItems.size
    val totalPending = trashCount + favCount

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding(),
            color = CleanerColors.Bg
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Header
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(CleanerColors.Surface)
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Xem trước trước khi xóa thật",
                        color = CleanerColors.TextPrimary,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Đóng ✕",
                        color = CleanerColors.TextMuted,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable(onClick = onDismiss)
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }

                // Body
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 116.dp),
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    contentPadding = PaddingValues(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            // Hero savings card
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(18.dp))
                                    .background(
                                        Brush.linearGradient(
                                            listOf(
                                                Color(0x33F43F5E),
                                                Color(0x2810B981)
                                            )
                                        )
                                    )
                                    .border(1.dp, CleanerColors.Border, RoundedCornerShape(18.dp))
                                    .padding(18.dp)
                            ) {
                                Column {
                                    Text(
                                        text = "TỔNG DUNG LƯỢNG SẼ GIẢI PHÓNG",
                                        color = Color(0xFFCBD5E1),
                                        fontSize = 11.5.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Spacer(Modifier.height(4.dp))
                                    Text(
                                        text = freedLabel,
                                        color = Color.White,
                                        fontSize = 32.sp,
                                        fontWeight = FontWeight.Black
                                    )
                                    Spacer(Modifier.height(4.dp))
                                    Text(
                                        text = "🗑️ $trashCount mục vào Thùng rác  •  ♥ $favCount mục Yêu thích",
                                        color = Color(0xFFE2E8F0),
                                        fontSize = 13.sp
                                    )
                                }
                            }

                            if (summary.monthTrashBreakdown.isNotEmpty()) {
                                Text(
                                    text = "Chi tiết theo từng tháng",
                                    color = CleanerColors.TextPrimary,
                                    fontSize = 13.5.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    items(summary.monthTrashBreakdown, key = { it.monthKey }) { m ->
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(10.dp))
                                                .background(CleanerColors.SurfaceAlt)
                                                .border(1.dp, CleanerColors.Border, RoundedCornerShape(10.dp))
                                                .padding(horizontal = 10.dp, vertical = 6.dp)
                                        ) {
                                            Text(
                                                text = "${m.label}: ${m.count} (${MediaFormatters.formatBytes(m.bytes)})",
                                                color = CleanerColors.TextPrimary,
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                        }
                                    }
                                }
                            }

                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color(0x1E38BDF8))
                                    .border(1.dp, Color(0x4D38BDF8), RoundedCornerShape(12.dp))
                                    .padding(12.dp)
                            ) {
                                Text(
                                    text = "🛡️ An toàn: Hệ thống Android sẽ hỏi xác nhận để chuyển vào Thùng rác (giữ 30 ngày khôi phục). Nếu bạn bật Sao lưu Google Photos, thao tác sẽ đồng bộ.",
                                    color = Color(0xFFBAE6FD),
                                    fontSize = 12.sp,
                                    lineHeight = 17.sp
                                )
                            }

                            if (summary.pendingFavoriteItems.isNotEmpty()) {
                                Text(
                                    text = "Sẽ gắn sao Yêu thích ♥ ($favCount)",
                                    color = CleanerColors.FavoriteAmber,
                                    fontSize = 13.5.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    items(summary.pendingFavoriteItems, key = { it.id }) { favItem ->
                                        ReviewMiniTile(
                                            item = favItem,
                                            bitmapLoader = bitmapLoader,
                                            badgeText = "♥ Yêu thích",
                                            actionLabel = "Bỏ chọn",
                                            onAction = { onRemoveFavoriteItem(favItem.id) },
                                            modifier = Modifier.width(116.dp)
                                        )
                                    }
                                }
                            }

                            Text(
                                text = if (trashCount > 0) {
                                    "Thùng chờ xóa ($trashCount mục — bấm Giữ lại nếu đổi ý)"
                                } else {
                                    "Chưa có mục nào trong thùng chờ xóa"
                                },
                                color = CleanerColors.TextPrimary,
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    items(summary.pendingTrashItems, key = { it.id }) { item ->
                        ReviewMiniTile(
                            item = item,
                            bitmapLoader = bitmapLoader,
                            badgeText = MediaFormatters.formatBytes(item.sizeBytes),
                            actionLabel = "↩ Giữ lại",
                            onAction = { onRescueTrashItem(item.id) }
                        )
                    }
                }

                // Footer action bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(CleanerColors.Surface)
                        .border(1.dp, CleanerColors.Border)
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(0.9f)
                    ) {
                        Text("Quẹt tiếp", color = CleanerColors.TextPrimary, fontSize = 13.sp)
                    }

                    Button(
                        onClick = onConfirmCommit,
                        enabled = totalPending > 0,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = CleanerColors.TrashRose,
                            contentColor = Color.White
                        ),
                        modifier = Modifier.weight(1.6f)
                    ) {
                        val cta = when {
                            trashCount > 0 && favCount > 0 -> "Lưu $favCount ♥ & Xóa $trashCount ($freedLabel)"
                            trashCount > 0 -> "Xóa $trashCount mục ($freedLabel)"
                            favCount > 0 -> "Lưu $favCount ảnh Yêu thích"
                            else -> "Chưa có thay đổi"
                        }
                        Text(
                            text = cta,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ReviewMiniTile(
    item: LocalMediaItem,
    bitmapLoader: MediaBitmapLoader,
    badgeText: String,
    actionLabel: String,
    onAction: () -> Unit,
    modifier: Modifier = Modifier
) {
    val thumb by produceState<ImageBitmap?>(initialValue = null, key1 = item.id) {
        value = bitmapLoader.loadThumbnail(item)
    }

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(CleanerColors.SurfaceAlt)
            .border(1.dp, CleanerColors.Border, RoundedCornerShape(12.dp))
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .background(Color(0xFF070A12))
        ) {
            if (thumb != null) {
                Image(
                    bitmap = thumb!!,
                    contentDescription = item.displayName,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            }
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(6.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(Color(0xD8090D16))
                    .padding(horizontal = 7.dp, vertical = 2.dp)
            ) {
                Text(
                    text = badgeText,
                    color = CleanerColors.SkyAccent,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Column(
            modifier = Modifier.padding(7.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp)
        ) {
            Text(
                text = MediaFormatters.formatDateTime(item.dateTakenMs),
                color = CleanerColors.TextMuted,
                fontSize = 10.5.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0x2810B981))
                    .border(1.dp, Color(0x6610B981), RoundedCornerShape(8.dp))
                    .clickable(onClick = onAction)
                    .padding(vertical = 5.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = actionLabel,
                    color = Color(0xFF6EE7B7),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
