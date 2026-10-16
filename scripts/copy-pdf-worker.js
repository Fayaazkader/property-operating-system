const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const destination = path.join(root, 'public', 'pdf-workers');

const workers = [
  {
    name: 'execution',
    packagePath: 'pdfjs-dist',
    expectedVersion: '6.4.299',
    filename: 'execution.worker.min.mjs',
  },
  {
    name: 'react-pdf',
    packagePath: 'react-pdf/node_modules/pdfjs-dist',
    expectedVersion: '5.4.296',
    filename: 'react-pdf.worker.min.mjs',
  },
];

fs.mkdirSync(destination, { recursive: true });

for (const worker of workers) {
  const packageRoot = path.join(root, 'node_modules', worker.packagePath);
  const metadata = JSON.parse(
    fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
  );

  if (metadata.version !== worker.expectedVersion) {
    throw new Error(
      `${worker.name}: expected PDF.js ${worker.expectedVersion}, found ${metadata.version}`
    );
  }

  const source = path.join(packageRoot, 'build', 'pdf.worker.min.mjs');
  const target = path.join(destination, worker.filename);

  fs.copyFileSync(source, target);

  console.log(
    `${worker.name}: PDF.js ${metadata.version} -> public/pdf-workers/${worker.filename}`
  );
}
