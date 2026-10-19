const http = require('http')
const WebSocket = require('ws')
const path = require('path')
const fs = require('fs')
const { detectSilence, runWhisperOffline } = require('./ffmpegService')

const server = http.createServer()
const wss = new WebSocket.Server({ server })

function broadcast(ws, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload))
  }
}

wss.on('connection', (ws) => {
  console.log('client connected')
  broadcast(ws, { type: 'log', msg: 'HyperFrame backend ready' })

  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg)
      switch (data.action) {
        case 'run-ffmpeg-demo':
          runFFmpegDemo(ws)
          break

        case 'run-silence': {
          const input = data.input || path.join(__dirname, 'test_assets', 'sample.mp4')
          if (!fs.existsSync(input)) {
            broadcast(ws, { type: 'log', msg: `Input not found: ${input}` })
            return
          }

          broadcast(ws, { type: 'log', msg: `Running silence detection on ${input}` })
          const segments = await detectSilence(input, (pct) => broadcast(ws, { type: 'progress', percent: pct }))
          const outDir = path.join(__dirname, 'output')
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
          const outPath = path.join(outDir, 'cutlist.json')
          fs.writeFileSync(outPath, JSON.stringify(segments, null, 2))
          broadcast(ws, { type: 'log', msg: `Silence cutlist saved to ${outPath}` })
          broadcast(ws, { type: 'cuts', cuts: segments })
          broadcast(ws, { type: 'progress', percent: 100 })
          break
        }

        case 'run-whisper': {
          const input = data.input || path.join(__dirname, 'test_assets', 'sample.wav')
          const model = data.model || path.join(__dirname, 'models', 'ggml-base.en.bin')

          if (!fs.existsSync(input)) {
            broadcast(ws, { type: 'log', msg: `Whisper input not found: ${input}` })
            return
          }

          broadcast(ws, { type: 'log', msg: `Running Whisper offline: ${input}` })
          const result = await runWhisperOffline(input, model, (pct) => broadcast(ws, { type: 'progress', percent: pct }))
          const outDir = path.join(__dirname, 'output')
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
          const outPath = path.join(outDir, 'transcript.txt')
          fs.writeFileSync(outPath, result)
          broadcast(ws, { type: 'log', msg: `Transcript saved to ${outPath}` })
          broadcast(ws, { type: 'transcript', text: result })
          broadcast(ws, { type: 'progress', percent: 100 })
          break
        }

        case 'scan-sfx': {
          const directory = data.directory || 'C:/SFX'
          const files = scanSfx(directory)
          broadcast(ws, { type: 'sfx', files })
          break
        }
      }
    } catch (error) {
      broadcast(ws, { type: 'log', msg: error.message || String(error) })
    }
  })
})

function scanSfx(directory) {
  if (!fs.existsSync(directory)) return []
  const files = []
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) walk(full)
      else if (/\.(wav|mp3|aiff|flac)$/i.test(full)) files.push(full)
    }
  }
  walk(directory)
  return files
}

function runFFmpegDemo(ws) {
  const ffmpeg = path.join(__dirname, 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  const proc = spawn(ffmpeg, ['-version'])

  proc.stdout.on('data', (d) => broadcast(ws, { type: 'log', msg: d.toString() }))
  proc.stderr.on('data', (d) => broadcast(ws, { type: 'log', msg: d.toString() }))

  proc.on('error', (err) => broadcast(ws, { type: 'log', msg: 'ffmpeg error: ' + err.message }))
  proc.on('close', (code) => {
    broadcast(ws, { type: 'log', msg: 'ffmpeg exited with code ' + code })
    broadcast(ws, { type: 'progress', percent: 100 })
  })

  let p = 0
  const timer = setInterval(() => {
    p += 7
    broadcast(ws, { type: 'progress', percent: p })
    if (p >= 90) clearInterval(timer)
  }, 400)
}

const PORT = 8080
server.listen(PORT, () => console.log('HyperFrame backend listening on', PORT))
