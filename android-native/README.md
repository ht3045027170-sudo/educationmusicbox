# 安卓版构建工程

这是离线原生 WebView 应用。音乐软件资源位于 `app/src/main/assets/index.html`，不包含账号、管理员或服务器功能。

应用会在使用调音器时请求 `RECORD_AUDIO` 麦克风权限。

`signing/update-key.jks` 是后续覆盖安装更新所需的固定签名文件。不要删除或更换；每次更新需要同时提高 `versionCode` 和 `versionName`。
