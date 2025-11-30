# 群控手机模拟后台

Node.js + MySQL 后端 + Vue 前端，用于模拟群控场景（设备解锁、点击/输入等操作的批量下发与执行监控）。

## 目录结构
- `backend/`：Express + MySQL API，含任务执行模拟器。
- `frontend/`：Vue 3 + Vite 单页控制台。
- `.gitignore`：忽略依赖与环境文件。

## 快速开始
1. 准备 MySQL：创建库并导入 `backend/schema.sql`。
   ```bash
   mysql -u root -p -e "CREATE DATABASE control_panel DEFAULT CHARACTER SET utf8mb4;"
   mysql -u root -p control_panel < backend/schema.sql
   ```
2. 配置环境：
   - 复制 `backend/.env.example` 为 `backend/.env`，填写 MySQL 账号。
   - 可选：`frontend/.env.example` 指定 `VITE_API_BASE_URL`（默认本地 4000）。
3. 安装依赖并启动：
   ```bash
   cd backend && npm install && npm run dev
   # 另开终端
   cd frontend && npm install && npm run dev
   ```
   前端默认 http://localhost:5173 ，通过 Vite 代理访问后端。
4. 登录前端：默认管理员账号密码在 `backend/.env`（`ADMIN_USER`/`ADMIN_PASSWORD`），首次登录后即可创建设备/脚本/任务。

## 后端要点
- 主要表：`devices`、`scripts`、`tasks`、`task_runs`。
- 管理员登录：`POST /api/auth/login`；除 `/api/health` 外的接口需要 Bearer token。
- 模拟器：按间隔扫描排队/运行中的 task_runs，根据在线概率/成功率推进进度或失败。
- 远程控制信令：内置 WebSocket 服务 `ws://<host>/ws`，`POST /api/remote/pair` 生成配对码（内存 30 分钟）。
- 可调参数（`.env`）：`SIMULATION_TICK_MS`、`SIMULATION_ONLINE_RATE`、`SIMULATION_SUCCESS_RATE`、`SIMULATION_BATCH_LIMIT`、`SIGNALING_PATH`、`STUN_SERVERS`、`TURN_SERVERS`。
- 关键接口（前缀 `/api`）：
  - `GET /health`
  - `POST /auth/login`
  - `GET/POST/PUT /devices`
  - `GET/POST /scripts`
  - `GET/POST /tasks`、`GET /tasks/:id`、`POST /tasks/:id/retry`
  - `POST /remote/pair`

## 前端要点
- Vue 3 + 纯 fetch 接口调用，支持登录、创建设备/脚本/任务、查看执行进度。
- UI 有背景渐变与卡片布局，包含设备/任务统计，并为每台设备显示一个“模拟窗口”卡片。
- 远程控制页：生成配对码，控制端通过 WebRTC 拉流并发送指令；内置“浏览器模拟设备”可本地演示信令/媒体流。
- 轮询任务列表（默认 4 秒），可手动刷新。

## 后续可扩展
- 引入 Redis 队列、WebSocket 推送。
- 增加权限、操作审计、脚本版本管理。
- 增强参数校验与表单校验。
- 部署 coturn/TURN，替换 WebRTC ICE 服务器为正式环境配置。
