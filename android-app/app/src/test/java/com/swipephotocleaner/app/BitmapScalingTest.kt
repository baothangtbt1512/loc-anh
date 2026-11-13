package com.swipephotocleaner.app

import com.swipephotocleaner.app.data.MediaBitmapLoader
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.max

class BitmapScalingTest {
    @Test
    fun preservesNativeResolutionForScreenshotsWithinBudget() {
        val target = MediaBitmapLoader.computeTargetDimensions(
            srcW = 1080,
            srcH = 2400,
            maxEdge = 2400,
            maxPixels = 5_000_000L
        )
        assertNull(target)
    }

    @Test
    fun scalesHighResCameraPhotosCrisplyWithoutUpscaling() {
        val target = MediaBitmapLoader.computeTargetDimensions(
            srcW = 4032,
            srcH = 3024,
            maxEdge = 2400,
            maxPixels = 5_000_000L
        )
        assertNotNull(target)
        val (w, h) = target!!
        assertEquals(2400, w)
        assertEquals(1800, h)
        assertTrue(w.toLong() * h.toLong() <= 5_000_000L)
    }

    @Test
    fun capsUltraLarge48MpPhotosWithinPixelAndEdgeCeilings() {
        val target = MediaBitmapLoader.computeTargetDimensions(
            srcW = 8000,
            srcH = 6000,
            maxEdge = 2560,
            maxPixels = 5_000_000L
        )
        assertNotNull(target)
        val (w, h) = target!!
        assertTrue(max(w, h) <= 2560)
        assertTrue(w.toLong() * h.toLong() <= 5_000_000L)
    }
}
