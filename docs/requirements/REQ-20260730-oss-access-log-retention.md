# REQ-20260730 OSS 访问日志与 30 天保留

## Status

`Shipped`

## 需求摘要

为生产 OSS Bucket 开启服务端访问日志，保存对象访问、响应状态、来源和流量等审计信息，便于排查 TV、Course Web 和 Web Simulator 的 OSS 使用情况。日志保留 30 天，过期后由 OSS 生命周期自动清理。

## 关联历史/现有需求

- [REQ-20260715-tv-media-delivery-protection](REQ-20260715-tv-media-delivery-protection.md)：本地媒体由 Nginx 独立 access log 记录；OSS 直连资源需要由 OSS 自身记录访问日志。
- [REQ-20260702-course-web-tv-simulator](REQ-20260702-course-web-tv-simulator.md)：Simulator 的历史 OSS 资源通过同源代理访问，OSS 回源访问仍会进入 OSS 日志。

## 涉及端和改动范围

| 模块 | 影响 |
| --- | --- |
| Alibaba Cloud OSS | 开启 Bucket 访问日志；增加限定前缀的 30 天生命周期规则 |
| `server` | 不修改请求、上传和数据库逻辑 |
| `tv-android` | 不修改；直连 OSS 下载会被服务端日志记录 |
| `course-web` / `websimulator` | 不修改；OSS 访问会被记录 |
| 数据库 | 无字段、无数据迁移、无写入 |

## 线上配置

- Source Bucket：`console-background`
- Target Bucket：`console-background`
- 日志前缀：`oss-access-logs/`
- 生命周期规则 ID：`expire-infini-oss-access-logs-30d`
- 生命周期范围：仅 `oss-access-logs/`
- 过期时间：日志对象生成 30 天后删除

媒体对象不在该前缀下，因此不会被这条规则删除。

## 数据与查询

OSS 访问日志由阿里云异步投递，不保证请求结束后立即出现。查询时在 OSS 控制台进入 Bucket 的文件列表，按 `oss-access-logs/` 前缀筛选；需要统计流量时仍以 OSS 计量监控和费用账单为准。

日志用于排查：

- 请求时间、Remote IP、Referer、User-Agent。
- 请求方法、对象路径、HTTP 状态码。
- 发送字节数和请求处理时间。
- OSS Request ID。

日志文件本身也占用少量标准存储空间；生命周期会在 30 天后自动删除。

## 关键配置逻辑

```text
enable bucket logging:
  targetBucket = current bucket
  targetPrefix = "oss-access-logs/"

merge lifecycle rules:
  preserve every unrelated existing rule
  replace only rule id = "expire-infini-oss-access-logs-30d"
  prefix = "oss-access-logs/"
  expirationDays = 30
```

## 风险和兼容策略

| 风险 | 处理 |
| --- | --- |
| 覆盖既有生命周期规则 | 写入前先读取并合并，只替换同 ID 或同日志前缀规则 |
| 误删媒体 | 生命周期限定 `oss-access-logs/`，不匹配媒体对象 |
| 日志未立即出现 | OSS 为异步投递；配置状态和计量监控先用于即时确认 |
| 日志自身产生存储 | 30 天自动过期，控制长期占用 |
| 关闭日志后残留旧日志 | 停止投递不自动删除旧对象；现有生命周期继续负责过期清理 |

## 回滚

1. 关闭 Bucket Logging。
2. 删除生命周期规则 `expire-infini-oss-access-logs-30d`，保留其他规则。
3. 如需立即清除历史日志，单独删除 `oss-access-logs/` 前缀；该操作必须再次确认，不能与关闭日志自动绑定。

## 手工验收用例

### Happy Flow

1. 在 OSS Bucket 日志管理中确认日志状态为启用。
2. 确认目标 Bucket 为 `console-background`，前缀为 `oss-access-logs/`。
3. 在生命周期规则中确认 `expire-infini-oss-access-logs-30d` 已启用且过期天数为 30。
4. 访问一个现有 OSS 图片或视频，等待 OSS 异步投递后，在日志前缀中找到对应时间段日志。

### Bad Flow

1. 检查媒体对象前缀，确认没有被 30 天规则匹配。
2. 新增一条无关生命周期规则后重新审计，确认日志规则不会覆盖该规则。
3. OSS 暂时没有日志文件时，确认 TV、Course 和上传服务仍可正常运行，不因日志投递失败阻断业务请求。

