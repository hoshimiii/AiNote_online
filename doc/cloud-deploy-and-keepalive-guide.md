# AiNote Linux 服务器部署与保活指南

> 适用仓库：`AiNote_online`  
> 更新时间：2026-04-15  
> 目标：在你自己的 Linux 服务器上完成可长期运行的部署，覆盖 Web、数据库、MCP Bridge 的启动、反向代理、TLS 与保活监控。

---

## 1. 推荐架构（单机版）

建议在同一台 Linux 服务器上运行以下组件：

1. **Web 主应用（Next.js）**
   - 进程管理：`systemd`（推荐）
   - 监听：`127.0.0.1:3000`
2. **MCP Bridge（`mcp-bridge/`）**
   - 进程管理：`systemd`
   - 运行方式：stdio 常驻进程
3. **反向代理（Nginx）**
   - 对外暴露：`80/443`
   - 转发到：`127.0.0.1:3000`
4. **数据库（PostgreSQL + pgvector）**
   - 可本机部署，也可云数据库

> 若你追求更高稳定性，建议数据库与应用分机部署；本文先给单机可落地方案。

---

## 2. 前置条件与版本建议

- OS：Ubuntu 22.04 / Debian 12（其他主流 Linux 发行版同理）
- Node.js：20 LTS+
- 包管理器：`pnpm`
- 数据库：PostgreSQL 14+（必须可启用 pgvector）
- 域名：已解析到服务器公网 IP（用于 HTTPS）

---

## 3. 首次部署步骤（Web）

### 3.1 安装基础环境

```bash
sudo apt update
sudo apt install -y git curl nginx postgresql postgresql-contrib
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pnpm
```

### 3.2 拉取项目并安装依赖

```bash
cd /opt
sudo git clone <你的仓库地址> AiNote_online
sudo chown -R $USER:$USER /opt/AiNote_online
cd /opt/AiNote_online
pnpm install
```

### 3.3 配置环境变量

根目录新建 `.env.production`（不要提交到 Git）：

```env
NODE_ENV=production
NEXTAUTH_URL=https://你的域名
NEXTAUTH_SECRET=替换为随机强密钥
AUTH_SECRET=替换为与NEXTAUTH_SECRET一致
DATABASE_URL=postgresql://user:password@127.0.0.1:5432/ainote?schema=public
# 可选
# PISTON_API_URL=http://127.0.0.1:2000
```

> 提示：`NEXTAUTH_URL` 必须与最终访问域名一致，否则登录态会异常。

### 3.4 初始化数据库与迁移

```bash
cd /opt/AiNote_online
pnpm prisma migrate deploy
pnpm prisma generate
```

如果数据库是新实例，请确认 pgvector 可用（本项目迁移中包含 `CREATE EXTENSION IF NOT EXISTS vector`）。

### 3.5 构建并本机启动验证

```bash
cd /opt/AiNote_online
pnpm build
PORT=3000 pnpm start
```

看到应用可访问后，再进入 systemd 托管。

---

## 4. 首次部署步骤（MCP Bridge）

### 4.1 准备 Bridge 环境变量

在 `mcp-bridge/.env` 写入：

```env
AINOTE_API_KEY=ainote_xxxxxxxx
VERCEL_API_URL=https://你的域名/api/mcp
```

> 虽然变量名是 `VERCEL_API_URL`，但它本质是“主站 MCP 接口地址”，自建 Linux 也可直接复用该命名。

### 4.2 安装依赖并验证启动

```bash
cd /opt/AiNote_online/mcp-bridge
pnpm install
pnpm start
```

Bridge 为 stdio 服务，通常由 MCP Client 拉起或通过守护进程常驻。

---

## 5. 使用 systemd 常驻运行（强烈推荐）

## 5.1 Web 服务单元

创建 `/etc/systemd/system/ainote-web.service`：

```ini
[Unit]
Description=AiNote Next.js Web
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/AiNote_online
EnvironmentFile=/opt/AiNote_online/.env.production
Environment=PORT=3000
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

### 5.2 MCP Bridge 服务单元

创建 `/etc/systemd/system/ainote-mcp-bridge.service`：

```ini
[Unit]
Description=AiNote MCP Bridge
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/AiNote_online/mcp-bridge
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

### 5.3 启动并设置开机自启

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ainote-web
sudo systemctl enable --now ainote-mcp-bridge
sudo systemctl status ainote-web
sudo systemctl status ainote-mcp-bridge
```

---

## 6. Nginx 反向代理与 HTTPS

### 6.1 Nginx 站点配置

创建 `/etc/nginx/sites-available/ainote.conf`：

```nginx
server {
  listen 80;
  server_name 你的域名;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

启用并重载：

```bash
sudo ln -s /etc/nginx/sites-available/ainote.conf /etc/nginx/sites-enabled/ainote.conf
sudo nginx -t
sudo systemctl reload nginx
```

### 6.2 申请 HTTPS 证书（Let’s Encrypt）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```

执行后会自动配置 TLS 与续期任务。

---

## 7. 保活与监控（Linux 自建重点）

### 7.1 进程级保活

- 已通过 `systemd` 的 `Restart=always` 实现异常自动拉起
- 建议额外配置：
  - `StartLimitIntervalSec` 与 `StartLimitBurst`，避免异常抖动
  - 日志轮转（`journald` 或 `logrotate`）

### 7.2 接口探活（HTTP）

建议每 5 分钟探活一次：

- `https://你的域名/api/auth/session`
- （可选）`https://你的域名/api/mcp` 做全链路探活

全链路探活请求体：

```json
{
  "toolName": "list_workspaces",
  "arguments": {}
}
```

### 7.3 定时探活任务（crontab 示例）

```bash
*/5 * * * * curl -fsS https://你的域名/api/auth/session >/dev/null || logger -t ainote "session healthcheck failed"
```

> 该任务不是“防冷启动”，而是“提前发现不可用并告警”。自建服务器一般不存在 serverless 冷启动问题。

### 7.4 监控与告警建议

- **基础监控**：Uptime Kuma（自建）或 Better Stack
- **系统监控**：Node Exporter + Prometheus + Grafana（可选）
- **最低告警集**：
  1. 站点 5xx 连续 3 次
  2. `ainote-web`/`ainote-mcp-bridge` 进程退出
  3. PostgreSQL 不可连接

---

## 8. 发布更新流程（建议）

每次更新建议执行：

```bash
cd /opt/AiNote_online
git pull
pnpm install
pnpm prisma migrate deploy
pnpm build
sudo systemctl restart ainote-web

cd /opt/AiNote_online/mcp-bridge
pnpm install
sudo systemctl restart ainote-mcp-bridge
```

---

## 9. 常见问题排查

1. **登录后立刻掉线 / Session 异常**
   - 检查 `NEXTAUTH_URL` 是否与你访问域名完全一致（含 https）
   - 检查 Nginx 是否透传 `X-Forwarded-Proto`

2. **`/api/mcp` 返回 401**
   - 检查 `AINOTE_API_KEY` 是否正确
   - 检查 `mcp-bridge/.env` 的 `VERCEL_API_URL` 是否指向你的 Linux 域名 `/api/mcp`

3. **向量检索报错（vector 类型）**
   - 检查 PostgreSQL 是否启用 pgvector
   - 检查迁移是否成功执行

4. **服务反复重启**
   - `journalctl -u ainote-web -f` 查看日志
   - 检查 `.env.production` 是否缺失必需变量

---

## 10. 上线验收清单

- [ ] `ainote-web` 服务运行正常且开机自启
- [ ] `ainote-mcp-bridge` 服务运行正常且开机自启
- [ ] Nginx + HTTPS 配置成功，公网可访问
- [ ] 登录/登出可用，`/api/auth/session` 正常
- [ ] `/api/mcp` 可通过 API Key 成功调用
- [ ] Prisma 迁移完成，`vector` 扩展可用
- [ ] 探活任务与告警已验证

---

## 11. 一句话总结

在 Linux 自建场景下，稳定性的关键是：

- 用 `systemd` 托管 Web 与 Bridge
- 用 Nginx + HTTPS 提供公网入口
- 用定时探活 + 告警形成运维闭环
- 用规范化发布流程降低升级风险
