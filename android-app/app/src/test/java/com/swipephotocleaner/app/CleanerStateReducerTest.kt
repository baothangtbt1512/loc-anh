package com.swipephotocleaner.app

import com.swipephotocleaner.app.model.CleanerReducer
import com.swipephotocleaner.app.model.LocalMediaItem
import com.swipephotocleaner.app.model.MediaFilter
import com.swipephotocleaner.app.model.SwipeDecision
import org.junit.Assert.assertEquals
import org.junit.Test

class CleanerStateReducerTest {
    private val items = listOf(
        LocalMediaItem(
            id = 1L,
            contentUriString = "content://media/external/images/media/1",
            displayName = "Screenshot_01.png",
            sizeBytes = 400_000_000L,
            dateTakenMs = 1794500000000L,
            monthKey = "2026-11",
            isVideo = false,
            isScreenshot = true
        ),
        LocalMediaItem(
            id = 2L,
            contentUriString = "content://media/external/images/media/2",
            displayName = "IMG_02.jpg",
            sizeBytes = 5_000_000L,
            dateTakenMs = 1794400000000L,
            monthKey = "2026-11",
            isVideo = false,
            isScreenshot = false
        ),
        LocalMediaItem(
            id = 3L,
            contentUriString = "content://media/external/video/media/3",
            displayName = "VID_03.mp4",
            sizeBytes = 1_100_000_000L,
            dateTakenMs = 1792000000000L,
            monthKey = "2026-10",
            isVideo = true,
            isScreenshot = false
        )
    )

    @Test
    fun groupsByMonthAndFiltersCorrectly() {
        val decisions = mapOf(
            1L to SwipeDecision.TRASH,
            2L to SwipeDecision.FAVORITE
        )

        val buckets = CleanerReducer.buildMonthBuckets(items, decisions, MediaFilter.ALL)
        assertEquals(2, buckets.size)
        assertEquals("2026-11", buckets[0].monthKey)
        assertEquals(0, buckets[0].remainingCount)
        assertEquals(1, buckets[0].pendingTrashCount)
        assertEquals(400_000_000L, buckets[0].pendingTrashBytes)

        assertEquals("2026-10", buckets[1].monthKey)
        assertEquals(1, buckets[1].remainingCount)

        val videoDeck = CleanerReducer.buildDeck(items, emptyMap(), "all", MediaFilter.VIDEO)
        assertEquals(listOf(3L), videoDeck.map { it.id })

        val screenshotDeck = CleanerReducer.buildDeck(items, emptyMap(), "2026-11", MediaFilter.SCREENSHOT)
        assertEquals(listOf(1L), screenshotDeck.map { it.id })
    }

    @Test
    fun summaryCalculatesPendingBytesAndMonthBreakdown() {
        val decisions = mapOf(
            1L to SwipeDecision.TRASH,
            2L to SwipeDecision.KEEP,
            3L to SwipeDecision.TRASH
        )

        val summary = CleanerReducer.buildSummary(items, decisions)
        assertEquals(2, summary.pendingTrashItems.size)
        assertEquals(1_500_000_000L, summary.pendingTrashBytes)
        assertEquals(1, summary.keptCount)
        assertEquals(2, summary.monthTrashBreakdown.size)
        assertEquals("2026-11", summary.monthTrashBreakdown[0].monthKey)
        assertEquals(400_000_000L, summary.monthTrashBreakdown[0].bytes)
        assertEquals("2026-10", summary.monthTrashBreakdown[1].monthKey)
        assertEquals(1_100_000_000L, summary.monthTrashBreakdown[1].bytes)
    }
}
