const http = require('http')
const WebSocket = require('ws')
const { spawn } = require('child_process')
const path = require('path')

const server = http.createServer()
const wss = new WebSocket.Server({ server })

wss.on('connection', (ws) => {
  console.log('client connected')
  ws.send(JSON.stringify({ type:'log', msg:'Welcome to HyperFrame backend' }))

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg)
      if (data.action === 'run-ffmpeg-demo') runFFmpegDemo(ws)
    } catch (e) { console.error(e) }
  })
})

function broadcast(obj, ws){
  const s = JSON.stringify(obj)
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(s)
}

function runFFmpegDemo(ws) {
  // Demo: run `ffmpeg -version` or a small command if ffmpeg.exe exists
  const bin = path.join(__dirname, 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')

  const ff = spawn(bin, ['-version'])

  ff.stdout.on('data', (d) => broadcast({type:'log', msg:d.toString()}, ws))
  ff.stderr.on('data', (d) => broadcast({type:'log', msg:d.toString()}, ws))

  ff.on('error', (err) => broadcast({type:'log', msg:'ffmpeg error: '+err.message}, ws))
  ff.on('close', (code) => {
    broadcast({type:'log', msg:'ffmpeg exited code '+code}, ws)
    broadcast({type:'progress', percent:100}, ws)
  })

  // emit fake progress for demo
  let p = 0
  const t = setInterval(() => {
    p += 7
    broadcast({type:'progress', percent:p}, ws)
    if (p >= 90) { clearInterval(t) }
  }, 400)
}

const PORT = 8080
server.listen(PORT, () => console.log('HyperFrame backend listening on', PORT))
