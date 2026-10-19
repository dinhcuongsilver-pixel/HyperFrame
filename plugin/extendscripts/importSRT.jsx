/*
ExtendScript to import an SRT file into project and place captions on the timeline.
Usage: put this script in Premiere Scripts folder and run with dialog to pick the SRT file.
Note: Premiere scripting caption API is limited across versions; this script imports the SRT as a file and places it on a track.
*/
(function(){
  if (!app.project) { alert('No project open'); return }
  var srtFile = File.openDialog('Select SRT file to import')
  if (!srtFile) return
  var srtPath = srtFile.fsName
  // Import SRT into project
  var ok = app.project.importFiles([srtPath], true, app.project.getInsertionBin(), false)
  if (!ok) { alert('Import failed'); return }
  // Find imported item
  var imported = null
  var root = app.project.rootItem
  for (var i=0;i<root.children.numItems;i++){
    var it = root.children[i]
    if (it.name === srtFile.name) { imported = it; break }
  }
  if (!imported) { alert('Imported SRT not found in project panel'); return }

  if (!app.project.activeSequence) { alert('Open a sequence to place captions'); return }
  var seq = app.project.activeSequence
  // create a new track for captions if needed
  var captionsTrackIndex = seq.videoTracks.numTracks // append at top
  seq.videoTracks.add() // not all APIs support add(); may fail on some versions
  // Instead, insert the imported item at current time on video track 2
  seq.videoTracks[1].insertClip(imported, seq.getPlayerPosition())
  alert('SRT imported to project and placed on track 2. You may need to convert it to Premiere captions manually depending on version.')
}())
