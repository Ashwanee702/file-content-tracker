const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 950,
    height: 700,
    minWidth: 750,
    minHeight: 550,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0f13',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Select folder dialog
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// Get all files in folder (recursively optional)
ipcMain.handle('get-files', async (event, folderPath) => {
  const supportedExts = ['.txt', '.md', '.js', '.ts', '.py', '.java', '.c', '.cpp',
    '.html', '.css', '.json', '.xml', '.csv', '.docx', '.pdf', '.xlsx', '.log',
    '.sh', '.yaml', '.yml', '.ini', '.cfg', '.toml', '.rs', '.go', '.rb', '.php'];

  function walk(dir) {
    let results = [];
    try {
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const filePath = path.join(dir, file);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            results = results.concat(walk(filePath));
          } else {
            const ext = path.extname(file).toLowerCase();
            if (supportedExts.includes(ext)) {
              results.push(filePath);
            }
          }
        } catch (e) { /* skip inaccessible */ }
      }
    } catch (e) { /* skip inaccessible dirs */ }
    return results;
  }

  return walk(folderPath);
});

// Read file content
ipcMain.handle('read-file', async (event, filePath) => {
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return { text: result.value, error: null };
    }

    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return { text: data.text, error: null };
    }

    if (ext === '.xlsx') {
      const XLSX = require('xlsx');
      const wb = XLSX.readFile(filePath);
      let text = '';
      wb.SheetNames.forEach(name => {
        const ws = wb.Sheets[name];
        text += XLSX.utils.sheet_to_csv(ws) + '\n';
      });
      return { text, error: null };
    }

    // Plain text / code / markup etc.
    return { text: fs.readFileSync(filePath, 'utf8'), error: null };
  } catch (e) {
    console.error(`[read-file] Failed on ${filePath}:`, e.message);
    return { text: null, error: e.message }; // unreadable file, but error is now visible
  }
});

// NLP search
ipcMain.handle('nlp-search', async (event, { content, query }) => {
  if (!content || !query) return false;

  const natural = require('natural');
  const tokenizer = new natural.WordTokenizer();
  const stemmer = natural.PorterStemmer;

  const normalize = (text) =>
    tokenizer.tokenize(text.toLowerCase()).map(w => stemmer.stem(w));

  const contentTokens = normalize(content);
  const queryTokens = normalize(query);

  if (queryTokens.length === 0) return false;

  // Check 1: Direct substring match (case-insensitive)
  if (content.toLowerCase().includes(query.toLowerCase())) return true;

  // Check 2: All query stems present in content
  const contentSet = new Set(contentTokens);
  const allStemsPresent = queryTokens.every(qt => contentSet.has(qt));
  if (allStemsPresent) return true;

  // Check 3: TF-IDF similarity with a sliding window
  const windowSize = Math.max(queryTokens.length * 3, 20);
  let matchCount = 0;
  for (let i = 0; i <= contentTokens.length - queryTokens.length; i++) {
    const window = contentTokens.slice(i, i + windowSize);
    const windowSet = new Set(window);
    const matches = queryTokens.filter(qt => windowSet.has(qt)).length;
    if (matches / queryTokens.length >= 0.75) {
      matchCount++;
      if (matchCount >= 1) return true;
    }
  }

  // Check 4: Jaro-Winkler on short queries (typo tolerance)
  if (query.split(/\s+/).length <= 3) {
    for (let i = 0; i <= contentTokens.length - queryTokens.length; i++) {
      const chunk = contentTokens.slice(i, i + queryTokens.length).join(' ');
      const score = natural.JaroWinklerDistance(
        stemmer.stem(query.toLowerCase()),
        chunk,
        {}
      );
      if (score >= 0.88) return true;
    }
  }

  return false;
});

// ── Open file in OS default application ─────────────────────────────────────
ipcMain.handle('open-in-system', async (event, filePath) => {
  const result = await shell.openPath(filePath);
  if (result) return { ok: false, error: result };
  return { ok: true };
});

// ── Reveal file in file explorer/finder ──────────────────────────────────────
ipcMain.handle('reveal-in-folder', async (event, filePath) => {
  shell.showItemInFolder(filePath);
  return { ok: true };
});
