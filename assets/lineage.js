/*
 * lineage.js - the interactive lineage tree for the "How it works" section.
 *
 * Every chain in the live soup has an id, and soup.log (an EventLog) records
 * each generation, mutation, recombination and break with its parents. Pick a
 * chain from the strip (the deepest-ancestry chains currently alive) and the
 * tree draws its ancestors as a graph: generations run left to right, a
 * mutation has one parent, a recombination has two (dashed magenta edge).
 * Click any node to re-root the tree there. By default the view follows the
 * chain as it mutates, so the tree keeps growing to the right.
 *
 * The tree is plain SVG built from a string; events are delegated on the <svg>
 * and nodes are focusable buttons so it works from the keyboard.
 */
(function () {
  'use strict';
  const A = window.Abio;
  const TYPE = { gen: ['born from nothing', 188], mut: ['mutation', 118], rec: ['recombination', 320], frag: ['break', 46] };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clock = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

  function beads(seq, mark) {
    return seq.split('').map((c, i) => '<span class="bead' + (i === mark ? ' hit' : '') + '" style="--h:' + (A.letterHue[c] || 180) + '">' + c + '</span>').join('');
  }

  A.makeLineage = function (els) {
    const { strip, svg, detail, live, follow, stats } = els;
    let sel = null, dirty = true, acc = 99, hold = false;

    function describe(e) {
      if (!e) return 'This chain is older than the log remembers.';
      const t = TYPE[e.type];
      let how = t[0] === 'born from nothing' ? 'Condensed from the soup' : '';
      if (e.type === 'mut') {
        const m = e.mut;
        how = m.type === 'sub' ? 'Substitution at position ' + (m.index + 1) + ': ' + m.from + ' became ' + m.to
          : m.type === 'ins' ? 'Insertion at position ' + (m.index + 1) + ': ' + m.residue + ' slipped in'
          : 'Deletion at position ' + (m.index + 1) + ': ' + m.residue + ' dropped out';
        how += ' (parent #' + e.parents[0] + ')';
      } else if (e.type === 'rec') how = 'Recombination of #' + e.parents[0] + ' (head up to position ' + e.cut[0] + ') and #' + e.parents[1] + ' (tail from position ' + (e.cut[1] + 1) + ')';
      else if (e.type === 'frag') how = 'Broke off a tail; head of #' + e.parents[0] + ' lives on';
      return how + '. Generation ' + e.depth + ', at ' + clock(e.t) + '.';
    }

    function select(id, byUser) {
      sel = id; dirty = true;
      const e = A.soup.log.get(id);
      detail.innerHTML = '<p><strong>Chain #' + id + '</strong> ' + (e ? beads(e.seq, e.mut && e.mut.type !== 'del' ? e.mut.index : -1) : '') + '</p><p>' + esc(describe(e)) + '</p>';
      if (byUser && live) live.textContent = 'Chain ' + id + '. ' + describe(e) + (e ? ' Sequence ' + e.seq + '.' : '');
      markStrip();
    }

    /* ----- the strip of living chains ----- */
    function markStrip() {
      strip.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.id === sel)));
    }
    function refreshStrip() {
      const soup = A.soup;
      let alive = soup.chains.filter((c) => !c.dying).map((c) => ({ c, d: (soup.log.get(c.id) || { depth: 0 }).depth }));
      alive.sort((p, q) => q.d - p.d || q.c.age - p.c.age);
      alive = alive.slice(0, 10);
      if (follow && follow.checked && sel != null && !alive.some((a) => a.c.id === sel)) {
        // the chain mutated into a newer id: follow its deepest living descendant
        let bestC = null, bestD = -1;
        soup.chains.forEach((c) => {
          if (c.dying) return;
          const e = soup.log.get(c.id);
          if (e && e.depth > bestD && soup.log.ancestors(c.id, 8, 40).nodes.some((n) => n.id === sel)) { bestC = c; bestD = e.depth; }
        });
        if (bestC) select(bestC.id, false);
      }
      if (sel == null && alive.length) select(alive[0].c.id, false);
      strip.innerHTML = alive.map((a) => {
        const s = a.c.seq;
        return '<li><button type="button" data-id="' + a.c.id + '" aria-pressed="' + (a.c.id === sel) + '" aria-label="Chain ' + a.c.id + ', generation ' + a.d + ', sequence ' + s + '">' +
          '<span class="beads">' + beads(s.slice(0, 9)) + (s.length > 9 ? '<span class="more">+' + (s.length - 9) + '</span>' : '') + '</span>' +
          '<small>#' + a.c.id + ' &middot; gen ' + a.d + '</small></button></li>';
      }).join('');
    }
    strip.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) select(+b.dataset.id, true); });
    ['pointerenter', 'focusin'].forEach((n) => strip.addEventListener(n, () => (hold = true)));
    ['pointerleave', 'focusout'].forEach((n) => strip.addEventListener(n, () => (hold = false)));

    /* ----- the tree ----- */
    function drawTree() {
      const log = A.soup.log, res = log.ancestors(sel, 9, 40), nodes = res.nodes;
      if (!nodes.length) { svg.innerHTML = '<text x="20" y="40" class="lt">No recorded history for this chain.</text>'; return; }
      const depths = Array.from(new Set(nodes.map((n) => n.depth))).sort((a, b) => a - b);
      const col = {}; depths.forEach((d, i) => (col[d] = i));
      const byId = {}; nodes.forEach((n) => (byId[n.id] = n));
      /* Lanes (rows): the selected chain and its first-parent line share lane 0;
       * every extra parent of a recombination starts a new lane (+1, -1, +2, ...),
       * so branches never overlap. Columns are the distinct generation numbers. */
      const lane = {}; lane[sel] = 0;
      let nextLane = 1;
      nodes.forEach((n) => n.parents.forEach((p, i) => {
        if (!byId[p] || lane[p] !== undefined) return;
        if (i === 0) lane[p] = lane[n.id] || 0;
        else { lane[p] = (nextLane % 2 ? 1 : -1) * Math.ceil(nextLane / 2); nextLane++; }
      }));
      const ls = nodes.map((n) => lane[n.id] || 0), minL = Math.min.apply(null, ls), maxL = Math.max.apply(null, ls);
      const gap = 50, H = Math.max(150, (maxL - minL) * gap + 90), W = Math.max(380, depths.length * 110 + 40);
      const pos = {};
      nodes.forEach((n) => {
        const x = depths.length > 1 ? 40 + col[n.depth] * ((W - 80) / (depths.length - 1)) : W / 2;
        pos[n.id] = { x, y: 34 + ((lane[n.id] || 0) - minL) * gap };
      });
      let out = '';
      nodes.forEach((n) => n.parents.forEach((p) => {
        const a = pos[p], b = pos[n.id];
        if (!a || !b) return;
        const mx = (a.x + b.x) / 2;
        out += '<path class="edge' + (n.type === 'rec' ? ' rec' : '') + '" style="animation-delay:' + (Math.random() * 0.6).toFixed(2) + 's" d="M' + a.x + ' ' + a.y + ' C' + mx + ' ' + a.y + ' ' + mx + ' ' + b.y + ' ' + b.x + ' ' + b.y + '"/>';
      }));
      nodes.forEach((n) => {
        const p = pos[n.id], t = TYPE[n.type], isSel = n.id === sel, s = n.seq.length > 9 ? n.seq.slice(0, 8) + '…' : n.seq;
        out += '<g class="node' + (isSel ? ' sel' : '') + '" data-id="' + n.id + '" tabindex="0" role="button" aria-label="Chain ' + n.id + ', ' + t[0] + ', generation ' + n.depth + ', sequence ' + esc(n.seq) + '">' +
          '<circle class="halo" cx="' + p.x + '" cy="' + p.y + '" r="19" fill="hsl(' + t[1] + ' 85% 60% / .18)"/>' +
          '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + (isSel ? 12 : 9) + '" fill="hsl(' + t[1] + ' 85% 60%)"/>' +
          '<text x="' + p.x + '" y="' + (p.y + 27) + '" text-anchor="middle" class="lt">' + esc(s) + '</text></g>';
      });
      if (res.truncated) out += '<text x="6" y="14" class="lt dim">older history not shown</text>';
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.style.width = W + 'px';
      svg.innerHTML = out;
      svg.parentElement.scrollLeft = 1e5; // newest generation in view
      if (stats) stats.textContent = nodes.length + ' ancestors shown over ' + depths.length + ' generation' + (depths.length > 1 ? 's' : '') + '; ' + log.map.size + ' events in the log.';
    }
    svg.addEventListener('click', (e) => { const g = e.target.closest('.node'); if (g) { if (follow) follow.checked = false; select(+g.dataset.id, true); } });
    svg.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const g = e.target.closest('.node'); if (g) { e.preventDefault(); if (follow) follow.checked = false; select(+g.dataset.id, true); }
    });

    return A.loop.add({
      el: svg.parentElement, stepAlways: false,
      step(dt) {
        acc += dt;
        if (acc > 2.5 && !hold) { acc = 0; const before = sel; refreshStrip(); if (before !== sel) dirty = true; }
      },
      draw() {
        if (sel == null) refreshStrip();
        if (dirty && sel != null) { dirty = false; drawTree(); }
      },
    });
  };
})();
