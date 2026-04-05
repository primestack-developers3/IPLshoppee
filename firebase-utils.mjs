import { existsSync, readFileSync } from 'node:fs';

export function loadEnvFile(filename, env = process.env) {
  if (!existsSync(filename)) return;

  const source = readSafeFile(filename);
  source.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const separator = trimmed.indexOf('=');
    if (separator === -1) return;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^"(.*)"$/, '$1');
    if (!env[key]) {
      env[key] = value.replace(/\\n/g, '\n');
    }
  });
}

export function readSafeFile(filename) {
  try {
    return readFileSync(filename, 'utf8');
  } catch {
    return '';
  }
}

function normalizePrivateKey(value) {
  return String(value || '').replace(/\\n/g, '\n');
}

function parseInlineServiceAccount(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return null;

  const attempts = [value];
  try {
    attempts.push(Buffer.from(value, 'base64').toString('utf8'));
  } catch {
    // Ignore invalid base64 input.
  }

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      return {
        projectId: parsed.project_id || parsed.projectId || '',
        clientEmail: parsed.client_email || parsed.clientEmail || '',
        privateKey: normalizePrivateKey(parsed.private_key || parsed.privateKey || '')
      };
    } catch {
      // Keep trying.
    }
  }

  return null;
}

export function getFirebaseServiceAccount(env = process.env) {
  const inline = parseInlineServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON || '');
  if (inline?.projectId && inline?.clientEmail && inline?.privateKey) {
    return inline;
  }

  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: normalizePrivateKey(env.FIREBASE_PRIVATE_KEY)
    };
  }

  return null;
}

let firestoreContextPromise = null;

export async function getFirebaseFirestore(options = {}) {
  if (firestoreContextPromise) {
    return firestoreContextPromise;
  }

  firestoreContextPromise = (async () => {
    const serviceAccount = getFirebaseServiceAccount(options.env || process.env);
    if (!serviceAccount) {
      return {
        enabled: false,
        db: null,
        reason: 'missing_firebase_credentials'
      };
    }

    try {
      const [{ cert, getApp, getApps, initializeApp }, { getFirestore }] = await Promise.all([
        import('firebase-admin/app'),
        import('firebase-admin/firestore')
      ]);

      const appName = options.appName || 'reyval-server';
      const existingApp = getApps().find(app => app.name === appName);
      const app = existingApp || initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId,
        ...(options.env?.FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL
          ? { databaseURL: options.env?.FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL }
          : {})
      }, appName);

      return {
        enabled: true,
        db: getFirestore(existingApp || app),
        reason: 'firebase_ready'
      };
    } catch (error) {
      return {
        enabled: false,
        db: null,
        reason: error.message || 'firebase_initialization_failed'
      };
    }
  })();

  return firestoreContextPromise;
}
