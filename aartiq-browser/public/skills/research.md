---
name: research
description: Use this skill for deep research, news gathering, fact-checking, and any task requiring web search. Activate when the user asks about current events, prices, scores, or requests a research report.
license: Proprietary
---

## Research Workflow

### Deep Research (Recommended for complex queries)
Use the DEEP_RESEARCH command for comprehensive, multi-source research with iterative search, source ranking, and coverage analysis.

```json
{"type": "DEEP_RESEARCH", "query": "<topic>", "engine": "duckduckgo", "maxResults": 12}
```

The pipeline automatically:
- Decomposes the query into subtopics
- Searches iteratively until coverage threshold is met
- Ranks sources by domain authority + content quality
- Extracts articles with multi-strategy fallback
- Detects contradictions across sources
- Generates a structured report with executive summary, key takeaways, and charts data

### Quick Research (For simpler queries)
For quick fact-finding or when you need specific pages:

**Step 1:** [WEB_SEARCH: <topic+today>] — returns titles, URLs, and brief snippets. System auto-reads the top result.
**Step 2:** [NAVIGATE: <url>] for the NEXT 2–3 best URLs from those results.
**Step 3:** [READ_PAGE_CONTENT] on EACH source to extract full article details.
**Step 4:** Synthesize all full-page content and answer.
**Step 5:** When generating a document, automatically include a "## Sources" section at the end listing every URL you visited and used.

### When to use DEEP_RESEARCH vs WEB_SEARCH
- **Use DEEP_RESEARCH** when: user asks for "research", "analyze", "report", "comprehensive", "deep dive", "what's happening with", "latest news about", or any multi-faceted topic
- **Use WEB_SEARCH** when: user asks a simple factual question, wants a quick answer, or needs a specific piece of information

### Regeneration / Refinement Exception
Skip re-searching if you are regenerating due to an error, changing the template, or making minor edits and you already have the verified primary source data in your history. DO NOT re-search for identical data.

### Website Data
**Step 1:** [NAVIGATE: https://example.com]
**Step 2:** [READ_PAGE_CONTENT]
**Step 3:** Write answer from the content returned

### Context Memory
- Recent web searches are cached (5 min TTL)
- Recent page content is stored
- Recent OCR/screenshots are available
- Before searching, check if you already have the data
- If asked to "add detail", "change template", or "fix parsing error" — use data already in your history
- Only re-search if the user asks for "new" or "fresher" information

### Anti-Hallucination
- NEVER write news headlines, tech updates, prices, scores from memory
- NEVER invent source URLs (e.g. "techcrunch.com/2026/03/05/openai-launches-gpt-5-4")
- NEVER generate a PDF with fake data before searching
- NEVER answer "what happened today" without searching first
- NEVER make up model names, specs, or release dates
- ALWAYS emit [DEEP_RESEARCH: query] or [WEB_SEARCH: query] BEFORE any prose for factual/current queries
- After [NAVIGATE: url], ALWAYS follow with [READ_PAGE_CONTENT] to get actual full-page data
- Cite the real URL from search results when presenting information
