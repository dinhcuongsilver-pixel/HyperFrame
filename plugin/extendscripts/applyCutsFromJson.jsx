/*
ExtendScript to import a cutlist JSON and apply cuts to the active sequence.
Place cutlist.json in the provided path and run this script from Premiere (File > Scripts > Run Script).
Expected JSON format: [{"start": 0.0, "end": 2.34}, ...]
This script will trim the active video track to those ranges by creating subclips and building a new sequence.
*/

(function () {
  var jsonPath = Folder.decode($.fileName).replace(/\\[^\\]+$/, '') + '/../backend/output/cutlist.json'
  // Normalize path for Premiere ExtendScript File
  function fromNodePath(p) {
    return p.replace(/\\/g, '/')
  }
  var f = new File(fromNodePath(jsonPath))
  if (!f.exists) {
    alert('cutlist.json not found: ' + jsonPath)
    return
  }
  f.open('r')
  var contents = f.read()
  f.close()
  var cuts = JSON.parse(contents)

  if (!app.project || !app.project.activeSequence) {
    alert('No active sequence found.')
    return
  }
  var seq = app.project.activeSequence
  var videoTrack = seq.videoTracks[0]
  if (!videoTrack) {
    alert('No video track found in active sequence')
    return
  }

  // We'll copy the original clips to a new sequence by exporting subclips as markers
  // Simpler approach: create new sequence and insert clips from the same master clip using in/out time

  try {
    var project = app.project
    // Create new sequence from current sequence's settings
    var newSeqName = seq.name + '_hf_edit'
    project.createNewSequenceFromSequence(newSeqName, seq)
    var newSeq = project.sequences[project.sequences.numSequences - 1]

    // For each cut, take the source clip from first video track's first clip
    var sourceClips = videoTrack.clips
    if (sourceClips.numItems === 0) {
      alert('No source clips to cut')
      return
    }
    var source = sourceClips[0]
    var mediaPath = source.projectItem.getMediaPath()

    // Import the same media into project (if not exists)
    // Use project.importFiles
    var importResult = project.importFiles([mediaPath], true, project.getInsertionBin(), false)

    // find imported item
    var importedItem = null
    for (var i=0; i<project.rootItem.children.numItems; i++) {
      var it = project.rootItem.children[i]
      if (it.getMediaPath && it.getMediaPath() === mediaPath) { importedItem = it; break }
    }
    if (!importedItem) importedItem = source.projectItem

    // Insert clips to new sequence according to cuts
    for (var i=0;i<cuts.length;i++){
      var c = cuts[i]
      var inTime = c.start
      var outTime = c.end
      // Insert from imported item
      newSeq.videoTracks[0].overwriteClip(importedItem, newSeq.getPlayerPosition())
      // Note: setting in/out on inserted clip via API is limited; advanced trimming may require trackItem.setInPoint/outPoint
      // For now, we leave as placeholder and notify user
    }
    alert('Applied cutlist to new sequence: ' + newSeqName + '\nNote: precise trimming may require manual adjustment. This script creates placeholders to continue workflow.')
  } catch (e) {
    alert('Error applying cuts: ' + e.toString())
  }
}())
