# NLP File Search — Electron App

Fully offline NLP-powered file searcher. Select any folder, enter a keyword or phrase, and the app scans every supported file using natural language processing.

## Supported File Types

| Type | Extensions |
|------|-----------|
| Text / Code | `.txt`, `.md`, `.js`, `.ts`, `.py`, `.java`, `.c`, `.cpp`, `.html`, `.css`, `.json`, `.xml`, `.csv`, `.log`, `.sh`, `.yaml`, `.yml`, `.ini`, `.cfg`, `.toml`, `.rs`, `.go`, `.rb`, `.php` |
| Word Docs | `.docx` |
| PDFs | `.pdf` |
| Spreadsheets | `.xlsx` |

## NLP Matching Strategy

Files are matched using a layered approach (all offline, no API calls):

1. **Direct substring match** — case-insensitive literal search
2. **Stem matching** — Porter Stemmer via `natural` library (run/running/ran all match)
3. **Sliding window proximity** — query terms near each other in content (75%+ match)
4. **Jaro-Winkler similarity** — fuzzy matching for short queries (typo tolerance)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Run the app
npm start
```

## Requirements

- Node.js 16+
- npm

## Project Structure

```
nlp-search-app/
├── package.json
└── src/
    ├── main.js       # Electron main process (file I/O, NLP)
    ├── preload.js    # Context bridge
    ├── index.html    # UI
    └── renderer.js   # UI logic
```
