const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const { app } = require('electron');
const fetch = require('cross-fetch');

class RagService {
  constructor() {
    this.storePath = null;
    this.chunks = [];
    this.loaded = false;
  }

  async init() {
    if (this.loaded) return;
    const userDataPath = app.getPath('userData');
    this.storePath = path.join(userDataPath, 'rag-vectors.json');

    try {
      if (fs.existsSync(this.storePath)) {
        const raw = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
        this.chunks = raw || [];
      }
    } catch (e) {
      console.warn('[RAG] Failed to load store:', e.message);
      this.chunks = [];
    }
    this.loaded = true;
    console.log(`[RAG] Loaded ${this.chunks.length} chunks`);
  }

  _save() {
    if (!this.storePath) return;
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.chunks));
    } catch (e) {
      console.error('[RAG] Save failed:', e.message);
    }
  }

  async embed(text, apiKey) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return this._localEmbed(text);
    }

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: { parts: [{ text: text.slice(0, 5000) }] } }),
        }
      );

      if (!res.ok) {
        console.warn(`[RAG] Embedding API failed (${res.status}), using fallback.`);
        return this._localEmbed(text);
      }

      const data = await res.json();
      if (data.embedding?.values) {
        return data.embedding.values;
      }
      return this._localEmbed(text);
    } catch (e) {
      console.warn('[RAG] Embedding error:', e.message);
      return this._localEmbed(text);
    }
  }

  _localEmbed(text) {
    const words = text.toLowerCase().split(/\s+/);
    const dim = 128;
    const vec = new Array(dim).fill(0);
    for (let i = 0; i < words.length; i++) {
      let hash = 0;
      for (let j = 0; j < words[i].length; j++) {
        hash = ((hash << 5) - hash + words[i].charCodeAt(j)) | 0;
      }
      vec[Math.abs(hash) % dim] += 1;
    }
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map(v => v / mag);
  }

  _cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
  }

  _chunkText(text, size = 512) {
    const words = text.split(/\s+/);
    const chunks = [];
    for (let i = 0; i < words.length; i += size) {
      chunks.push(words.slice(i, i + size).join(' '));
    }
    return chunks;
  }

  async ingest(text, source, apiKey) {
    await this.init();
    const textChunks = this._chunkText(text);
    let added = 0;

    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      if (chunk.trim().length < 10) continue;

      const vector = await this.embed(chunk, apiKey);
      this.chunks.push({
        id: `${source}-${i}-${Date.now()}`,
        text: chunk,
        source,
        vector,
        created: Date.now(),
      });
      added++;
    }

    this._save();
    console.log(`[RAG] Ingested ${added} chunks from "${source}"`);
    return added;
  }

  async retrieve(query, k = 4, apiKey) {
    await this.init();
    if (this.chunks.length === 0) return [];

    const qVec = await this.embed(query, apiKey);
    const scored = this.chunks.map(c => ({
      ...c,
      score: this._cosineSimilarity(qVec, c.vector),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map(c => ({
      text: c.text,
      source: c.source,
      score: c.score,
    }));
  }

  async retrieveContext(query, k = 5, apiKey) {
    const results = await this.retrieve(query, k, apiKey);
    if (results.length === 0) return '';
    
    return results
      .map((r, i) => {
        const truncatedText = r.text.length > 800 ? r.text.slice(0, 800) + '...' : r.text;
        return `[SOURCE ${i + 1}: ${r.source} | MATCH: ${(r.score * 100).toFixed(1)}%]\n"""\n${truncatedText}\n"""`;
      })
      .join('\n\n');
  }

  getStats() {
    return {
      totalChunks: this.chunks.length,
      sources: [...new Set(this.chunks.map(c => c.source))],
      loaded: this.loaded,
    };
  }

  async deleteSource(source) {
    await this.init();
    const before = this.chunks.length;
    this.chunks = this.chunks.filter(c => c.source !== source);
    this._save();
    return before - this.chunks.length;
  }

  async clear() {
    this.chunks = [];
    this._save();
    return true;
  }
}

module.exports = { RagService };
