const { spawn } = require('child_process')
const path = require('path')

// Runs ffmpeg silencedetect and parses output into cutlist
// Returns an array of non-silent segments: [{start, end}]

function parseSilenceOutput(stderr) {
  const lines = stderr.split(/\r?\n/)
  const silences = []
  for (const l of lines) {
    const s = l.match(/silence_start: ([0-9.]+)/)
    if (s) silences.push({ type:'start', t: parseFloat(s[1]) })
    const e = l.match(/silence_end: ([0-9.]+) \| silence_duration: ([0-9.]+)/)
    if (e) silences.push({ type:'end', t: parseFloat(e[1]), dur: parseFloat(e[2]) })
  }
  return silences
}

function invertSilencesToSegments(silences, totalDuration) {
  // silences: sequence of {type:'start'|'end', t}
  // produce segments of non-silent audio
  const segments = []
  let lastEnd = 0
  // pair starts and ends
  const paired = []
  for (let i=0;i<silences.length;i++){
    const it = silences[i]
    if (it.type === 'end') continue
  }
  // Build array of silence intervals
  const silenceIntervals = []
  for (let i=0;i<silences.length;i++){
    const item = silences[i]
    if (item.type === 'start') {
      // find next end
      const next = silences.find(x => x.type === 'end' && x.t >= item.t)
      if (next) silenceIntervals.push([item.t, next.t])
      else silenceIntervals.push([item.t, totalDuration])
    }
  }
  // construct non-silent segments between silences
  let cursor = 0
  for (const si of silenceIntervals) {
    const s = si[0], e = si[1]
    if (cursor < s) segments.push({ start: cursor, end: s })
    cursor = e
  }
  if (cursor < totalDuration) segments.push({ start: cursor, end: totalDuration })
  return segments
}

function detectSilence(filePath, progressCb) {
  return new Promise((resolve, reject) => {
    const ff = process.platform === 'win32' ? path.join(__dirname,'bin','ffmpeg.exe') : 'ffmpeg'
    // First, probe duration using ffprobe (ffmpeg -i gives duration on stderr) - but simpler: use ffprobe if available
    const ffprobe = process.platform === 'win32' ? path.join(__dirname,'bin','ffprobe.exe') : 'ffprobe'
    const probe = spawn(ffprobe, ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1', filePath])
    let duration = null
    probe.stdout.on('data', (d) => { duration = parseFloat(d.toString()) })
    probe.on('close', (code) => {
      if (!duration || isNaN(duration)) duration = 0
      // run ffmpeg silencedetect
      const args = ['-i', filePath, '-af', 'silencedetect=n=-35dB:d=0.5', '-f', 'null', '-']
      const proc = spawn(ff, args)
      let stderr = ''
      proc.stderr.on('data', (d) => {
        stderr += d.toString()
        // crude progress: estimate by reading time=... entries
        const m = d.toString().match(/time=([0-9:\.]+)/)
        if (m && duration) {
          const parts = m[1].split(':').map(parseFloat).reverse()
          let secs = 0
          for (let i=0;i<parts.length;i++) secs += parts[i] * Math.pow(60,i)
          const pct = Math.round((secs / duration) * 100)
          progressCb(pct)
        }
      })
      proc.on('close', (code) => {
        const silences = parseSilenceOutput(stderr)
        const segments = invertSilencesToSegments(silences, duration)
        resolve(segments)
      })
      proc.on('error', (err) => reject(err))
    })
    probe.on('error', (err) => {
      // fallback: run ffmpeg directly without duration
      const args = ['-i', filePath, '-af', 'silencedetect=n=-35dB:d=0.5', '-f', 'null', '-']
      const proc = spawn(ff, args)
      let stderr = ''
      proc.stderr.on('data', (d) => { stderr += d.toString() })
      proc.on('close', (code) => {
        const silences = parseSilenceOutput(stderr)
        const segments = invertSilencesToSegments(silences, 0)
        resolve(segments)
      })
      proc.on('error', (err) => reject(err))
    })
  })
}

module.exports = { detectSilence }
