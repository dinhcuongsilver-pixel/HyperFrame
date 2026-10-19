(() => {
  const statusEl = document.getElementById('status')
  const logEl = document.getElementById('log')
  const barEl = document.getElementById('bar')
  const selectedPathEl = document.getElementById('selectedPath')
  const fileInput = document.getElementById('fileInput')

  let ws
  let selectedFile = ''

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    selectedFile = file.path || file.name || file.webkitRelativePath || ''
    selectedPathEl.textContent = 'Selected: ' + selectedFile
    log('Selected file: ' + selectedFile)
  })

  function log(msg) {
    logEl.textContent += msg + '\n'
    logEl.scrollTop = logEl.scrollHeight
  }

  function connect() {
    ws = new WebSocket('ws://localhost:8080')
    ws.onopen = () => {
      statusEl.textContent = 'connected'
      log('Connected to HyperFrame backend')
    }
    ws.onclose = () => {
      statusEl.textContent = 'disconnected'
      setTimeout(connect, 2000)
    }
    ws.onmessage = (m) => {
      try {
        const data = JSON.parse(m.data)
        if (data.type === 'log') {
          log(data.msg)
        } else if (data.type === 'progress') {
          const pct = Math.max(0, Math.min(100, Number(data.percent) || 0))
          barEl.style.width = pct + '%'
        } else if (data.type === 'cuts') {
          log('Silence segments: ' + JSON.stringify(data.cuts))
        } else if (data.type === 'transcript') {
          log('Transcript: ' + data.text)
        } else if (data.type === 'sfx') {
          log('SFX files found: ' + data.files.length)
          if (data.files.length) log(data.files.slice(0, 10).join('\n'))
        }
      } catch (e) {
        log('Received non-JSON output: ' + m.data)
      }
    }
  }

  connect()

  document.getElementById('runSilenceBtn').addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return log('Backend not connected')
    const path = selectedFile || ''
    ws.send(JSON.stringify({ action: 'run-silence', input: path }))
  })

  document.getElementById('runWhisperBtn').addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return log('Backend not connected')
    const path = selectedFile || ''
    ws.send(JSON.stringify({ action: 'run-whisper', input: path }))
  })

  document.getElementById('runSfxBtn').addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return log('Backend not connected')
    ws.send(JSON.stringify({ action: 'scan-sfx', directory: 'C:/SFX' }))
  })
})()
