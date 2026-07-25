// lib/execution/providers/docusign.ts
// DocuSign eSignature REST API — production provider

interface DocuSignConfig {
  accountId: string;
  userId: string;
  integrationKey: string;
  privateKey: string;
  baseUrl: string;
}

interface EnvelopeRequest {
  documentBase64: string;
  documentName: string;
  documentId: string;
  subject: string;
  recipients: Array<{
    name: string;
    email: string;
    roleName: string;
    routingOrder: number;
  }>;
  signHereTabs?: Array<{
    documentId: string;
    pageNumber: string;
    xPosition: string;
    yPosition: string;
  }>;
  callbackUrl?: string;
}

interface EnvelopeResponse {
  envelopeId: string;
  status: string;
  statusDateTime: string;
}

interface SigningUrlRequest {
  envelopeId: string;
  recipientId: string;
  email: string;
  name: string;
  returnUrl: string;
}

interface SigningUrlResponse {
  url: string;
  expiresAt: string;
}

function getConfig(): DocuSignConfig {
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  const userId = process.env.DOCUSIGN_USER_ID;
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
  const privateKey = process.env.DOCUSIGN_PRIVATE_KEY;

  if (!accountId || !userId || !integrationKey || !privateKey) {
    throw new Error('DocuSign configuration incomplete. Missing: ' + 
      [!accountId && 'ACCOUNT_ID', !userId && 'USER_ID', !integrationKey && 'INTEGRATION_KEY', !privateKey && 'PRIVATE_KEY'].filter(Boolean).join(', '));
  }

  return {
    accountId,
    userId,
    integrationKey,
    privateKey,
    baseUrl: process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi',
  };
}

async function getAccessToken(config: DocuSignConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = { alg: 'RS256', typ: 'JWT' };
  const jwtBody = {
    iss: config.integrationKey,
    sub: config.userId,
    aud: config.baseUrl.includes('demo') ? 'account-d.docusign.com' : 'account.docusign.com',
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation',
  };

  const encodedHeader = btoa(JSON.stringify(jwtHeader));
  const encodedBody = btoa(JSON.stringify(jwtBody));

  // Sign with private key using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = Uint8Array.from(atob(config.privateKey.replace(/-----.*?-----/g, '').replace(/\s/g, '')), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(`${encodedHeader}.${encodedBody}`)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const jwt = `${encodedHeader}.${encodedBody}.${encodedSignature}`;

  const response = await fetch(`https://${config.baseUrl.includes('demo') ? 'account-d.docusign.com' : 'account.docusign.com'}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) throw new Error(`DocuSign auth failed: ${response.status}`);
  const data = await response.json();
  return data.access_token;
}

export const docusignProvider = {
  async createEnvelope(params: EnvelopeRequest): Promise<EnvelopeResponse> {
    const config = getConfig();
    const token = await getAccessToken(config);

    const envelope: any = {
      documents: [{
        documentBase64: params.documentBase64,
        documentId: params.documentId || '1',
        fileExtension: 'pdf',
        name: params.documentName,
      }],
      emailSubject: params.subject,
      recipients: {
        signers: params.recipients.map((r, i) => ({
          email: r.email,
          name: r.name,
          recipientId: String(i + 1),
          routingOrder: String(r.routingOrder),
          roleName: r.roleName,
          tabs: params.signHereTabs ? {
            signHereTabs: params.signHereTabs,
          } : {
            signHereTabs: [{ documentId: params.documentId || '1', pageNumber: '1', xPosition: '100', yPosition: '100' }],
          },
        })),
      },
      status: 'sent',
    };

    if (params.callbackUrl) {
      envelope.eventNotification = {
        url: params.callbackUrl,
        loggingEnabled: true,
        requireAcknowledgment: true,
        envelopeEvents: [{ envelopeEventStatusCode: 'completed' }, { envelopeEventStatusCode: 'declined' }, { envelopeEventStatusCode: 'voided' }],
        recipientEvents: [{ recipientEventStatusCode: 'completed' }, { recipientEventStatusCode: 'declined' }],
      };
    }

    const response = await fetch(`${config.baseUrl}/v2.1/accounts/${config.accountId}/envelopes`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    if (!response.ok) throw new Error(`DocuSign envelope creation failed: ${response.status}`);
    const data = await response.json();
    return { envelopeId: data.envelopeId, status: data.status, statusDateTime: data.statusDateTime };
  },

  async getSigningUrl(params: SigningUrlRequest): Promise<SigningUrlResponse> {
    const config = getConfig();
    const token = await getAccessToken(config);

    const response = await fetch(
      `${config.baseUrl}/v2.1/accounts/${config.accountId}/envelopes/${params.envelopeId}/views/recipient`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authenticationMethod: 'none',
          email: params.email,
          userName: params.name,
          recipientId: params.recipientId,
          returnUrl: params.returnUrl,
        }),
      }
    );

    if (!response.ok) throw new Error(`DocuSign signing URL failed: ${response.status}`);
    const data = await response.json();
    return { url: data.url, expiresAt: new Date(Date.now() + 300 * 1000).toISOString() };
  },

  async getEnvelopeStatus(envelopeId: string): Promise<{ status: string; completedAt?: string }> {
    const config = getConfig();
    const token = await getAccessToken(config);
    const response = await fetch(`${config.baseUrl}/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`DocuSign status check failed: ${response.status}`);
    const data = await response.json();
    return { status: data.status, completedAt: data.completedDateTime };
  },

  async getCertificate(envelopeId: string): Promise<string> {
    const config = getConfig();
    const token = await getAccessToken(config);
    const response = await fetch(`${config.baseUrl}/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}/documents/certificate`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`DocuSign certificate fetch failed: ${response.status}`);
    const pdfBuffer = await response.arrayBuffer();
    return Buffer.from(pdfBuffer).toString('base64');
  },
};
