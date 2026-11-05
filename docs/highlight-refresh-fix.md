# 终端语义高亮：刷新与恢复修复记录

本文件记录 `codex/terminal-display-pr` 的语义高亮在真机验证中发现的问题、根因与修复，便于后续维护与回归。
缺陷的完整验证数据（隔离基准、真实 GUI 帧统计、数据通路）见工作区中的 `verify/REPORT.md`（该目录不随发布包提供）。

## 1. 症状（用户可感）

1. **滚动历史时颜色消失**：向上翻阅缓冲区后，可见行回到默认前景色，直到下一行新输出才恢复；滚轮滚动、拖动滚动条、窗口 resize、退出 `vim`/`top` 后都如此。
2. **持续输出时几乎没有高亮**：`tail -f`、构建日志、`yes | head` 等连续写入期间统计到的装饰为 0；只有输出停顿后的瞬间才出现一次颜色。
3. 密集屏幕（多分栏、宽终端）下最新输出的行先失去高亮；共享 worker 被某个面板重启时其他面板短暂停顿；worker 出错后每 60 ms 静默重试且终端无任何提示。

## 2. 根因

### 2.1 xterm 对用户滚动刻意抑制 `onScroll`（P0）

addon 只订阅了 `term.onScroll`/`onWriteParsed`/`onResize`/`buffer.onBufferChange`。但在 xterm 5.5 中，用户滚轮与滚动条路径是：

```
Viewport.handleWheel()            修改 viewportElement.scrollTop  (Viewport.ts:256)
  → 原生 'scroll' → Viewport._handleScroll()                      (Viewport.ts:71,179)
  → _onRequestScrollLines.fire({ …, suppressScrollEvent: true })  (Viewport.ts:199)
  → Terminal.scrollLines(…, suppress, VIEWPORT)                   (Terminal.ts:506)
  → BufferService.scrollLines(…, suppress)                        (BufferService.ts:148)
     仅在 !suppress 时 _onScroll.fire
  → term.onScroll 不会触发
```

只有换行推送新行（`BufferService.scroll()`）和程序化 `term.scrollLines()` 才触发 `onScroll`，所以"滚轮滚动 → 重算"从未发生。

### 2.2 事件抖动丢弃已完成扫描（P1）

`request()` 在每次 `onScroll`/`onWriteParsed` 都无条件 `generation++`，`scan()` 在 `await` worker 后比对 generation，不一致即丢弃。实测丢弃率 56–90%（worker RTT 3/8/15 ms），持续输出时接近 100%，即高亮最需要时完全不出现。

### 2.3 其余问题（P2/P3）

- 单次扫描装饰上限 4096，按扫描顺序自上而下占满，**底部（最新输出）的行先失去高亮**；
- 共享 worker 在任一终端释放时若持有在飞任务会被 `terminate()`，其他面板下一帧约 +20 ms 停顿；超时方案被永久隔离（文档称"编辑后解除"但直到所有 lease 释放才清）；
- 扫描失败每 60 ms 清空并重试，终端侧无提示；
- 回滚裁剪时若用 `baseY/length` 判定会误伤（`baseY` 在未满时随追加增长），用错行号绘制会错位。

## 3. 修复

| 项 | 改动 | 位置 |
|---|---|---|
| P0 滚动触发 | `term.onRender` 后比较 `viewportY`，变化才请求重算；另加 250 ms 视口轮询兜底（`unref`，隐藏面板/无渲染事件也能恢复）；resize/buffer 切换/配色变更统一走 `invalidate()` | `addon.js` |
| P1 结果采用 | `request()` 不再自增 generation，仅几何变化失效；扫描前用 xterm marker 锚定首行，`await` 后按 `shift = start - anchor.line` 把结果平移重定位再应用；锚点行本身被裁掉才丢弃重扫；锚点在 `finally` 释放 | `addon.js` |
| P2 预算 | `MAX_DECORATIONS` 4096→1024，`groupRunsByRow` 自底向上分配（最新输出优先），支持 trim 偏移 | `addon.js` |
| P3 worker | `release()` 不再因单个终端释放而重启共享 worker；每个被放弃任务一个 watchdog，超时只隔离真正的挂死方案并把排队任务放回队首重跑；隔离改为 30 s 过期或编辑配色立即解除；失败保留上次成功装饰、500 ms→5 s 退避、每种原因只告警一次 | `regex-runner.js`、`addon.js` |
| 扫描分配 | `readLogicalLine` 复用 `buffer.getNullCell()` + `line.getCell(x, cell)`，避免逐字符分配 CellData | `matcher.js` |
| 预览 | 匹配期间保留上次着色，消除逐键闪烁 | `use-regex-matches.js` |
| 设置性能 | `PatternTags` 的 `patternProblem` 按文本缓存，取代每渲染 2×N 次正则编译 | `PatternTags.jsx` |

## 4. 验证

- 新增 `test/highlight-refresh.mjs`（15 项）：滚轮式视口移动触发重算、轮询兜底、事件抖动不丢弃在飞结果、trim 平移重定位、锚点被裁重扫、底部优先预算、worker 共享与挂死回收、隔离过期/清除、失败退避与配色编辑恢复。在修复前基线上 12/15 失败。
- `npm test` 210/211 通过（唯一失败 `test/manifest.mjs` 为 `~/.npm` 权限环境问题，基线同样失败）；`npm run lint`、`npm run build` 通过。
- 真实 DSH 客户端 + 本地 sshd：20 万行流式输出期间稳态 329 个装饰 / 2445 个上色字形（修复前 0/0）；滚轮滚动与跳到 5000 行 scrollback 顶部后仍为 336/2496（修复前 0/188）。

## 5. 行为变化与限制

- 普通写入/滚动不再作废在飞扫描：结果可能落后几行（按 marker 行锚定，落点仍正确），下一次扫描即收敛；就地重写（`\r` 覆盖）的同一行可能短暂沿用旧色 60–150 ms。
- 单次扫描最多 1024 个装饰；超宽且密集的视口会保留底部行、顶部行暂不着色，下一次滚动/输出会轮换。
- 极速大流量（20 万行瞬间灌入）期间仍有约 0.4–0.8 s 的重建窗口（FitAddon resize 触发 `invalidate()`），稳态与滚动场景不受影响。
- 选择文本时语义色被选择前景色覆盖（`layer: "bottom"` 的既定行为，复制文本不受影响）。

## 6. 回归与复现

```sh
node --test test/output-highlight.mjs test/highlight-refresh.mjs test/regex-worker.mjs
npm test && npm run lint && npm run build
```

验证步骤（真实 GUI）：连接任意服务器 → 打开「终端外观」启用语义高亮 → 执行 `seq -f 'L%g 2026-11-05 12:00:00 ERROR 10.1.2.3 /var/log/app.log' 1 20000` → 滚轮向上翻阅历史，可见行应保持着色；`yes '…' | head -200000` 期间应持续看到着色；在 `vim`/`top` 中不装饰，退出后恢复。

## 7. 与功能基线的区分

修复位于分支 `fix/highlight-refresh`，基于 tag `codex-baseline-445bdb2`（codex 的原功能提交）。提交覆盖 worker 生命周期、刷新与结果采用、性能、测试和文档，后续还包含外观设置的指针拖动、恢复确认与布局优化。`git log --oneline codex-baseline-445bdb2..HEAD` 可核对完整改动边界。
