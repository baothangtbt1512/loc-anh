package com.swipephotocleaner.app.data

import android.content.Context
import com.swipephotocleaner.app.model.SwipeDecision

class CleanerPreferences(context: Context) {
    private val prefs = context.getSharedPreferences("spc_cleaner_prefs", Context.MODE_PRIVATE)

    fun loadDecisions(): Map<Long, SwipeDecision> {
        val raw = prefs.getString("decisions_map", null) ?: return emptyMap()
        val result = mutableMapOf<Long, SwipeDecision>()
        for (entry in raw.split(';')) {
            if (entry.isBlank()) continue
            val parts = entry.split(':')
            if (parts.size != 2) continue
            val id = parts[0].toLongOrNull() ?: continue
            val decision = runCatching { SwipeDecision.valueOf(parts[1]) }.getOrNull() ?: continue
            result[id] = decision
        }
        return result
    }

    fun saveDecisions(decisions: Map<Long, SwipeDecision>) {
        val serialized = decisions.entries.joinToString(";") { "${it.key}:${it.value.name}" }
        prefs.edit().putString("decisions_map", serialized).apply()
    }

    fun getLifetimeFreedBytes(): Long = prefs.getLong("lifetime_freed_bytes", 0L)

    fun addFreedStats(bytes: Long, trashedCount: Int, favoritedCount: Int) {
        prefs.edit()
            .putLong("lifetime_freed_bytes", getLifetimeFreedBytes() + maxOf(0L, bytes))
            .putInt("lifetime_trashed_count", prefs.getInt("lifetime_trashed_count", 0) + maxOf(0, trashedCount))
            .putInt("lifetime_favorited_count", prefs.getInt("lifetime_favorited_count", 0) + maxOf(0, favoritedCount))
            .apply()
    }
}
