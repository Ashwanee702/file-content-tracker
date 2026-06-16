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

const resultsBadge   = document.getElementById('resultsBadge');
const resultsBody    = document.getElementById('resultsBody');
const emptyState     = document.getElementById('emptyState');
const fileCountStatus = document.getElementById('fileCountStatus');
const nlpDot         = document.getElementById('nlpDot');
const nlpStatus      = document.getElementById('nlpStatus');

let selectedFolder = null;
let isCancelled = false;
let matchCount = 0;

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

  // Reset state
  isCancelled = false;
  matchCount = 0;
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
    const content = await window.api.readFile(filePath);

    if (content) {
      // NLP search
      const matched = await window.api.nlpSearch(content, query);
      if (matched) {
        appendResult(filePath, fileName);
        matchCount++;
      }
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
  } else {
    progressLabel.textContent = `Done — ${matchCount} match${matchCount !== 1 ? 'es' : ''} found`;
    progressBar.style.width = '100%';
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
function appendResult(filePath, fileName) {
  emptyState.style.display = 'none';

  const ext = fileName.split('.').pop().toLowerCase();

  const item = document.createElement('div');
  item.className = 'result-item';
  item.title = filePath;
  item.innerHTML = `
    <div class="result-dot"></div>
    <span class="result-name">${fileName}</span>
    <span class="result-ext">.${ext}</span>
  `;
  resultsBody.appendChild(item);
}

function resetResults() {
  resultsBody.innerHTML = '';
  emptyState.style.display = 'none';
  const es = document.createElement('div');
  es.id = 'emptyState';
  es.className = 'empty-state';
  es.innerHTML = '<div class="empty-icon">⏳</div><div class="empty-text">Searching…</div>';
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
}
