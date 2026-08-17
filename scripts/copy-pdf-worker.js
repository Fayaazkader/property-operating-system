const fs = require('fs');
const path = require('path');

const workerSrc = path.join(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.min.js');
const targetDir = path.join(process.cwd(), '.next/dev/server/chunks');

if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

const targetFile = path.join(targetDir, 'pdf.worker.mjs');
fs.copyFileSync(workerSrc, targetFile);
console.log('✅ pdf.worker.mjs copied to', targetFile);
