CREATE TABLE IF NOT EXISTS devices (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  model VARCHAR(128) DEFAULT '',
  os_version VARCHAR(64) DEFAULT '',
  resolution VARCHAR(64) DEFAULT '',
  tags JSON,
  status VARCHAR(32) DEFAULT 'online',
  online_probability DECIMAL(5,2) DEFAULT 0.85,
  last_seen DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_devices_status (status),
  INDEX idx_devices_updated (updated_at)
);

CREATE TABLE IF NOT EXISTS scripts (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  steps JSON,
  version INT DEFAULT 1,
  created_by VARCHAR(128),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(36) PRIMARY KEY,
  script_id VARCHAR(36) NOT NULL,
  payload JSON,
  target_devices JSON,
  status VARCHAR(32) DEFAULT 'queued',
  progress INT DEFAULT 0,
  created_by VARCHAR(128),
  started_at DATETIME,
  finished_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tasks_status (status),
  INDEX idx_tasks_created (created_at),
  FOREIGN KEY (script_id) REFERENCES scripts(id)
);

CREATE TABLE IF NOT EXISTS task_runs (
  id VARCHAR(36) PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(36) NOT NULL,
  status VARCHAR(32) DEFAULT 'queued',
  progress INT DEFAULT 0,
  log TEXT,
  last_message VARCHAR(255),
  started_at DATETIME,
  finished_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_task_runs_task (task_id),
  INDEX idx_task_runs_status (status),
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

-- Sample script to simulate unlock + open app (optional seed)
-- INSERT INTO scripts (id, name, description, steps, version, created_by)
-- VALUES (
--   UUID(),
--   'Unlock & Open App',
--   'Simulates unlock, start app, click and input',
--   JSON_ARRAY(
--     JSON_OBJECT('type', 'unlock', 'details', JSON_OBJECT('mode', 'pin', 'value', '1234')),
--     JSON_OBJECT('type', 'openApp', 'details', JSON_OBJECT('package', 'com.demo.app')),
--     JSON_OBJECT('type', 'click', 'details', JSON_OBJECT('x', 120, 'y', 240)),
--     JSON_OBJECT('type', 'input', 'details', JSON_OBJECT('text', 'hello world'))
--   ),
--   1,
--   'system'
-- );
