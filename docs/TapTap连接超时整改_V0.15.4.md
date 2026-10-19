# TapTap H5 连接超时整改 V0.15.4

游戏958691，基于main efa6530。

## 行为

- H5云档按官方MCP工作流直接调用；登录凭证请求与云档恢复分开去重。云档成功后不因独立登录凭证超时反复进入连接中。
- 原生登录仍使用120秒SDK超时、125秒客户端保护。启动恢复窗口8秒，超过窗口提供继续本地游戏；进入盘面后迟到云档不应用，回首页再恢复。
- 云档临时错误自动重试最多3次，间隔5/15/30秒；永久错误和登录无回调超时停止自动重复调用，可手动重试。云档上传沿用65秒限频，永久上传错误停止重复上传。
- 所有原生回调只结算一次；旧请求超时后迟到的回调仅记录证据。销毁平台实例会终止客户端等待，后续回调不得切换存档。
- 平台检查显示调用阶段和秒数，支持复制诊断；debug下保留排行榜、广告、埋点状态。
- 诊断记录调用开始、success/fail/complete、同步异常、Promise结果和本地超时，保留最多100条。记录游戏版本、页面路径、UA和桥接存在性；运行时未提供版本时标记not reported。不调用私有桥接方法，不记录登录凭证、完整存档或页面查询参数。
- 空登录成功响应判为INVALID_LOGIN_RESPONSE；CLIENT_TIMEOUT明确标为客户端等待超时。

## 验证

- TypeScript编译、165项快速回归通过。
- Chrome实际WebGL下使用模拟tap，原广告按钮、完播发奖、使用及重开测试通过。
- 新增WebGL场景验证登录无回调时云档可用、诊断面板布局与真实点击复制、8秒后继续本地游戏、原生同步抛错被捕获。
- 字体补齐新增中文字符；正式H5配置与ZIP逐文件校验通过。
- 包体zhuanshouzhuo-0.15.4-taptap.zip，SHA256 741ea9af751fbe2e2250103fd740022afe58ce00c37d2a08cb55fc7d4cdb0afe。

## 尚需真实容器验证

本次没有可用的用户设备执行通道，不能将模拟tap结果视作真机账号验收。上传后须核对首页v0.15.4，验证云档恢复、重进/换设备恢复；若登录仍无回调，从TapTap菜单的平台检查复制诊断，或提交自测反馈。

## 构建

运行npm run package:taptap。Windows或Python命令不同的环境可设置PYTHON为Python可执行文件绝对路径；默认仍为python3。此开关仅用于打包工具，不进入前端。

## 依据

TapTap Minigame MCP get_cloud_save_integration_guide及docs://cloud-save/api/cloud-save-manager/get-archive-list。
官方登录API：https://developer.taptap.cn/minigameapidoc/dev/api/open-api/login/tap.login/ 。
