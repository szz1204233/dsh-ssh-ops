# Windows 验证记录（`fix/highlight-refresh`）

- 验证日期：2026-11-06
- 版本：0.4.5（HEAD `bf8ecc6`，已合入 upstream/main v0.4.5）
- 环境：Windows 11 `10.0.26200.9711` / Node.js `v22.22.2` / x64

## 1. 构建

`npm install` → `prepare`（`gen:xterm-css` + `build:host` + `build:client`）全部成功。
产物：`lib/index.js`（602 KB）、`lib/client.js`（1.6 MB）、`lib/typert.js`、`lib/remote.js` 及 4 个 chunk。

## 2. 自动化测试

| 项目 | 结果 |
| --- | --- |
| `npm test` | **235 / 235 通过**，0 失败（15.4 s） |
| `npm run lint` | **0 错误** |
| `node --test test/highlight-refresh.mjs` | **15 / 15 通过** |

`highlight-refresh` 覆盖的修复点：

1. 轮滚式视口移动（xterm 抑制 `onScroll`）触发重算；
2. 无 render/scroll 事件时视口轮询兜底；
3. 在飞（write/scroll 同时到达）时扫描结果仍被采用；
4. 回滚裁剪后按 marker 重扫而非画旧行；仅位移的裁剪做重定基；
5. 装饰预算自底向上分配，最新输出优先；
6. 共享 worker 在单个终端释放后保持温热；超时/挂死任务隔离与重试退避；编辑配色立即解除退避。

> 与 `docs/highlight-refresh-fix.md` 记录的 210/211 不同：本机没有出现 `test/manifest.mjs` 的 `~/.npm` 权限失败，全量通过。

## 3. 运行态（DSH Desktop 重启后）

- 宿主加载的 host 半为 0.4.5：会话工具中出现 0.4.5 新增的 `sftp_upload_file`（0.4.3 包内不存在）；
- 客户端包内 `PLUGIN_VERSION = "0.4.5"`；
- 包内包含本次修复的关键实现：`MAX_DECORATIONS = 1024`、`groupRunsByRow`、`viewportY`/`invalidate()`。

## 4. 端到端（真实 ssh2，非 mock）

以仓库自带 `test-sshd.mjs` 在本机 2222 端口启动 SSH 服务，经插件工具链验证：

| 用例 | 结果 |
| --- | --- |
| `ssh_connect` 127.0.0.1:2222（test/test123） | 通过 |
| `ssh_exec` 多行输出 | 通过（6 行日志原样返回） |
| `sftp_list` | 通过 |
| `sftp_upload_file`（134 B）→ `sftp_read` 回读 | 通过（字节一致） |
| 交互式 shell（`ssh_write` + 回车） | 通过（cmd.exe 提示符、回显、换行正常） |

## 5. 未覆盖 / 需人工确认

- 浏览器内语义高亮的**视觉效果**（滚动历史保持着色、持续输出持续着色、`vim`/`top` 退出后恢复）：自动化测试基于模拟 xterm，实际渲染需在 GUI 中人工复核。
- 真实 Linux 服务器上的 `seq` / `yes | head` 场景：本机仅以 `test-sshd.mjs` 的 cmd.exe shell 验证数据通路。

## 6. Windows 环境注意事项

- 本机 Git 默认 `http.sslBackend=schannel`，在此环境下 TLS 握手报 `SEC_E_NO_CREDENTIALS`；使用
  `git -c http.sslBackend=openssl ...`（或经本地代理）可正常 clone/push。
- 构建与安装需要在 profile 目录（`%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-ssh-ops`）写入，
  安装后必须完全退出并重启 DSH Desktop，宿主才会加载新的 host 半。
