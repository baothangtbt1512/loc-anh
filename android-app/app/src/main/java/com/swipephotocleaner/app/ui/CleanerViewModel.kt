package com.swipephotocleaner.app.ui

import android.app.Application
import android.content.IntentSender
import android.os.Build
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.swipephotocleaner.app.data.CleanerPreferences
import com.swipephotocleaner.app.data.MediaBitmapLoader
import com.swipephotocleaner.app.data.MediaStoreRepository
import com.swipephotocleaner.app.model.CleanerReducer
import com.swipephotocleaner.app.model.CleanerSummary
import com.swipephotocleaner.app.model.LocalMediaItem
import com.swipephotocleaner.app.model.MediaFilter
import com.swipephotocleaner.app.model.MediaFormatters
import com.swipephotocleaner.app.model.MonthBucket
import com.swipephotocleaner.app.model.SwipeDecision
import com.swipephotocleaner.app.model.UndoEntry
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CleanerUiState(
    val isLoading: Boolean = false,
    val selectedMonth: String = "all",
    val activeFilter: MediaFilter = MediaFilter.ALL,
    val monthBuckets: List<MonthBucket> = emptyList(),
    val deckItems: List<LocalMediaItem> = emptyList(),
    val summary: CleanerSummary = CleanerSummary(
        pendingTrashItems = emptyList(),
        pendingTrashBytes = 0L,
        pendingFavoriteItems = emptyList(),
        keptCount = 0,
        monthTrashBreakdown = emptyList()
    ),
    val canUndo: Boolean = false,
    val totalMediaCount: Int = 0,
    val lifetimeFreedBytes: Long = 0L,
    val showReviewSheet: Boolean = false,
    val statusMessage: String? = null
)

sealed interface SystemCommitRequest {
    data class LaunchSender(val intentSender: IntentSender, val phase: CommitPhase) : SystemCommitRequest
}

enum class CommitPhase {
    FAVORITE,
    TRASH,
    LEGACY_RECOVERABLE
}

class CleanerViewModel(application: Application) : AndroidViewModel(application) {
    private val prefs = CleanerPreferences(application)
    private val repository = MediaStoreRepository(application)
    val bitmapLoader = MediaBitmapLoader(application)

    private var allItems: List<LocalMediaItem> = emptyList()
    private val decisions = mutableMapOf<Long, SwipeDecision>()
    private val undoStack = ArrayDeque<UndoEntry>()

    private var pendingCommitFavorites: List<LocalMediaItem> = emptyList()
    private var pendingCommitTrash: List<LocalMediaItem> = emptyList()

    private val _uiState = MutableStateFlow(
        CleanerUiState(lifetimeFreedBytes = prefs.getLifetimeFreedBytes())
    )
    val uiState: StateFlow<CleanerUiState> = _uiState.asStateFlow()

    private val _pendingIntentRequest = MutableStateFlow<SystemCommitRequest?>(null)
    val pendingIntentRequest: StateFlow<SystemCommitRequest?> = _pendingIntentRequest.asStateFlow()

    init {
        decisions.putAll(prefs.loadDecisions())
    }

    fun refreshLibrary() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val loaded = repository.loadAllMedia()
            allItems = loaded
            // Prune stale decisions for items no longer present in MediaStore
            val validIds = loaded.mapTo(HashSet(loaded.size)) { it.id }
            decisions.keys.retainAll(validIds)
            prefs.saveDecisions(decisions)
            recomputeUi(isLoading = false)
        }
    }

    fun selectMonth(monthKey: String) {
        _uiState.update { it.copy(selectedMonth = monthKey) }
        recomputeUi()
    }

    fun selectFilter(filter: MediaFilter) {
        _uiState.update { it.copy(activeFilter = filter) }
        recomputeUi()
    }

    fun decide(itemId: Long, decision: SwipeDecision) {
        val prev = decisions[itemId]
        decisions[itemId] = decision
        undoStack.addLast(UndoEntry(itemId, prev))
        while (undoStack.size > 500) undoStack.removeFirst()
        prefs.saveDecisions(decisions)
        recomputeUi()
    }

    fun undo() {
        if (undoStack.isEmpty()) return
        val last = undoStack.removeLast()
        if (last.previousDecision != null) {
            decisions[last.itemId] = last.previousDecision
        } else {
            decisions.remove(last.itemId)
        }
        prefs.saveDecisions(decisions)
        recomputeUi(statusMessage = "Đã hoàn tác thao tác vừa rồi")
    }

    fun rescueFromTrash(itemId: Long) {
        if (decisions[itemId] != SwipeDecision.TRASH) return
        decisions[itemId] = SwipeDecision.KEEP
        undoStack.addLast(UndoEntry(itemId, SwipeDecision.TRASH))
        prefs.saveDecisions(decisions)
        recomputeUi()
    }

    fun removeFavoritePending(itemId: Long) {
        if (decisions[itemId] != SwipeDecision.FAVORITE) return
        decisions[itemId] = SwipeDecision.KEEP
        prefs.saveDecisions(decisions)
        recomputeUi()
    }

    fun resetKeptItems() {
        val keptIds = decisions.filterValues { it == SwipeDecision.KEEP }.keys.toList()
        if (keptIds.isEmpty()) return
        for (id in keptIds) decisions.remove(id)
        undoStack.clear()
        prefs.saveDecisions(decisions)
        recomputeUi(statusMessage = "Đã khôi phục ${keptIds.size} ảnh để quẹt lại")
    }

    fun openReviewSheet() {
        _uiState.update { it.copy(showReviewSheet = true) }
    }

    fun closeReviewSheet() {
        _uiState.update { it.copy(showReviewSheet = false) }
    }

    fun clearStatusMessage() {
        _uiState.update { it.copy(statusMessage = null) }
    }

    fun startCommitFlow() {
        val summary = _uiState.value.summary
        pendingCommitFavorites = summary.pendingFavoriteItems
        pendingCommitTrash = summary.pendingTrashItems

        if (pendingCommitFavorites.isEmpty() && pendingCommitTrash.isEmpty()) return
        _uiState.update { it.copy(showReviewSheet = false) }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (pendingCommitFavorites.isNotEmpty()) {
                val sender = repository.buildFavoriteIntentSender(pendingCommitFavorites)
                if (sender != null) {
                    _pendingIntentRequest.value = SystemCommitRequest.LaunchSender(sender, CommitPhase.FAVORITE)
                    return
                }
            }
            launchTrashOrFinish()
        } else {
            // Android 8-10 fallback
            commitLegacyFlow()
        }
    }

    fun onSystemIntentResult(phase: CommitPhase, approved: Boolean) {
        _pendingIntentRequest.value = null
        when (phase) {
            CommitPhase.FAVORITE -> {
                if (approved) {
                    for (fav in pendingCommitFavorites) {
                        decisions[fav.id] = SwipeDecision.KEEP
                    }
                    prefs.addFreedStats(bytes = 0L, trashedCount = 0, favoritedCount = pendingCommitFavorites.size)
                    prefs.saveDecisions(decisions)
                }
                val favDoneCount = if (approved) pendingCommitFavorites.size else 0
                pendingCommitFavorites = emptyList()
                if (pendingCommitTrash.isNotEmpty()) {
                    launchTrashOrFinish(favDoneCount)
                } else {
                    recomputeUi(
                        statusMessage = if (approved) "Đã lưu $favDoneCount ảnh vào Yêu thích!" else "Đã hủy lưu Yêu thích."
                    )
                    refreshLibrary()
                }
            }

            CommitPhase.TRASH -> {
                if (approved) {
                    val freed = pendingCommitTrash.sumOf { it.sizeBytes }
                    val count = pendingCommitTrash.size
                    for (tr in pendingCommitTrash) {
                        decisions.remove(tr.id)
                    }
                    undoStack.clear()
                    prefs.addFreedStats(bytes = freed, trashedCount = count, favoritedCount = 0)
                    prefs.saveDecisions(decisions)
                    pendingCommitTrash = emptyList()
                    recomputeUi(
                        statusMessage = "Đã chuyển $count mục vào Thùng rác (${MediaFormatters.formatBytes(freed)})!"
                    )
                    refreshLibrary()
                } else {
                    pendingCommitTrash = emptyList()
                    recomputeUi(statusMessage = "Bạn đã hủy thao tác chuyển vào Thùng rác.")
                }
            }

            CommitPhase.LEGACY_RECOVERABLE -> {
                if (approved) {
                    commitLegacyFlow()
                } else {
                    recomputeUi(statusMessage = "Bạn đã hủy quyền xóa trên thiết bị.")
                }
            }
        }
    }

    private fun launchTrashOrFinish(favDoneCount: Int = 0) {
        if (pendingCommitTrash.isNotEmpty()) {
            val sender = repository.buildTrashIntentSender(pendingCommitTrash)
            if (sender != null) {
                _pendingIntentRequest.value = SystemCommitRequest.LaunchSender(sender, CommitPhase.TRASH)
                return
            }
        }
        if (favDoneCount > 0) {
            recomputeUi(statusMessage = "Đã lưu $favDoneCount ảnh vào Yêu thích!")
            refreshLibrary()
        }
    }

    private fun commitLegacyFlow() {
        viewModelScope.launch {
            if (pendingCommitFavorites.isNotEmpty()) {
                for (fav in pendingCommitFavorites) {
                    decisions[fav.id] = SwipeDecision.KEEP
                }
                prefs.saveDecisions(decisions)
            }
            val result = repository.deleteLegacyItems(pendingCommitTrash)
            if (result.recoverableIntentSender != null) {
                _pendingIntentRequest.value = SystemCommitRequest.LaunchSender(
                    result.recoverableIntentSender,
                    CommitPhase.LEGACY_RECOVERABLE
                )
                return@launch
            }
            for (tr in pendingCommitTrash) {
                decisions.remove(tr.id)
            }
            undoStack.clear()
            prefs.addFreedStats(bytes = result.deletedBytes, trashedCount = result.deletedCount, favoritedCount = 0)
            prefs.saveDecisions(decisions)
            pendingCommitFavorites = emptyList()
            pendingCommitTrash = emptyList()
            recomputeUi(
                statusMessage = "Đã dọn ${result.deletedCount} mục (${MediaFormatters.formatBytes(result.deletedBytes)})!"
            )
            refreshLibrary()
        }
    }

    private fun recomputeUi(isLoading: Boolean = _uiState.value.isLoading, statusMessage: String? = null) {
        val currentState = _uiState.value
        val buckets = CleanerReducer.buildMonthBuckets(allItems, decisions, currentState.activeFilter)
        val effectiveMonth = if (
            currentState.selectedMonth != "all" &&
            buckets.none { it.monthKey == currentState.selectedMonth }
        ) {
            "all"
        } else {
            currentState.selectedMonth
        }
        val deck = CleanerReducer.buildDeck(allItems, decisions, effectiveMonth, currentState.activeFilter)
        val summary = CleanerReducer.buildSummary(allItems, decisions)

        _uiState.update {
            it.copy(
                isLoading = isLoading,
                selectedMonth = effectiveMonth,
                monthBuckets = buckets,
                deckItems = deck,
                summary = summary,
                canUndo = undoStack.isNotEmpty(),
                totalMediaCount = allItems.size,
                lifetimeFreedBytes = prefs.getLifetimeFreedBytes(),
                statusMessage = statusMessage ?: it.statusMessage
            )
        }
    }
}
