/*
 * Minimal in-memory stand-in for the subset of `firebase/firestore` used by
 * src/services/chatMessageService.js and src/screens/Users.js.
 *
 * Ghi chú: chỉ là test double cho regression tests của nợ cũ (Firebase legacy).
 * Không mô phỏng Rules; các hành vi "server" (ví dụ từ chối ghi đè) được tiêm
 * qua `setCommitInterceptor`.
 */

const store = new Map();
const snapshotListeners = [];
let commitInterceptor = null;
let commitLog = [];

const SERVER_TIMESTAMP = { __serverTimestamp: true };

const joinPath = (segments) => segments.filter((s) => s !== undefined).map(String).join('/');

const isDatabase = (value) => value && value.__isDatabase === true;

const doc = (base, ...segments) => {
  if (isDatabase(base)) {
    return { __type: 'doc', path: joinPath(segments), id: String(segments[segments.length - 1]) };
  }
  // doc(collectionRef, id)
  const path = joinPath([base.path, ...segments]);
  return { __type: 'doc', path, id: String(segments[segments.length - 1]) };
};

const collection = (base, ...segments) => {
  const prefix = isDatabase(base) ? [] : [base.path];
  return { __type: 'collection', path: joinPath([...prefix, ...segments]) };
};

const makeSnapshot = (ref) => {
  const data = store.get(ref.path);
  return {
    id: ref.id,
    ref,
    exists: () => data !== undefined,
    data: () => (data === undefined ? undefined : JSON.parse(JSON.stringify(data))),
  };
};

const getDoc = async (ref) => makeSnapshot(ref);

const runTransaction = async (_db, updateFn) => {
  const writes = [];
  const tx = {
    get: async (ref) => makeSnapshot(ref),
    set: (ref, value) => {
      writes.push({ op: 'set', ref, value });
      return tx;
    },
    update: (ref, value) => {
      writes.push({ op: 'update', ref, value });
      return tx;
    },
  };

  const result = await updateFn(tx);

  if (commitInterceptor) {
    // Interceptor may throw to simulate a server-side rejection.
    commitInterceptor(writes);
  }

  writes.forEach(({ op, ref, value }) => {
    if (op === 'set') {
      store.set(ref.path, value);
    } else {
      if (!store.has(ref.path)) {
        throw new Error(`No document to update: ${ref.path}`);
      }
      store.set(ref.path, { ...store.get(ref.path), ...value });
    }
  });
  commitLog.push(writes);

  return result;
};

const query = (ref, ...constraints) => ({ __type: 'query', path: ref.path, constraints });
const where = (field, op, value) => ({ kind: 'where', field, op, value });
const orderBy = (field, dir) => ({ kind: 'orderBy', field, dir });
const limit = (n) => ({ kind: 'limit', n });
const serverTimestamp = () => SERVER_TIMESTAMP;

const docsUnder = (collectionPath) =>
  [...store.entries()]
    .filter(([path]) => {
      if (!path.startsWith(`${collectionPath}/`)) return false;
      return !path.slice(collectionPath.length + 1).includes('/');
    })
    .map(([path]) => makeSnapshot({ path, id: path.split('/').pop() }));

const onSnapshot = (q, onNext) => {
  const emit = () => {
    let docs = docsUnder(q.path);
    (q.constraints || []).forEach((c) => {
      if (c.kind === 'where' && c.op === 'array-contains') {
        docs = docs.filter((d) => (d.data()[c.field] || []).includes(c.value));
      }
    });
    onNext({ docs });
  };
  snapshotListeners.push(emit);
  emit();
  return () => {};
};

const writeBatch = () => {
  const writes = [];
  return {
    set: (ref, value) => writes.push([ref, value]),
    commit: async () => writes.forEach(([ref, value]) => store.set(ref.path, value)),
  };
};

const updateDoc = async (ref, value) => {
  store.set(ref.path, { ...store.get(ref.path), ...value });
};

const firestoreModule = {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
};

const testControl = {
  database: { __isDatabase: true },
  reset: () => {
    store.clear();
    snapshotListeners.length = 0;
    commitInterceptor = null;
    commitLog = [];
  },
  seed: (path, value) => store.set(path, value),
  read: (path) => store.get(path),
  paths: () => [...store.keys()],
  setCommitInterceptor: (fn) => {
    commitInterceptor = fn;
  },
  commitCount: () => commitLog.length,
};

module.exports = { firestoreModule, testControl, SERVER_TIMESTAMP };
