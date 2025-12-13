package com.example.remoteagent.ui

import android.content.Intent
import android.os.Bundle
import android.text.method.ScrollingMovementMethod
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.example.remoteagent.BuildConfig
import com.example.remoteagent.R
import com.example.remoteagent.webrtc.RemoteAgentService

class MainActivity : AppCompatActivity() {
    private lateinit var inputCode: EditText
    private lateinit var inputSignal: EditText
    private lateinit var logView: TextView
    private var autoStarted = false

    private val mediaProjectionPermission = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        RemoteAgentService.onMediaProjectionResult(result.resultCode, result.data)
        appendLog("录屏权限返回 resultCode=${result.resultCode}")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        inputCode = findViewById(R.id.inputCode)
        inputSignal = findViewById(R.id.inputSignal)
        logView = findViewById(R.id.logView)
        logView.movementMethod = ScrollingMovementMethod()

        findViewById<Button>(R.id.btnStart).setOnClickListener {
            startAgent()
        }
        findViewById<Button>(R.id.btnStop).setOnClickListener {
            stopAgent()
        }

        RemoteAgentService.logs.observe(this) { line ->
            appendLog(line)
        }

        // 自动填充默认配对码/信令地址
        if (BuildConfig.DEFAULT_CODE.isNotBlank()) {
            inputCode.setText(BuildConfig.DEFAULT_CODE)
        }
        if (BuildConfig.DEFAULT_SIGNAL.isNotBlank()) {
            inputSignal.setText(BuildConfig.DEFAULT_SIGNAL)
        }
        // 自动启动
        if (BuildConfig.DEFAULT_CODE.isNotBlank() && BuildConfig.DEFAULT_SIGNAL.isNotBlank()) {
            autoStarted = true
            startAgent()
        }
    }

    override fun onResume() {
        super.onResume()
        RemoteAgentService.logs.value?.let { appendLog(it) }
    }

    private fun startAgent() {
        val code = inputCode.text.toString().trim()
        val signal = inputSignal.text.toString().trim()
        if (code.isEmpty() || signal.isEmpty()) {
            appendLog("请填写配对码和信令地址")
            return
        }
        val intent = Intent(this, RemoteAgentService::class.java).apply {
            putExtra("code", code)
            putExtra("signal", signal)
        }
        startForegroundService(intent)
        appendLog("启动服务，等待录屏权限")
        RemoteAgentService.requestMediaProjection(mediaProjectionPermission, this)
    }

    private fun stopAgent() {
        stopService(Intent(this, RemoteAgentService::class.java))
        appendLog("已停止服务")
    }

    private fun appendLog(line: String) {
        logView.append("$line\n")
        val layout = logView.layout
        if (layout != null) {
            val scroll = layout.getLineTop(logView.lineCount) - logView.height
            if (scroll > 0) logView.scrollTo(0, scroll) else logView.scrollTo(0, 0)
        }
    }
}
