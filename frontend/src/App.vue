<template>
  <div class="app-shell">
    <!-- 简易舞蹈投票页 -->
    <div v-if="!showOld" class="card vote-card">
      <div class="header" style="margin-bottom: 8px">
        <div>
          <div class="badge">舞蹈投票 · Demo</div>
          <h1 class="title">人气投票</h1>
          <p class="subtitle">为你喜欢的选手投上一票，实时累加。</p>
        </div>
        <button class="secondary" @click="showOld = true">返回后台</button>
      </div>
      <div class="vote-grid">
        <div v-for="item in candidates" :key="item.id" class="vote-card-item">
          <div class="vote-rank">#{{ item.rank }}</div>
          <div class="vote-name">{{ item.name }}</div>
          <div class="vote-team">{{ item.team }}</div>
          <div class="vote-count">票数：{{ item.votes }}</div>
          <button @click="voteFor(item.id)">投票</button>
        </div>
      </div>
    </div>

    <div v-show="showOld">
    <div v-if="!isAuthed" class="card auth-card">
      <h3>管理员登录</h3>
      <p class="muted">默认账号密码在 <code>backend/.env</code> 中，可自行修改。</p>
      <form class="form" @submit.prevent="handleLogin">
        <div class="row">
          <div style="flex: 1">
            <label>用户名</label>
            <input v-model="authForm.username" required autocomplete="username" />
          </div>
          <div style="flex: 1">
            <label>密码</label>
            <input
              v-model="authForm.password"
              type="password"
              required
              autocomplete="current-password"
            />
          </div>
        </div>
        <button type="submit" :disabled="creating.login">
          {{ creating.login ? '登录中...' : '登录' }}
        </button>
      </form>
    </div>

    <template v-else>
      <div class="header">
        <div>
          <div class="badge">模拟群控 · Node + Vue</div>
          <h1 class="title">群控手机后台</h1>
          <p class="subtitle">解锁、打开应用、点击/输入等操作的模拟执行与状态监控。</p>
        </div>
        <div class="pill">
          <div>设备: {{ devices.length }}</div>
          <div>任务: {{ tasks.length }}</div>
          <div class="muted">管理员：{{ currentUser }}</div>
          <button class="secondary" @click="handleLogout">退出</button>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <h3>新增设备</h3>
          <p class="muted">创建虚拟设备，后续可批量下发脚本。</p>
          <form class="form" @submit.prevent="handleCreateDevice">
            <div class="row">
              <div style="flex: 1">
                <label>设备名称</label>
                <input v-model="newDevice.name" placeholder="Pixel 7 Pro / 测试机 A" required />
              </div>
              <div style="flex: 1">
                <label>机型</label>
                <input v-model="newDevice.model" placeholder="Pixel 7" />
              </div>
            </div>
            <div class="row">
              <div style="flex: 1">
                <label>系统版本</label>
                <input v-model="newDevice.osVersion" placeholder="Android 13" />
              </div>
              <div style="flex: 1">
                <label>分辨率</label>
                <input v-model="newDevice.resolution" placeholder="1080x2400" />
              </div>
            </div>
            <div class="row">
              <div style="flex: 1">
                <label>标签 (逗号分隔)</label>
                <input v-model="newDevice.tags" placeholder="demo,qa" />
              </div>
              <div style="width: 160px">
                <label>在线概率</label>
                <input
                  v-model.number="newDevice.onlineProbability"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                />
              </div>
            </div>
            <button type="submit" :disabled="creating.device">
              {{ creating.device ? '创建中...' : '创建设备' }}
            </button>
          </form>
        </div>

        <div class="card">
          <h3>新增脚本</h3>
          <p class="muted">脚本用 JSON 表达步骤，可直接引用或修改模板。</p>
          <form class="form" @submit.prevent="handleCreateScript">
            <label>脚本名称</label>
            <input v-model="newScript.name" placeholder="解锁 + 打开抖音" required />
            <label>描述</label>
            <input v-model="newScript.description" placeholder="模拟解锁并打开目标应用" />
            <label>步骤 (JSON)</label>
            <textarea
              v-model="newScript.stepsText"
              rows="6"
              spellcheck="false"
              placeholder='[{"type":"unlock","params":{"pin":"1234"}}]'
            ></textarea>
            <button type="submit" :disabled="creating.script">
              {{ creating.script ? '保存中...' : '保存脚本' }}
            </button>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="row" style="justify-content: space-between; align-items: center">
          <div>
            <h3>设备列表</h3>
            <p class="muted">
              在线 {{ deviceStats.online }} · 忙碌 {{ deviceStats.busy }} · 离线 {{ deviceStats.offline }}
            </p>
          </div>
          <button class="secondary" @click="loadDevices">刷新</button>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>设备</th>
              <th>机型</th>
              <th>系统</th>
              <th>状态</th>
              <th>标签</th>
              <th>最近</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!devices.length">
              <td colspan="6" class="muted">暂无设备，先添加一个吧。</td>
            </tr>
            <tr v-for="device in devices" :key="device.id">
              <td>{{ device.name }}</td>
              <td>{{ device.model }}</td>
              <td>{{ device.osVersion }}</td>
              <td>
                <span class="status" :class="device.status">{{ device.status }}</span>
              </td>
              <td>
                <span v-for="tag in device.tags" :key="tag" class="chip">{{ tag }}</span>
              </td>
              <td class="muted">{{ device.lastSeen ? formatTime(device.lastSeen) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <h3>设备模拟窗口</h3>
        <p class="muted">为每台设备显示一个虚拟屏幕，呈现状态与最近心跳。</p>
        <div class="device-wall">
          <div v-for="device in devices" :key="`win-${device.id}`" class="phone">
            <div class="phone-status">
              <span class="dot" :class="device.status"></span>
              {{ device.status }}
            </div>
            <div class="phone-name">{{ device.name }}</div>
            <div class="phone-body">
              <div class="phone-app">App: {{ device.tags[0] || 'demo' }}</div>
              <div class="phone-log">Last seen: {{ device.lastSeen ? formatTime(device.lastSeen) : '—' }}</div>
              <div class="phone-meter">
                <span :style="{ width: `${Math.round((device.onlineProbability || 0.8) * 100)}%` }"></span>
              </div>
              <div class="phone-foot">{{ device.model || 'Virtual Device' }}</div>
            </div>
          </div>
          <div v-if="!devices.length" class="muted">暂无设备窗口</div>
        </div>
      </div>

      <div class="card">
        <div class="row" style="justify-content: space-between; align-items: center">
          <div>
            <h3>创建群控任务</h3>
            <p class="muted">
              选择脚本和设备，后台模拟执行（解锁/点击/输入）。
            </p>
          </div>
          <button class="secondary" @click="loadTasks">刷新任务</button>
        </div>
        <form class="form" @submit.prevent="handleCreateTask">
          <div class="row">
            <div style="flex: 1">
              <label>脚本</label>
              <select v-model="newTask.scriptId" required>
                <option value="" disabled>请选择脚本</option>
                <option v-for="script in scripts" :key="script.id" :value="script.id">
                  {{ script.name }}
                </option>
              </select>
            </div>
            <div style="flex: 1">
              <label>设备 (可多选)</label>
              <select v-model="newTask.deviceIds" multiple size="4" required>
                <option v-for="device in devices" :key="device.id" :value="device.id">
                  {{ device.name }} · {{ device.status }}
                </option>
              </select>
            </div>
          </div>
          <label>Payload / 参数 (可选 JSON)</label>
          <textarea
            v-model="newTask.payloadText"
            rows="4"
            spellcheck="false"
            placeholder='{"account":"demo","text":"hello"}'
          ></textarea>
          <div class="row" style="justify-content: flex-end">
            <button type="submit" :disabled="creating.task">
              {{ creating.task ? '下发中...' : '创建任务' }}
            </button>
          </div>
        </form>
      </div>

      <div class="card">
        <div class="row" style="justify-content: space-between; align-items: center">
          <div>
            <h3>任务执行</h3>
            <p class="muted">
              运行中 {{ taskStats.running }} · 成功 {{ taskStats.success }} · 失败/部分失败
              {{ taskStats.failed }}
            </p>
          </div>
          <button class="secondary" @click="loadTasks">刷新</button>
        </div>
        <div class="task-list">
          <div v-if="!tasks.length" class="muted">暂无任务，先创建一个。</div>
          <div v-for="task in tasks" :key="task.id" class="task-card">
            <div class="task-header">
              <div>
                <div class="muted">{{ task.id.slice(0, 8) }}</div>
                <div style="display: flex; gap: 8px; align-items: center">
                  <strong>{{ findScriptName(task.scriptId) }}</strong>
                  <span class="status" :class="statusClass(task.status)">{{ task.status }}</span>
                </div>
                <div class="muted" style="margin-top: 4px">
                  目标设备 {{ task.targetDevices?.length || 0 }} · 进度 {{ task.progress || 0 }}%
                </div>
              </div>
              <div style="display: flex; gap: 8px; align-items: center">
                <div class="chip">成功 {{ task.stats?.success || 0 }}</div>
                <div class="chip">失败 {{ task.stats?.failed || 0 }}</div>
                <div class="chip">排队 {{ task.stats?.queued || 0 }}</div>
                <button
                  class="secondary"
                  :disabled="task.status === 'running'"
                  @click="() => retryTask(task.id)"
                >
                  重试失败设备
                </button>
              </div>
            </div>
            <div class="progress" style="margin: 10px 0 6px">
              <span :style="{ width: `${task.progress || 0}%` }"></span>
            </div>
            <div class="muted">
              创建：{{ formatTime(task.createdAt) }}
              <span v-if="task.finishedAt"> · 结束：{{ formatTime(task.finishedAt) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="row" style="justify-content: space-between; align-items: center">
          <div>
            <h3>远程控制 (WebRTC，本地演示)</h3>
            <p class="muted">
              生成配对码 → 安卓 Agent 用配对码注册 → 通过信令+TURN 建立通话；本地可用“浏览器模拟设备”验证流程。
            </p>
          </div>
          <button class="secondary" @click="disconnectRemote">断开</button>
        </div>

        <div class="grid">
          <div class="card" style="background: transparent; border: 1px dashed rgba(255,255,255,0.1)">
            <h4>控制端</h4>
            <div class="form">
              <label>配对码</label>
              <div class="row">
                <input v-model="remoteState.pairCode" placeholder="6 位数字" style="flex:1" />
                <button class="secondary" @click="fetchPairCode">生成</button>
              </div>
              <label>设备 ID (可选，便于审计)</label>
              <input v-model="remoteState.deviceId" placeholder="device-123" />
              <div class="row">
                <button type="button" @click="connectController" :disabled="remoteState.status === 'connecting'">
                  {{ remoteState.status === 'connected' ? '已连接' : '连接远程' }}
                </button>
                <button class="secondary" type="button" @click="sendTapCenter" :disabled="!remoteState.dataChannel">
                  发送一次点击
                </button>
                <button class="secondary" type="button" @click="sendBack" :disabled="!remoteState.dataChannel">
                  发送返回键
                </button>
              </div>
              <div class="muted">状态：{{ remoteState.status }} · 信令：{{ signalingUrl }}</div>
              <div class="muted">日志</div>
              <div class="remote-log">
                <div v-for="(line, idx) in remoteState.log" :key="`log-${idx}`">{{ line }}</div>
              </div>
            </div>
          </div>

          <div class="card" style="background: transparent; border: 1px dashed rgba(255,255,255,0.1)">
            <h4>远程画面</h4>
            <div class="video-box">
              <video ref="remoteVideo" autoplay playsinline muted></video>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top: 10px; background: transparent; border: 1px dashed rgba(255,255,255,0.1)">
          <h4>浏览器模拟设备 (方便本地验证信令/WebRTC)</h4>
          <p class="muted">
            点击启动后选择共享一个窗口/屏幕，模拟“设备端 Agent”推流并接收指令。
          </p>
          <div class="row">
            <button type="button" @click="startSimulator" :disabled="simulator.running">
              {{ simulator.running ? '运行中' : '启动模拟设备' }}
            </button>
            <button class="secondary" type="button" @click="stopSimulator" :disabled="!simulator.running">
              停止
            </button>
            <div class="muted">使用同一个配对码：{{ remoteState.pairCode || '先生成' }}</div>
          </div>
        </div>
      </div>
    </template>

    <div v-if="toast.message" class="toast" :class="toast.kind">
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, onUnmounted } from 'vue';
import { api, setToken, getToken } from './api/client';

const devices = ref([]);
const scripts = ref([]);
const tasks = ref([]);
const showOld = ref(false);
const candidates = reactive([
  { id: 'a', name: '选手 A', team: '火花舞团', votes: 1280, rank: 1 },
  { id: 'b', name: '选手 B', team: '霓虹舞社', votes: 1120, rank: 2 },
  { id: 'c', name: '选手 C', team: '节奏联盟', votes: 980, rank: 3 },
  { id: 'd', name: '选手 D', team: '街舞小队', votes: 860, rank: 4 }
]);

const creating = reactive({
  device: false,
  script: false,
  task: false,
  login: false
});

const toast = reactive({ message: '', kind: 'info', timer: null });

const token = ref(getToken());
const currentUser = ref(token.value ? 'admin' : '');
const isAuthed = computed(() => !!token.value);

const newDevice = reactive({
  name: '测试设备 A',
  model: 'Pixel 7',
  osVersion: 'Android 13',
  resolution: '1080x2400',
  tags: 'demo,qa',
  onlineProbability: 0.88
});

const newScript = reactive({
  name: '解锁 + 打开应用',
  description: '解锁屏幕后打开应用并点击/输入',
  stepsText: JSON.stringify(
    [
      { type: 'unlock', params: { mode: 'pin', value: '1234' } },
      { type: 'openApp', params: { package: 'com.demo.app' } },
      { type: 'click', params: { x: 240, y: 720 } },
      { type: 'input', params: { text: 'hello world' } }
    ],
    null,
    2
  )
});

const newTask = reactive({
  scriptId: '',
  deviceIds: [],
  payloadText: JSON.stringify({ account: 'demo', text: 'hello' }, null, 2)
});

const authForm = reactive({
  username: 'admin',
  password: 'admin123'
});

const remoteVideo = ref(null);
const signalingUrl = ref(
  import.meta.env.VITE_SIGNALING_URL ||
    `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://localhost:4000/ws`
);

const iceServers = (() => {
  const servers = [];
  const stunList =
    import.meta.env.VITE_STUN_SERVERS || 'stun:stun.l.google.com:19302,stun:global.stun.twilio.com:3478';
  stunList
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((url) => servers.push({ urls: url }));
  if (import.meta.env.VITE_TURN_URL) {
    servers.push({
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USERNAME || '',
      credential: import.meta.env.VITE_TURN_PASSWORD || ''
    });
  }
  return servers;
})();

const remoteState = reactive({
  pairCode: '',
  deviceId: '',
  status: 'idle',
  log: [],
  ws: null,
  pc: null,
  dataChannel: null
});

const simulator = reactive({
  running: false,
  ws: null,
  pc: null,
  stream: null
});

const deviceStats = computed(() => ({
  online: devices.value.filter((d) => d.status === 'online').length,
  busy: devices.value.filter((d) => d.status === 'busy').length,
  offline: devices.value.filter((d) => d.status === 'offline').length
}));

const taskStats = computed(() => ({
  running: tasks.value.filter((t) => t.status === 'running').length,
  success: tasks.value.filter((t) => t.status === 'success').length,
  failed: tasks.value.filter(
    (t) => t.status === 'failed' || t.status === 'partial_failed'
  ).length
}));

const setToast = (message, kind = 'info') => {
  toast.message = message;
  toast.kind = kind;
  if (toast.timer) clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    toast.message = '';
  }, 3200);
};

const handleUnauthorized = (err) => {
  const msg = (err && err.message) || '';
  if (err?.code === 401 || /unauthorized/i.test(msg)) {
    handleLogout();
    setToast('登录过期，请重新登录', 'error');
    return true;
  }
  return false;
};

const appendLog = (line) => {
  remoteState.log.push(line);
  if (remoteState.log.length > 50) {
    remoteState.log.shift();
  }
};

const formatTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleString();
};

const findScriptName = (id) => scripts.value.find((s) => s.id === id)?.name || '未命名脚本';

const statusClass = (status) => status || 'queued';

const loadDevices = async () => {
  try {
    devices.value = await api.getDevices();
  } catch (err) {
    if (handleUnauthorized(err)) return;
    setToast(`加载设备失败: ${err.message}`, 'error');
  }
};

const loadScripts = async () => {
  try {
    scripts.value = await api.getScripts();
    if (!newTask.scriptId && scripts.value.length) {
      newTask.scriptId = scripts.value[0].id;
    }
  } catch (err) {
    if (handleUnauthorized(err)) return;
    setToast(`加载脚本失败: ${err.message}`, 'error');
  }
};

const loadTasks = async () => {
  try {
    tasks.value = await api.getTasks();
  } catch (err) {
    if (handleUnauthorized(err)) return;
    setToast(`加载任务失败: ${err.message}`, 'error');
  }
};

const loadAll = async () => {
  await Promise.all([loadDevices(), loadScripts(), loadTasks()]);
};

const handleCreateDevice = async () => {
  try {
    creating.device = true;
    const tags = newDevice.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = {
      name: newDevice.name,
      model: newDevice.model,
      osVersion: newDevice.osVersion,
      resolution: newDevice.resolution,
      tags,
      onlineProbability: Number(newDevice.onlineProbability) || 0.85
    };
    await api.createDevice(payload);
    setToast('设备已创建');
    await loadDevices();
  } catch (err) {
    if (handleUnauthorized(err)) return;
    setToast(err.message || '创建设备失败', 'error');
  } finally {
    creating.device = false;
  }
};

const handleCreateScript = async () => {
  try {
    creating.script = true;
    const steps = JSON.parse(newScript.stepsText || '[]');
    await api.createScript({
      name: newScript.name,
      description: newScript.description,
      steps
    });
    setToast('脚本已保存');
    await loadScripts();
  } catch (err) {
    if (handleUnauthorized(err)) return;
    setToast(`保存脚本失败: ${err.message}`, 'error');
  } finally {
    creating.script = false;
  }
};

const handleCreateTask = async () => {
  if (!newTask.scriptId || !newTask.deviceIds.length) {
    setToast('请选择脚本和设备', 'error');
    return;
  }
  try {
    creating.task = true;
    const payload = newTask.payloadText ? JSON.parse(newTask.payloadText) : {};
    await api.createTask({
      scriptId: newTask.scriptId,
      deviceIds: newTask.deviceIds,
      payload
    });
    setToast('任务已创建');
    await loadTasks();
  } catch (err) {
    if (handleUnauthorized(err)) return;
    setToast(`创建任务失败: ${err.message}`, 'error');
  } finally {
    creating.task = false;
  }
};

const retryTask = async (taskId) => {
  try {
    await api.retryTask(taskId);
    setToast('已重试失败设备');
    await loadTasks();
  } catch (err) {
    if (handleUnauthorized(err)) return;
    setToast(`重试失败: ${err.message}`, 'error');
  }
};

const voteFor = (id) => {
  const target = candidates.find((c) => c.id === id);
  if (!target) return;
  target.votes += 1;
  setToast(`已为 ${target.name} 投票`);
};

const handleLogin = async () => {
  try {
    creating.login = true;
    const res = await api.login({
      username: authForm.username,
      password: authForm.password
    });
    setToken(res.token);
    token.value = res.token;
    currentUser.value = res.user?.username || authForm.username;
    setToast('登录成功');
    await loadAll();
    startPolling();
  } catch (err) {
    setToast(`登录失败: ${err.message}`, 'error');
  } finally {
    creating.login = false;
  }
};

const handleLogout = () => {
  setToken('');
  token.value = '';
  currentUser.value = '';
  devices.value = [];
  scripts.value = [];
  tasks.value = [];
  stopPolling();
  disconnectRemote();
};

let poller = null;
const startPolling = () => {
  if (poller) return;
  poller = setInterval(loadTasks, 4000);
};

const stopPolling = () => {
  if (poller) clearInterval(poller);
  poller = null;
};

// --- Remote control ---
const sendWS = (ws, payload) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
};

const cleanupRemote = () => {
  if (remoteState.ws) {
    remoteState.ws.close();
  }
  if (remoteState.pc) {
    remoteState.pc.getSenders().forEach((s) => s.track && s.track.stop());
    remoteState.pc.close();
  }
  remoteState.ws = null;
  remoteState.pc = null;
  remoteState.dataChannel = null;
  remoteState.status = 'idle';
};

const disconnectRemote = () => {
  cleanupRemote();
  appendLog('已断开');
};

const fetchPairCode = async () => {
  try {
    const res = await api.createPair({ deviceId: remoteState.deviceId || undefined });
    remoteState.pairCode = res.code;
    setToast(`新配对码: ${res.code}`);
  } catch (err) {
    if (handleUnauthorized(err)) return;
    setToast(`获取配对码失败: ${err.message}`, 'error');
  }
};

const ensurePC = () => {
  if (remoteState.pc) return remoteState.pc;
  const pc = new RTCPeerConnection({ iceServers });
  pc.onicecandidate = (ev) => {
    if (ev.candidate) {
      sendWS(remoteState.ws, { type: 'candidate', candidate: ev.candidate });
    }
  };
  pc.ontrack = (ev) => {
    const [stream] = ev.streams;
    appendLog('收到视频流/track');
    if (remoteVideo.value) {
      remoteVideo.value.srcObject = stream || new MediaStream([ev.track]);
      remoteVideo.value.play().catch(() => {});
    }
  };
  pc.ondatachannel = (ev) => {
    remoteState.dataChannel = ev.channel;
    ev.channel.onmessage = (msg) => appendLog(`设备消息: ${msg.data}`);
  };
   pc.oniceconnectionstatechange = () => {
    appendLog(`ICE: ${pc.iceConnectionState}`);
  };
  pc.onconnectionstatechange = () => {
    appendLog(`PC: ${pc.connectionState}`);
  };
  remoteState.pc = pc;
  return pc;
};

const connectController = () => {
  if (!remoteState.pairCode) {
    setToast('请填写或生成配对码', 'error');
    return;
  }
  cleanupRemote();
  remoteState.status = 'connecting';
  const ws = new WebSocket(signalingUrl.value);
  remoteState.ws = ws;

  ws.onopen = () => {
    sendWS(ws, {
      type: 'hello',
      role: 'controller',
      code: remoteState.pairCode,
      deviceId: remoteState.deviceId,
      token: getToken()
    });
    appendLog('信令已连接，等待设备...');
  };

  ws.onmessage = async (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      return;
    }
    if (msg.type === 'ready') {
      remoteState.status = 'waiting';
      appendLog('已就绪，等待设备');
    }
    if (msg.type === 'device_ready') {
      remoteState.status = 'connected';
      appendLog(`设备上线：${msg.deviceId || ''}`);
    }
    if (msg.type === 'offer' && msg.sdp) {
      const pc = ensurePC();
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendWS(ws, { type: 'answer', sdp: pc.localDescription });
      remoteState.status = 'connected';
      appendLog('已应答设备 Offer');
    }
    if (msg.type === 'candidate' && msg.candidate) {
      const pc = ensurePC();
      await pc.addIceCandidate(msg.candidate);
    }
    if (msg.type === 'bye') {
      appendLog('设备断开');
      remoteState.status = 'idle';
    }
    if (msg.type === 'error') {
      setToast(`信令错误: ${msg.message}`, 'error');
    }
  };

  ws.onerror = () => {
    setToast('信令连接失败', 'error');
    remoteState.status = 'idle';
  };

  ws.onclose = () => {
    remoteState.status = 'idle';
  };
};

const sendTapCenter = () => {
  if (!remoteState.dataChannel) return;
  const payload = JSON.stringify({ type: 'tap', x: 0.5, y: 0.5 });
  remoteState.dataChannel.send(payload);
  appendLog('已发送点击 (0.5,0.5)');
};

const sendBack = () => {
  if (!remoteState.dataChannel) return;
  const payload = JSON.stringify({ type: 'key', key: 'back' });
  remoteState.dataChannel.send(payload);
  appendLog('已发送返回键');
};

// Device simulator (runs in browser to validate flow)
const startSimulator = async () => {
  if (!remoteState.pairCode) {
    setToast('先生成一个配对码', 'error');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: 720, height: 1280, frameRate: 20 },
      audio: false
    });
    simulator.running = true;
    simulator.stream = stream;

    const ws = new WebSocket(signalingUrl.value);
    simulator.ws = ws;
    const pc = new RTCPeerConnection({ iceServers });
    simulator.pc = pc;

    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    const dc = pc.createDataChannel('control');
    dc.onmessage = (ev) => {
      appendLog(`设备模拟收到: ${ev.data}`);
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        sendWS(ws, { type: 'candidate', candidate: ev.candidate });
      }
    };
    pc.oniceconnectionstatechange = () => appendLog(`(模拟设备) ICE: ${pc.iceConnectionState}`);
    pc.onconnectionstatechange = () => appendLog(`(模拟设备) PC: ${pc.connectionState}`);

    const makeOffer = async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendWS(ws, { type: 'offer', sdp: pc.localDescription });
      appendLog('模拟设备发送 Offer');
    };

    ws.onopen = () => {
      sendWS(ws, { type: 'hello', role: 'device', code: remoteState.pairCode });
    };
    ws.onmessage = async (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      if (msg.type === 'controller_ready') {
        await makeOffer();
      }
      if (msg.type === 'answer' && msg.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        appendLog('模拟设备收到 Answer');
      }
      if (msg.type === 'candidate' && msg.candidate) {
        await pc.addIceCandidate(msg.candidate);
      }
    };

    ws.onclose = stopSimulator;
    ws.onerror = stopSimulator;
  } catch (err) {
    setToast(`启动模拟设备失败: ${err.message}`, 'error');
    stopSimulator();
  }
};

const stopSimulator = () => {
  simulator.running = false;
  if (simulator.ws) simulator.ws.close();
  if (simulator.pc) simulator.pc.close();
  if (simulator.stream) simulator.stream.getTracks().forEach((t) => t.stop());
  simulator.ws = null;
  simulator.pc = null;
  simulator.stream = null;
};

onMounted(async () => {
  if (isAuthed.value) {
    await loadAll();
    startPolling();
  }
});

onUnmounted(() => {
  stopPolling();
  disconnectRemote();
  stopSimulator();
  if (toast.timer) clearTimeout(toast.timer);
});
</script>
