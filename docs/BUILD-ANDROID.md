# Hướng dẫn Build Native Android — WhisperChat Client

Tài liệu hướng dẫn thiết lập môi trường và quy trình build ứng dụng Android native (React Native 0.88 / Expo SDK 58, New Architecture) dành cho thành viên nhóm (Hải, Quân, Lead).

---

## 1. Yêu cầu Môi trường & Tiên quyết (Prerequisites)

### 1.1. Java Development Kit (JDK 17 LTS)
- **Bắt buộc sử dụng JDK 17:** Android Gradle Plugin (AGP) 8.8+ và Gradle 9.4.1 tương thích tốt nhất với JDK 17.
- **Lưu ý quan trọng về Java 25:** Nếu máy cài Java 25 (hoặc các phiên bản Java thử nghiệm mới), Gradle daemon sẽ không khởi động được hoặc gặp lỗi tương thích.
- **Cấu hình biến môi trường (PowerShell):**
  ```powershell
  $env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
  $env:Path = "$env:JAVA_HOME\bin;$env:Path"
  ```
  Kiểm tra: `java -version` (phải xuất hiện `openjdk version "17.x.x"`).

### 1.2. Android SDK & NDK
- **Android SDK:**
  - Compile SDK: `35` (hoặc `37`)
  - Target SDK: `34` (Android 14) hoặc `35` (Android 15)
  - Min SDK: `24` (Android 7.0)
  - Android SDK Build-Tools: `35.0.0`
- **Android NDK:**
  - Phiên bản yêu cầu: `27.1.12297006` (`r27b`)
  - Vị trí mặc định: `%LOCALAPPDATA%\Android\Sdk\ndk\27.1.12297006`
- **CMake & Ninja:**
  - CMake `3.22.1` (đi kèm Android SDK)
  - Ninja `1.10.2` (đi kèm CMake)
- **Cấu hình biến môi trường (PowerShell):**
  ```powershell
  $env:ANDROID_HOME = "C:\Users\<username>\AppData\Local\Android\Sdk"
  $env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
  ```
  Kiểm tra: `adb --version`

---

## 2. Vấn đề Môi trường Windows: MAX_PATH, Thư viện C++ Bên Thứ Ba & Symlinks

### 2.1. Hiện tượng & Nguyên nhân Kỹ thuật
Khi build Native New Architecture trên Windows (đặc biệt với React Native 0.88 New Architecture / C++ Codegen):
1. **Giới hạn 260 ký tự (`MAX_PATH`) khi `LongPathsEnabled = 0`:**
   - Hệ thống Codegen và Ninja sinh cây thư mục sâu cho các object C++. Khi vượt quá 260 ký tự, Ninja báo lỗi:
     ```
     ninja: error: mkdir(CMakeFiles/...): No such file or directory
     ninja: error: Stat(...): Filename longer than 260 characters
     ```
2. **Phạm vi của `CMAKE_OBJECT_PATH_MAX=250`:**
   - Plugin `plugins/withGradleArch.js` đã tự động chèn `-DCMAKE_OBJECT_PATH_MAX=250` vào `android/app/build.gradle`.
   - Tuy nhiên, trong mô hình multi-project của Android Gradle Plugin (AGP), cấu hình CMake của `:app` chỉ áp dụng cho module ứng dụng. Các thư viện native bên thứ ba (`:react-native-reanimated`, `:react-native-gesture-handler`) chạy bằng subproject CMakeLists riêng và không kế thừa cờ CMake từ `:app`.
3. **Vấn đề Symlink của npm trên Windows:**
   - Trong package `react-native-reanimated`, file `android/CMakeLists.txt` định nghĩa mã nguồn tại `${CMAKE_SOURCE_DIR}/Common/cpp`. Trên môi trường POSIX (Linux/macOS), `android/Common` là một symbolic link trỏ về `../Common`.
   - Tương tự, `react-native-gesture-handler/android/CMakeLists.txt` tìm file tại `./shared/shadowNodes/*.cpp` (yêu cầu symlink `android/shared -> ../shared`).
   - Mặc định trên Windows nếu chưa bật **Developer Mode**, `npm install` không có đặc quyền tạo symlink (`SeCreateSymbolicLinkPrivilege`), khiến các liên kết này bị thiếu. Khi build sạch không có symlink/junction, compiler ném lỗi:
     ```
     NativeProxy.cpp:2:10: fatal error: 'reanimated/Compat/WorkletsApi.h' file not found
     #include <reanimated/Compat/WorkletsApi.h>
     ninja: build stopped: subcommand failed.
     BUILD FAILED (Exit code: 1)
     ```

### 2.2. Giải pháp Chính quy (Khuyến nghị cho Môi trường Windows):

#### Giải pháp 1: Bật LongPathsEnabled và Windows Developer Mode (Khuyến nghị Chuẩn nhất)
1. **Bật LongPathsEnabled:**
   Mở PowerShell với quyền **Administrator** và chạy:
   ```powershell
   Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'LongPathsEnabled' -Value 1
   ```
2. **Bật Developer Mode trên Windows:**
   - Vào **Windows Settings** -> **System** (hoặc **Update & Security**) -> **For developers**.
   - Bật **Developer Mode** sang **On**.
   - Khi Developer Mode bật, Git và npm có quyền tạo real symlinks trên phân vùng NTFS mà không cần quyền Administrator.

#### Giải pháp 2: Clone repository vào đường dẫn ngắn
Nếu làm việc trên máy không có quyền Administrator:
- Clone repo vào đường dẫn thư mục gốc ngắn ở ổ đĩa (ví dụ: `C:\repo\wc` hoặc `D:\wc`), tránh đặt sâu trong nhiều cấp thư mục người dùng (`D:\ForIntern\Projects\...`).

#### Giải pháp 3: Tự động hóa Hoàn toàn qua Hook postinstall (Khuyến nghị Cục bộ cho Windows)
Để các thành viên trong nhóm (Hải, Quân) không cần phải tạo junction thủ công bằng tay mỗi lần clone hoặc cài đặt package, dự án đã tích hợp cơ chế tự động hóa 100%:
- **File script:** `scripts/fix-windows-native-links.js` (Node.js, an toàn, idempotent, log rõ ràng).
- **Cơ chế hoạt động:**
  1. Kiểm tra nền tảng (`process.platform === 'win32'`). Nếu chạy trên Linux/macOS, script tự động bỏ qua (không gây lỗi).
  2. Tự động kiểm tra và tạo NTFS Directory Junctions chỉ trong phạm vi `node_modules` cho:
     - `node_modules/react-native-reanimated/android/Common` -> `../Common`
     - `node_modules/react-native-gesture-handler/android/shared` -> `../shared`
     - `node_modules/react-native-worklets/android/Common` -> `../Common`
  3. Idempotent: Nếu liên kết đã tồn tại và hợp lệ, script an toàn bỏ qua. Tuyệt đối KHÔNG xóa hoặc sửa bất kỳ dữ liệu nào ngoài `node_modules`.
  4. Đã gắn sẵn vào hook `"postinstall": "node scripts/fix-windows-native-links.js"` trong `package.json`.
- **Sử dụng:**
  Khi Hải hoặc Quân chạy `npm install` (hoặc `npm run postinstall`), hệ thống tự động chuẩn bị toàn bộ native links cần thiết. Sau đó chạy thẳng:
  ```powershell
  npx expo prebuild --platform android --clean
  cd android && .\gradlew.bat assembleRelease -PreactNativeArchitectures=x86_64
  ```
  Quá trình biên dịch C++ New Architecture sẽ hoàn thành sạch sẽ (**Exit code 0**) mà không yêu cầu can thiệp thủ công hay quyền Administrator.

### 2.3. Cơ chế Tự động hóa qua Config Plugin của Dự án
Dự án đã tích hợp sẵn plugin `plugins/withGradleArch.js`. Mỗi khi chạy `npx expo prebuild`, plugin này tự động tiêm:
```groovy
externalNativeBuild {
    cmake {
        arguments "-DCMAKE_OBJECT_PATH_MAX=250"
    }
}
```
vào `android/app/build.gradle` để băm độ dài đường dẫn file object C++ của `:app`.

---

## 3. Quản lý Kiến trúc CPU (ABI) qua Config Plugin

Dự án không yêu cầu sửa tay file `android/gradle.properties` (vì thư mục `android/` nằm trong `.gitignore` và được sinh tự động bởi Expo prebuild).

Plugin `plugins/withGradleArch.js` tự động cấu hình:
```properties
reactNativeArchitectures=arm64-v8a,x86_64
```
vào `android/gradle.properties` mỗi lần prebuild.
- **Lợi ích:** Loại bỏ việc biên dịch 2 kiến trúc legacy 32-bit (`armeabi-v7a`, `x86`). Tiết kiệm hơn **60% thời gian biên dịch C++** và tránh tràn dung lượng ổ đĩa dev.

---

## 4. Quy trình Build Ứng dụng

### 4.1. Bước 1: Sinh mã Native (Expo Prebuild)
Chạy lệnh tại thư mục gốc của repository:
```powershell
npx expo prebuild --platform android --no-install
```
Lệnh này sẽ tự động:
1. Tạo thư mục `android/`.
2. Áp dụng plugin `plugins/withGradleArch.js` (cấu hình ABI và CMake path limit).
3. Áp dụng plugin `plugins/withNetworkSecurity.js` (cấu hình cấm cleartext, nhúng CA cert, thiết lập `<pin-set>`).

### 4.2. Bước 2: Build Debug APK
Dùng để chạy thử nghiệm và kiểm thử nhanh trên Emulator:
```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
$env:ANDROID_HOME = "C:\Users\<username>\AppData\Local\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

cd android
.\gradlew.bat assembleDebug -PreactNativeArchitectures=x86_64
```
File APK đầu ra: `android/app/build/outputs/apk/debug/app-debug.apk`

### 4.3. Bước 3: Build Release APK
Dùng để chạy nghiệm thu, demo bảo mật và cài lên điện thoại thật:
```powershell
cd android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
```
*(Hoặc dùng lệnh rút gọn từ root package.json: `npm run build:android:local`)*

File APK đầu ra: `android/app/build/outputs/apk/release/app-release.apk` (Dung lượng: ~38.6 MB, đã tối ưu R8/ProGuard).

---

## 5. Cài đặt và Chạy Thử nghiệm

### 5.1. Cài đặt lên Android Emulator
1. Khởi động Emulator (ví dụ: `Pixel_8_Pro` x86_64):
   ```powershell
   emulator -avd Pixel_8_Pro
   ```
2. Cài đặt APK:
   ```powershell
   adb -s emulator-5554 install -r android/app/build/outputs/apk/debug/app-debug.apk
   # Hoặc bản release:
   adb -s emulator-5554 install -r android/app/build/outputs/apk/release/app-release.apk
   ```
3. Khởi chạy ứng dụng:
   ```powershell
   adb -s emulator-5554 shell am start -n com.whisperchat.app/.MainActivity
   ```

### 5.2. Cài đặt lên Điện thoại Thật (Physical Device)
1. Bật **Developer Options** và kích hoạt **USB Debugging** trên điện thoại Android.
2. Kết nối điện thoại với máy tính qua cáp USB và chấp nhận thông báo tin cậy máy tính.
3. Kiểm tra thiết bị nhận diện:
   ```powershell
   adb devices
   ```
4. Cài đặt file Release APK:
   ```powershell
   adb install -r android/app/build/outputs/apk/release/app-release.apk
   ```
5. Mở ứng dụng WhisperChat trên điện thoại.

---

## 6. Theo dõi Logcat & Gỡ lỗi Mạng
Để theo dõi log mạng, TLS handshake và nhật ký thực thi React Native:
```powershell
# Xem log JavaScript của ứng dụng:
adb logcat -s ReactNativeJS

# Xem log kiểm tra chứng chỉ và pinning của hệ điều hành Android:
adb logcat | Select-String -Pattern "PinFailureLogger|TrustManagerImpl|network_security_config"
```
