# TapTap H5 平台接入 V0.15

## 当前状态

本次实现客户端、登录凭证交换服务及自动检查，尚未完成真实平台端到端验收。不要将本次提交直接视为已上线或四项能力均已接通。

游戏 App ID：958691。后台已有星数榜 `q1vw62hcu7xhx9dnwv`、关卡榜 `8fhubriadufle2x7ic`，查询时均为不重置、仅白名单可见。广告变现页面已显示开启。

尚缺：部署后的 HTTPS 登录地址、经平台自动查询确认的竖屏广告配置。小游戏密钥只配置在服务端；MiniApp ID 应以应用配置中的值为准，不能未经核实就用商店游戏 ID 代替。没有真实 TapTap 客户端运行记录、真实完播和跨设备同步证据。

## 实现范围

- `src/taptap.ts` 封装全局 tap 能力，普通浏览器不加载 SDK，也不模拟登录或广告发奖。平台调用有超时，兼容 success/fail 和排行榜 callback 回调。
- 登录用 `tap.login` 获取一次性 code，POST 到自己的 HTTPS `/login` 服务换取 verified openid，之后切换账号专属本地存档。服务返回失败时不置为已登录，不上传。
- `server/taptap-worker.mjs` 是可部署到 fetch-compatible Worker 的凭证交换处理器。它只向官方 code2Session 接口发送配置的 MiniApp ID、secret 和本次 code，响应只返回 openid，不返回 session_key，不记录凭证。部署方还应配置平台入口域名、频率限制和请求域名白名单。
- 云档包含教学/正式进度、星级、最好步数、未完成盘面、免费道具余量、广告领取及剩余奖励、独立排行榜成绩。账号切换隔离本地键，旧试玩进度需用户主动确认导入。
- 云档先写 tap 文件系统，再创建或更新固定槽 `jade_save_v1`。上传尝试至少相隔 61 秒；上传时本地继续发生修改，新修订保持待同步。失败重试不覆盖本地进度。
- 盘面不一致时先让玩家选择本地或云端整份盘面；成绩合并取最好，已消耗广告奖励不会被旧档恢复。读取到无效结构或不匹配账号时拒绝合并，不继续上传覆盖。
- 首页 TapTap 入口提供登录/同步、两张排行榜、旧试玩导入和同步状态。

## 广告与次数规则

正式关每次重开仍恢复免费提示1次、免费消除1次。每局广告提示和广告消除各只能领取一次；明确重开时，两类广告领取资格重置，未用广告奖励清零。刷新或退出后继续当前盘面则保留次数。领取记录带重开代次，旧云档不能把新一局重新标成已领取。

免费次数耗尽后，对应按钮提示视频补充入口；视频完整结束 `isEnded === true` 才增加一次对应道具。取消、加载/播放失败、缺失完成标记均不发奖，也不标记领取。两种奖励共用平台激励视频实例，不要求创建两个广告位。广告期间拦截盘面输入，清理手势并停止声音，切后台取消普通动作也不会开放盘面输入。

奖励记录在本地和云档中维护。目前不包含服务端广告凭据校验、原子领取账本或跨设备锁：两台设备同时使用旧档领取、恶意清空/修改客户端数据等情况不能严格防止。若必须跨设备并发也严格各限一次，需增加服务端可验证广告结果和原子领取接口；不能用此客户端实现宣称达到该保证。

## 排行榜口径

关卡榜为正式关卡累计通关数量；星数榜为这些关卡累计最好星数。教学成绩不计入，提示/消除不影响正常闯关和星数上榜资格。分数采用绝对累计值上报，不采用增量累加。

Debug 参数会使本次通关不写入独立排行榜成绩；导入旧试玩成绩也不导入排行记录。之后正常游玩仍可积累合格成绩。客户端隔离不是服务端反作弊；当前榜单应保持白名单测试，待实际验收后再决定开放。

## 构建与部署

日常浏览器预览：`npm run build`，无 TapTap 配置也可游玩。生成的 dist 不包含 server 目录和密钥。

TapTap 配置使用公开构建环境变量：

- `TAP_LOGIN_URL`：已部署的 HTTPS `/login` 地址。
- `TAP_REWARDED_AD_UNIT_ID`：由 TapTap 官方广告配置查询返回的当前游戏匹配竖屏广告 ID。用户不需要手工创建或提供 ID，不允许使用示例或其他游戏的 ID。

正式 H5 构建入口：`npm run release:taptap`，缺少上述任一项就失败退出。该命令仅生成 H5 目录，不上传、不提交审核。包体还需按既有 H5 打包流程处理及自测。

登录 Worker 的服务端环境变量：

- `TAP_MINIAPP_ID`：应用配置核实的 MiniApp ID。
- `TAP_MINIAPP_SECRET`：平台小游戏密钥，使用托管平台 secret 功能设置，不写仓库或前端。
- `ALLOWED_ORIGINS`：逗号分隔、精确匹配的 H5 运行域名。

官方广告配置自动查询目前尚未在本项目环境接通，尚未填入实际广告 ID。现有 CLI 登录凭证不等于玩家登录凭证，也不等于已部署游戏登录服务。

## 验收

本地自动检查覆盖账号隔离、每关两类独立领取、刷新保持/重开重置、旧云档不能恢复已用奖励、盘面冲突选择、无效云档拒绝、上传时本地继续改档、完整/中断/重复广告回调、Debug 排行过滤、正常后续成绩、服务端不泄露密钥及场景输入锁。

平台验收仍需：首次/过期登录，账号切换，两台设备顺序同步和断网恢复，广告有库存/无库存/中断/完播/切后台，两张白名单排行榜和真实 H5 包启动。多设备并发领取不是当前版本保证。

## 官方依据

- https://developer.taptap.cn/minigameapidoc/dev/api/open-api/login/tap.login/
- https://developer.taptap.cn/minigameapidoc/dev/server/login/code2Session/
- https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/cloud-save-tutorial/
- https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/leaderboard-tutorial/
- https://developer.taptap.cn/minigameapidoc/dev/api/ad/tap.createRewardedVideoAd/
- https://github.com/taptap/instant-games-open-mcp/tree/main/src/features/ads

本地验证结果：115项快速回归通过；原有 WebGL 道具实点/刷新/重开测试通过；新增模拟 TapTap 的 WebGL 测试验证登录界面、广告确认按钮实点、完播增发、消耗和重开领取限制。模拟接口不构成真实平台验收。

新增界面文案曾在精简字体中缺字，已从官方 Noto 字体补齐，保留原宋体 ExtraLight（200）与黑体 Regular 风格；`scripts/subset-fonts.py --check` 校验全部 TypeScript 源码中的293个中文字符，两份字体均覆盖。源字体来源：

- https://github.com/google/fonts/blob/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf
- https://github.com/notofonts/noto-cjk/blob/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf

许可随 `public/assets/fonts/OFL*.txt` 保留。日常构建使用提交的 WOFF，不需要在线下载字体。
