import PropTypes from 'prop-types';
import { query, where, collection, onSnapshot } from 'firebase/firestore';
import React, { useMemo, useState, useEffect, createContext } from 'react';

import { database } from '../config/firebase';
import { getChatMemberState } from '../services/chatMessageService';
import { AuthenticatedUserContext } from './AuthenticatedUserContext';

export const UnreadMessagesContext = createContext();

export const UnreadMessagesProvider = ({ children }) => {
  const { user } = React.useContext(AuthenticatedUserContext);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.email) {
      setUnreadCount(0);
      return () => {};
    }

    let unsubscribe = () => {};

    const subscribeToUnreadCounts = async () => {
      const chatsRef = collection(database, 'chats');
      const chatsQuery = query(
        chatsRef,
        where('memberIds', 'array-contains', user.uid)
      );

      unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
        const memberStates = await Promise.all(
          snapshot.docs.map((chat) => getChatMemberState(chat.id, user.uid))
        );
        const nextUnreadCount = memberStates.reduce(
          (total, memberState) =>
            total + (memberState && !memberState.hidden ? memberState.unreadCount ?? 0 : 0),
          0
        );
        setUnreadCount(nextUnreadCount);
      });
    };

    subscribeToUnreadCounts().catch((error) => {
      console.log('Unable to subscribe to unread counts', error);
      setUnreadCount(0);
    });

    return () => unsubscribe();
  }, [user]);

  const value = useMemo(() => ({ unreadCount, setUnreadCount }), [unreadCount, setUnreadCount]);

  return <UnreadMessagesContext.Provider value={value}>{children}</UnreadMessagesContext.Provider>;
};

UnreadMessagesProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
