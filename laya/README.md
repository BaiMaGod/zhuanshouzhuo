# 官方 LayaAir 3.4.0 工程

不要直接编辑生成的 `src/bracelet` 或 `assets/assets`。在仓库根目录执行 `npm run laya:prepare`，再用 LayaAir IDE 3.4.0 打开 `JadeBracelet.laya`，或使用仓库的 `release:*` 命令。

首次由 IDE/CLI 自动生成 engine 类型、资源元数据和缓存。核心游戏源码只维护在仓库根目录 `src/`。平台 AppID 和 App 签名未填写，避免将测试包误认为可上架包。
