# Backend (Node.js + Express + MySQL)

Simulated群控后台后端，提供设备、脚本、任务接口并内置任务执行模拟器。

## 环境准备
1. 确保本地有 Node.js 18+、MySQL 5.7+/8.0。
2. 创建数据库：
   ```sql
   CREATE DATABASE control_panel DEFAULT CHARACTER SET utf8mb4;
   USE control_panel;
   SOURCE ./schema.sql;
   ```
3. 复制 `.env.example` 为 `.env`，根据环境填写 MySQL 账号与端口。
4. 安装依赖并启动：
   ```bash
   npm install
   npm run dev
   ```

## 主要脚本
- `npm run dev`：启动 HTTP 服务与模拟任务执行器。
- `npm start`：生产模式启动。

## 关键接口 (简略)
- `GET /api/health`：健康检查。
- `POST /api/auth/login`：管理员登录（账号密码由环境变量配置，默认 admin/admin123）。
- `GET/POST/PUT /api/devices`：设备列表、创建、更新。
- `POST /api/scripts`、`GET /api/scripts/:id`：脚本管理。
- `POST /api/tasks`：创建任务（携带 `scriptId`、`deviceIds`、可选 `payload`）。
- `GET /api/tasks`、`GET /api/tasks/:id`：任务与执行明细。
- `POST /api/tasks/:id/retry`：重试失败的设备执行。
- `POST /api/remote/pair`：生成远程控制配对码（内存存储，默认 30 分钟）。
- WebSocket 信令：`ws://host:port/ws`（可配 `SIGNALING_PATH`），用于 WebRTC Offer/Answer 交换。

## 模拟逻辑
- 任务执行器每 `SIMULATION_TICK_MS` 扫描运行/排队的设备执行。
- `SIMULATION_ONLINE_RATE` 控制在线概率，`SIMULATION_SUCCESS_RATE` 控制操作成功概率。
- 设备在执行时标记为 `busy`，完成后回到 `online`，离线失败会标记为 `offline`。

## 后续可扩展
- 接入 Redis 做队列和速率控制。
- 增加审计日志、权限、WebSocket 推送。
- 引入 joi/zod 等做参数校验。
- 接入 TURN（coturn）并将 `STUN_SERVERS`/`TURN_SERVERS` 写入环境变量。
