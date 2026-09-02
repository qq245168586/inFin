# 06. 源代码鉴别材料准备说明

## 1. 交存规则

根据《计算机软件著作权登记办法》第十条，软件鉴别材料包括程序和文档的鉴别材料。通常做法是：

- 源程序：前、后各连续 30 页，共 60 页；
- 文档：前、后各连续 30 页，共 60 页；
- 如果整个程序或文档不足 60 页，则提交全部；
- 除特定情况外，源程序每页不少于 50 行，文档每页不少于 30 行；
- 页眉建议写软件全称和版本号；
- 右上角或页脚标注页码；
- A4、黑白、纵向、清晰。

## 2. 本项目推荐取样策略

首次申请综合平台时，建议源程序材料覆盖以下自研核心：

1. Server 业务域：
   - 用户、场馆、课程包、课程、排课、媒体、TV session；
2. Course Web：
   - 动作库、课程编辑器、模板、Pod、排课；
3. Coach Web：
   - 现场控课、TV 绑定、课表；
4. TV Android：
   - MQTT、daily bundle、媒体缓存、播放状态、进度计算；
5. MQTT Gateway：
   - HTTP 到 MQTT 的控制发布逻辑。

不要提交：

- `node_modules`；
- build/dist 产物；
- lock 文件；
- 第三方库源码；
- 密钥、密码、真实生产配置；
- 自动生成文件。

## 3. 推荐文件范围

见 [source-file-recommendation.txt](source-file-recommendation.txt)。

## 4. 本地生成脚本

已提供脚本：

```bash
python3 docs/software-copyright-application/scripts/generate_source_deposit.py
```

脚本会读取推荐文件，生成一个源代码交存草案 Markdown。正式提交前建议人工复核、脱敏、排版为 Word/PDF。

注意：源代码鉴别材料包含敏感资产，不建议随意发给无关人员。

