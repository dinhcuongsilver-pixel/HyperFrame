(() => {
  const statusEl = document.getElementById('status')
  const logEl = document.getElementById('log')
  const barEl = document.getElementById('bar')
  const startBtn = document.getElementById('startFF')

  let ws
  function connect() {
    ws = new WebSocket('ws://localhost:8080')
    ws.onopen = () => { statusEl.textContent = 'connected' }
    ws.onclose = () => { statusEl.textContent = 'disconnected'; setTimeout(connect,2000) }
    ws.onmessage = (m) => {
      try {
        const data = JSON.parse(m.data)
        if (data.type === 'log') {
          logEl.textContent += data.msg + '\n'
          logEl.scrollTop = logEl.scrollHeight
        } else if (data.type === 'progress') {
          barEl.style.width = Math.max(0, Math.min(100, data.percent)) + '%'
        }
      } catch (e) {
        console.warn('non-json message', m.data)
      }
    }
  }
  connect()

  startBtn.addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return alert('Backend not connected')
    ws.send(JSON.stringify({action:'run-ffmpeg-demo'}))
  })
})()
