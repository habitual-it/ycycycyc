package com.example.remoteagent.webrtc

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.lifecycle.MutableLiveData
import com.example.remoteagent.R
import com.example.remoteagent.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class RemoteAgentService : Service() {
    private val scope = CoroutineScope(Dispatchers.IO + Job())
    private var ws: WebSocket? = null
    private var mediaProjection: MediaProjection? = null

    private var code: String = ""
    private var signalUrl: String = ""

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(1, buildNotification("准备中"))
        // setupPeerFactory() // 暂时注释，WebRTC依赖已移除
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        code = intent?.getStringExtra("code").orEmpty()
        signalUrl = intent?.getStringExtra("signal").orEmpty()
        log("启动，code=$code signal=$signalUrl")
        connectWs()
        return START_STICKY
    }

    override fun onDestroy() {
        ws?.close(1000, "stop")
        mediaProjection?.stop()
        super.onDestroy()
    }

    private fun connectWs() {
        val client = OkHttpClient.Builder()
            .pingInterval(15, TimeUnit.SECONDS)
            .build()

        val req = Request.Builder().url(signalUrl).build()
        ws = client.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: okhttp3.Response) {
                log("WS 已连接")
                sendHello()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleSignal(text)
            }

            override fun onMessage(webSocket: WebSocket, bytes: ByteString) {}

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: okhttp3.Response?) {
                log("WS 失败: ${t.message}")
            }
        })
    }

    private fun sendHello() {
        val obj = JSONObject()
        obj.put("type", "hello")
        obj.put("role", "device")
        obj.put("code", code)
        ws?.send(obj.toString())
    }

    private fun handleSignal(text: String) {
        val json = JSONObject(text)
        when (json.optString("type")) {
            "controller_ready" -> {
                log("控制端在线，WebRTC功能暂不可用")
            }
            "answer" -> {
                log("收到 Answer，WebRTC功能暂不可用")
            }
            "candidate" -> {
                log("收到 ICE Candidate，WebRTC功能暂不可用")
            }
        }
    }

    private fun log(msg: String) {
        Log.d("RemoteAgentService", msg)
        logs.postValue(msg)
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(1, buildNotification(msg))
    }

    private fun buildNotification(text: String) =
        NotificationCompat.Builder(this, "remote_agent")
            .setSmallIcon(android.R.drawable.sym_def_app_icon)
            .setContentTitle("RemoteAgent")
            .setContentText(text)
            .setContentIntent(
                PendingIntent.getActivity(
                    this, 0, Intent(this, MainActivity::class.java),
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )
            )
            .build()

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "remote_agent",
                "Remote Agent",
                NotificationManager.IMPORTANCE_LOW
            )
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    companion object {
        val logs = MutableLiveData<String>()
        private var mediaProjectionManager: MediaProjectionManager? = null
        private var projectionResultHandler: ((Int, Intent?) -> Unit)? = null
        var projectionResultCode: Int = 0
        var projectionResultData: Intent? = null

        fun requestMediaProjection(
            launcher: androidx.activity.result.ActivityResultLauncher<Intent>,
            context: Context
        ) {
            if (mediaProjectionManager == null) {
                mediaProjectionManager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            }
            val intent = mediaProjectionManager?.createScreenCaptureIntent()
            launcher.launch(intent)
        }

        fun onMediaProjectionResult(resultCode: Int, data: Intent?) {
            projectionResultCode = resultCode
            projectionResultData = data
            logs.postValue("录屏权限返回 code=$resultCode")
        }
    }
}
