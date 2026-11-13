package com.swipephotocleaner.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

object CleanerColors {
    val Bg = Color(0xFF090C14)
    val Surface = Color(0xFF121826)
    val SurfaceAlt = Color(0xFF1B2336)
    val Border = Color(0x1FFFFFFF)
    val TextPrimary = Color(0xFFF8FAFC)
    val TextMuted = Color(0xFF94A3B8)
    val KeepGreen = Color(0xFF10B981)
    val TrashRose = Color(0xFFF43F5E)
    val FavoriteAmber = Color(0xFFF59E0B)
    val SkyAccent = Color(0xFF38BDF8)
    val VideoPurple = Color(0xFFA855F7)
}

private val AppColorScheme = darkColorScheme(
    primary = CleanerColors.SkyAccent,
    secondary = CleanerColors.KeepGreen,
    tertiary = CleanerColors.FavoriteAmber,
    error = CleanerColors.TrashRose,
    background = CleanerColors.Bg,
    surface = CleanerColors.Surface,
    onBackground = CleanerColors.TextPrimary,
    onSurface = CleanerColors.TextPrimary
)

@Composable
fun SwipeCleanerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = AppColorScheme,
        content = content
    )
}
