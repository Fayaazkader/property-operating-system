import assert from 'node:assert/strict';

import {
  generateLeaseDocument,
  LeaseGenerationError,
  type LeaseGenerationDependencies,
} from '../../lib/lease/generation/generate';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const ids = {
  actor: '11111111-1111-4111-8111-111111111111',
  entity: '22222222-2222-4222-8222-222222222222',
  opportunity: '33333333-3333-4333-8333-333333333333',
  commercialVersion: '44444444-4444-4444-8444-444444444444',
  template: '55555555-5555-4555-8555-555555555555',
  sourceDocument: '66666666-6666-4666-8666-666666666666',
  canonicalDocument: '77777777-7777-4777-8777-777777777777',
};

const input = {
  entityId: ids.entity,
  opportunityId: ids.opportunity,
  templateId: ids.template,
  actorId: ids.actor,
};

const manifest = {
  values: {
    tenant_name: 'Acme Retail (Pty) Ltd',
  },
  mappings: [],
  provenance: {
    entityId: ids.entity,
    opportunityId: ids.opportunity,
    commercialVersionId: ids.commercialVersion,
    commercialVersionNumber: 2,
    templateId: ids.template,
    templateVersion: 4,
    sourceTemplateDocumentId: ids.sourceDocument,
    sourceTemplateChecksum: 'source-checksum',
  },
  validation: {
    valid: true,
    issues: [],
  },
} as any;

const template = {
  id: ids.template,
  entity_id: ids.entity,
  version: 4,
  status: 'active',
  review_status: 'approved',
  source_document_id: ids.sourceDocument,
  source_document_checksum: 'source-checksum',
  source_mime_type: DOCX_MIME,
} as any;

const docxSource = {
  documentId: ids.sourceDocument,
  fileName: 'approved-template.docx',
  mimeType: DOCX_MIME,
  format: 'docx' as const,
  storageBucket: 'documents',
  storageKey: 'lease-templates/source.docx',
  checksum: 'source-checksum',
  bytes: new Uint8Array([1, 2, 3]),
};

const pdfSource = {
  ...docxSource,
  fileName: 'approved-template.pdf',
  mimeType: 'application/pdf',
  format: 'pdf' as const,
};

const rendered = {
  bytes: new Uint8Array([10, 20, 30, 40]),
  mimeType: DOCX_MIME,
  extension: 'docx',
  checksum: 'generated-checksum',
  fields: [],
};

type HarnessOptions = {
  uploadError?: { message: string } | null;
  registrationError?: { message: string } | null;
  registeredDocumentId?: unknown;
  canonicalStorageKey?: string;
  canonicalChecksum?: string | null;
  canonicalMimeType?: string;
  canonicalLookupError?: { message: string } | null;
  canonicalMissing?: boolean;
};

function createHarness(options: HarnessOptions = {}) {
  const calls = {
    prepareAuthority: 0,
    loadSource: 0,
    buildRenderPlan: 0,
    renderDocx: 0,
    uploads: [] as string[],
    removals: [] as string[],
    registrations: 0,
    canonicalLookups: 0,
  };

  const attemptId = '88888888-8888-4888-8888-888888888888';

  const expectedAttemptKey = [
    'generated-leases',
    ids.entity,
    ids.opportunity,
    ids.commercialVersion,
    ids.template,
    'v4',
    `generated-checksum-${attemptId}.docx`,
  ].join('/');

  const canonicalStorageKey =
    options.canonicalStorageKey ?? expectedAttemptKey;

  const dependencies: LeaseGenerationDependencies = {
    prepareAuthority: (async () => {
      calls.prepareAuthority += 1;
      return {
        manifest,
        template,
      };
    }) as LeaseGenerationDependencies['prepareAuthority'],

    loadSource: (async () => {
      calls.loadSource += 1;
      return docxSource;
    }) as LeaseGenerationDependencies['loadSource'],

    buildRenderPlan: (() => {
      calls.buildRenderPlan += 1;
      return {
        format: 'docx',
        entries: [],
        checks: [],
      };
    }) as LeaseGenerationDependencies['buildRenderPlan'],

    renderDocx: (() => {
      calls.renderDocx += 1;
      return rendered;
    }) as LeaseGenerationDependencies['renderDocx'],

    createAttemptId: () => attemptId,
  };

  const canonicalDocument = options.canonicalMissing
    ? null
    : {
        id: ids.canonicalDocument,
        file_name: `lease-${ids.opportunity}-v4.docx`,
        mime_type: options.canonicalMimeType ?? DOCX_MIME,
        file_size_bytes: rendered.bytes.length,
        checksum:
          options.canonicalChecksum === undefined
            ? rendered.checksum
            : options.canonicalChecksum,
        storage_bucket: 'documents',
        storage_key: canonicalStorageKey,
      };

  const client = {
    storage: {
      from(bucket: string) {
        assert.equal(bucket, 'documents');

        return {
          async upload(
            key: string,
            bytes: Uint8Array,
            uploadOptions: {
              contentType: string;
              upsert: boolean;
            },
          ) {
            calls.uploads.push(key);

            assert.deepEqual(bytes, rendered.bytes);
            assert.equal(uploadOptions.contentType, DOCX_MIME);
            assert.equal(uploadOptions.upsert, false);

            return {
              data: options.uploadError ? null : { path: key },
              error: options.uploadError ?? null,
            };
          },

          async remove(keys: string[]) {
            calls.removals.push(...keys);

            return {
              data: keys,
              error: null,
            };
          },
        };
      },
    },

    async rpc(name: string, args: Record<string, unknown>) {
      calls.registrations += 1;

      assert.equal(name, 'register_generated_lease_document');
      assert.equal(args.p_actor_id, ids.actor);
      assert.equal(args.p_entity_id, ids.entity);
      assert.equal(args.p_opportunity_id, ids.opportunity);
      assert.equal(
        args.p_commercial_version_id,
        ids.commercialVersion,
      );
      assert.equal(args.p_template_id, ids.template);
      assert.equal(args.p_template_version, 4);
      assert.equal(
        args.p_template_source_document_id,
        ids.sourceDocument,
      );
      assert.equal(
        args.p_template_source_checksum,
        'source-checksum',
      );
      assert.equal(
        args.p_generated_checksum,
        'generated-checksum',
      );
      assert.equal(args.p_storage_bucket, 'documents');
      assert.equal(args.p_storage_key, expectedAttemptKey);

      return {
        data:
          options.registeredDocumentId === undefined
            ? ids.canonicalDocument
            : options.registeredDocumentId,
        error: options.registrationError ?? null,
      };
    },

    from(table: string) {
      assert.equal(table, 'documents');

      return {
        select(_columns: string) {
          return {
            eq(_field1: string, _value1: unknown) {
              return {
                eq(_field2: string, _value2: unknown) {
                  return {
                    async maybeSingle() {
                      calls.canonicalLookups += 1;

                      return {
                        data: canonicalDocument,
                        error:
                          options.canonicalLookupError ?? null,
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as any;

  return {
    calls,
    client,
    dependencies,
    expectedAttemptKey,
  };
}

async function expectLeaseGenerationError(
  action: () => Promise<unknown>,
  code: string,
): Promise<void> {
  let thrown: unknown;

  try {
    await action();
  } catch (error) {
    thrown = error;
  }

  assert(
    thrown instanceof LeaseGenerationError,
    `expected LeaseGenerationError, received ${String(thrown)}`,
  );

  assert.equal(thrown.code, code);
}

async function main(): Promise<void> {

/*
 * 1. Successful generation.
 */
{
  const harness = createHarness();

  const result = await generateLeaseDocument(
    input,
    harness.client,
    harness.dependencies,
  );

  assert.equal(result.documentId, ids.canonicalDocument);
  assert.equal(result.checksum, 'generated-checksum');
  assert.equal(result.storageKey, harness.expectedAttemptKey);

  assert.equal(harness.calls.prepareAuthority, 1);
  assert.equal(harness.calls.loadSource, 1);
  assert.equal(harness.calls.buildRenderPlan, 1);
  assert.equal(harness.calls.renderDocx, 1);
  assert.equal(harness.calls.uploads.length, 1);
  assert.equal(harness.calls.registrations, 1);
  assert.equal(harness.calls.canonicalLookups, 1);
  assert.deepEqual(harness.calls.removals, []);

  console.log('PASS successful generation');
}

/*
 * 2. Storage failure stops before database registration.
 */
{
  const harness = createHarness({
    uploadError: {
      message: 'simulated upload failure',
    },
  });

  await expectLeaseGenerationError(
    () =>
      generateLeaseDocument(
        input,
        harness.client,
        harness.dependencies,
      ),
    'storage_upload_failed',
  );

  assert.equal(harness.calls.uploads.length, 1);
  assert.equal(harness.calls.registrations, 0);
  assert.equal(harness.calls.canonicalLookups, 0);
  assert.deepEqual(harness.calls.removals, []);

  console.log('PASS storage failure stops registration');
}

/*
 * 3. Registration failure compensates only this attempt's upload.
 */
{
  const harness = createHarness({
    registrationError: {
      message: 'simulated registration failure',
    },
  });

  await expectLeaseGenerationError(
    () =>
      generateLeaseDocument(
        input,
        harness.client,
        harness.dependencies,
      ),
    'registration_failed',
  );

  assert.equal(harness.calls.registrations, 1);
  assert.equal(harness.calls.canonicalLookups, 0);
  assert.deepEqual(
    harness.calls.removals,
    [harness.expectedAttemptKey],
  );

  console.log('PASS registration failure cleans own upload');
}

/*
 * 4. Concurrent/idempotent loser resolves winner and removes only its own
 * unique upload.
 */
{
  const winnerStorageKey =
    'generated-leases/existing/canonical-winner.docx';

  const harness = createHarness({
    canonicalStorageKey: winnerStorageKey,
  });

  const result = await generateLeaseDocument(
    input,
    harness.client,
    harness.dependencies,
  );

  assert.equal(result.documentId, ids.canonicalDocument);
  assert.equal(result.storageKey, winnerStorageKey);

  assert.deepEqual(
    harness.calls.removals,
    [harness.expectedAttemptKey],
  );

  assert(
    !harness.calls.removals.includes(winnerStorageKey),
    'winner storage object must never be removed',
  );

  console.log('PASS idempotent loser preserves canonical winner');
}

/*
 * 5. Canonical checksum mismatch fails closed.
 */
{
  const harness = createHarness({
    canonicalChecksum: 'different-generated-checksum',
  });

  await expectLeaseGenerationError(
    () =>
      generateLeaseDocument(
        input,
        harness.client,
        harness.dependencies,
      ),
    'registration_invalid',
  );

  assert.equal(harness.calls.registrations, 1);

  console.log('PASS canonical checksum mismatch rejected');
}

/*
 * 6. Unsupported PDF source fails before rendering/storage/registration.
 */
{
  const harness = createHarness();

  harness.dependencies.loadSource = (async () => {
    harness.calls.loadSource += 1;
    return pdfSource;
  }) as LeaseGenerationDependencies['loadSource'];

  await expectLeaseGenerationError(
    () =>
      generateLeaseDocument(
        input,
        harness.client,
        harness.dependencies,
      ),
    'unsupported_format',
  );

  assert.equal(harness.calls.buildRenderPlan, 0);
  assert.equal(harness.calls.renderDocx, 0);
  assert.equal(harness.calls.uploads.length, 0);
  assert.equal(harness.calls.registrations, 0);

  console.log('PASS unsupported PDF fails before storage');
}

/*
 * 7. Authority failure stops the entire pipeline before source resolution.
 */
{
  const harness = createHarness();

  harness.dependencies.prepareAuthority = (async () => {
    harness.calls.prepareAuthority += 1;
    throw new Error('simulated authority failure');
  }) as LeaseGenerationDependencies['prepareAuthority'];

  let failed = false;

  try {
    await generateLeaseDocument(
      input,
      harness.client,
      harness.dependencies,
    );
  } catch {
    failed = true;
  }

  assert(failed, 'authority failure did not stop generation');
  assert.equal(harness.calls.loadSource, 0);
  assert.equal(harness.calls.buildRenderPlan, 0);
  assert.equal(harness.calls.renderDocx, 0);
  assert.equal(harness.calls.uploads.length, 0);
  assert.equal(harness.calls.registrations, 0);

  console.log('PASS authority failure stops pipeline');
}

console.log('ALL LEASE GENERATION ORCHESTRATOR CHECKS PASSED');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
