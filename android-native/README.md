# 安卓版构建工程

这是通过本地HTTPS资源运行的WebView应用，入口为 `app/src/main/assets/index.html`。基础音乐工具可离线使用；账号、教师管理、班级作业和统计接口依赖网页服务器，不在此本地工程提供。部分辅助网页资源虽然随包保存，不代表对应云功能已支持离线。

使用调音器时请求 `RECORD_AUDIO` 麦克风权限。本轮网页调音器、输入管理、验证说明及相关界面资源已同步；真实安卓麦克风、蓝牙和安装包仍待验收。

## 预览构建

在Android开发环境中打开本目录，安装与工程Android Gradle插件匹配的JDK、Gradle及Android SDK（compileSdk为35）。本仓库未包含Gradle wrapper，不能直接使用 `./gradlew`。

配置完成后可在本目录运行 `gradle :app:assembleDebug`。预览构建使用开发调试签名，包名为 `com.hetian.musictoolbox.edu.preview`，可与正式版并存，不用于覆盖更新正式版。调试安装包通常位于 `app/build/outputs/apk/debug/`。

## 正式构建

正式版包名仍为 `com.hetian.musictoolbox.edu`。构建配置读取 `signing/release-key.jks`，密码与别名来自环境变量或本机 `signing/keystore.properties`；不要在仓库、报告或聊天中公开密码。

覆盖更新必须使用原正式签名。不得为了生成APK而新建密钥冒充旧签名；签名准备齐全后提高 `versionCode` 并确定 `versionName`，再构建与验收正式版。本次未提高正式版本或生成正式APK。

当前验收机器没有可用Java运行时、可执行Gradle和正式签名文件，因此尚未执行构建。预览签名配置的修改只完成源码检查，不能视作APK已通过构建。
