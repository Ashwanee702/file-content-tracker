/* renderer.js – runs in the browser context via contextBridge */

const folderPicker   = document.getElementById('folderPicker');
const folderPathDisplay = document.getElementById('folderPathDisplay');
const queryInput     = document.getElementById('queryInput');
const searchBtn      = document.getElementById('searchBtn');
const stopBtn        = document.getElementById('stopBtn');

const progressLabel  = document.getElementById('progressLabel');
const progressCount  = document.getElementById('progressCount');
const progressBar    = document.getElementById('progressBar');
const progressFile   = document.getElementById('progressFile');
const skippedLink    = document.getElementById('skippedLink');

const resultsBadge   = document.getElementById('resultsBadge');
const resultsBody    = document.getElementById('resultsBody');
const emptyState     = document.getElementById('emptyState');
const fileCountStatus = document.getElementById('fileCountStatus');
const nlpDot         = document.getElementById('nlpDot');
const nlpStatus      = document.getElementById('nlpStatus');

let selectedFolder = null;
let isCancelled = false;
let matchCount = 0;
let failedFiles = [];

// ── Folder picker ────────────────────────────────────────────────────────────
folderPicker.addEventListener('click', async () => {
  const folder = await window.api.selectFolder();
  if (!folder) return;
  selectedFolder = folder;
  folderPathDisplay.textContent = folder;
  folderPathDisplay.classList.remove('placeholder');
  updateSearchBtn();
  resetUI();

  // Count files
  fileCountStatus.textContent = 'Counting files…';
  const files = await window.api.getFiles(folder);
  fileCountStatus.textContent = `${files.length} supported file${files.length !== 1 ? 's' : ''} found`;
});

// ── Input gating ─────────────────────────────────────────────────────────────
queryInput.addEventListener('input', updateSearchBtn);

function updateSearchBtn() {
  const ready = selectedFolder && queryInput.value.trim().length > 0;
  searchBtn.disabled = !ready;
}

// ── Search ───────────────────────────────────────────────────────────────────
searchBtn.addEventListener('click', startSearch);
queryInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !searchBtn.disabled) startSearch();
});

stopBtn.addEventListener('click', () => {
  isCancelled = true;
  stopBtn.disabled = true;
  progressLabel.textContent = 'Stopping…';
});

async function startSearch() {
  if (!selectedFolder) return;
  const query = queryInput.value.trim();
  if (!query) return;
  lastQuery = query;

  // Reset state
  isCancelled = false;
  matchCount = 0;
  failedFiles = [];
  skippedLink.style.display = 'none';
  skippedLink.innerHTML = '';
  const oldDetail = document.getElementById('skippedDetail');
  if (oldDetail) oldDetail.remove();
  resetResults();

  // UI: searching mode
  searchBtn.disabled = true;
  stopBtn.disabled = false;
  nlpDot.className = 'status-dot yellow';
  nlpStatus.textContent = 'Processing…';

  // Get file list
  progressLabel.textContent = 'Scanning folder…';
  progressBar.style.width = '0%';
  const files = await window.api.getFiles(selectedFolder);
  const total = files.length;

  if (total === 0) {
    progressLabel.textContent = 'No supported files found';
    finishSearch();
    return;
  }

  progressLabel.textContent = `Searching ${total} files…`;
  fileCountStatus.textContent = `${total} file${total !== 1 ? 's' : ''}`;

  for (let i = 0; i < total; i++) {
    if (isCancelled) break;

    const filePath = files[i];
    const fileName = filePath.split(/[\\/]/).pop();
    progressFile.textContent = filePath;

    // Read file
    const result = await window.api.readFile(filePath);

    if (result && result.text) {
      // NLP search
      const matched = await window.api.nlpSearch(result.text, query);
      if (matched) {
        appendResult(filePath, fileName);
        matchCount++;
      }
    } else if (result && result.error) {
      failedFiles.push({ filePath, fileName, error: result.error });
    }

    // Update progress
    const pct = Math.round(((i + 1) / total) * 100);
    progressBar.style.width = pct + '%';
    progressCount.textContent = `${i + 1} / ${total}`;
    resultsBadge.textContent = `${matchCount} found`;
  }

  finishSearch();
}

function finishSearch() {
  stopBtn.disabled = true;
  searchBtn.disabled = false;
  updateSearchBtn();

  const cancelled = isCancelled;
  isCancelled = false;

  progressFile.textContent = '';
  progressCount.textContent = '';

  if (cancelled) {
    progressLabel.textContent = `Stopped — ${matchCount} match${matchCount !== 1 ? 'es' : ''} found so far`;
    progressBar.style.width = '0%';
  } else if (failedFiles.length > 0) {
    progressLabel.textContent = `Done — ${matchCount} match${matchCount !== 1 ? 'es' : ''} found, ${failedFiles.length} file${failedFiles.length !== 1 ? 's' : ''} skipped (unreadable)`;
    progressBar.style.width = '100%';
    console.warn('Files skipped due to read errors:', failedFiles);
    showSkippedLink();
  } else {
    progressLabel.textContent = `Done — ${matchCount} match${matchCount !== 1 ? 'es' : ''} found`;
    progressBar.style.width = '100%';
    skippedLink.style.display = 'none';
  }

  resultsBadge.textContent = `${matchCount} found`;
  nlpDot.className = 'status-dot green';
  nlpStatus.textContent = 'NLP Ready';

  if (matchCount === 0) {
    emptyState.innerHTML = '<div class="empty-icon">🔍</div><div class="empty-text">No matching files found</div>';
    emptyState.style.display = 'flex';
  }
}

// ── Result rendering ──────────────────────────────────────────────────────────
let lastQuery = '';

function appendResult(filePath, fileName) {
  emptyState.style.display = 'none';

  const ext = fileName.split('.').pop().toLowerCase();

  const item = document.createElement('div');
  item.className = 'result-item';
  item.title = `Click to open in default app\n${filePath}`;
  item.innerHTML = `
    <div class="result-dot"></div>
    <span class="result-name">${fileName}</span>
    <span class="result-ext">.${ext}</span>
    <span class="result-open-hint">Open ↗</span>
  `;
  item.addEventListener('click', () => {
    window.api.openInSystem(filePath);
  });
  resultsBody.prepend(item);
}

function resetResults() {
  resultsBody.innerHTML = '';
  emptyState.style.display = 'none';
  const es = document.createElement('div');
  es.id = 'emptyState';
  es.className = 'empty-state';
  es.innerHTML = '<div class="empty-icon">⏳</div><div class="empty-text">Scan Complete</div>';
  resultsBody.appendChild(es);
  resultsBadge.textContent = '0 found';
}

function resetUI() {
  resultsBody.innerHTML = '';
  const es = document.createElement('div');
  es.className = 'empty-state';
  es.innerHTML = '<div class="empty-icon">📂</div><div class="empty-text">Select a folder and enter a search phrase</div>';
  resultsBody.appendChild(es);
  progressBar.style.width = '0%';
  progressLabel.textContent = 'Ready';
  progressCount.textContent = '';
  progressFile.textContent = '';
  resultsBadge.textContent = '0 found';
  matchCount = 0;
  skippedLink.style.display = 'none';
  skippedLink.innerHTML = '';
}

function showSkippedLink() {
  skippedLink.style.display = 'block';
  skippedLink.textContent = `⚠ ${failedFiles.length} file${failedFiles.length !== 1 ? 's' : ''} could not be read — click for details`;
  skippedLink.onclick = () => {
    const existing = document.getElementById('skippedDetail');
    if (existing) { existing.remove(); return; }

    const detail = document.createElement('div');
    detail.className = 'skipped-detail';
    detail.id = 'skippedDetail';
    detail.innerHTML = failedFiles.map(f =>
      `<div class="skipped-detail-row"><span class="fname">${f.fileName}</span> — <span class="ferr">${escapeHtml(f.error)}</span></div>`
    ).join('');
    skippedLink.insertAdjacentElement('afterend', detail);
  };
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
