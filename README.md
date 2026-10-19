# HyperFrame — Premiere Pro Assistant Plugin (Scaffold)

HyperFrame là một plugin dạng panel + local backend để tự động hoá các tác vụ chỉnh sửa video trên Premiere Pro (không qua Adobe Cloud). Mục tiêu: silence removal, audio sync, SRT import, b-roll/motion graphics integration, dynamic zoom, transitions, SFX/music insertion, audio cleanup, auto color grading, và tích hợp ffmpeg + whisper với thanh tiến trình.

Mục lục:
- plugin/: scaffold code cho panel (CEP) và backend (Node.js)
- README.md: bạn đang đọc

Tiếp theo bạn có thể:
1. Kiểm tra /plugin và làm theo hướng dẫn để chạy demo local (silence removal + progress).
2. Cung cấp sample videos và thông tin Higgsfield để tôi tích hợp tiếp.

Liệt kê những thứ tôi sẽ thêm bước tiếp theo (nếu bạn đồng ý):
- Implement silence removal pipeline (ffmpeg + auto thresholds)
- Implement audio sync demo
- Implement SRT import into Premiere via ExtendScript snippets
- Create installer để copy panel vào thư mục CEP của Premiere trên Windows

