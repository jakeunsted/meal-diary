import crypto from 'crypto';
import type { Request } from 'express';

const CERT_HOST = 's3.amazonaws.com';
const CERT_PATH_PREFIX = '/echo.api/';
const MAX_TIMESTAMP_SKEW_MS = 150_000;
const ECHO_API_SAN = 'dns:echo-api.amazon.com';

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

interface AlexaApplicationIdCarrier {
  session?: { application?: { applicationId?: string } };
  context?: { System?: { application?: { applicationId?: string } } };
  request?: { timestamp?: string };
}

const safeEqual = (left: string, right: string): boolean => {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuf, rightBuf);
};

export const isValidAlexaCertUrl = (certUrl: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(certUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') {
    return false;
  }
  if (parsed.username || parsed.password) {
    return false;
  }
  if (parsed.hostname !== CERT_HOST) {
    return false;
  }
  if (parsed.port !== '' && parsed.port !== '443') {
    return false;
  }
  if (parsed.search || parsed.hash) {
    return false;
  }
  return parsed.pathname.startsWith(CERT_PATH_PREFIX);
};

const splitCertificates = (pemChain: string): string[] =>
  pemChain.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];

const validateCertChain = (pemChain: string): string | null => {
  const pems = splitCertificates(pemChain);
  if (pems.length < 2) {
    return null;
  }

  let certs: crypto.X509Certificate[];
  try {
    certs = pems.map((pem) => new crypto.X509Certificate(pem));
  } catch {
    return null;
  }

  const leaf = certs[0];
  const now = Date.now();
  if (new Date(leaf.validFrom).getTime() > now || new Date(leaf.validTo).getTime() < now) {
    return null;
  }

  const sanNames = (leaf.subjectAltName ?? '')
    .split(',')
    .map((part) => part.trim().toLowerCase());
  if (!sanNames.includes(ECHO_API_SAN)) {
    return null;
  }

  for (let index = 0; index < certs.length - 1; index += 1) {
    const current = certs[index];
    const issuer = certs[index + 1];
    if (!current || !issuer || !current.verify(issuer.publicKey)) {
      return null;
    }
  }

  return pems[0] ?? null;
};

const signatureMatches = (rawBody: Buffer, signature: string, certificatePem: string): boolean => {
  for (const algorithm of ['RSA-SHA1', 'RSA-SHA256']) {
    try {
      const verifier = crypto.createVerify(algorithm);
      verifier.update(rawBody);
      verifier.end();
      if (verifier.verify(certificatePem, signature, 'base64')) {
        return true;
      }
    } catch {
      // Try the next algorithm Amazon may use for the same certificate.
    }
  }
  return false;
};

const timestampIsFresh = (body: AlexaApplicationIdCarrier): boolean => {
  const timestamp = body.request?.timestamp;
  if (!timestamp) {
    return false;
  }
  const parsed = new Date(timestamp).getTime();
  if (Number.isNaN(parsed)) {
    return false;
  }
  return Math.abs(Date.now() - parsed) <= MAX_TIMESTAMP_SKEW_MS;
};

const applicationIdsMatch = (body: AlexaApplicationIdCarrier): boolean => {
  const skillId = process.env.ALEXA_SKILL_ID;
  if (!skillId) {
    return false;
  }
  const sessionId = body.session?.application?.applicationId;
  const contextId = body.context?.System?.application?.applicationId;
  if (!sessionId || !contextId) {
    return false;
  }
  return safeEqual(sessionId, skillId) && safeEqual(contextId, skillId);
};

const fetchCertChain = async (certUrl: string): Promise<string | null> => {
  const response = await fetch(certUrl, {
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    return null;
  }
  return response.text();
};

export const verifyAlexaSkillRequest = async (req: Request): Promise<boolean> => {
  const certUrl = req.get('SignatureCertChainUrl');
  const signature = req.get('Signature');
  const rawBody = req.rawBody;
  if (!certUrl || !signature || !rawBody || rawBody.length === 0 || !isValidAlexaCertUrl(certUrl)) {
    return false;
  }

  const body = (req.body ?? {}) as AlexaApplicationIdCarrier;
  if (!timestampIsFresh(body) || !applicationIdsMatch(body)) {
    return false;
  }

  try {
    const pemChain = await fetchCertChain(certUrl);
    if (!pemChain) {
      return false;
    }
    const leafPem = validateCertChain(pemChain);
    if (!leafPem) {
      return false;
    }
    return signatureMatches(rawBody, signature, leafPem);
  } catch {
    return false;
  }
};
