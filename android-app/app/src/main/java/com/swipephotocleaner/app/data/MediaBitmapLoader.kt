package com.swipephotocleaner.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
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
import java.io.InputStream
import kotlin.math.max

class MediaBitmapLoader(context: Context) {
    private val resolver = context.contentResolver
    private val previewCache = LruCache<String, ImageBitmap>(28)
    private val thumbCache = LruCache<String, ImageBitmap>(120)

    suspend fun loadPreview(item: LocalMediaItem): ImageBitmap? = loadBitmap(item, large = true)

    suspend fun loadThumbnail(item: LocalMediaItem): ImageBitmap? = loadBitmap(item, large = false)

    private suspend fun loadBitmap(item: LocalMediaItem, large: Boolean): ImageBitmap? {
        val key = "${item.id}_${if (large) "lg" else "sm"}"
        val cache = if (large) previewCache else thumbCache
        cache.get(key)?.let { return it }

        val targetPx = if (large) 1280 else 360
        val bmp = withContext(Dispatchers.IO) {
            runCatching {
                val uri = Uri.parse(item.contentUriString)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    resolver.loadThumbnail(uri, Size(targetPx, targetPx), null)
                } else {
                    loadLegacyBitmap(uri, item, targetPx)
                }
            }.getOrNull()
        } ?: return null

        val imageBitmap = bmp.asImageBitmap()
        cache.put(key, imageBitmap)
        return imageBitmap
    }

    private fun loadLegacyBitmap(uri: Uri, item: LocalMediaItem, targetPx: Int): Bitmap? {
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
        resolver.openInputStream(uri)?.use { stream: InputStream ->
            BitmapFactory.decodeStream(stream, null, bounds)
        }
        val maxDim = max(bounds.outWidth, bounds.outHeight)
        var sample = 1
        while (maxDim / sample > targetPx * 2) {
            sample *= 2
        }

        val opts = BitmapFactory.Options().apply {
            inSampleSize = sample
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        val raw = resolver.openInputStream(uri)?.use { stream ->
            BitmapFactory.decodeStream(stream, null, opts)
        } ?: return null

        if (item.orientationDegrees == 0) return raw
        val matrix = Matrix().apply { postRotate(item.orientationDegrees.toFloat()) }
        val rotated = Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, matrix, true)
        if (rotated !== raw) raw.recycle()
        return rotated
    }
}
