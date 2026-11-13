package com.swipephotocleaner.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.media.ExifInterface
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.LruCache
import android.util.Size
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.swipephotocleaner.app.model.LocalMediaItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * Decodes razor-sharp full-stage previews from the original media file (avoiding tiny
 * MediaStore / EXIF thumbnails on Android 10+) while keeping small grid thumbnails fast.
 */
class MediaBitmapLoader(context: Context) {
    private val appContext = context.applicationContext
    private val resolver = appContext.contentResolver

    private val previewMaxEdge: Int = run {
        val dm = appContext.resources.displayMetrics
        max(dm.widthPixels, dm.heightPixels).coerceIn(2200, 3072)
    }

    private val previewCacheBudgetKb: Int = run {
        val maxHeapKb = (Runtime.getRuntime().maxMemory() / 1024L).toInt()
        (maxHeapKb / 5).coerceIn(28 * 1024, 96 * 1024)
    }

    private val previewCache = object : LruCache<Long, ImageBitmap>(previewCacheBudgetKb) {
        override fun sizeOf(key: Long, value: ImageBitmap): Int {
            val kb = (value.width.toLong() * value.height.toLong() * 4L) / 1024L
            return kb.toInt().coerceAtLeast(1)
        }
    }

    private val thumbCache = LruCache<Long, ImageBitmap>(140)

    fun getCachedPreview(itemId: Long): ImageBitmap? = previewCache.get(itemId)

    suspend fun loadPreview(item: LocalMediaItem): ImageBitmap? {
        previewCache.get(item.id)?.let { return it }

        val bmp = withContext(Dispatchers.IO) {
            runCatching {
                val uri = Uri.parse(item.contentUriString)
                if (item.isVideo) {
                    loadVideoPreviewBitmap(uri)
                } else {
                    loadPhotoPreviewBitmap(uri, item)
                }
            }.getOrNull()
        } ?: return null

        val imageBitmap = bmp.asImageBitmap()
        previewCache.put(item.id, imageBitmap)
        return imageBitmap
    }

    suspend fun loadThumbnail(item: LocalMediaItem): ImageBitmap? {
        thumbCache.get(item.id)?.let { return it }

        val targetPx = 400
        val bmp = withContext(Dispatchers.IO) {
            runCatching {
                val uri = Uri.parse(item.contentUriString)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    resolver.loadThumbnail(uri, Size(targetPx, targetPx), null)
                } else {
                    loadLegacyThumbnail(uri, item, targetPx)
                }
            }.getOrNull()
        } ?: return null

        val imageBitmap = bmp.asImageBitmap()
        thumbCache.put(item.id, imageBitmap)
        return imageBitmap
    }

    private fun loadPhotoPreviewBitmap(uri: Uri, item: LocalMediaItem): Bitmap? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val decoded = runCatching {
                val source = ImageDecoder.createSource(resolver, uri)
                ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
                    // Software ARGB bitmap avoids hardware-bitmap upload glitches and lets LruCache track size cleanly.
                    decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
                    val target = computeTargetDimensions(
                        srcW = info.size.width,
                        srcH = info.size.height,
                        maxEdge = previewMaxEdge,
                        maxPixels = MAX_PREVIEW_PIXELS
                    )
                    if (target != null) {
                        decoder.setTargetSize(target.first, target.second)
                    }
                }
            }.getOrNull()
            if (decoded != null) return decoded
        }

        val bitmapFactoryDecoded = loadBitmapFactoryPreview(uri, item)
        if (bitmapFactoryDecoded != null) return bitmapFactoryDecoded

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            runCatching { resolver.loadThumbnail(uri, Size(previewMaxEdge, previewMaxEdge), null) }.getOrNull()
        } else {
            null
        }
    }

    private fun loadVideoPreviewBitmap(uri: Uri): Bitmap? {
        val retriever = MediaMetadataRetriever()
        val frame = try {
            retriever.setDataSource(appContext, uri)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                retriever.getScaledFrameAtTime(
                    -1L,
                    MediaMetadataRetriever.OPTION_CLOSEST_SYNC,
                    previewMaxEdge,
                    previewMaxEdge
                ) ?: retriever.frameAtTime
            } else {
                retriever.frameAtTime
            }
        } catch (_: Throwable) {
            null
        } finally {
            runCatching { retriever.release() }
        }

        if (frame != null) {
            return downscaleBitmapIfNeeded(frame, previewMaxEdge, MAX_PREVIEW_PIXELS)
        }

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            runCatching { resolver.loadThumbnail(uri, Size(previewMaxEdge, previewMaxEdge), null) }.getOrNull()
        } else {
            null
        }
    }

    private fun loadBitmapFactoryPreview(uri: Uri, item: LocalMediaItem): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { stream ->
            BitmapFactory.decodeStream(stream, null, bounds)
        }
        val rawW = bounds.outWidth
        val rawH = bounds.outHeight
        if (rawW <= 0 || rawH <= 0) return null

        val maxDim = max(rawW, rawH)
        var sample = 1
        while (maxDim / (sample * 2) >= previewMaxEdge) {
            sample *= 2
        }

        val opts = BitmapFactory.Options().apply {
            inSampleSize = sample
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        val raw = resolver.openInputStream(uri)?.use { stream ->
            BitmapFactory.decodeStream(stream, null, opts)
        } ?: return null

        val oriented = applyExifTransformIfNeeded(uri, raw, item.orientationDegrees)
        return downscaleBitmapIfNeeded(oriented, previewMaxEdge, MAX_PREVIEW_PIXELS)
    }

    private fun loadLegacyThumbnail(uri: Uri, item: LocalMediaItem, targetPx: Int): Bitmap? {
        if (item.isVideo) {
            @Suppress("DEPRECATION")
            return MediaStore.Video.Thumbnails.getThumbnail(
                resolver,
                item.id,
                MediaStore.Video.Thumbnails.MINI_KIND,
                null
            )
        }

        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { stream ->
            BitmapFactory.decodeStream(stream, null, bounds)
        }
        val maxDim = max(bounds.outWidth, bounds.outHeight)
        if (maxDim <= 0) return null

        var sample = 1
        while (maxDim / (sample * 2) >= targetPx) {
            sample *= 2
        }
        val opts = BitmapFactory.Options().apply {
            inSampleSize = sample
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        val raw = resolver.openInputStream(uri)?.use { stream ->
            BitmapFactory.decodeStream(stream, null, opts)
        } ?: return null

        return applyExifTransformIfNeeded(uri, raw, item.orientationDegrees)
    }

    private fun applyExifTransformIfNeeded(uri: Uri, bitmap: Bitmap, fallbackDegrees: Int): Bitmap {
        val exifOrientation = runCatching {
            resolver.openInputStream(uri)?.use { stream ->
                ExifInterface(stream).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_UNDEFINED
                )
            }
        }.getOrNull()

        val matrix = Matrix()
        var needsTransform = false

        when (exifOrientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> {
                matrix.postRotate(90f); needsTransform = true
            }
            ExifInterface.ORIENTATION_ROTATE_180 -> {
                matrix.postRotate(180f); needsTransform = true
            }
            ExifInterface.ORIENTATION_ROTATE_270 -> {
                matrix.postRotate(270f); needsTransform = true
            }
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> {
                matrix.postScale(-1f, 1f); needsTransform = true
            }
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> {
                matrix.postScale(1f, -1f); needsTransform = true
            }
            ExifInterface.ORIENTATION_TRANSPOSE -> {
                matrix.postRotate(90f); matrix.postScale(-1f, 1f); needsTransform = true
            }
            ExifInterface.ORIENTATION_TRANSVERSE -> {
                matrix.postRotate(270f); matrix.postScale(-1f, 1f); needsTransform = true
            }
            else -> if (fallbackDegrees != 0) {
                matrix.postRotate(fallbackDegrees.toFloat())
                needsTransform = true
            }
        }

        if (!needsTransform) return bitmap
        val transformed = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        if (transformed !== bitmap) bitmap.recycle()
        return transformed
    }

    private fun downscaleBitmapIfNeeded(bitmap: Bitmap, maxEdge: Int, maxPixels: Long): Bitmap {
        val target = computeTargetDimensions(bitmap.width, bitmap.height, maxEdge, maxPixels) ?: return bitmap
        val scaled = Bitmap.createScaledBitmap(bitmap, target.first, target.second, true)
        if (scaled !== bitmap) bitmap.recycle()
        return scaled
    }

    companion object {
        private const val MAX_PREVIEW_PIXELS = 5_000_000L

        internal fun computeTargetDimensions(
            srcW: Int,
            srcH: Int,
            maxEdge: Int,
            maxPixels: Long
        ): Pair<Int, Int>? {
            if (srcW <= 0 || srcH <= 0) return null
            val longest = max(srcW, srcH)
            val pixels = srcW.toLong() * srcH.toLong()
            if (longest <= maxEdge && pixels <= maxPixels) {
                return null
            }
            val edgeRatio = if (longest > maxEdge) maxEdge.toDouble() / longest.toDouble() else 1.0
            val areaRatio = if (pixels > maxPixels) sqrt(maxPixels.toDouble() / pixels.toDouble()) else 1.0
            val scale = min(edgeRatio, areaRatio)
            val targetW = (srcW * scale).roundToInt().coerceAtLeast(1)
            val targetH = (srcH * scale).roundToInt().coerceAtLeast(1)
            return targetW to targetH
        }
    }
}
