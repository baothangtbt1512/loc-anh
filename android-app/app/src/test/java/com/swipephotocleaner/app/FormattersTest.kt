package com.swipephotocleaner.app

import com.swipephotocleaner.app.model.MediaFormatters
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Calendar

class FormattersTest {
    @Test
    fun formatBytesFormatsAcrossUnits() {
        assertEquals("0 B", MediaFormatters.formatBytes(0L))
        assertEquals("512 B", MediaFormatters.formatBytes(512L))
        assertEquals("840 KB", MediaFormatters.formatBytes(840L * 1024L))
        assertEquals("14.2 MB", MediaFormatters.formatBytes((14.2 * 1024 * 1024).toLong()))
        assertEquals("1.42 GB", MediaFormatters.formatBytes((1.42 * 1024 * 1024 * 1024).toLong()))
    }

    @Test
    fun monthFormattingAndEpochConversionWork() {
        val cal = Calendar.getInstance().apply {
            set(2026, Calendar.NOVEMBER, 13, 10, 30, 0)
        }
        val key = MediaFormatters.monthKeyFromEpochMs(cal.timeInMillis)
        assertEquals("2026-11", key)
        assertEquals("Tháng 11/2026", MediaFormatters.formatMonthLabel(key))
        assertEquals("Tất cả tháng", MediaFormatters.formatMonthLabel("all"))
        assertEquals("Không rõ tháng", MediaFormatters.formatMonthLabel("unknown"))
    }

    @Test
    fun detectScreenshotMatchesFoldersAndNames() {
        assertTrue(MediaFormatters.detectScreenshot("Screenshot_20261113.png", "Pictures/"))
        assertTrue(MediaFormatters.detectScreenshot("IMG_1234.png", "DCIM/Screenshots/"))
        assertFalse(MediaFormatters.detectScreenshot("IMG_1234.jpg", "DCIM/Camera/"))
    }

    @Test
    fun formatDurationHandlesMinutesAndHours() {
        assertEquals("", MediaFormatters.formatDuration(0L))
        assertEquals("01:42", MediaFormatters.formatDuration(102_000L))
        assertEquals("1:02:05", MediaFormatters.formatDuration(3_725_000L))
    }
}
