package com.swipephotocleaner.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.swipephotocleaner.app.ui.CleanerColors
import com.swipephotocleaner.app.ui.CleanerViewModel
import com.swipephotocleaner.app.ui.CommitPhase
import com.swipephotocleaner.app.ui.SwipeCleanerTheme
import com.swipephotocleaner.app.ui.SwipeDeckScreen
import com.swipephotocleaner.app.ui.SystemCommitRequest

class MainActivity : ComponentActivity() {
    private val viewModel: CleanerViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            SwipeCleanerTheme {
                val uiState by viewModel.uiState.collectAsState()
                val pendingIntent by viewModel.pendingIntentRequest.collectAsState()

                var permissionState by remember { mutableStateOf(evaluatePermissions()) }
                var activeCommitPhase by remember { mutableStateOf<CommitPhase?>(null) }

                val permissionLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestMultiplePermissions()
                ) {
                    permissionState = evaluatePermissions()
                    if (permissionState.canReadAny) {
                        viewModel.refreshLibrary()
                    }
                }

                val intentSenderLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.StartIntentSenderForResult()
                ) { result ->
                    val phase = activeCommitPhase ?: return@rememberLauncherForActivityResult
                    activeCommitPhase = null
                    viewModel.onSystemIntentResult(phase, result.resultCode == Activity.RESULT_OK)
                }

                LaunchedEffect(Unit) {
                    if (permissionState.canReadAny) {
                        viewModel.refreshLibrary()
                    }
                }

                LaunchedEffect(pendingIntent) {
                    val req = pendingIntent ?: return@LaunchedEffect
                    when (req) {
                        is SystemCommitRequest.LaunchSender -> {
                            activeCommitPhase = req.phase
                            intentSenderLauncher.launch(
                                IntentSenderRequest.Builder(req.intentSender).build()
                            )
                        }
                    }
                }

                if (!permissionState.canReadAny) {
                    PermissionOnboardingScreen(
                        onRequestPermission = {
                            permissionLauncher.launch(requiredPermissionsForDevice())
                        },
                        onOpenSettings = {
                            val intent = Intent(
                                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                Uri.fromParts("package", packageName, null)
                            )
                            startActivity(intent)
                        }
                    )
                } else {
                    SwipeDeckScreen(
                        uiState = uiState,
                        bitmapLoader = viewModel.bitmapLoader,
                        hasPartialPermission = permissionState.isPartialOnly,
                        onRequestMoreAccess = {
                            permissionLauncher.launch(requiredPermissionsForDevice())
                        },
                        onRefresh = { viewModel.refreshLibrary() },
                        onSelectMonth = { viewModel.selectMonth(it) },
                        onSelectFilter = { viewModel.selectFilter(it) },
                        onDecide = { id, dec -> viewModel.decide(id, dec) },
                        onUndo = { viewModel.undo() },
                        onOpenReview = { viewModel.openReviewSheet() },
                        onCloseReview = { viewModel.closeReviewSheet() },
                        onRescueTrashItem = { viewModel.rescueFromTrash(it) },
                        onRemoveFavoriteItem = { viewModel.removeFavoritePending(it) },
                        onConfirmCommit = { viewModel.startCommitFlow() },
                        onResetKept = { viewModel.resetKeptItems() },
                        onClearStatusMessage = { viewModel.clearStatusMessage() }
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (evaluatePermissions().canReadAny && viewModel.uiState.value.totalMediaCount == 0) {
            viewModel.refreshLibrary()
        }
    }

    private fun requiredPermissionsForDevice(): Array<String> {
        return when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE -> arrayOf(
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO,
                Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED
            )
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> arrayOf(
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO
            )
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> arrayOf(
                Manifest.permission.READ_EXTERNAL_STORAGE
            )
            else -> arrayOf(
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            )
        }
    }

    private fun isGranted(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
    }

    private fun evaluatePermissions(): PermissionState {
        return when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE -> {
                val full = isGranted(Manifest.permission.READ_MEDIA_IMAGES) ||
                    isGranted(Manifest.permission.READ_MEDIA_VIDEO)
                val partial = isGranted(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED)
                PermissionState(canReadAny = full || partial, isPartialOnly = !full && partial)
            }
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> {
                val ok = isGranted(Manifest.permission.READ_MEDIA_IMAGES) ||
                    isGranted(Manifest.permission.READ_MEDIA_VIDEO)
                PermissionState(canReadAny = ok, isPartialOnly = false)
            }
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> {
                PermissionState(canReadAny = isGranted(Manifest.permission.READ_EXTERNAL_STORAGE), isPartialOnly = false)
            }
            else -> {
                val ok = isGranted(Manifest.permission.READ_EXTERNAL_STORAGE) &&
                    isGranted(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                PermissionState(canReadAny = ok, isPartialOnly = false)
            }
        }
    }
}

private data class PermissionState(
    val canReadAny: Boolean,
    val isPartialOnly: Boolean
)

@Composable
private fun PermissionOnboardingScreen(
    onRequestPermission: () -> Unit,
    onOpenSettings: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(CleanerColors.Bg)
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(CleanerColors.Surface)
                .border(1.dp, CleanerColors.Border, RoundedCornerShape(24.dp))
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text("⚡", fontSize = 48.sp)
            Text(
                text = "Swipe Dọn Ảnh",
                color = CleanerColors.TextPrimary,
                fontSize = 22.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                text = "Gom ảnh theo từng tháng, quẹt phải để Giữ, quẹt trái vào Thùng chờ xóa (xem trước tổng GB giải phóng), quẹt lên Yêu thích.",
                color = CleanerColors.TextMuted,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                lineHeight = 20.sp
            )
            Spacer(Modifier.height(4.dp))
            Button(
                onClick = onRequestPermission,
                colors = ButtonDefaults.buttonColors(
                    containerColor = CleanerColors.KeepGreen,
                    contentColor = Color.White
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Cấp quyền đọc Ảnh & Video", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }
            OutlinedButton(
                onClick = onOpenSettings,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Mở Cài đặt quyền (nếu đã từ chối)", color = CleanerColors.TextMuted, fontSize = 13.sp)
            }
        }
    }
}
