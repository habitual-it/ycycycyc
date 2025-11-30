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
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStreamTrack
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoCapturer
import org.webrtc.VideoSource
import org.webrtc.VideoTrack
import java.util.concurrent.TimeUnit

class RemoteAgentService : Service() {
    private val scope = CoroutineScope(Dispatchers.IO + Job())
    private var ws: WebSocket? = null
    private var pc: PeerConnection? = null
    private var mediaProjection: MediaProjection? = null
    private var videoCapturer: VideoCapturer? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null

    private var code: String = ""
    private var signalUrl: String = ""

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(1, buildNotification("准备中"))
        setupPeerFactory()
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
        pc?.dispose()
        mediaProjection?.stop()
        stopCapture()
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
                log("控制端在线，创建 Offer")
                scope.launch { createOffer() }
            }
            "answer" -> {
                val sdp = json.optJSONObject("sdp") ?: return
                pc?.setRemoteDescription(
                    SimpleSdpObserver(),
                    SessionDescription(SessionDescription.Type.ANSWER, sdp.optString("sdp"))
                )
                log("收到 Answer")
            }
            "candidate" -> {
                val cand = json.optJSONObject("candidate") ?: return
                val ice = IceCandidate(
                    cand.optString("sdpMid"),
                    cand.optInt("sdpMLineIndex"),
                    cand.optString("candidate")
                )
                pc?.addIceCandidate(ice)
            }
        }
    }

    private fun setupPeerFactory() {
        eglBase = EglBase.create()
        val options = PeerConnectionFactory.InitializationOptions.builder(this)
            .setEnableInternalTracer(true)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(options)
        val encoderFactory = DefaultVideoEncoderFactory(eglBase!!.eglBaseContext, true, true)
        val decoderFactory = DefaultVideoDecoderFactory(eglBase!!.eglBaseContext)
        factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()
    }

    private suspend fun createOffer() {
        if (pc == null) {
            pc = factory.createPeerConnection(buildIceServers(), object : PeerConnection.Observer {
                override fun onIceCandidate(candidate: IceCandidate) {
                    val obj = JSONObject()
                    obj.put("type", "candidate")
                    val cand = JSONObject()
                    cand.put("sdpMid", candidate.sdpMid)
                    cand.put("sdpMLineIndex", candidate.sdpMLineIndex)
                    cand.put("candidate", candidate.sdp)
                    obj.put("candidate", cand)
                    ws?.send(obj.toString())
                }

                override fun onConnectionChange(newState: PeerConnection.PeerConnectionState) {
                    log("PC: $newState")
                }

                override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState) {
                    log("ICE: $newState")
                }
                override fun onAddStream(p0: org.webrtc.MediaStream?) {}
                override fun onDataChannel(p0: org.webrtc.DataChannel?) {}
                override fun onRemoveStream(p0: org.webrtc.MediaStream?) {}
                override fun onSignalingChange(p0: PeerConnection.SignalingState?) {}
                override fun onIceGatheringChange(p0: PeerConnection.IceGatheringState?) {}
                override fun onIceCandidatesRemoved(p0: Array<out IceCandidate>?) {}
                override fun onRenegotiationNeeded() {}
                override fun onStandardizedIceConnectionChange(p0: PeerConnection.IceConnectionState?) {}
                override fun onConnectionChange(newState: PeerConnection.PeerConnectionState) {
                    log("PC: $newState")
                }
            })
        }

        startCaptureIfPossible()

        pc?.createDataChannel("control", org.webrtc.DataChannel.Init())?.registerObserver(ControlObserver())

        pc?.createOffer(SimpleSdpObserver { sdp ->
            pc?.setLocalDescription(SimpleSdpObserver(), sdp)
            val obj = JSONObject()
            obj.put("type", "offer")
            val sdpObj = JSONObject()
            sdpObj.put("type", sdp.type.canonicalForm())
            sdpObj.put("sdp", sdp.description)
            obj.put("sdp", sdpObj)
            ws?.send(obj.toString())
            log("发送 Offer")
        }, MediaConstraints())
    }

    private fun buildIceServers(): List<PeerConnection.IceServer> {
        // 可改为从配置读取；默认用公共 STUN
        return listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
        )
    }

    private fun startCaptureIfPossible() {
        if (videoTrack != null) return
        if (!ensureMediaProjection()) {
            log("尚未取得录屏权限，无法推流")
            return
        }
        try {
            val surfaceHelper = SurfaceTextureHelper.create("CaptureThread", eglBase?.eglBaseContext)
            val capturer = createScreenCapturer()
            val source = factory.createVideoSource(true)
            capturer.initialize(surfaceHelper, applicationContext, source.capturerObserver)
            capturer.startCapture(720, 1280, 20)
            val track = factory.createVideoTrack("video0", source)
            track.setEnabled(true)
            pc?.addTrack(track, listOf("stream0"))
            videoCapturer = capturer
            videoSource = source
            videoTrack = track
            log("开始推流 720x1280@20fps")
        } catch (e: Exception) {
            log("启动采集失败: ${e.message}")
        }
    }

    private fun stopCapture() {
        try {
            videoCapturer?.stopCapture()
        } catch (_: Exception) {
        }
        videoSource?.dispose()
        videoTrack?.dispose()
        videoCapturer = null
        videoSource = null
        videoTrack = null
    }

    private fun createScreenCapturer(): VideoCapturer {
        val data = projectionResultData
        val callback = object : MediaProjection.Callback() {
            override fun onStop() {
                log("录屏停止")
                stopCapture()
            }
        }
        return org.webrtc.ScreenCapturerAndroid(data, callback)
    }

    private fun ensureMediaProjection(): Boolean {
        if (mediaProjection != null) return true
        val data = projectionResultData ?: return false
        val mgr = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjection = mgr.getMediaProjection(projectionResultCode, data)
        return mediaProjection != null
    }

    private fun log(msg: String) {
        Log.d("RemoteAgentService", msg)
        logs.postValue(msg)
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(1, buildNotification(msg))
    }

    private fun buildNotification(text: String) =
        NotificationCompat.Builder(this, "remote_agent")
            .setSmallIcon(R.mipmap.ic_launcher)
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
        private lateinit var factory: PeerConnectionFactory
        private var mediaProjectionManager: MediaProjectionManager? = null
        private var projectionResultHandler: ((Int, Intent?) -> Unit)? = null
        var projectionResultCode: Int = 0
        var projectionResultData: Intent? = null
        var eglBase: EglBase? = null

        fun requestMediaProjection(
            launcher: androidx.activity.result.ActivityResultLauncher<Intent>,
            context: Context
        ) {
            if (mediaProjectionManager == null) {
                mediaProjectionManager =
                    context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
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

    private inner class ControlObserver : org.webrtc.DataChannel.Observer {
        override fun onBufferedAmountChange(p0: Long) {}
        override fun onStateChange() {
            log("DataChannel state=${pc?.dataChannels?.firstOrNull()?.state()}")
        }

        override fun onMessage(buffer: org.webrtc.DataChannel.Buffer?) {
            buffer ?: return
            val data = ByteArray(buffer.data.remaining())
            buffer.data.get(data)
            val text = String(data)
            log("指令: $text (暂未注入)")
            // TODO: 解析 JSON 并通过无障碍/ADB 注入事件
        }
    }

    private open inner class SimpleSdpObserver(
        private val onCreateSuccess: ((SessionDescription) -> Unit)? = null
    ) : SdpObserver {
        override fun onCreateSuccess(desc: SessionDescription) {
            onCreateSuccess?.invoke(desc)
        }

        override fun onSetSuccess() {}
        override fun onCreateFailure(p0: String?) {
            log("SDP create fail $p0")
        }
        override fun onSetFailure(p0: String?) {
            log("SDP set fail $p0")
        }
    }
}
