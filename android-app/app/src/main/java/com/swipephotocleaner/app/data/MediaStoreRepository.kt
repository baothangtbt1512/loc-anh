package com.swipephotocleaner.app.data

import android.app.PendingIntent
import android.app.RecoverableSecurityException
import android.content.ContentResolver
import android.content.ContentUris
import android.content.Context
import android.content.IntentSender
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import com.swipephotocleaner.app.model.LocalMediaItem
import com.swipephotocleaner.app.model.MediaFormatters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class MediaStoreRepository(private val context: Context) {
    private val resolver: ContentResolver = context.contentResolver

    suspend fun loadAllMedia(): List<LocalMediaItem> = withContext(Dispatchers.IO) {
        val images = queryCollection(
            collectionUri = MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            isVideo = false
        )
        val videos = queryCollection(
            collectionUri = MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
            isVideo = true
        )
        (images + videos).sortedByDescending { it.dateTakenMs }
    }

    private fun queryCollection(collectionUri: Uri, isVideo: Boolean): List<LocalMediaItem> {
        val columns = mutableListOf(
            MediaStore.MediaColumns._ID,
            MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.SIZE,
            MediaStore.MediaColumns.DATE_TAKEN,
            MediaStore.MediaColumns.DATE_MODIFIED,
            MediaStore.MediaColumns.WIDTH,
            MediaStore.MediaColumns.HEIGHT
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            columns.add(MediaStore.MediaColumns.RELATIVE_PATH)
        } else {
            @Suppress("DEPRECATION")
            columns.add(MediaStore.MediaColumns.DATA)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            columns.add(MediaStore.MediaColumns.IS_FAVORITE)
        }

        if (isVideo) {
            columns.add(MediaStore.Video.VideoColumns.DURATION)
        } else {
            columns.add(MediaStore.Images.ImageColumns.ORIENTATION)
        }

        val selection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            "${MediaStore.MediaColumns.IS_TRASHED} = 0 AND ${MediaStore.MediaColumns.SIZE} > 0"
        } else {
            "${MediaStore.MediaColumns.SIZE} > 0"
        }

        val list = mutableListOf<LocalMediaItem>()
        resolver.query(
            collectionUri,
            columns.toTypedArray(),
            selection,
            null,
            "${MediaStore.MediaColumns.DATE_MODIFIED} DESC"
        )?.use { cursor ->
            val idIdx = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
            val nameIdx = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME)
            val sizeIdx = cursor.getColumnIndex(MediaStore.MediaColumns.SIZE)
            val dateTakenIdx = cursor.getColumnIndex(MediaStore.MediaColumns.DATE_TAKEN)
            val dateModIdx = cursor.getColumnIndex(MediaStore.MediaColumns.DATE_MODIFIED)
            val widthIdx = cursor.getColumnIndex(MediaStore.MediaColumns.WIDTH)
            val heightIdx = cursor.getColumnIndex(MediaStore.MediaColumns.HEIGHT)
            val relPathIdx = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                cursor.getColumnIndex(MediaStore.MediaColumns.RELATIVE_PATH)
            } else {
                @Suppress("DEPRECATION")
                cursor.getColumnIndex(MediaStore.MediaColumns.DATA)
            }
            val favIdx = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                cursor.getColumnIndex(MediaStore.MediaColumns.IS_FAVORITE)
            } else -1
            val durationIdx = if (isVideo) cursor.getColumnIndex(MediaStore.Video.VideoColumns.DURATION) else -1
            val orientationIdx = if (!isVideo) cursor.getColumnIndex(MediaStore.Images.ImageColumns.ORIENTATION) else -1

            while (cursor.moveToNext()) {
                val id = cursor.getLong(idIdx)
                val uri = ContentUris.withAppendedId(collectionUri, id)
                val name = if (nameIdx >= 0) cursor.getString(nameIdx).orEmpty() else ""
                val size = if (sizeIdx >= 0) cursor.getLong(sizeIdx) else 0L
                val rawTaken = if (dateTakenIdx >= 0) cursor.getLong(dateTakenIdx) else 0L
                val rawMod = if (dateModIdx >= 0) cursor.getLong(dateModIdx) * 1000L else 0L
                val effectiveTs = if (rawTaken > 946684800000L) rawTaken else rawMod
                val path = if (relPathIdx >= 0) cursor.getString(relPathIdx).orEmpty() else ""
                val width = if (widthIdx >= 0) cursor.getInt(widthIdx) else 0
                val height = if (heightIdx >= 0) cursor.getInt(heightIdx) else 0
                val isFav = favIdx >= 0 && cursor.getInt(favIdx) == 1
                val duration = if (durationIdx >= 0) cursor.getLong(durationIdx) else 0L
                val orientation = if (orientationIdx >= 0) cursor.getInt(orientationIdx) else 0

                list.add(
                    LocalMediaItem(
                        id = id,
                        contentUriString = uri.toString(),
                        displayName = name,
                        sizeBytes = size,
                        dateTakenMs = effectiveTs,
                        monthKey = MediaFormatters.monthKeyFromEpochMs(effectiveTs),
                        isVideo = isVideo,
                        durationMs = duration,
                        relativePath = path,
                        width = width,
                        height = height,
                        isAlreadyFavorite = isFav,
                        isScreenshot = MediaFormatters.detectScreenshot(name, path),
                        orientationDegrees = orientation
                    )
                )
            }
        }
        return list
    }

    fun buildFavoriteIntentSender(items: List<LocalMediaItem>): IntentSender? {
        if (items.isEmpty() || Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null
        val uris = items.map { Uri.parse(it.contentUriString) }
        val pending: PendingIntent = MediaStore.createFavoriteRequest(resolver, uris, true)
        return pending.intentSender
    }

    fun buildTrashIntentSender(items: List<LocalMediaItem>): IntentSender? {
        if (items.isEmpty() || Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null
        val uris = items.map { Uri.parse(it.contentUriString) }
        val pending: PendingIntent = MediaStore.createTrashRequest(resolver, uris, true)
        return pending.intentSender
    }

    /**
     * Fallback direct delete for Android 8-10 (API 26-29) where createTrashRequest doesn't exist.
     */
    suspend fun deleteLegacyItems(items: List<LocalMediaItem>): LegacyDeleteResult = withContext(Dispatchers.IO) {
        var deletedCount = 0
        var deletedBytes = 0L
        var recoverableSender: IntentSender? = null

        for (item in items) {
            val uri = Uri.parse(item.contentUriString)
            try {
                val rows = resolver.delete(uri, null, null)
                if (rows > 0) {
                    deletedCount++
                    deletedBytes += item.sizeBytes
                }
            } catch (sec: SecurityException) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && sec is RecoverableSecurityException) {
                    recoverableSender = sec.userAction.actionIntent.intentSender
                    break
                }
            }
        }

        LegacyDeleteResult(
            deletedCount = deletedCount,
            deletedBytes = deletedBytes,
            recoverableIntentSender = recoverableSender
        )
    }
}

data class LegacyDeleteResult(
    val deletedCount: Int,
    val deletedBytes: Long,
    val recoverableIntentSender: IntentSender?
)
