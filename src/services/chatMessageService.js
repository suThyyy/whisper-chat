import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  doc,
  limit,
  query,
  getDoc,
  orderBy,
  collection,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { auth, database } from '../config/firebase';
import { mergeMessages, MESSAGE_STATUS, normalizeMessage } from '../utils/chat';

const CHAT_MESSAGE_PAGE_SIZE = 50;
const PENDING_MESSAGES_STORAGE_KEY = 'pendingChatMessages';

const getChatRef = (chatId) => doc(database, 'chats', chatId);
const getMemberRef = (chatId, uid) => doc(database, 'chats', chatId, 'members', uid);
const getMessagesCollection = (chatId) => collection(database, 'chats', chatId, 'messages');
const getMessageRef = (chatId, messageId) =>
  doc(getMessagesCollection(chatId), String(messageId));

const buildMessageUser = (message, sender) => ({
  _id: sender.email,
  avatar: message?.user?.avatar ?? '',
  name: sender.displayName ?? sender.email,
  uid: sender.uid,
});

const buildStoredMessage = (message, sender) => {
  const normalizedMessage = normalizeMessage(message);

  return {
    _id: String(normalizedMessage._id),
    createdAt: serverTimestamp(),
    image: normalizedMessage.image || null,
    senderId: sender.uid,
    status: MESSAGE_STATUS.SENT,
    text: normalizedMessage.text,
    user: buildMessageUser(normalizedMessage, sender),
    video: normalizedMessage.video || null,
  };
};

const buildLastMessageMetadata = (storedMessage) => ({
  ...storedMessage,
  createdAt: serverTimestamp(),
});

const readPendingMessagesStore = async () => {
  const storedMessages = await AsyncStorage.getItem(PENDING_MESSAGES_STORAGE_KEY);

  return storedMessages ? JSON.parse(storedMessages) : {};
};

const writePendingMessagesStore = async (store) => {
  await AsyncStorage.setItem(PENDING_MESSAGES_STORAGE_KEY, JSON.stringify(store));
};

export const loadPendingMessages = async (chatId) => {
  const store = await readPendingMessagesStore();

  return (store[chatId] ?? []).map(normalizeMessage);
};

export const upsertPendingMessage = async (chatId, message) => {
  const store = await readPendingMessagesStore();
  const pendingMessages = store[chatId] ?? [];
  const nextMessage = normalizeMessage(message);
  const existingIndex = pendingMessages.findIndex((entry) => entry._id === nextMessage._id);
  const updatedMessages =
    existingIndex === -1
      ? [nextMessage, ...pendingMessages]
      : pendingMessages.map((entry, index) => (index === existingIndex ? nextMessage : entry));

  await writePendingMessagesStore({ ...store, [chatId]: updatedMessages });

  return updatedMessages.map(normalizeMessage);
};

export const removePendingMessage = async (chatId, messageId) => {
  const store = await readPendingMessagesStore();
  const pendingMessages = (store[chatId] ?? []).filter((entry) => entry._id !== messageId);

  await writePendingMessagesStore({ ...store, [chatId]: pendingMessages });

  return pendingMessages.map(normalizeMessage);
};

export const clearDeliveredPendingMessages = async (chatId, deliveredMessageIds = []) => {
  if (!deliveredMessageIds.length) {
    return loadPendingMessages(chatId);
  }

  const deliveredMessageIdSet = new Set(deliveredMessageIds);
  const store = await readPendingMessagesStore();
  const pendingMessages = (store[chatId] ?? []).filter(
    (entry) => !deliveredMessageIdSet.has(entry._id)
  );

  await writePendingMessagesStore({ ...store, [chatId]: pendingMessages });

  return pendingMessages.map(normalizeMessage);
};

export const subscribeToChatMessages = (chatId, onMessages, onError) =>
  onSnapshot(
    query(getMessagesCollection(chatId), orderBy('createdAt', 'desc'), limit(CHAT_MESSAGE_PAGE_SIZE)),
    (snapshot) => {
      onMessages(
        snapshot.docs.map((messageDoc) =>
          normalizeMessage({ _id: messageDoc.id, ...messageDoc.data() })
        )
      );
    },
    onError
  );

export const sendChatMessage = async ({ chatId, message }) => {
  const sender = auth.currentUser;

  if (!sender?.uid || !sender?.email) {
    throw new Error('You must be signed in to send a message.');
  }

  await runTransaction(database, async (transaction) => {
    const chatRef = getChatRef(chatId);
    const chatSnapshot = await transaction.get(chatRef);

    if (!chatSnapshot.exists()) {
      throw new Error('Chat does not exist');
    }

    const chatData = chatSnapshot.data();
    const memberIds = chatData?.memberIds ?? [];

    if (!memberIds.includes(sender.uid)) {
      throw new Error('You are not a member of this chat.');
    }

    const memberSnapshots = await Promise.all(
      memberIds.map(async (memberId) => {
        const memberRef = getMemberRef(chatId, memberId);
        const memberSnapshot = await transaction.get(memberRef);

        if (!memberSnapshot.exists()) {
          throw new Error('Chat membership data is incomplete.');
        }

        return { memberId, memberRef, memberSnapshot };
      })
    );

    const storedMessage = buildStoredMessage(message, sender);
    const messageRef = getMessageRef(chatId, storedMessage._id);

    transaction.set(messageRef, storedMessage);
    transaction.update(chatRef, {
      lastMessage: buildLastMessageMetadata(storedMessage),
      lastUpdated: serverTimestamp(),
    });

    memberSnapshots.forEach(({ memberId, memberRef, memberSnapshot }) => {
      const memberState = memberSnapshot.data();
      const isSender = memberId === sender.uid;

      transaction.update(memberRef, {
        hidden: false,
        lastAccess: isSender ? serverTimestamp() : memberState.lastAccess,
        lastMessageId: storedMessage._id,
        unreadCount: isSender ? 0 : (memberState.unreadCount ?? 0) + 1,
      });
    });
  });
};

export const markChatAsRead = async ({ chatId, userId }) => {
  if (!chatId || !userId) {
    return;
  }

  await runTransaction(database, async (transaction) => {
    const memberRef = getMemberRef(chatId, userId);
    const memberSnapshot = await transaction.get(memberRef);

    if (!memberSnapshot.exists()) {
      return;
    }

    transaction.update(memberRef, {
      hidden: false,
      lastAccess: serverTimestamp(),
      unreadCount: 0,
    });
  });
};

export const flushPendingMessages = async ({ chatId }) => {
  const pendingMessages = await loadPendingMessages(chatId);
  const unsentMessages = pendingMessages.filter(
    (pendingMessage) => pendingMessage.status !== MESSAGE_STATUS.SENT
  );

  await Promise.all(
    unsentMessages.map(async (pendingMessage) => {
      await sendChatMessage({
        chatId,
        message: {
          ...pendingMessage,
          status: MESSAGE_STATUS.SENDING,
        },
      });
      await removePendingMessage(chatId, pendingMessage._id);
    })
  );
};

export const getChatMetadata = async (chatId) => {
  const chatSnapshot = await getDoc(getChatRef(chatId));

  return chatSnapshot.exists() ? chatSnapshot.data() : null;
};

export const getChatMemberState = async (chatId, userId) => {
  if (!chatId || !userId) {
    return null;
  }

  const memberSnapshot = await getDoc(getMemberRef(chatId, userId));

  return memberSnapshot.exists() ? memberSnapshot.data() : null;
};

export const mergeServerAndPendingMessages = (serverMessages, pendingMessages) =>
  mergeMessages(serverMessages, pendingMessages);

export { CHAT_MESSAGE_PAGE_SIZE };
