// Seed text for the color-scheme preview. It must exercise every built-in
// classification (errors, success, warnings, information, addresses/time,
// numbers, strings/paths, options, commands, file permissions, prompts) so the
// preview shows what the current scheme actually colors, and it includes CJK
// characters because the matcher maps them back to terminal cell widths.
// The run of eight lines fits the preview without scrolling at the default font.
// This is sample terminal output, not UI copy: the lines stay outside the
// translation dictionary (hence the i18n-ignore markers below).
export const DEFAULT_PREVIEW_TEXT = [
  "demo@host:~$ cat --lines=42 /var/log/app.log",
  "2026-10-30 12:30:15 ERROR 连接被拒绝 connection refused", // i18n-ignore
  "2026-10-30 12:30:16 WARNING 磁盘使用率 87%，请清理日志", // i18n-ignore
  "SUCCESS 服务已启动 192.168.1.10 端口 2222", // i18n-ignore
  "INFO login demo from 2001:db8::1 MAC 00:1A:2B:3C:4D:5E",
  'debug retries=42 --verbose "text" /home/demo/项目.log', // i18n-ignore
  "drwxr-xr-x 2 demo staff 4096 Nov 6 10:30 /srv/服务器", // i18n-ignore
  "demo@host:~$ sudo systemctl status nginx"
].join("\n");
