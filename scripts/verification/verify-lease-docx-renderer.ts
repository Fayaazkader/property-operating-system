import { createHash } from 'crypto';
import PizZip from 'pizzip';

import { renderLeaseDocx } from '../../lib/lease/generation/docx-renderer';
import { buildLeaseRenderPlan } from '../../lib/lease/generation/renderer';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function createDocx(documentXml: string): Uint8Array {
  const zip = new PizZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );

  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`,
  );

  zip.folder('word')?.file(
    'document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${documentXml}
    <w:sectPr/>
  </w:body>
</w:document>`,
  );

  return new Uint8Array(
    zip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    }),
  );
}

function source(bytes: Uint8Array) {
  return {
    documentId: 'document-1',
    fileName: 'lease-template.docx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    format: 'docx' as const,
    storageBucket: 'documents',
    storageKey: 'templates/lease-template.docx',
    checksum: createHash('sha256').update(bytes).digest('hex'),
    bytes,
  };
}

function manifest(token = '{{tenant_name}}', fieldKey = 'tenant_name') {
  return {
    values: {
      tenant_name: 'Acme Retail (Pty) Ltd',
    },
    mappings: [
      {
        id: 'mapping-tenant-1',
        fieldKey,
        label: 'Tenant Name',
        type: 'text',
        required: true,
        target: {
          kind: 'placeholder',
          targetId: 'placeholder-tenant-1',
          token,
          startOffset: 0,
          endOffset: token.length,
        },
        status: 'confirmed',
        confidence: {
          detection: 100,
          mapping: 100,
        },
        evidence: [],
        source: 'ai',
        approved: true,
        approvedBy: 'user-1',
        approvedAt: new Date().toISOString(),
      },
    ],
    provenance: {
      entityId: 'entity-1',
      opportunityId: 'opportunity-1',
      commercialVersionId: 'version-1',
      commercialVersionNumber: 1,
      templateId: 'template-1',
      templateVersion: 1,
      sourceTemplateDocumentId: 'document-1',
      sourceTemplateChecksum: 'source-checksum',
    },
    validation: {
      valid: true,
      errors: [],
      warnings: [],
    },
  } as any;
}

/*
 * 1. Normal placeholder.
 */
{
  const bytes = createDocx(
    '<w:p><w:r><w:t>{{tenant_name}}</w:t></w:r></w:p>',
  );

  const src = source(bytes);
  const plan = buildLeaseRenderPlan(manifest(), src);
  const rendered = renderLeaseDocx(src, plan);

  assert(rendered.bytes.length > 0, 'normal render produced no bytes');
  assert(rendered.fields.length === 1, 'normal render evidence missing');
  assert(
    rendered.fields[0].renderedValue === 'Acme Retail (Pty) Ltd',
    'normal render evidence contains wrong value',
  );
  assert(
    rendered.checksum ===
      createHash('sha256').update(rendered.bytes).digest('hex'),
    'rendered SHA-256 does not match output bytes',
  );

  const output = new PizZip(rendered.bytes);
  const xml = output.file('word/document.xml')?.asText() ?? '';

  assert(
    xml.includes('Acme Retail (Pty) Ltd'),
    'rendered value is absent from DOCX XML',
  );
  assert(
    !xml.includes('{{tenant_name}}'),
    'placeholder remains after rendering',
  );

  console.log('PASS normal placeholder');
}

/*
 * 2. Word split-run placeholder.
 *
 * This is critical. Word frequently splits visible text across runs.
 */
{
  const bytes = createDocx(
    '<w:p>' +
      '<w:r><w:t>{{tenant_</w:t></w:r>' +
      '<w:r><w:t>name}}</w:t></w:r>' +
    '</w:p>',
  );

  const src = source(bytes);
  const plan = buildLeaseRenderPlan(manifest(), src);
  const rendered = renderLeaseDocx(src, plan);

  const output = new PizZip(rendered.bytes);
  const xml = output.file('word/document.xml')?.asText() ?? '';

  assert(
    xml.includes('Acme Retail (Pty) Ltd'),
    'split-run placeholder was not rendered',
  );

  console.log('PASS split-run placeholder');
}

/*
 * 3. Mapping/token contradiction must fail.
 */
{
  const bytes = createDocx(
    '<w:p><w:r><w:t>{{tenant_name}}</w:t></w:r></w:p>',
  );

  const src = source(bytes);
  const badManifest = manifest('{{tenant_name}}', 'landlord_name');

  let failed = false;

  try {
    const plan = buildLeaseRenderPlan(badManifest, src);
    renderLeaseDocx(src, plan);
  } catch {
    failed = true;
  }

  assert(failed, 'contradictory mapping did not fail');

  console.log('PASS contradictory mapping rejected');
}

/*
 * 4. Unsupported placeholder convention must fail.
 */
{
  const bytes = createDocx(
    '<w:p><w:r><w:t>[[tenant_name]]</w:t></w:r></w:p>',
  );

  const src = source(bytes);
  const badManifest = manifest('[[tenant_name]]');

  let failed = false;

  try {
    const plan = buildLeaseRenderPlan(badManifest, src);
    renderLeaseDocx(src, plan);
  } catch {
    failed = true;
  }

  assert(failed, 'unsupported placeholder convention did not fail');

  console.log('PASS unsupported placeholder rejected');
}


/*
 * 5. Repeated occurrences of the same approved canonical field.
 *
 * Legal agreements routinely repeat party/property/commercial values.
 * All occurrences must render consistently.
 */
{
  const bytes = createDocx(
    '<w:p><w:r><w:t>{{tenant_name}}</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>Tenant: {{tenant_name}}</w:t></w:r></w:p>' +
    '<w:p>' +
      '<w:r><w:t>{{tenant_</w:t></w:r>' +
      '<w:r><w:t>name}}</w:t></w:r>' +
    '</w:p>',
  );

  const src = source(bytes);

  const repeatedManifest = manifest();

  repeatedManifest.mappings = [
    repeatedManifest.mappings[0],
    {
      ...repeatedManifest.mappings[0],
      id: 'mapping-tenant-2',
      target: {
        ...repeatedManifest.mappings[0].target,
        targetId: 'placeholder-tenant-2',
        startOffset: 100,
        endOffset: 115,
      },
    },
    {
      ...repeatedManifest.mappings[0],
      id: 'mapping-tenant-3',
      target: {
        ...repeatedManifest.mappings[0].target,
        targetId: 'placeholder-tenant-3',
        startOffset: 200,
        endOffset: 215,
      },
    },
  ];

  const plan = buildLeaseRenderPlan(repeatedManifest, src);
  const rendered = renderLeaseDocx(src, plan);

  assert(
    rendered.fields.length === 3,
    'repeated mappings did not preserve three evidence records',
  );

  const output = new PizZip(rendered.bytes);
  const xml = output.file('word/document.xml')?.asText() ?? '';

  const occurrences =
    xml.match(/Acme Retail \(Pty\) Ltd/g)?.length ?? 0;

  assert(
    occurrences === 3,
    `expected 3 rendered tenant occurrences, found ${occurrences}`,
  );

  assert(
    !xml.includes('{{tenant_name}}'),
    'approved repeated placeholder remains after rendering',
  );

  console.log('PASS repeated placeholder occurrences');
}


/*
 * 6. Approved optional field with no value renders as an intentional blank.
 *
 * A missing optional commercial value must never leave a raw contractual
 * placeholder in the generated agreement.
 */
{
  const bytes = createDocx(
    '<w:p><w:r><w:t>Lease fee: {{lease_fee}}</w:t></w:r></w:p>',
  );

  const src = source(bytes);
  const optionalManifest = manifest();

  optionalManifest.values = {
    ...optionalManifest.values,
    lease_fee: null,
  };

  optionalManifest.mappings = [
    {
      ...optionalManifest.mappings[0],
      id: 'mapping-lease-fee',
      fieldKey: 'lease_fee',
      required: false,
      target: {
        ...optionalManifest.mappings[0].target,
        targetId: 'placeholder-lease-fee',
        token: '{{lease_fee}}',
      },
    },
  ];

  const plan = buildLeaseRenderPlan(optionalManifest, src);

  assert(
    plan.entries.length === 1,
    'optional null mapping was omitted from render plan',
  );

  assert(
    plan.entries[0].value === null,
    'optional missing value was not normalised to null',
  );

  const rendered = renderLeaseDocx(src, plan);

  assert(
    rendered.fields.length === 1,
    'optional blank render evidence was not preserved',
  );

  assert(
    rendered.fields[0].renderedValue === '',
    'optional null value did not render as blank',
  );

  const output = new PizZip(rendered.bytes);
  const xml = output.file('word/document.xml')?.asText() ?? '';

  assert(
    !xml.includes('{{lease_fee}}'),
    'optional placeholder remains after rendering',
  );

  console.log('PASS optional null placeholder rendered blank');
}

console.log('ALL DOCX RENDERER CHECKS PASSED');
