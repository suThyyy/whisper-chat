import {
  doc,
  updateDoc,
  collection,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

import { database } from '../config/firebase';
import {
  dedupeUsersByUid,
  buildChatMemberIds,
  buildChatParticipant,
} from '../utils/chat';

export const MAX_CHAT_MEMBERS = 10;

const getMemberRef = (chatId, uid) => doc(database, 'chats', chatId, 'members', uid);

const buildMemberState = (participant, isCreator) => ({
  email: participant.email,
  hidden: false,
  lastAccess: isCreator ? serverTimestamp() : null,
  lastMessageId: null,
  uid: participant.uid,
  unreadCount: 0,
});

const createChat = async ({ currentUser, groupName, groupAdminIds, participants }) => {
  const users = dedupeUsersByUid(participants);

  if (!currentUser?.uid || !currentUser?.email) {
    throw new Error('You must be signed in to create a chat.');
  }

  if (users.length === 0 || users.length > MAX_CHAT_MEMBERS) {
    throw new Error(`A chat must have between 1 and ${MAX_CHAT_MEMBERS} members.`);
  }

  const chatRef = doc(collection(database, 'chats'));
  const batch = writeBatch(database);

  batch.set(chatRef, {
    createdBy: currentUser.uid,
    groupAdminIds,
    groupName,
    lastMessage: null,
    lastUpdated: serverTimestamp(),
    memberIds: buildChatMemberIds(users),
    schemaVersion: 3,
    users,
  });

  users.forEach((participant) => {
    batch.set(
      getMemberRef(chatRef.id, participant.uid),
      buildMemberState(participant, participant.uid === currentUser.uid)
    );
  });

  await batch.commit();

  return chatRef.id;
};

export const deleteChatForUser = async ({ chatId, userId }) => {
  if (!chatId || !userId) {
    throw new Error('A chat and authenticated user are required.');
  }

  await updateDoc(getMemberRef(chatId, userId), { hidden: true });
};

export const createDirectChat = async ({ currentUser, otherUser }) =>
  createChat({
    currentUser,
    groupAdminIds: [],
    groupName: '',
    participants: [
      buildChatParticipant({
        email: currentUser?.email,
        name: currentUser?.displayName ?? currentUser?.email,
        uid: currentUser?.uid,
      }),
      buildChatParticipant({
        email: otherUser?.email,
        name: otherUser?.name,
        uid: otherUser?.uid,
      }),
    ],
  });

export const createGroupChat = async ({ currentUser, groupName, selectedUsers }) =>
  createChat({
    currentUser,
    groupAdminIds: [currentUser?.uid],
    groupName: groupName.trim(),
    participants: [
      buildChatParticipant({
        email: currentUser?.email,
        name: currentUser?.displayName ?? currentUser?.email,
        uid: currentUser?.uid,
      }),
      ...selectedUsers.map((user) =>
        buildChatParticipant({
          email: user?.email,
          name: user?.name,
          uid: user?.uid,
        })
      ),
    ],
  });
