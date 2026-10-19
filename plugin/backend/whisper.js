const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

function resolveExecutable(name) {
  const candidates = [
    path.join(__dirname, 'bin', process.platform === 'win32' ? `${name}.exe` : name),
    path.join(__dirname, 'bin', process.platform === 'win32' ? `${name}.cmd` : name),
    path.join(__dirname, 'bin', 'ffmpeg.exe'),
    path.join(__dirname, 'bin', 'ffprobe.exe')
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function getDuration(filePath) {
  return new Promise((resolve, reject) => {
    const ffprobe = resolveExecutable('ffprobe')
    if (!ffprobe) {
      resolve(0)
      return
    }

    const proc = spawn(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath])
    let output = ''
    proc.stdout.on('data', (d) => { output += d.toString() })
    proc.stderr.on('data', (d) => { output += d.toString() })
    proc.on('close', () => {
      const value = parseFloat(output)
      resolve(Number.isFinite(value) ? value : 0)
    })
    proc.on('error', () => resolve(0))
  })
}

function parseSilenceOutput(stderr) {
  const lines = stderr.split(/\r?\n/)
  const events = []

  for (const line of lines) {
    const startMatch = line.match(/silence_start: ([0-9.]+)/)
    if (startMatch) events.push({ type: 'start', t: parseFloat(startMatch[1]) })

    const endMatch = line.match(/silence_end: ([0-9.]+) \| silence_duration: ([0-9.]+)/)
    if (endMatch) events.push({ type: 'end', t: parseFloat(endMatch[1]), dur: parseFloat(endMatch[2]) })
  }

  return events
}

function segmentsFromSilenceEvents(events, duration) {
  const silenceIntervals = []
  const starts = events.filter(e => e.type === 'start')
  for (const start of starts) {
    const end = events.find(e => e.type === 'end' && e.t >= start.t)
    if (end) silenceIntervals.push([start.t, end.t])
    else silenceIntervals.push([start.t, duration || 0])
  }

  const segments = []
  let cursor = 0
  for (const [start, end] of silenceIntervals) {
    if (cursor < start) segments.push({ start: cursor, end: start })
    cursor = end
  }

  if (duration > 0 && cursor < duration) segments.push({ start: cursor, end: duration })
  return segments
}

function detectSilence(filePath, progressCb) {
  return new Promise((resolve, reject) => {
    const ffmpeg = resolveExecutable('ffmpeg')
    if (!ffmpeg) {
      reject(new Error('FFmpeg executable not found. Place ffmpeg.exe into /plugin/backend/bin'))
      return
    }

    getDuration(filePath)
      .then((duration) => {
        const proc = spawn(ffmpeg, ['-i', filePath, '-af', 'silencedetect=n=-35dB:d=0.5', '-f', 'null', '-'])
        let stderr = ''

        proc.stderr.on('data', (chunk) => {
          const text = chunk.toString()
          stderr += text
          const match = text.match(/time=([0-9:\.]+)/)
          if (match && duration > 0) {
            const values = match[1].split(':').map(Number).reverse()
            let seconds = 0
            values.forEach((val, idx) => { seconds += val * Math.pow(60, idx) })
            const pct = Math.min(100, Math.max(0, Math.round((seconds / duration) * 100)))
            if (progressCb) progressCb(pct)
          }
        })

        proc.on('close', () => {
          const events = parseSilenceOutput(stderr)
          const segments = segmentsFromSilenceEvents(events, duration)
          resolve(segments)
        })

        proc.on('error', reject)
      })
      .catch(reject)
  })
}

function runWhisperOffline(filePath, modelPath, progressCb) {
  return new Promise((resolve, reject) => {
    const whisper = resolveExecutable('whisper')
    if (!whisper) {
      reject(new Error('Whisper executable not found. Place whisper.exe or whisper.cpp binary into /plugin/backend/bin'))
      return
    }

    const args = ['-m', modelPath || '', '-f', filePath, '-otxt']
    const proc = spawn(whisper, args.filter(Boolean))
    let output = ''

    proc.stdout.on('data', (chunk) => { output += chunk.toString() })
    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      output += text
      if (progressCb) {
        const m = text.match(/(\d+)%/)
        if (m) progressCb(parseInt(m[1], 10))
      }
    })

    proc.on('close', (code) => {
      if (code !== 0) reject(new Error('Whisper failed: ' + output))
      else resolve(output)
    })

    proc.on('error', reject)
  })
}

module.exports = {
  detectSilence,
  runWhisperOffline,
  getDuration
}
