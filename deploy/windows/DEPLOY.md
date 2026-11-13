# Windows Server 部署手册

面向腾讯云 Windows Server（2019 / 2022），部署 `node/server` 后端，并用 HTTPS 域名供小程序调用。

全程 PowerShell（管理员）。所有路径保持纯 ASCII，避免中文路径在服务、日志、备份里出编码问题。

---

## 0. 架构与目录约定

```
公网 443 ──> Nginx / Caddy（HTTPS 终止 + 反代）──> 127.0.0.1:3001 ──> node bin/www
                                                              └─> MySQL 127.0.0.1:3306
```

| 目录 | 用途 |
|---|---|
| `C:\apps\badminton\repo` | git clone 的仓库，后端在 `repo\node\server` |
| `C:\apps\badminton\caddy` | `caddy.exe` + `Caddyfile` + 证书缓存 |
| `C:\apps\badminton\nssm` | `nssm.exe`（把 node 注册成 Windows 服务） |
| `C:\apps\badminton\logs` | 应用日志、Caddy 访问日志 |
| `C:\apps\badminton\backups` | 数据库与头像备份 |

> **路径说明**：下文统一用 `C:\apps\badminton\repo\node\server` 指代后端目录。
> 如果你的项目放在别的位置（例如已经解压在 `C:\project\badminton_shopkeeper\node\node\server`），把下文所有该路径换成实际路径，并在注册服务与备份时用 `-ServerDir` 显式指定——脚本默认不会去别处找。

**为什么不放 `C:\Program Files`**：该目录写文件需要管理员权限，日志和头像写入会被拒。

**为什么不用 pm2**：pm2 在 Windows 上的服务化（`pm2-windows-service`）早已停止维护，路径和权限坑多。NSSM 是 Windows 上最稳的进程守护方案，自带崩溃重启、日志重定向和日志切割，能力足够。

**重要：只能单实例**。`bin/www` 启动时会跑建表补索引和垃圾数据回收定时器，多开进程会重复执行回收逻辑。

---

## 1. 前置：域名与放行端口

### 1.1 DNS

在域名解析里加一条 A 记录指向服务器公网 IP。**如果这个域名已经在跑别的项目（比如已有 443 站点），说明 A 记录早就配好了，跳过本节。**

### 1.2 腾讯云安全组 / 防火墙

控制台放行入站 **80**、**443**、**3389**。

**不要放行 3001**。后端只监听本机，由 Nginx 反代对外，直接暴露端口等于绕过了 HTTPS。

### 1.3 Windows 防火墙

```powershell
New-NetFirewallRule -DisplayName "HTTP 80"  -Direction Inbound -Protocol TCP -LocalPort 80  -Action Allow
New-NetFirewallRule -DisplayName "HTTPS 443" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

---

## 2. 安装运行时

以下都下载到 `C:\temp`（先 `New-Item -ItemType Directory -Force C:\temp`）。

### 2.1 Node.js

打开 <https://nodejs.org/en/download>，下载 **LTS x64 的 .msi**（当前建议 Node 22 LTS），双击默认安装即可。

装完新开一个 PowerShell 窗口验证：

```powershell
node -v
npm -v
```

> 不要用 Node 24 之前的奇数版本（如 21、23），非 LTS 在服务器上没有意义。

### 2.2 Git

<https://git-scm.com/download/win>，默认安装。

### 2.3 MySQL 8.0

<https://dev.mysql.com/downloads/installer/> 下载 `mysql-installer-community-*.msi`，安装时选 **Server only**：

- Config Type：`Server Computer`
- 端口：`3306`
- 认证方式：`Use Strong Password Encryption`（caching_sha2_password）——项目用 mysql2 驱动，支持该插件
- Root 密码：设置一个强密码并记下来
- Windows Service：勾选 `Start the MySQL Server at System Startup`，服务名 `MySQL80`

验证：

```powershell
Get-Service MySQL80
```

### 2.4 NSSM

<https://nssm.cc/release/nssm-2.24.zip>，解压后把 `win64\nssm.exe` 放到 `C:\apps\badminton\nssm\`。

### 2.5 反向代理（Nginx 或 Caddy，二选一）

**服务器上已经有 Nginx 在跑项目 → 跳过本节**，直接看第 8A 节，复用现有 Nginx 即可。重复装一套反代会抢 80/443。

只有全新服务器才需要装一个。两种都行：

| 选型 | 适合 | 代价 |
|---|---|---|
| 复用已有 Nginx | 已有项目在跑 | 只需加一段 location，最简单 |
| Caddy | 全新机器 | 单文件，证书自动签发续期 |

装 Caddy：

```powershell
New-Item -ItemType Directory -Force C:\apps\badminton\caddy | Out-Null
Invoke-WebRequest -Uri "https://caddyserver.com/api/download?os=windows&arch=amd64" -OutFile C:\apps\badminton\caddy\caddy.exe
& C:\apps\badminton\caddy\caddy.exe version
```

不推荐 IIS：要额外装 ARR + URL Rewrite 两个模块，再手工绑证书，步骤比前两者都多。

---

## 3. 建库建账号

用 root 登录 MySQL（`mysql -u root -p`），执行：

```sql
CREATE DATABASE badminton DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE USER 'badminton'@'localhost' IDENTIFIED BY '换成强密码';
GRANT ALL PRIVILEGES ON badminton.* TO 'badminton'@'localhost';
FLUSH PRIVILEGES;
```

用独立账号而非 root：应用被打穿时损失可控，且能单独改密码。

> 表结构**不用手工建**。后端启动时 `sync({ force: false })` 会自动建缺失的表，随后 `config/indexes.js` 补二级索引。首次启动日志里出现 `[index]` 相关输出属正常。

---

## 4. 拉代码与装依赖

```powershell
New-Item -ItemType Directory -Force C:\apps\badminton | Out-Null
cd C:\apps\badminton
git clone https://gitee.com/jihaowen/badminton_shopkeeper.git repo

cd C:\apps\badminton\repo\node\server
npm config set registry https://registry.npmmirror.com
npm ci --omit=dev
```

- 用 `npm ci` 而不是 `npm install`：严格按 `package-lock.json` 装，版本可复现。
- `--omit=dev` 跳过 nodemon 等开发依赖。
- gitee 私库首次会要求输入账号密码。

---

## 5. 生产环境变量

```powershell
cd C:\apps\badminton\repo\node\server
Copy-Item .env.example .env
notepad .env
```

按下表逐项改，其余保持默认：

| 变量 | 生产值 | 说明 |
|---|---|---|
| `NODE_ENV` | `production` | 影响日志与错误输出 |
| `PORT` | `3001` | 必须和 Nginx `proxy_pass` 的端口一致 |
| `HOST` | `127.0.0.1` | **必须改**。默认 `0.0.0.0` 会监听所有网卡，端口一旦被放行就直接暴露 |
| `DB_HOST` | `127.0.0.1` | |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | 第 3 步创建的 | |
| `WX_APPID` / `WX_APPSECRET` | 小程序后台的真实值 | 缺失会导致登录全部失败 |
| `JWT_SECRET` | 64 位随机串 | **必须换**，默认空值等于任意人可伪造身份 |
| `JWT_EXPIRES_IN` | `604800` | 7 天 |
| `PUBLIC_BASE_URL` | `https://esccry.top/api/badminton` | 拼头像等静态资源地址，必须 https、带路径前缀、不带尾斜杠 |
| `RECYCLE_ENABLED` | `true` | 垃圾数据回收定时器 |

生成 `JWT_SECRET`：

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
```

`.env` 已被 `.gitignore` 排除，`git pull` 不会覆盖它。**不要把它提交到仓库。**

---

## 6. 首次前台试跑

注册服务前先在当前窗口跑一次，报错能直接看到：

```powershell
cd C:\apps\badminton\repo\node\server
node bin/www
```

看到 `[server] listening on 127.0.0.1:3001` 说明起来了。**另开一个窗口**验证：

```powershell
curl http://127.0.0.1:3001/health
```

返回 `{"code":"200",...}` 即通。然后回到第一个窗口按 `Ctrl+C`，确认打印 `[server] 已退出`（优雅退出生效）。

常见报错：

| 报错 | 原因 |
|---|---|
| `ECONNREFUSED 127.0.0.1:3306` | MySQL80 服务没启动 |
| `Access denied for user` | `.env` 里账号密码不对 |
| `ER_NOT_SUPPORTED_AUTH_MODE` | 账号用了旧认证插件，重建用户 |
| `EADDRINUSE` | 端口被别的进程占着（先 `netstat -ano \| findstr :3001` 查 PID） |

---

## 7. 注册为 Windows 服务

```powershell
# 情况一：按本文档的目录约定部署
& C:\apps\badminton\repo\deploy\windows\install-service.ps1 -Root C:\apps\badminton

# 情况二：项目在别的位置（-ServerDir 指向含 bin\www 的那一层）
& C:\project\badminton_shopkeeper\node\deploy\windows\install-service.ps1 `
    -Root C:\apps\badminton `
    -ServerDir C:\project\badminton_shopkeeper\node\node\server
```

（脚本在仓库里，路径是 `<项目根>\deploy\windows\`，不是部署根目录下。）

脚本做的事（也可手工用 nssm 逐条设置）：

- 服务名 `BadmintonAPI`，以 `node.exe` 为宿主运行 `bin/www`
- 工作目录设为 `node\server`（`.env` 和 `public\avatar` 都靠相对位置找）
- 崩溃自动重启，重启延迟 3 秒
- 标准输出/错误分别写到 `logs\api-out.log`、`logs\api-err.log`，单文件超 10MB 自动切割
- 开机自启

验证：

```powershell
Get-Service BadmintonAPI
curl http://127.0.0.1:3001/health
```

如果服务起不来，看 `C:\apps\badminton\logs\api-err.log`，多半是 `.env` 或 node 路径问题。

---

## 8. 配置 HTTPS 反向代理

小程序只能访问 443 端口，所以后端必须由反向代理对外。**二选一，不要两个都装**：

| 服务器现状 | 看哪节 |
|---|---|
| 已经有 Nginx 在跑（多半是这种情况） | 8A |
| 全新服务器，没有任何反代 | 8B |

### 8A. 已有 Nginx：加一段 location

#### 第一步：确认端口没被占

```powershell
netstat -ano | findstr :3001
```

有输出说明 3001 已被占用，换一个空闲端口，**同时改两处**：`.env` 的 `PORT` 和下面的 `proxy_pass`。

Nginx 一个 443 就能挂多个项目，靠**路径前缀**区分，不需要额外域名和证书：

```
https://esccry.top/api/badminton/...    → 127.0.0.1:3001（本项目）
https://esccry.top/api/werewolf/...     → 127.0.0.1:3000（已有项目）
```

#### 第二步：在现有 server 块里加 location

打开 nginx 配置，找到监听 443 的那个 `server { }`，在**大括号内部**追加（完整片段见 `repo\deploy\windows\nginx-badminton.conf`）：

```nginx
location = /api/badminton {
    return 301 /api/badminton/;
}

location /api/badminton/ {
    # 末尾斜杠不能少：它会把 /api/badminton 前缀剥掉再转发，
    # 后端收到的才是 /matches/list，而不是 /api/badminton/matches/list
    proxy_pass http://127.0.0.1:3001/;

    proxy_http_version 1.1;
    proxy_set_header Host              $http_host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_redirect off;

    # 头像上传单文件上限 10MB；nginx 默认 1MB，超过会直接返回 413
    client_max_body_size 10m;

    proxy_connect_timeout 10s;
    proxy_send_timeout    60s;
    proxy_read_timeout    60s;
}
```

#### 第三步：改了后端两处配置

`.env` 里对应改：

```
PORT=3001
HOST=127.0.0.1
PUBLIC_BASE_URL=https://esccry.top/api/badminton
```

`HOST` 必须是 `127.0.0.1`——Nginx 和 node 在同一台机器，端口不需要对公网开。

#### 第四步：校验并重载

```powershell
cd C:\nginx
.\nginx.exe -t
.\nginx.exe -s reload
```

`-t` 输出 `syntax is ok` / `test is successful` 才算改对。如果 nginx 是注册成服务的，改用 `Restart-Service nginx`。

验证：

```powershell
curl https://esccry.top/api/badminton/health
```

#### 三个最容易写错的地方

| 错误写法 | 后果 |
|---|---|
| `proxy_pass http://127.0.0.1:3001;`（少了尾斜杠） | 后端收到 `/api/badminton/matches/list`，全部 404 |
| 漏了 `client_max_body_size` | 上传头像超过 1MB 报 413，前端只看到「上传失败」 |
| 小程序里把域名配成带路径的 | 微信后台的合法域名**只能是域名**，带路径会校验不通过 |

### 8B. 没有 Nginx：用 Caddy 自动签证书

```powershell
New-Item -ItemType Directory -Force C:\apps\badminton\caddy | Out-Null
Invoke-WebRequest -Uri "https://caddyserver.com/api/download?os=windows&arch=amd64" -OutFile C:\apps\badminton\caddy\caddy.exe
notepad C:\apps\badminton\caddy\Caddyfile
```

Caddyfile 内容（模板在 `repo\deploy\windows\Caddyfile`）：

```
api.your-domain.com {
    encode gzip
    reverse_proxy 127.0.0.1:3001
}
```

首次签发需要 80 端口公网可达（ACME 校验走 80）。前台试跑确认能签下来：

```powershell
cd C:\apps\badminton\caddy
.\caddy.exe run --config Caddyfile
```

日志出现 `certificate obtained successfully` 即成功，`Ctrl+C` 停掉后注册服务：

```powershell
$nssm = "C:\apps\badminton\nssm\nssm.exe"
& $nssm install Caddy "C:\apps\badminton\caddy\caddy.exe" "run --config C:\apps\badminton\caddy\Caddyfile"
& $nssm set Caddy AppDirectory "C:\apps\badminton\caddy"
& $nssm set Caddy Start SERVICE_AUTO_START
& $nssm start Caddy
```

证书续期由 Caddy 自动完成，无需额外任务。

---

## 9. 迁移数据

### 9.1 导出（本地开发机）

**必须用 `cmd /c` 包一层**。PowerShell 的 `>` 会把输出写成 UTF-16，导入时报编码错误。

```powershell
cmd /c "mysqldump -u root -p --default-character-set=utf8mb4 --single-transaction --routines --triggers --set-gtid-purged=OFF badminton > C:\temp\badminton.sql"
```

`mysqldump` 不在 PATH 时用完整路径，例如 `"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe"`。

### 9.2 上传

需要服务器已开 SSH。腾讯云 Windows 镜像默认没装，先装：

```powershell
# 在服务器上执行
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
New-NetFirewallRule -DisplayName "SSH 22" -Direction Inbound -Protocol TCP -LocalPort 22 -Action Allow
```

然后本地推送：

```powershell
scp C:\temp\badminton.sql administrator@<公网IP>:C:/apps/badminton/backups/
```

不用 SSH 也行：远程桌面复制粘贴、或腾讯云控制台的「上传文件」。

### 9.3 导入（服务器）

```powershell
cd C:\apps\badminton
cmd /c "mysql -u badminton -p badminton < C:\apps\badminton\backups\badminton.sql"
```

同样必须 `cmd /c`，PowerShell 不支持 `<` 输入重定向。

> **注意：导入会 DROP 并重建表。** 如果服务器上已经有真实数据（比如先上线跑过几天），先备份再导入，否则会被本地数据整体覆盖。
>
> 导入用的是 `badminton` 账号，所以导出时**不要加 `--databases`**——那会在文件里写入 `CREATE DATABASE`，该账号没有这个权限，导入直接失败。上面第 9.1 节的命令已经避开了。

导入后重启服务加载：

```powershell
Restart-Service BadmintonAPI
```

### 9.4 迁移头像

头像存在 `public\avatar`，不跟着数据库走，必须单独搬。

```powershell
# 本地打包
Compress-Archive -Path E:\work\badminton_shopkeeper\node\server\public\avatar -DestinationPath C:\temp\avatar.zip -Force
scp C:\temp\avatar.zip administrator@<公网IP>:C:/apps/badminton/backups/

# 服务器解压（解到 public 下，会生成 avatar 目录）
Expand-Archive C:\apps\badminton\backups\avatar.zip -DestinationPath C:\apps\badminton\repo\node\server\public -Force
```

不搬的话旧用户头像全是裂图（数据库里存的是 `/avatar/xxx.jpg` 相对路径）。

---

## 10. 小程序端切换域名

改 `miniprogram/config.js`：

```js
const ENV = 'prod'   // 原来是 'dev'
```

并把 `prod` 段填成真实地址。**这里要带 `/api/badminton` 路径前缀**，与 Nginx 的 `location /api/badminton/` 对应：

```js
prod: {
  serverUrl: 'https://esccry.top/api/badminton',
  staticUrl: 'https://esccry.top/api/badminton',
  code: 'v0.9',
}
```

然后在**微信公众平台 → 开发管理 → 开发设置 → 服务器域名**里配置：

| 类型 | 值 |
|---|---|
| request 合法域名 | `https://esccry.top` |
| uploadFile 合法域名 | `https://esccry.top` |

> **这两处填的不是同一个东西，别抄错**：
>
> | 配置位置 | 填什么 | 带不带路径 |
> |---|---|---|
> | 小程序 `config.js` | `https://esccry.top/api/badminton` | **带** |
> | 微信后台域名白名单 | `https://esccry.top` | **不带** |
>
> 微信后台的合法域名只认域名，带路径会直接提示格式错误；而代码里必须带前缀，否则请求打到已有项目的根路径上。

- `uploadFile` 必须单独配，否则头像上传会被拦。
- 域名必须已备案、必须 https、不能带端口和路径。
- 改完在开发者工具里「清缓存 → 全部清除」再编译，否则还是旧地址。

---

## 11. 验收清单

按顺序逐条过，任一条不过就别急着发版：

- [ ] `curl https://esccry.top/api/badminton/health` 返回 `code: "200"`
- [ ] 浏览器直接打开 `https://esccry.top/api/badminton/avatar/xxx.jpg` 能看到图片（不存在的文件应返回 404 而不是 500）
- [ ] 原有项目没被影响：`https://esccry.top/` 和 `/api/werewolf/` 仍然正常
- [ ] 微信开发者工具关闭「不校验合法域名」后，首页能正常加载
- [ ] 小程序登录成功，`users` 表新增记录
- [ ] 新建一场比赛 → 报名 → 生成排期 → 记分 → 结束，全流程走通
- [ ] 上传头像成功，返回的路径能访问
- [ ] `Get-Service BadmintonAPI, nginx` 都是 `Running`
- [ ] 重启服务器后服务自动起来（`Restart-Computer` 后重新连上验证）

---

## 12. 日常运维

### 重启 / 停止

```powershell
Restart-Service BadmintonAPI
Stop-Service BadmintonAPI
```

**不要用 `Get-Process node | Stop-Process` 强杀**，会跳过优雅退出，正在写的请求直接断。

### 看日志

```powershell
Get-Content C:\apps\badminton\logs\api-err.log -Tail 50 -Wait
Get-Content C:\apps\badminton\logs\api-out.log -Tail 100
```

### 更新代码

```powershell
cd C:\apps\badminton\repo
git pull
cd node\server
npm ci --omit=dev
Restart-Service BadmintonAPI
```

依赖没变时 `npm ci` 也可省略，但加上更安全。

### 备份

`repo\deploy\windows\backup.ps1` 会导出数据库并把 `public\avatar` 打包，按日期存到 `backups\`，自动清理 7 天前的文件：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\apps\badminton\repo\deploy\windows\backup.ps1 -DBPassword <数据库密码>
```

挂到任务计划每天凌晨 3:30：

```powershell
schtasks /Create /TN "BadmintonBackup" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\apps\badminton\repo\deploy\windows\backup.ps1 -DBPassword <数据库密码>" /SC DAILY /ST 03:30 /RU SYSTEM /F
```

注意脚本参数默认值（`$DBName`、`$DBUser`、`$MysqlBinDir`）要按实际情况改。

---

## 13. 安全收尾

- `.env` 不要进仓库，也不要在聊天/截图里暴露 `WX_APPSECRET`、`JWT_SECRET`
- MySQL 只监听 127.0.0.1（默认就是），安全组不放行 3306
- 3001 端口不对公网开放
- 建议在腾讯云控制台开启**快照策略**，与数据库备份互为补充
- 上线后可关掉 `app.js` 里的 `cors({ origin: true })`——小程序请求不受浏览器 CORS 限制，反射任意来源在公网没有意义

---

## 附：为什么这些步骤不能省

| 步骤 | 省略的后果 |
|---|---|
| 迁移 `public\avatar` | 所有历史头像裂图，且无法恢复 |
| `cmd /c` 包 mysqldump | SQL 文件变 UTF-16，导入直接报错 |
| 只跑单实例 | 垃圾回收定时器重复执行，同一批数据被反复删 |
| 不配 uploadFile 域名 | 头像上传静默失败 |
| 3001 对公网开放 | 明文传输令牌，等于没有 HTTPS |
| `proxy_pass` 少写尾斜杠 | 后端路径多一层 `/badminton`，所有接口 404 |
| 漏配 `client_max_body_size` | 超过 1MB 的图片上传直接 413 |
| 改 `JWT_SECRET` | 任何人都能伪造任意 openId 登录 |
