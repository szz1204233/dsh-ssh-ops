# Agent 侧使用反馈：SSH 插件（2026-11）

> 状态：讨论稿，未提 issue。
> 视角：**AI agent 作为调用方**（不是人类点面板），在一次真实的多轮运维会话里连续使用。
> 运行时版本：**0.4.3**（`~/.dsh/profiles/desktop/node_modules/dsh-ssh-ops`）；对照源码 `upstream/main` 0.4.4。若某条在 0.4.4 已修，直接忽略。
> 会话规模：约 18 轮，macOS → 腾讯云 OpenCloudOS 9.2，先 `aiops` 只读排查、后切 `root` 做变更。

> **公开版本说明**：本文随仓库公开，真实主机地址与业务域名已脱敏（`203.0.113.10` 为文档专用地址占位，`example.com` 为占位域名）；原始完整版保留在本地 `dsh-feedback` 分支与补丁备份中。本文档是后续优化备选清单，条目基于 0.4.3 的一次真实会话，落地前请按当前版本逐条复核。

## TL;DR

连接建立之后，`ssh_exec` 的体验接近本地 shell，几乎没因为“能力不足”卡过。
真正消耗轮次的是三件事：**断线后无法自助重连**、**多连接时看不出身份**、**高影响变更没有确认层**。

如果只做三件事：连接可自助恢复（F-01/F-02）、变更确认（F-03）、长输出落盘（F-05）。

---

## 1. 本次会话做了什么

| 阶段 | 动作 | 用到的工具 |
|---|---|---|
| 摸底 | 读密钥包文档，定位服务器 | 本地 `bash`/`read`/`grep` |
| 只读排查 | 服务是否在跑、容器、端口、证书、日志 | `ssh_list` `ssh_exec` |
| 切账号 | aiops → root | `ssh_list` `ssh_terminal_sessions` |
| 取证 | `docker inspect/logs/stats`、`openssl`、`systemctl` | `ssh_exec` |
| 变更 | 签发证书、改 `site.db`/`docker.db`、迁反代、重启 nginx | `ssh_exec` + 本地事务脚本 |
| 收尾 | 备份、回滚预案、默认 443 兜底 | `ssh_exec` |

## 2. 做得好的地方（这些是真实加分项）

1. **`ssh_exec` 继承交互式 shell 的 cwd，并回显 `[cwd: /root]`**。不用每条命令自己 `cd`，也不会静默跑错目录。
2. **stdout / stderr 分离 + `[exit code: N]`**。能区分“没输出”和“失败”，排查时省心。
3. **`ssh_list` 用 `*` 标当前活跃连接，同时列出 saved resources**。我切 root 那次就是靠它确认默认走哪个账号。
4. **危险命令确认（宿主原生审批、fail-closed）**。改生产库时确实给了我安全感。
5. **`ssh_read` 的 `new / tail` 增量语义**。本次没直接用上（都是非交互命令），但设计方向对。
6. **断线后资源仍在**，不是彻底失联。

## 3. 摩擦点与建议

### F-01 断线后无法自助重连（P0）

**现象**

```
Error: ssh_exec failed: no active SSH connection.
       The operator has no saved SSH resources yet.
```

但当时**明明有两个保存资源**，只是没连上。这条信息把“资源不存在”和“资源存在但未连接”混成了一句，我第一反应是资源丢了。

**影响**：整个会话卡在“请用户去右侧面板点连接”，空转了一轮。

**建议**

- 错误分三态：无资源 / 有资源但未连接 / 有资源但认证失败；
- 未连接时把可重连资源列出来（含 id、`user@host`、`not connected`）；
- 让 agent 能直接 `ssh_connect_profile` 重连（受“允许 AI 自动连接已保存服务器”开关约束）。

**验收**：断线后 `ssh_exec` 报错里带 `available: <id> root@host [not connected]`，且一条命令即可恢复。

### F-02 同名资源无法消歧（P0）

**现象**

```
resource name "腾讯云轻量应用服务器" matches multiple saved SSH resources
(腾讯云轻量应用服务器, 腾讯云轻量应用服务器);
use the full name or the resource id from ssh_list.
```

但 `ssh_list` **不输出 resource id**，报错里也不给。`ssh_terminal_sessions` 返回的 `connectionId`（`腾讯云轻量应用服务器-67cda814`）不是 resource id，试了也不认。

**影响**：唯一出路是请用户手点，agent 侧无法自愈。

**建议**

- `ssh_list` 每条带 id（短 id 即可）；
- `ssh_connect_profile` 支持 `user@host`、`#id`、序号；
- 重名时默认用 `user@host` 唯一化展示。

**验收**：重名资源可用 `root@203.0.113.10` 直接连接。

### F-03 高影响变更缺少确认层（P0）

**现象**：整个会话里真正有杀伤力的操作，全部是普通 `ssh_exec`：

- `python3` 事务改 `site.db`（INSERT / DELETE 站点记录）
- `mv` 证书目录、`mv` vhost 配置
- `/etc/init.d/nginx restart`（全站中断 <1s）
- `sqlite3 .backup` + 覆盖式恢复预案

工具只拦了 `DROP/TRUNCATE` 一类。本次没出事，**靠的是 agent 自己先备份、并在回答里写清回滚路径**——这是自律，不是机制。

**建议**

- 在现有三档策略（标准 / 自定义放行 / 全部放行）基础上，把“服务重启 / 数据库写 / 目录移动 / 证书替换”纳入**类目**判断，而不是只靠命令正则；
- 审批卡里给出结构化影响：**改哪些文件、影响哪个服务、回滚命令**；
- 可选 `dry-run`：只返回“将执行什么”，不执行。

**验收**：标准档下 `nginx restart` 与 `sqlite3 <db>` 写操作触发审批，卡片包含影响面与回滚提示。

### F-04 执行身份不可见（P1）

**现象**：`aiops` 与 `root` 两个连接同时存在时，`ssh_exec` 输出只有 `[cwd: /root]`，没有 `user@host`。两个账号的登录目录都可能是 `/root`，**无法从输出判断命令到底用谁跑的**。

本次中途我不得不反复 `id` 自证；如果换成一个破坏性命令，这个不确定性的代价会很高。

**建议**：输出头加一行连接标识，如 `[server: root@203.0.113.10]` 或 `[conn: <id>]`；多连接时尤其必要。

**验收**：任一 `ssh_exec` 输出首行包含连接标识。

### F-05 长输出截断导致重复执行（P1）

**现象**：`docker logs` 全量 grep、`nginx -T`、大日志统计被 `| tail` 截断后，只能换参数重跑。本次多花了约 3~4 轮。

**建议**：超过阈值自动落盘（如 `/tmp/dsh-ssh-<ts>.log`），返回“路径 + 行数 + 前 N 行”；提供 `output=inline|file|auto`。

**验收**：>2000 行时返回文件路径，可继续 `ssh_read` / `grep`。

### F-06 超时策略一刀切（P1）

**现象**：默认 30s。访问 Let's Encrypt 的 `get_cert_to_site`、全量日志 grep 都需要手工把 `timeout_ms` 提到 150s~200s。

**建议**：按命令特征给默认值（`curl`/`openssl`/`docker logs`/包管理/证书类自动放宽），或在超时错误里直接提示“可指定 `timeout_ms` 重试”。

**验收**：超时错误包含可操作建议，而不是只有 `timeout`。

### F-07 “失败但空输出”的静默（P2）

**现象**：`aiops` 下 `docker info` 失败但输出为空；`systemctl list-units | grep bark` 无输出。需要自己推断是“命令不可用”还是“确实没有结果”。

**建议**：`exit != 0` 且 stdout/stderr 都为空时，显式提示 `[exit code: N] (no stdout/stderr)`，并给一句可能原因（权限 / 命令不存在）。

### F-08 排障入口缺失（P2，文档类）

**现象**：排查 nginx reload 失败时，我一直看 `/www/server/nginx/logs/error.log`，真正原因在 `/www/wwwlogs/nginx_error.log`（master 的 fd 在那里）。浪费 3~4 轮。正解是 `ls -l /proc/<pid>/fd | grep log`。

**建议**：不一定要内置命令。可在文档或工具描述里给一组“排障片段”：进程打开的日志、端口归属、最近 reload 记录、监听套接字。

### F-09 本地 `bash` 与远端 `ssh_exec` 混淆（P2）

**现象**：我有一次在本地 `bash` 里写了 `cd /www/server/panel`，报 `No such file or directory` 才反应过来。两者输出形态太像。

**建议**：本地 `bash` 输出加轻量 `[local]` 标识，或 `ssh_exec` 的 cwd 行改成 `[remote: <conn> cwd=/root]`。

### F-10 多 agent 无审计（P2，远期）

本次是单 agent。若多个 agent 并行操作同一连接，没有“谁在何时跑了什么”的记录。建议连接级命令审计（时间 / 连接 / 命令 / 退出码），面板可查。

## 4. 我自己可以做得更好的地方

1. 一开始就该确认“本地无 docker、服务在远端”，而不是先跑 `ps aux | grep bark` 试运气；
2. 排查服务异常时，先看**进程实际打开的文件**，再判断日志路径；
3. 备份目录应统一（本次散在 `panel-backup-*`、`docker-remove-*`、`docker-cleanup-*`、`cert-cleanup-*` 四处），事后不好找。

## 5. 只做三件事的话

1. **连接可自助恢复**：F-01 + F-02 合并处理，这是唯一真正“阻塞”过 agent 的点；
2. **变更确认层**：F-03，把服务重启 / DB 写 / 目录移动纳入类目审批；
3. **长输出落盘**：F-05，省轮次，也让证据可追溯。

其余（超时策略、排障片段、本地/远端区分、审计）都是锦上添花。

## 附 A：关键证据（原文）

```
Error: ssh_exec failed: no active SSH connection.
       The operator has no saved SSH resources yet.

Error: ssh_connect_profile failed: resource name "腾讯云轻量应用服务器" matches
multiple saved SSH resources (腾讯云轻量应用服务器, 腾讯云轻量应用服务器);
use the full name or the resource id from ssh_list.

2026/11/05 00:00:03 [emerg] cache "app_example_com_cache" uses the
"/www/wwwroot/app.example.com/proxy_cache_dir" cache path while previously
it used the "/www/dk_project/sites/app.example.com/proxy_cache_dir" cache path
```

## 附 B：时间线摘要

| 时间 | 事件 |
|---|---|
| 15:08 | 本地摸底，确认服务在远端 |
| 15:09–15:12 | aiops 只读：容器、端口、`/ping`、证书 |
| 15:23 | 切 root，`docker inspect` 确认 Up 10 个月 |
| 15:24 | 发现 `app.example.com` 证书过期 |
| 15:39–15:41 | 为 wallos / yourls 重新签发证书 |
| 23:52 | 面板「反向代理项目」报“读取配置文件失败” |
| 23:58–00:05 | 迁移 3 个站点到面板项目，两次重启解决 cache 冲突 |
| 00:02 | 确认面板 reload 机制恢复 |
| 00:05–00:12 | 清理 4 条 Docker 反代、加 443 兜底、清过期证书 |
