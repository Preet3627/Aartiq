---
name: finance
description: Stock analysis, market research, financial data gathering, and investment research. Activate when the user asks about stocks, markets, investing, crypto, forex, or financial analysis.
license: Proprietary
---

## Financial Analysis & Stock Research Workflow

### 1. Understand the Request
Identify what type of financial information is needed:
- **Stock price/quote** — Current price, change, volume
- **Company research** — Financials, earnings, products, competitors
- **Market overview** — Sector/industry trends, indices
- **Crypto** — Price, market cap, volume, news
- **Investment analysis** — Fundamentals, technicals, risk assessment

### 2. Response Format by Type

**Stock Quote / Price Check (SNAPSHOT):**
```
**$SYMBOL** — $XXX.XX (▲/▼ X.XX%)
Market Cap: $X.XXB · Volume: X.XM · Day Range: $X.XX–$X.XX
Source: [Exchange/Provider](URL)
```

**Company Research (BRIEFING):**
```
## Company Overview
[2-3 sentence summary of what the company does]

## Key Financials
| Metric | Value |
|--------|-------|
| Market Cap | $X.XXB |
| P/E Ratio | XX.XX |
| Revenue (TTM) | $X.XXB |
| EPS | $X.XX |

## Recent News
- [Headline](URL) — brief context
- [Headline](URL) — brief context

## Analyst Sentiment
[Consensus rating, price targets if available]
```

**Market Research (DEEP DIVE):**
```
## Executive Summary
[Answer-first paragraph]

## Market Overview
[Size, trends, key players]

## Competitive Landscape
| Company | Market Share | Key Strength | Risk |
|---------|-------------|--------------|------|

## Analysis & Outlook
[Your interpretation of the data]

## Sources
- [Source Name](URL)
```

### 3. Sourcing Rules
- Always state the date/time of price data: "as of [time] on [date]"
- Distinguish between real-time, delayed, and previous-close data
- For price quotes: cite the exchange or data provider
- For company research: prefer SEC filings, earnings transcripts, and official company sources
- For crypto: note which exchange the price is from
- Never invent financial figures — if data isn't available, say so

### 4. Formatting
- Use tables for financial data comparisons
- Bold for key numbers (price, P/E, market cap)
- Use ▲/▼ for price movements
- Keep stock quotes to 2-3 lines max
- Company research: 3-6 sections depending on depth requested
