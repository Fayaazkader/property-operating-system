import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transform } from 'typescript';

const require = createRequire(import.meta.url);

const filename = 'lib/execution/server/invitation-delivery.ts';
const source = readFileSync(filename, 'utf8');

const compiled = transform(source, [
  context => root => {
    function visit(node) {
      if (
        node.kind === 272 &&
        node.moduleSpecifier?.text === 'server-only'
      ) {
        return undefined;
      }
      return require('typescript').visitEachChild(node, visit, context);
    }
    return require('typescript').visitNode(root, visit);
  },
]);

// Compile the original implementation, replacing its external imports
// with controlled dependencies. Do not contact Supabase or Resend.
const ts = require('typescript');
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

let sender;
let sendCount;

const moduleObject = { exports: {} };

const mockRequire = name => {
  if (name === 'server-only') return {};
  if (name === './invitations') {
    return { issueSigningInvitation: () => {
      throw new Error('Unexpected invitation issue');
    }};
  }
  if (name === './invitation-email') {
    return {
      sendSigningInvitationEmail: async input => {
        sendCount++;
        return sender(input);
      },
    };
  }
  throw new Error(`Unexpected module import: ${name}`);
};

new Function('require', 'module', 'exports', output)(
  mockRequire,
  moduleObject,
  moduleObject.exports,
);

const { deliverReservedSigningInvitation } = moduleObject.exports;

function database({
  initialStatus = 'pending',
  updateFails = false,
  claimFails = false,
} = {}) {
  const updates = [];
  let status = initialStatus;
  let claims = 0;

  return {
    updates,
    get claims() { return claims; },
    client: {
      async rpc(name, args) {
        assert.equal(name, 'claim_execution_invitation_email_dispatch');
        assert.equal(args.p_delivery_attempt_id, 'attempt-1');
        claims++;

        if (claimFails) {
          return { data: null, error: new Error('Claim failed') };
        }

        if (status !== 'pending') {
          return { data: false, error: null };
        }

        status = 'sending';
        return { data: true, error: null };
      },
      from(table) {
        assert.equal(table, 'execution_invitation_delivery_attempts');

        return {
          update(values) {
            updates.push(values);

            return {
              eq(column, value) {
                assert.equal(column, 'id');
                assert.equal(value, 'attempt-1');

                return {
                  eq(statusColumn, expectedStatus) {
                    assert.equal(statusColumn, 'status');
                    assert.equal(expectedStatus, 'sending');

                    return {
                      select() {
                        return {
                          async maybeSingle() {
                            if (updateFails) {
                              return {
                                data: null,
                                error: new Error('DB failure'),
                              };
                            }

                            if (status !== 'sending') {
                              return { data: null, error: null };
                            }

                            status = values.status;

                            return {
                              data: { id: 'attempt-1' },
                              error: null,
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
        };
      },
    },
  };
}

const input = {
  deliveryAttemptId: 'attempt-1',
  destination: 'signer@example.invalid',
  signerName: 'Test Signer',
  signingUrl: 'https://example.invalid/execution/sign/test',
  expiresAt: '2026-10-16T12:00:00.000Z',
};

test.beforeEach(() => {
  sendCount = 0;
  sender = async () => ({ providerMessageId: 'resend-test-1' });
});

test('provider acceptance is recorded exactly once', async () => {
  const db = database();
  const result = await deliverReservedSigningInvitation(db.client, input);

  assert.equal(result, 'provider_accepted');
  assert.equal(sendCount, 1);
  assert.equal(db.updates.length, 1);
  assert.equal(db.updates[0].status, 'provider_accepted');
  assert.equal(db.updates[0].provider_message_id, 'resend-test-1');
});

test('provider rejection records delivery_unknown without retry', async () => {
  sender = async () => { throw new Error('Provider rejected'); };

  const db = database();
  const result = await deliverReservedSigningInvitation(db.client, input);

  assert.equal(result, 'delivery_unknown');
  assert.equal(sendCount, 1);
  assert.equal(db.updates[0].status, 'delivery_unknown');
});

test('provider timeout does not trigger retry', async () => {
  sender = async () => { throw new Error('Provider timeout'); };

  const db = database();
  const result = await deliverReservedSigningInvitation(db.client, input);

  assert.equal(result, 'delivery_unknown');
  assert.equal(sendCount, 1);
});

test('ledger failure requires manual reconciliation', async () => {
  const db = database({ updateFails: true });

  await assert.rejects(
    deliverReservedSigningInvitation(db.client, input),
    /Manual reconciliation required/i,
  );

  assert.equal(sendCount, 1);
});

test('non-pending delivery is rejected before provider call', async () => {
  const db = database({ initialStatus: 'provider_accepted' });

  await assert.rejects(
    deliverReservedSigningInvitation(db.client, input),
    /could not be claimed/i,
  );

  assert.equal(sendCount, 0);
  assert.equal(db.updates.length, 0);
});

test('failed claim never contacts provider', async () => {
  const db = database({ claimFails: true });

  await assert.rejects(
    deliverReservedSigningInvitation(db.client, input),
    /could not be claimed/i,
  );

  assert.equal(sendCount, 0);
  assert.equal(db.updates.length, 0);
});

test('concurrent callers cannot both dispatch the same attempt', async () => {
  const db = database();

  const results = await Promise.allSettled([
    deliverReservedSigningInvitation(db.client, input),
    deliverReservedSigningInvitation(db.client, input),
  ]);

  assert.equal(
    results.filter(result => result.status === 'fulfilled').length,
    1,
  );

  assert.equal(
    results.filter(result => result.status === 'rejected').length,
    1,
  );

  assert.equal(sendCount, 1);
  assert.equal(db.claims, 2);
  assert.equal(db.updates.length, 1);
});
