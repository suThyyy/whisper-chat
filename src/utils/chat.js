export const FALLBACK_CONTACT_NAME = '~ No Name or Email ~';
export const MESSAGE_STATUS = {
  FAILED: 'failed',
  READ: 'read',
  SENDING: 'sending',
  SENT: 'sent',
};

export const buildInitials = (value = '') => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return '?';
  }

  return trimmedValue
    .split(/\s+/)
    .filter(Boolean)
    .reduce((initials, part) => `${initials}${part[0].toUpperCase()}`, '');
};

export const buildChatParticipant = ({ uid, email, name }) => ({
  uid: uid ?? '',
  email: email ?? '',
  name: name ?? '',
});

export const buildChatMemberIds = (users = []) =>
  Array.from(new Set(users.map((user) => user?.uid).filter(Boolean)));

export const getDisplayName = (user, currentUserEmail) => {
  const userName = user?.name?.trim();
  const userEmail = user?.email?.trim();

  if (userName) {
    return userEmail === currentUserEmail ? `${userName}*(You)` : userName;
  }

  return userEmail || FALLBACK_CONTACT_NAME;
};

export const getUserStatusText = (userEmail, currentUserEmail) =>
  userEmail === currentUserEmail ? 'Message yourself' : 'User status';

export const getChatDisplayName = (chatData, currentUser) => {
  const { users = [], groupName } = chatData ?? {};

  if (groupName) {
    return groupName;
  }

  if (Array.isArray(users) && users.length === 1) {
    return users[0].name || users[0].email || FALLBACK_CONTACT_NAME;
  }

  if (!Array.isArray(users) || users.length !== 2) {
    return FALLBACK_CONTACT_NAME;
  }

  if (currentUser?.displayName) {
    return users[0].name === currentUser.displayName ? users[1].name : users[0].name;
  }

  if (currentUser?.email) {
    return users[0].email === currentUser.email ? users[1].email : users[0].email;
  }

  return FALLBACK_CONTACT_NAME;
};

export const getMessagePreview = (message, currentUserEmail) => {
  if (!message) {
    return 'No messages yet';
  }

  const isCurrentUser = currentUserEmail === message.user?._id;
  const userName = isCurrentUser ? 'You' : (message.user?.name || '').split(' ')[0];

  if (message.image) {
    return `${userName}: sent an image`;
  }

  if (message.video) {
    return `${userName}: sent a video`;
  }

  const messageText = message.text?.length > 20 ? `${message.text.substring(0, 20)}...` : message.text;

  return `${userName}: ${messageText || ''}`;
};

export const normalizeTimestamp = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }

  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

export const normalizeMessage = (message = {}) => ({
  ...message,
  createdAt: normalizeTimestamp(message.createdAt) ?? new Date(),
  image: message.image ?? '',
  status: message.status ?? MESSAGE_STATUS.SENT,
  text: message.text ?? '',
  video: message.video ?? '',
});

export const mergeMessages = (serverMessages = [], pendingMessages = []) => {
  const mergedMessages = new Map();

  [...pendingMessages, ...serverMessages].forEach((message) => {
    if (!message?._id) {
      return;
    }

    const normalizedMessage = normalizeMessage(message);
    const existingMessage = mergedMessages.get(normalizedMessage._id);

    if (!existingMessage || normalizedMessage.status !== MESSAGE_STATUS.SENDING) {
      mergedMessages.set(normalizedMessage._id, {
        ...existingMessage,
        ...normalizedMessage,
      });
    }
  });

  return [...mergedMessages.values()].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
  );
};

export const dedupeUsersByEmail = (users = []) =>
  Array.from(new Map(users.filter((user) => user?.email).map((user) => [user.email, user])).values());

export const dedupeUsersByUid = (users = []) =>
  Array.from(new Map(users.filter((user) => user?.uid).map((user) => [user.uid, user])).values());

export const getLastMessageFromChat = (chatData) =>
  chatData?.lastMessage ? normalizeMessage(chatData.lastMessage) : null;
