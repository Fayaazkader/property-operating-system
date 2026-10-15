import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { PDFDocument, degrees, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const output = ts.transpileModule(readFileSync('lib/execution/server/finalisation-pdf.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', output)(name => name === 'server-only' ? {} : require(name), module, module.exports);
const { assembleExecutedPdf } = module.exports;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
async function fixture(angle = 0) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([500, 700]);
  page.setCropBox(20, 30, 400, 600);
  page.setRotation(degrees(angle));
  const originalPdf = await pdf.save();
  const originalSha256 = hash(originalPdf);
  return { originalPdf, originalSha256, executionId: 'execution', documentVersionId: 'version',
    manifest: { executionId: 'execution', documentVersionId: 'version', originalSha256,
      fields: [{ id: 'signature', participantId: 'signer', type: 'signature', page: 1, x: .1, y: .2, width: .3, height: .1 }] },
    signers: [{ participantId: 'signer', name: 'Signer', email: null, signedAt: '2026-10-15T12:00:00Z',
      signatureBytes: png, signatureContentType: 'image/png', signatureSha256: hash(png) }] };
}
function operators(page) {
  const contents = page.node.Contents();
  return Array.from({ length: contents.size() }, (_, i) => {
    const stream = contents.lookup(i, PDFRawStream);
    return Buffer.from(decodePDFRawStream(stream).decode()).toString();
  }).join('\n');
}
for (const angle of [0, 90, 180, 270]) {
  test(`renders on original cropped page at rotation ${angle}`, async () => {
    const input = await fixture(angle);
    const result = await assembleExecutedPdf(input);
    const pdf = await PDFDocument.load(result.bytes);
    assert.equal(pdf.getPageCount(), 1);
    assert.equal(result.pageCount, 1);
    assert.equal(result.sha256, hash(result.bytes));
    const page = pdf.getPage(0);
    assert.deepEqual(page.getCropBox(), { x: 20, y: 30, width: 400, height: 600 });
    assert.equal(page.getRotation().angle, angle);
    const ops = operators(page);
    assert.match(ops, /\/Image-\d+ Do/);
    // Square image fits height and is centered horizontally in the designated box.
    const expected = { 0: [90, 450], 90: [140, 160], 180: [350, 210], 270: [300, 500] }[angle];
    const translation = /1 0 0 1 ([\d.e+-]+) ([\d.e+-]+) cm/.exec(ops);
    assert.ok(translation);
    assert.ok(Math.abs(Number(translation[1]) - expected[0]) < 1e-8);
    assert.ok(Math.abs(Number(translation[2]) - expected[1]) < 1e-8);
  });
}
for (const [name, mutate, error] of [
  ['source tampering', a => a.originalPdf[0] ^= 1, /checksum/],
  ['wrong document version', a => a.manifest.documentVersionId = 'other', /manifest/],
  ['wrong execution', a => a.manifest.executionId = 'other', /manifest/],
  ['wrong manifest checksum', a => a.manifest.originalSha256 = '0'.repeat(64), /manifest/],
  ['empty fields', a => a.manifest.fields = [], /manifest/],
  ['duplicate fields', a => a.manifest.fields.push({ ...a.manifest.fields[0] }), /placement/],
  ['unknown participant', a => a.manifest.fields[0].participantId = 'other', /participant/],
  ['out of page', a => a.manifest.fields[0].page = 2, /placement/],
  ['fractional page', a => a.manifest.fields[0].page = 1.5, /placement/],
  ['nonfinite coordinates', a => a.manifest.fields[0].x = NaN, /placement/],
  ['outside crop', a => a.manifest.fields[0].width = 1, /placement/],
  ['negative extent', a => a.manifest.fields[0].height = -1, /placement/],
  ['unsupported field', a => a.manifest.fields[0].type = 'stamp', /placement/],
  ['duplicate signer', a => a.signers.push({ ...a.signers[0] }), /duplicate/],
  ['signature tampering', a => a.signers[0].signatureSha256 = '0'.repeat(64), /checksum/],
  ['initials tampering', a => a.signers[0].initials = { bytes: png, contentType: 'image/png', sha256: '0'.repeat(64) }, /checksum/],
  ['invalid signing time', a => a.signers[0].signedAt = 'invalid', /metadata/],
  ['unsupported image', a => a.signers[0].signatureContentType = 'image/svg+xml', /image type/],
  ['missing initials', a => a.manifest.fields[0].type = 'initial', /initials/],
  ['no signature field', a => a.manifest.fields[0].type = 'date', /signature field/],
  ['unreadable date', a => { a.manifest.fields[0].type = 'date'; a.manifest.fields[0].height = .001; }, /too small/],
]) {
  test(`rejects ${name}`, async () => {
    const input = await fixture(); mutate(input);
    await assert.rejects(assembleExecutedPdf(input), error);
  });
}
test('renders separately captured initials and UTC date without extra pages', async () => {
  const input = await fixture();
  input.signers[0].initials = { bytes: png, contentType: 'image/png', sha256: hash(png) };
  input.manifest.fields.push({ ...input.manifest.fields[0], id: 'initial', type: 'initial', y: .4 },
    { ...input.manifest.fields[0], id: 'date', type: 'date', y: .6 });
  const result = await assembleExecutedPdf(input);
  const pdf = await PDFDocument.load(result.bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.equal((operators(pdf.getPage(0)).match(/Do/g) ?? []).length, 2);
  assert.match(operators(pdf.getPage(0)), /323032362d31302d3135/i);
});

// Independent renderer verifies displayed bounds, including crop origin and rotation.
// Requires Python + PyMuPDF; failure is explicit rather than a skipped geometry gate.
for (const angle of [0, 90, 180, 270]) {
  test(`independent raster verification at rotation ${angle}`, async () => {
    const input = await fixture(angle);
    const result = await assembleExecutedPdf(input);
    const directory = mkdtempSync(join(tmpdir(), 'assetflow-pdf-'));
    try {
      const path = join(directory, 'executed.pdf');
      writeFileSync(path, result.bytes);
      const rendered = spawnSync('python', ['-c', `
import fitz, json, sys
page = fitz.open(sys.argv[1])[0]
pix = page.get_pixmap(alpha=False)
points = [(x,y) for y in range(pix.height) for x in range(pix.width)
          if min(pix.pixel(x,y)) < 200]
assert points, 'No signature pixels rendered'
print(json.dumps(dict(width=pix.width, height=pix.height,
    bounds=[min(x for x,y in points), min(y for x,y in points),
            max(x for x,y in points)+1, max(y for x,y in points)+1])))
`, path], { encoding: 'utf8' });
      assert.equal(rendered.status, 0, rendered.stderr);
      const { width, height, bounds } = JSON.parse(rendered.stdout);
      const field = input.manifest.fields[0];
      const size = Math.min(field.width * width, field.height * height);
      const left = field.x * width + (field.width * width - size) / 2;
      const top = field.y * height + (field.height * height - size) / 2;
      [left, top, left + size, top + size].forEach((value, i) => {
        assert.ok(Math.abs(bounds[i] - value) <= 1, JSON.stringify({ bounds, left, top, size }));
      });
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
}
