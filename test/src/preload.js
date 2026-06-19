const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getFiles: (folderPath) => ipcRenderer.invoke('get-files', folderPath),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  nlpSearch: (content, query) => ipcRenderer.invoke('nlp-search', { content, query }),
  openInSystem: (filePath) => ipcRenderer.invoke('open-in-system', filePath)
});
