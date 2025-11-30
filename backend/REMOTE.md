# 远程控制（WebRTC 信令与配对码）

当前后端内置了简易信令服务（WebSocket）与配对码接口，便于接入 Android Agent 与前端控制端。

## 配置
- `.env` 关键项：
  - `SIGNALING_PATH`：WebSocket 路径，默认 `/ws`
  - `SIGNALING_PAIR_TTL_MS`：配对码有效期（默认 30 分钟）
  - `STUN_SERVERS`：逗号分隔的 STUN 列表，默认 `stun:stun.l.google.com:19302`
  - `TURN_SERVERS`：可选，逗号分隔；格式示例 `turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349`
- 后端启动后，信令监听在 `ws://<host>:<port><SIGNALING_PATH>`。

## HTTP 接口
- `POST /api/remote/pair`（需登录）：生成配对码
  - 请求：`{ "deviceId": "可选，用于标记设备" }`
  - 响应：`{ code: "123456", deviceId: "...", expiresAt: "ISO" }`

## WebSocket 信令协议
- 连接：控制端和设备端都连接 `ws://<host>:<port><SIGNALING_PATH>`。
- 首帧：`hello`
  ```json
  {
    "type": "hello",
    "role": "device" | "controller",
    "code": "123456",
    "deviceId": "optional-device-id",
    "token": "controller 需要携带 Bearer token（登录后）"
  }
  ```
- 事件：
  - `ready`：本端已就绪
  - `device_ready` / `controller_ready`：对端上线
  - WebRTC 交换：
    - `offer`: `{ "type": "offer", "sdp": {..} }`（通常由设备端发送）
    - `answer`: `{ "type": "answer", "sdp": {..} }`
    - `candidate`: `{ "type": "candidate", "candidate": {...} }`
    - `bye`: `{ "type": "bye", "reason": "..." }`
  - 错误：`{ "type": "error", "message": "..." }`

## Android Agent 实现要点（仅 Android）
1) **配对与信令**：启动时请求用户输入或从后台下发配对码 → 连接 `/ws` → 发送 `hello`（role=device）。
2) **媒体推流**：MediaProjection + MediaCodec 录屏编码为 H.264/H.265；创建 WebRTC PeerConnection，添加 video track；通常由设备端发 Offer。
3) **输入执行**：开 DataChannel（名随意，例如 `control`），监听 JSON 指令：
   - 点击：`{ "type": "tap", "x": 0.5, "y": 0.5 }`（相对坐标 0-1）
   - 滑动：`{ "type": "swipe", "from": [0.1,0.1], "to": [0.9,0.9], "durationMs": 300 }`
   - 按键：`{ "type": "key", "key": "back" | "home" | "recent" }`
   - 输入文本：`{ "type": "text", "value": "hello" }`
   使用 AccessibilityService 或 Instrumentation 注入事件。
4) **健壮性**：心跳（可选）、ICE 断线重连、自适应分辨率/码率（低带宽时降级）。
5) **安全**：首次录屏、辅助功能需用户确认；会话 PIN/配对码短期有效。

## 前端控制端（现有实现）
- Vue 页面集成了信令、配对码输入、WebRTC 播放和 DataChannel 指令发送（点击/返回键示例）。
- 另有“浏览器模拟设备”按钮，可在本地用屏幕共享模拟 Agent 流，验证信令链路。

## 将来要做
- 接入 coturn 正式 TURN；把 `TURN_SERVERS` 设成生产值。
- 持久化配对/会话日志（当前内存）。
- 增加控制端文件传输/剪贴板等能力（可复用 DataChannel）。  
