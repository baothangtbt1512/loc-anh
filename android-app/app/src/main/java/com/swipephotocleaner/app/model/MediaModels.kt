package com.swipephotocleaner.app.model

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.pow

enum class SwipeDecision {
    KEEP,
    TRASH,
    FAVORITE
}

enum class MediaFilter {
    ALL,
    SCREENSHOT,
    VIDEO
}

data class LocalMediaItem(
    val id: Long,
    val contentUriString: String,
    val displayName: String,
    val sizeBytes: Long,
    val dateTakenMs: Long,
    val monthKey: String,
    val isVideo: Boolean,
    val durationMs: Long = 0L,
    val relativePath: String = "",
    val width: Int = 0,
    val height: Int = 0,
    val isAlreadyFavorite: Boolean = false,
    val isScreenshot: Boolean = false,
    val orientationDegrees: Int = 0
)

data class UndoEntry(
    val itemId: Long,
    val previousDecision: SwipeDecision?
)

data class MonthBucket(
    val monthKey: String,
    val label: String,
    val totalCount: Int,
    val remainingCount: Int,
    val pendingTrashCount: Int,
    val pendingTrashBytes: Long,
    val totalBytes: Long
)

data class MonthTrashSummary(
    val monthKey: String,
    val label: String,
    val count: Int,
    val bytes: Long
)

data class CleanerSummary(
    val pendingTrashItems: List<LocalMediaItem>,
    val pendingTrashBytes: Long,
    val pendingFavoriteItems: List<LocalMediaItem>,
    val keptCount: Int,
    val monthTrashBreakdown: List<MonthTrashSummary>
)

object MediaFormatters {
    private val UNITS = arrayOf("B", "KB", "MB", "GB", "TB")

    fun formatBytes(bytes: Long): String {
        if (bytes <= 0L) return "0 B"
        val exp = minOf(floor(ln(bytes.toDouble()) / ln(1024.0)).toInt(), UNITS.lastIndex)
        val value = bytes / 1024.0.pow(exp.toDouble())
        val pattern = when {
            exp == 0 -> "%.0f %s"
            value >= 100.0 -> "%.0f %s"
            value >= 10.0 -> "%.1f %s"
            else -> "%.2f %s"
        }
        return String.format(Locale.US, pattern, value, UNITS[exp])
    }

    fun monthKeyFromEpochMs(epochMs: Long): String {
        if (epochMs <= 0L) return "unknown"
        val cal = Calendar.getInstance().apply { timeInMillis = epochMs }
        val year = cal.get(Calendar.YEAR)
        val month = cal.get(Calendar.MONTH) + 1
        return String.format(Locale.US, "%04d-%02d", year, month)
    }

    fun formatMonthLabel(monthKey: String): String {
        if (monthKey == "all") return "Tất cả tháng"
        if (monthKey == "unknown") return "Không rõ tháng"
        val parts = monthKey.split("-")
        if (parts.size != 2) return monthKey
        val year = parts[0]
        val monthNum = parts[1].toIntOrNull() ?: return monthKey
        return "Tháng $monthNum/$year"
    }

    fun formatDateTime(epochMs: Long): String {
        if (epochMs <= 0L) return "Chưa rõ ngày"
        val sdf = SimpleDateFormat("dd/MM/yyyy • HH:mm", Locale.getDefault())
        return sdf.format(Date(epochMs))
    }

    fun formatDuration(durationMs: Long): String {
        if (durationMs <= 0L) return ""
        val totalSec = durationMs / 1000L
        val mins = totalSec / 60L
        val secs = totalSec % 60L
        val hours = mins / 60L
        return if (hours > 0L) {
            String.format(Locale.US, "%d:%02d:%02d", hours, mins % 60L, secs)
        } else {
            String.format(Locale.US, "%02d:%02d", mins, secs)
        }
    }

    fun detectScreenshot(displayName: String, relativePath: String): Boolean {
        val combined = "$displayName $relativePath".lowercase(Locale.US)
        return combined.contains("screenshot") ||
            combined.contains("screen_shot") ||
            combined.contains("screenrecorder") ||
            combined.contains("chụp màn hình")
    }
}

object CleanerReducer {
    fun matchesFilter(item: LocalMediaItem, filter: MediaFilter): Boolean {
        return when (filter) {
            MediaFilter.ALL -> true
            MediaFilter.SCREENSHOT -> item.isScreenshot
            MediaFilter.VIDEO -> item.isVideo
        }
    }

    fun buildMonthBuckets(
        items: List<LocalMediaItem>,
        decisions: Map<Long, SwipeDecision>,
        filter: MediaFilter
    ): List<MonthBucket> {
        val map = linkedMapOf<String, MutableList<LocalMediaItem>>()
        for (item in items) {
            if (!matchesFilter(item, filter)) continue
            map.getOrPut(item.monthKey) { mutableListOf() }.add(item)
        }

        return map.entries
            .map { (key, list) ->
                var remaining = 0
                var trashCount = 0
                var trashBytes = 0L
                var totalBytes = 0L

                for (it in list) {
                    totalBytes += it.sizeBytes
                    when (decisions[it.id]) {
                        null -> remaining++
                        SwipeDecision.TRASH -> {
                            trashCount++
                            trashBytes += it.sizeBytes
                        }
                        SwipeDecision.KEEP, SwipeDecision.FAVORITE -> Unit
                    }
                }

                MonthBucket(
                    monthKey = key,
                    label = MediaFormatters.formatMonthLabel(key),
                    totalCount = list.size,
                    remainingCount = remaining,
                    pendingTrashCount = trashCount,
                    pendingTrashBytes = trashBytes,
                    totalBytes = totalBytes
                )
            }
            .sortedWith { a, b ->
                when {
                    a.monthKey == "unknown" -> 1
                    b.monthKey == "unknown" -> -1
                    else -> b.monthKey.compareTo(a.monthKey)
                }
            }
    }

    fun buildDeck(
        items: List<LocalMediaItem>,
        decisions: Map<Long, SwipeDecision>,
        selectedMonth: String,
        filter: MediaFilter
    ): List<LocalMediaItem> {
        return items.filter { item ->
            decisions[item.id] == null &&
                (selectedMonth == "all" || item.monthKey == selectedMonth) &&
                matchesFilter(item, filter)
        }.sortedByDescending { it.dateTakenMs }
    }

    fun buildSummary(
        items: List<LocalMediaItem>,
        decisions: Map<Long, SwipeDecision>
    ): CleanerSummary {
        val trashItems = mutableListOf<LocalMediaItem>()
        val favItems = mutableListOf<LocalMediaItem>()
        var keptCount = 0
        var trashBytes = 0L
        val byMonth = linkedMapOf<String, MutableList<LocalMediaItem>>()

        for (item in items) {
            when (decisions[item.id]) {
                SwipeDecision.KEEP -> keptCount++
                SwipeDecision.TRASH -> {
                    trashItems.add(item)
                    trashBytes += item.sizeBytes
                    byMonth.getOrPut(item.monthKey) { mutableListOf() }.add(item)
                }
                SwipeDecision.FAVORITE -> favItems.add(item)
                null -> Unit
            }
        }

        val breakdown = byMonth.entries
            .map { (key, list) ->
                MonthTrashSummary(
                    monthKey = key,
                    label = MediaFormatters.formatMonthLabel(key),
                    count = list.size,
                    bytes = list.sumOf { it.sizeBytes }
                )
            }
            .sortedWith { a, b ->
                when {
                    a.monthKey == "unknown" -> 1
                    b.monthKey == "unknown" -> -1
                    else -> b.monthKey.compareTo(a.monthKey)
                }
            }

        return CleanerSummary(
            pendingTrashItems = trashItems.sortedByDescending { it.dateTakenMs },
            pendingTrashBytes = trashBytes,
            pendingFavoriteItems = favItems.sortedByDescending { it.dateTakenMs },
            keptCount = keptCount,
            monthTrashBreakdown = breakdown
        )
    }
}
