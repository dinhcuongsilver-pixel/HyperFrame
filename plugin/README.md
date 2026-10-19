# Plugin scaffold for HyperFrame

This folder contains a minimal CEP panel and a local Node.js backend to demonstrate the architecture.

Quick start (Windows):
1. Install Node.js (>=16).
2. From repository root: cd plugin/backend && npm install
3. Run: node server.js
4. Open plugin/panel/index.html in a browser to test the UI (development). To load as a CEP panel in Premiere, copy the panel folder to the CEP extensions path for your Premiere Pro version (see Adobe CEP docs).

Notes about ffmpeg & whisper:
- The backend provides a placeholder to spawn ffmpeg and whisper processes and stream progress to the panel.
- You can download ffmpeg for Windows and place ffmpeg.exe in plugin/backend/bin/ffmpeg.exe.
- For offline whisper, consider using whisper.cpp builds for Windows and place the binary in plugin/backend/bin/whisper.exe.
- I included setup_binaries.ps1 to help download commonly used prebuilt artifacts (edit before running).
