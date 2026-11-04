/*
 * chem.js - the DOM-free rules of the soup.
 *
 * Everything here is a pure function of its arguments plus an injected random
 * number source `rng` (a function returning [0,1)), so it runs the same in the
 * browser and under Node (see tests/chem.test.js). The rules mirror the Rust
 * app (src/model.rs): 20 amino acids by letter code, chains of 1 to 50,
 * mutation by substitution / insertion / deletion, recombination by crossover
 * at random cut points, and a watch for the sequence METHINKS.
 *
 * Loaded as a classic script (so the page also works from file://). In the
 * browser it publishes window.Abio.chem; under Node it is module.exports.
 */
(function (root) {
  'use strict';

  const AMINO = 'ARNDCQEGHILKMFPSTWYV'; // same order as the Rust AMINO_ACIDS
  const TARGET = 'METHINKS';
  const MIN_LEN = 1;
  const MAX_LEN = 50;

  /* Rough chemistry classes, used only for colour. Hydrophobic residues glow
   * cyan/green, polar ones gold, basic ones magenta, acidic ones coral. */
  const CLASS = {};
  'AVILMFWPGC'.split('').forEach((c) => (CLASS[c] = 'hydrophobic'));
  'STNQY'.split('').forEach((c) => (CLASS[c] = 'polar'));
  'KRH'.split('').forEach((c) => (CLASS[c] = 'basic'));
  'DE'.split('').forEach((c) => (CLASS[c] = 'acidic'));

  const pick = (rng, n) => Math.floor(rng() * n);
  const randomAA = (rng) => AMINO[pick(rng, AMINO.length)];
  const randomSeq = (rng, len) => {
    let s = '';
    for (let i = 0; i < len; i++) s += randomAA(rng);
    return s;
  };

  /* Each mutation returns { seq, mut } or null when it would change nothing
   * (like the Rust app: "nothing happened" is never logged as a mutation). */
  function substitute(seq, rng) {
    if (!seq.length) return null;
    const index = pick(rng, seq.length);
    const from = seq[index];
    const to = randomAA(rng);
    return { seq: seq.slice(0, index) + to + seq.slice(index + 1), mut: { type: 'sub', index, from, to } };
  }
  function insert(seq, rng) {
    if (seq.length >= MAX_LEN) return null;
    const index = pick(rng, seq.length + 1);
    const residue = randomAA(rng);
    return { seq: seq.slice(0, index) + residue + seq.slice(index), mut: { type: 'ins', index, residue } };
  }
  function remove(seq, rng) {
    if (seq.length <= MIN_LEN) return null;
    const index = pick(rng, seq.length);
    return { seq: seq.slice(0, index) + seq.slice(index + 1), mut: { type: 'del', index, residue: seq[index] } };
  }
  /* One of the three at random; may be null (e.g. deleting from one residue). */
  function mutate(seq, rng) {
    const k = pick(rng, 3);
    return (k === 0 ? substitute : k === 1 ? insert : remove)(seq, rng);
  }

  /* Recombination: head of `a` joined to tail of `b`, cut points chosen at
   * random in each parent. Length is clamped to MAX_LEN. */
  function crossover(a, b, rng) {
    if (!a.length || !b.length) return null;
    const p1 = pick(rng, a.length);
    const p2 = pick(rng, b.length);
    const seq = (a.slice(0, p1) + b.slice(p2)).slice(0, MAX_LEN);
    return seq.length ? { seq, cut: [p1, p2] } : null;
  }

  /* Degradation: the chain breaks at a random point, the head survives. */
  function degrade(seq, rng) {
    if (seq.length <= 1) return null;
    const at = 1 + pick(rng, seq.length - 1);
    return { seq: seq.slice(0, at), shed: seq.slice(at) };
  }

  const containsTarget = (seq) => seq.indexOf(TARGET) !== -1;

  /* Longest stretch of TARGET found inside seq (0..8): a progress meter for
   * the METHINKS watch, since the full word almost never appears by chance. */
  function longestMatch(seq, target) {
    target = target || TARGET;
    let best = 0;
    for (let i = 0; i < target.length; i++) {
      for (let len = best + 1; i + len <= target.length; len++) {
        if (seq.indexOf(target.substr(i, len)) !== -1) best = len;
        else break;
      }
    }
    return best;
  }

  /* Shannon entropy (bits) of residue usage across a list of sequences.
   * Max is log2(20) ~ 4.32. Returns 0 for no residues. */
  function residueEntropy(seqs) {
    const counts = {};
    let total = 0;
    for (const s of seqs) for (const c of s) { counts[c] = (counts[c] || 0) + 1; total++; }
    if (!total) return 0;
    let h = 0;
    for (const k in counts) { const p = counts[k] / total; h -= p * Math.log2(p); }
    return h;
  }

  /*
   * EventLog: every chain has an id; every mutation and recombination is
   * recorded with its parents. Entries are { id, type, parents[], seq, t,
   * depth, mut?, cut? } keyed by id. `depth` is the generation number.
   * The log is capped (oldest forgotten) so a long session cannot leak.
   */
  class EventLog {
    constructor(cap) { this.cap = cap || 6000; this.map = new Map(); this.nextId = 1; }
    newId() { return this.nextId++; }
    record(entry) {
      const parents = entry.parents || [];
      let depth = 0;
      for (const p of parents) { const e = this.map.get(p); if (e) depth = Math.max(depth, e.depth + 1); }
      entry.depth = depth;
      entry.parents = parents;
      this.map.set(entry.id, entry);
      if (this.map.size > this.cap) this.map.delete(this.map.keys().next().value);
      return entry;
    }
    get(id) { return this.map.get(id); }
    /* Ancestors of `id` (including itself), breadth-first, at most `limit`
     * generations back and `maxNodes` entries. Returns { nodes, truncated }. */
    ancestors(id, limit, maxNodes) {
      limit = limit == null ? 8 : limit;
      maxNodes = maxNodes || 40;
      const nodes = [];
      const seen = new Set();
      let layer = [id];
      let truncated = false;
      for (let g = 0; layer.length && g <= limit; g++) {
        const next = [];
        for (const nid of layer) {
          if (seen.has(nid)) continue;
          const e = this.map.get(nid);
          if (!e) continue;
          if (nodes.length >= maxNodes) { truncated = true; continue; }
          seen.add(nid);
          nodes.push(e);
          for (const p of e.parents) next.push(p);
        }
        layer = next;
        if (g === limit && layer.some((p) => this.map.has(p) && !seen.has(p))) truncated = true;
      }
      return { nodes, truncated };
    }
  }

  const api = { AMINO, TARGET, MIN_LEN, MAX_LEN, CLASS, randomAA, randomSeq, substitute, insert, remove, mutate,
    crossover, degrade, containsTarget, longestMatch, residueEntropy, EventLog };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Abio = root.Abio || {}; root.Abio.chem = api; }
})(typeof window !== 'undefined' ? window : globalThis);
