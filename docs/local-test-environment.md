# Infini Local Test Environment

本地测试要求手机、TV 盒子、电脑在同一个局域网。

## 1. 查看本地地址

```bash
bash tools/local-test-env.sh
```

脚本会打印：

- server 启动命令
- admin / coach / course 的局域网访问地址
- TV 本地 APK 打包命令
- TV 使用的本地 API 和 MQTT 地址

如果自动检测 IP 不准：

```bash
INFINI_LOCAL_IP=192.168.1.23 bash tools/local-test-env.sh
```

## 2. 本地端口约定

- API server: `0.0.0.0:3100`
- MQTT broker: `1883`
- admin web: `5173`
- coach web: `5174`
- course web: `5175`

手机打开 coach 时使用：

```text
http://电脑局域网IP:5174
```

Vite 会把 `/api` 代理到电脑本机的 `127.0.0.1:3100`。

## 3. TV 本地包

```bash
cd apps/tv-android
INFINI_LOCAL_IP=192.168.1.23 tools/build-env-apk.sh local
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

本地 TV 包会连接：

- API: `http://192.168.1.23:3100/api`
- MQTT: `tcp://192.168.1.23:1883`

## 4. 生产环境保护

生产部署脚本会强制使用 production build：

```bash
pnpm run deploy
```

如果设置了 `INFINI_ENV` 且不是 `production`，部署会中止。

TV 生产包必须显式执行：

```bash
cd apps/tv-android
tools/build-env-apk.sh production assembleRelease
```
