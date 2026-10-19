# HyperFrame — Notes for Premiere 2026 & Offline Whisper

Đã cập nhật scaffold để hỗ trợ Premiere Pro 2026 (CEP panel). Bạn đã yêu cầu chạy offline cho Whisper và đã có kho SFX.

Những việc tôi đã làm ngay bây giờ:
- Thêm module `silence.js` trong plugin/backend để chạy ffmpeg silencedetect và xuất cutlist JSON.
- Cập nhật server để xử lý action `run-silence` qua WebSocket và lưu `cutlist.json` tại plugin/backend/output.
- Thêm một số ExtendScript (.jsx) dưới plugin/extendscripts/ để áp cutlist, import SRT, chèn SFX. Những script này là điểm khởi đầu và có thể cần tinh chỉnh với Premiere 2026 API.

Hướng dẫn chạy nhanh (Windows):
1. Cài Node.js >=16
2. Từ repo root: cd plugin/backend && npm init -y && npm i ws
3. Đặt ffmpeg.exe và ffprobe.exe vào plugin/backend/bin/ (bạn có thể dùng setup_binaries.ps1 và sửa URL nếu cần)
4. Đặt sample video vào plugin/backend/test_assets/sample.mp4 (hoặc truyền đường dẫn từ panel)
5. Chạy: node server.js
6. Mở plugin/panel/index.html trong trình duyệt (dev). Click "Run ffmpeg demo" để kiểm tra kết nối hoặc gửi ws message {"action":"run-silence","input":"C:/path/to/file.mp4"}
7. Sau khi hoàn thành, cutlist.json sẽ có ở plugin/backend/output/cutlist.json — bạn có thể chạy applyCutsFromJson.jsx trong Premiere (File > Scripts > Run Script).

Lưu ý quan trọng:
- Whisper (offline): tôi sẽ chuẩn bị integration với whisper.cpp nhưng model weights (ggml files) rất lớn — tôi sẽ cung cấp hướng dẫn để tải model offline và chỉ dùng binary để transcribe.
- ExtendScript API thay đổi theo Premiere; các script tôi thêm là generic và có thể cần chỉnh nhẹ cho Premiere 2026. Tôi sẽ test trên Premiere 2026 nếu bạn cung cấp sample video và môi trường test.


Next steps tôi sẽ làm tiếp:
1. Thêm API trong panel để chọn file từ máy, gọi run-silence và hiển thị cutlist preview.
2. Tích hợp CSInterface trong CEP panel để trực tiếp gọi ExtendScript và áp cutlist vào timeline (tự động) — cần panel được load trong Premiere.
3. Thêm audio sync backend, SFX search connector, auto audio cleanup pipeline.
4. Tích hợp whisper.cpp offline (download script + progress stream).

Trước khi tôi tiếp tục, xác nhận 2 điều ngắn:
- Bạn sẽ cung cấp 1-2 sample videos để tôi test cut/sync/color? (Yes/No)
- Bạn muốn tôi tiếp tục phát triển trực tiếp trên repo HyperFrame này? (Yes/Continue)
