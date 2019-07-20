// @ts-check
// Process front matter and pass to cb
//
'use strict';

module.exports = function front_matter_plugin(md, cb) {
  var min_markers = 3,
      marker_char  = '-'

  function frontMatter(state, startLine, endLine, silent) {
    var pos, currentLine, marker_count, token,
        old_parent, old_line_max,
        front_matter_end_found = false,
        lineFirstCharIndex = state.bMarks[startLine] + state.tShift[startLine],
        lineLastCharIndex = state.eMarks[startLine];

    // Check out the first character of the first line quickly,
    // this should filter out non-front matter
    //

    // Ensure starting at line 0 and first line contains 3+ dashes ending in return or carriage return
    if (startLine !== 0 || !/^---+\s*$/.test(state.src.slice(lineFirstCharIndex, lineLastCharIndex))) { return false; }

    // Check out the rest of the marker string
    //
    const start_content = lineLastCharIndex + 1;

    marker_count = state.src.slice(lineFirstCharIndex, lineLastCharIndex).split("-").length - 1;

    if (marker_count < min_markers) { return false; }
    
    // Handle carriage return case
    pos = 0;

    // Since start is found, we can report success here in validation mode
    //
    if (silent) { return true; }

    // Search for the end of the block
    //
    currentLine = startLine;

    for (;;) {
      currentLine++;
      if (currentLine >= endLine) {
        // unclosed block should be autoclosed by end of document.
        // also block seems to be autoclosed by end of parent
        break;
      }

      // bMarks: line starts
      // tShift: tab shifts
      // eMarks: end marks
      // --> start: start of line     max: end of line
      lineFirstCharIndex = state.bMarks[currentLine] + state.tShift[currentLine];
      lineLastCharIndex = state.eMarks[currentLine];

      if (lineFirstCharIndex < lineLastCharIndex && state.sCount[currentLine] < state.blkIndent) {
        // non-empty line with negative indent should stop the list:
        // - ```
        //  test
        break;
      }

      var benchmarkChar;
      if (marker_char !== state.src[lineFirstCharIndex] && '.' !== state.src[lineFirstCharIndex]){ 
        continue;
      }
      else{
        benchmarkChar = state.src[lineFirstCharIndex];
      }
      

      if (state.sCount[currentLine] - state.blkIndent >= 4) {
        // closing fence should be indented less than 4 spaces
        continue;
      }

      for (pos = lineFirstCharIndex + 1; pos <= lineLastCharIndex; pos++) {
        if (benchmarkChar !== state.src[pos]) {
          break;
        }
      }

      // closing code fence must be at least as long as the opening one
      if (Math.floor((pos - lineFirstCharIndex)) < marker_count) { continue; }

      // make sure tail has spaces only
      pos = state.skipSpaces(pos);

      if (pos < lineLastCharIndex) { continue; }

      // found!
      front_matter_end_found = true;
      break;
    }

    old_parent = state.parentType;
    old_line_max = state.lineMax;
    state.parentType = 'container';

    // this will prevent lazy continuations from ever going past our end marker
    state.lineMax = currentLine;

    token        = state.push('front_matter', null, 0);
    token.hidden = true;
    token.markup = state.src.slice(startLine, pos)
    token.block  = true;
    token.map    = [ startLine, pos ];

    state.parentType = old_parent;
    state.lineMax = old_line_max;
    state.line = currentLine + (front_matter_end_found ? 1 : 0);

    cb(state.src.slice(start_content, lineFirstCharIndex - 1))

    return true;
  }

  md.block.ruler.before('table', 'front_matter', frontMatter, {
    alt: [ 'paragraph', 'reference', 'blockquote', 'list' ]
  });
};