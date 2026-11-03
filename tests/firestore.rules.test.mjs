import fs from 'node:fs';
import path from 'node:path';
import test, { after, before, beforeEach } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectId = 'whisperchat-rules-test';
const alice = { uid: 'alice-uid', email: 'alice@example.com', name: 'Alice' };
const bob = { uid: 'bob-uid', email: 'bob@example.com', name: 'Bob' };
const mallory = { uid: 'mallory-uid', email: 'mallory@example.com', name: 'Mallory' };
const chatId = 'alice-bob-chat';
let testEnv;

const profile = (user) => ({
  about: 'Available',
  email: user.email,
  name: user.name,
  uid: user.uid,
});

const chat = () => ({
  createdBy: alice.uid,
  groupAdminIds: [],
  groupName: '',
  lastMessage: null,
  lastUpdated: new Date('2026-10-31T00:00:00.000Z'),
  memberIds: [alice.uid, bob.uid],
  schemaVersion: 3,
  users: [
    { uid: alice.uid, email: alice.email, name: alice.name },
    { uid: bob.uid, email: bob.email, name: bob.name },
  ],
});

const member = (user) => ({
  email: user.email,
  hidden: false,
  lastAccess: null,
  lastMessageId: null,
  uid: user.uid,
  unreadCount: 0,
});

const dbFor = (user) =>
  testEnv.authenticatedContext(user.uid, { email: user.email }).firestore();

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'users', alice.uid), profile(alice)),
      setDoc(doc(db, 'users', bob.uid), profile(bob)),
      setDoc(doc(db, 'users', mallory.uid), profile(mallory)),
      setDoc(doc(db, 'chats', chatId), chat()),
      setDoc(doc(db, 'chats', chatId, 'members', alice.uid), member(alice)),
      setDoc(doc(db, 'chats', chatId, 'members', bob.uid), member(bob)),
    ]);
  });
});

after(async () => {
  await testEnv.cleanup();
});

test('user profiles are readable by authenticated users but writable only by their owner', async () => {
  const aliceDb = dbFor(alice);
  const malloryDb = dbFor(mallory);
  const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();

  await assertSucceeds(getDocs(collection(aliceDb, 'users')));
  await assertFails(getDocs(collection(unauthenticatedDb, 'users')));
  await assertSucceeds(updateDoc(doc(aliceDb, 'users', alice.uid), { name: 'Alice Updated' }));
  await assertFails(updateDoc(doc(malloryDb, 'users', alice.uid), { name: 'Mallory' }));
  await assertFails(
    setDoc(doc(malloryDb, 'users', 'forged-user'), {
      about: 'Available',
      email: alice.email,
      name: 'Forged',
      uid: alice.uid,
    })
  );
});

test('chat reads require membership and collection queries require the memberIds constraint', async () => {
  const aliceDb = dbFor(alice);
  const malloryDb = dbFor(mallory);

  await assertSucceeds(getDoc(doc(aliceDb, 'chats', chatId)));
  await assertFails(getDoc(doc(malloryDb, 'chats', chatId)));
  await assertSucceeds(
    getDocs(
      query(collection(aliceDb, 'chats'), where('memberIds', 'array-contains', alice.uid))
    )
  );
  await assertFails(getDocs(collection(aliceDb, 'chats')));
});

test('the creator can atomically create a valid chat and member state documents', async () => {
  const aliceDb = dbFor(alice);
  const newChatId = 'new-chat';
  const batch = writeBatch(aliceDb);

  batch.set(doc(aliceDb, 'chats', newChatId), {
    ...chat(),
    lastUpdated: serverTimestamp(),
  });
  batch.set(doc(aliceDb, 'chats', newChatId, 'members', alice.uid), {
    ...member(alice),
    lastAccess: serverTimestamp(),
  });
  batch.set(doc(aliceDb, 'chats', newChatId, 'members', bob.uid), member(bob));

  await assertSucceeds(batch.commit());
});

test('existing membership and chat ownership fields cannot be changed by a member', async () => {
  const aliceDb = dbFor(alice);

  await assertFails(
    updateDoc(doc(aliceDb, 'chats', chatId), {
      memberIds: [alice.uid, bob.uid, mallory.uid],
    })
  );
  await assertFails(updateDoc(doc(aliceDb, 'chats', chatId), { createdBy: bob.uid }));
});

test('a sender cannot spoof another user in a message', async () => {
  const aliceDb = dbFor(alice);

  await assertFails(
    setDoc(doc(aliceDb, 'chats', chatId, 'messages', 'spoofed-message'), {
      _id: 'spoofed-message',
      createdAt: serverTimestamp(),
      image: null,
      senderId: bob.uid,
      status: 'sent',
      text: 'I am Bob',
      user: { _id: bob.email, avatar: '', name: bob.name, uid: bob.uid },
      video: null,
    })
  );
});

test('a validly attributed message cannot be created without its atomic metadata updates', async () => {
  const aliceDb = dbFor(alice);

  await assertFails(
    setDoc(doc(aliceDb, 'chats', chatId, 'messages', 'orphaned-message'), {
      _id: 'orphaned-message',
      createdAt: serverTimestamp(),
      image: null,
      senderId: alice.uid,
      status: 'sent',
      text: 'Missing metadata writes',
      user: { _id: alice.email, avatar: '', name: alice.name, uid: alice.uid },
      video: null,
    })
  );
});

test('a valid message, chat metadata, and per-member unread updates commit atomically', async () => {
  const aliceDb = dbFor(alice);
  const messageId = 'message-1';
  const message = {
    _id: messageId,
    createdAt: serverTimestamp(),
    image: null,
    senderId: alice.uid,
    status: 'sent',
    text: 'Hello Bob',
    user: { _id: alice.email, avatar: '', name: alice.name, uid: alice.uid },
    video: null,
  };
  const batch = writeBatch(aliceDb);

  batch.set(doc(aliceDb, 'chats', chatId, 'messages', messageId), message);
  batch.update(doc(aliceDb, 'chats', chatId), {
    lastMessage: message,
    lastUpdated: serverTimestamp(),
  });
  batch.update(doc(aliceDb, 'chats', chatId, 'members', alice.uid), {
    hidden: false,
    lastAccess: serverTimestamp(),
    lastMessageId: messageId,
    unreadCount: 0,
  });
  batch.update(doc(aliceDb, 'chats', chatId, 'members', bob.uid), {
    hidden: false,
    lastAccess: null,
    lastMessageId: messageId,
    unreadCount: 1,
  });

  await assertSucceeds(batch.commit());
});

test('members can mark only their own state read or hidden', async () => {
  const aliceDb = dbFor(alice);

  await assertSucceeds(
    updateDoc(doc(aliceDb, 'chats', chatId, 'members', alice.uid), {
      hidden: false,
      lastAccess: serverTimestamp(),
      unreadCount: 0,
    })
  );
  await assertSucceeds(
    updateDoc(doc(aliceDb, 'chats', chatId, 'members', alice.uid), { hidden: true })
  );
  await assertFails(
    updateDoc(doc(aliceDb, 'chats', chatId, 'members', bob.uid), { unreadCount: 999 })
  );
});

test('outsiders cannot read messages or member state', async () => {
  const malloryDb = dbFor(mallory);

  await assertFails(getDocs(collection(malloryDb, 'chats', chatId, 'messages')));
  await assertFails(getDoc(doc(malloryDb, 'chats', chatId, 'members', alice.uid)));
});
