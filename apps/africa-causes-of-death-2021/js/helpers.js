// Wrap an SVG <text> element to a target pixel width by breaking on spaces.
// First tspan is rendered smaller (sub-total line, like "Total N | name").
// The "|" character forces a line break. Faithful port of Bremer's wrap()
// from the 2015 labor piece, retuned for D3 v7 (no .each binding).
export function wrap(textNode, width) {
  const text = d3.select(textNode);
  const words = text.text().split(/\s+/).reverse();
  const currentSize = parseFloat(text.style("font-size"));
  const y = text.attr("y");
  const dy = parseFloat(text.attr("dy")) || 0;
  const lineHeight = 1.2;
  const extraHeight = 0.2;

  let line = [];
  let lineNumber = 0;
  let tspan = text.text(null)
    .append("tspan")
    .attr("class", "subTotal")
    .attr("x", 0).attr("y", y)
    .attr("dy", dy + "em")
    .style("font-size", (Math.round(currentSize * 0.5) <= 5 ? 0 : Math.round(currentSize * 0.5)) + "px");

  let word;
  while ((word = words.pop()) !== undefined) {
    line.push(word);
    tspan.text(line.join(" "));
    if (tspan.node().getComputedTextLength() > width || word === "|") {
      if (word === "|") word = "";
      line.pop();
      tspan.text(line.join(" "));
      line = [word];
      tspan = text.append("tspan")
        .attr("x", 0).attr("y", y)
        .attr("dy", (++lineNumber * lineHeight + extraHeight + dy) + "em")
        .text(word);
    }
  }
}

export const commaFormat = d3.format(",");

// Cancellation token. The currently-running zoom registers its abort signal
// here; the next zoom replaces it, which is enough to make stale transitions
// no-op once they next resume. v3's clearTimeout hack is no longer needed.
export function makeCancellation() {
  let current = null;
  return {
    start() {
      if (current) current.abort();
      current = new AbortController();
      return current.signal;
    },
    get signal() { return current ? current.signal : null; },
  };
}
