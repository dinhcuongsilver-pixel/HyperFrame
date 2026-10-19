/*
ExtendScript helper to insert an SFX file at given timecodes.
This script prompts for a JSON file containing array of {path: 'C:/..', start: seconds}
*/
(function(){
  if (!app.project) { alert('No project open'); return }
  var jsonFile = File.openDialog('Select SFX instructions JSON')
  if (!jsonFile) return
  jsonFile.open('r')
  var data = jsonFile.read()
  jsonFile.close()
  var instructions = JSON.parse(data)
  if (!app.project.activeSequence) { alert('Open a sequence'); return }
  var seq = app.project.activeSequence
  var audioTrack = seq.audioTracks[0]
  for (var i=0;i<instructions.length;i++){
    var ins = instructions[i]
    // import the file
    app.project.importFiles([ins.path], true, app.project.getInsertionBin(), false)
    // find project item
    var item = null
    var root = app.project.rootItem
    for (var j=0;j<root.children.numItems;j++){
      var it = root.children[j]
      if (it.getMediaPath && it.getMediaPath() === ins.path) { item = it; break }
    }
    if (item) {
      audioTrack.insertClip(item, ins.start)
    }
  }
  alert('SFX insertion complete (may need manual alignment)')
}())
