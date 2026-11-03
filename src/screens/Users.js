import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Alert, FlatList, StyleSheet } from 'react-native';
import { query, where, orderBy, collection, onSnapshot } from 'firebase/firestore';

import Cell from '../components/Cell';
import ContactRow from '../components/ContactRow';
import { auth, database } from '../config/firebase';
import { createDirectChat } from '../services/chatService';
import { colors, layout, spacing } from '../config/constants';
import { getDisplayName, getUserStatusText } from '../utils/chat';

const Users = () => {
  const navigation = useNavigation();
  const [users, setUsers] = useState([]);
  const [existingChats, setExistingChats] = useState([]);

  useEffect(() => {
    let unsubscribeUsers = () => {};
    let unsubscribeChats = () => {};

    const subscribeToData = async () => {
      const collectionUserRef = collection(database, 'users');
      const q = query(collectionUserRef, orderBy('name', 'asc'));
      unsubscribeUsers = onSnapshot(q, (snapshot) => {
        setUsers(snapshot.docs);
      });

      const collectionChatsRef = collection(database, 'chats');
      const q2 = query(
        collectionChatsRef,
        where('memberIds', 'array-contains', auth?.currentUser?.uid)
      );
      unsubscribeChats = onSnapshot(q2, (snapshot) => {
        const existing = snapshot.docs
          .filter(
            (existingChat) =>
              !existingChat.data().groupName
          )
          .map((existingChat) => ({
            chatId: existingChat.id,
            memberIds: existingChat.data().memberIds ?? [],
          }));
        setExistingChats(existing);
      });
    };

    subscribeToData().catch((error) => {
      Alert.alert('Unable to load users', error.message);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeChats();
    };
  }, []);

  const handleNewGroup = useCallback(() => {
    navigation.navigate('Group');
  }, [navigation]);

  const handleNavigate = useCallback(
    async (user) => {
      let navigationChatID = '';
      let messageYourselfChatID = '';
      const selectedUser = { ...user.data(), uid: user.id };

      existingChats.forEach((existingChat) => {
        const isCurrentUserInTheChat = existingChat.memberIds.includes(auth?.currentUser?.uid);
        const isMessageYourselfExists =
          selectedUser.uid === auth?.currentUser?.uid && existingChat.memberIds.length === 1;

        if (
          isCurrentUserInTheChat &&
          existingChat.memberIds.includes(selectedUser.uid)
        ) {
          navigationChatID = existingChat.chatId;
        }

        if (isMessageYourselfExists === 2) {
          messageYourselfChatID = existingChat.chatId;
        }

        if (auth?.currentUser?.uid === selectedUser.uid) {
          navigationChatID = '';
        }
      });

      try {
        if (messageYourselfChatID) {
          navigation.navigate('Chat', { id: messageYourselfChatID, chatName: handleName(user) });
        } else if (navigationChatID) {
          navigation.navigate('Chat', { id: navigationChatID, chatName: handleName(user) });
        } else {
          const chatId = await createDirectChat({
            currentUser: auth?.currentUser,
            otherUser: selectedUser,
          });

          navigation.navigate('Chat', { id: chatId, chatName: handleName(user) });
        }
      } catch (error) {
        Alert.alert('Unable to open chat', error.message);
      }
    },
    [existingChats, handleName, navigation]
  );

  const handleSubtitle = useCallback(
    (user) => getUserStatusText(user.data().email, auth?.currentUser?.email),
    []
  );

  const handleName = useCallback(
    (user) => getDisplayName(user.data(), auth?.currentUser?.email),
    []
  );

  const renderUser = useCallback(
    ({ item }) => (
      <ContactRow
        name={handleName(item)}
        subtitle={handleSubtitle(item)}
        onPress={() => handleNavigate(item)}
        showForwardIcon={false}
      />
    ),
    [handleName, handleNavigate, handleSubtitle]
  );

  const renderUsersHeader = useCallback(
    () => <Text style={[styles.textContainer, styles.registeredUsersLabel]}>Registered users</Text>,
    []
  );

  return (
    <SafeAreaView style={styles.container}>
      <Cell
        title="New group"
        icon="people"
        tintColor={colors.teal}
        onPress={handleNewGroup}
        style={styles.newGroupCell}
      />

      {users.length === 0 ? (
        <View style={styles.pageContent}>
          <View style={styles.listCard}>
            <View style={styles.blankContainer}>
              <Text style={styles.textContainer}>No registered users yet</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.pageContent}>
          <View style={styles.listCard}>
            <FlatList
              data={users}
              renderItem={renderUser}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={renderUsersHeader}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  blankContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  container: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  listCard: {
    backgroundColor: 'white',
    borderRadius: layout.cardRadius,
    flex: 1,
    overflow: 'hidden',
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  newGroupCell: {
    borderRadius: layout.cardRadius,
    marginHorizontal: layout.pageInset,
    marginTop: layout.pageTopInset,
    overflow: 'hidden',
  },
  pageContent: {
    flex: 1,
    paddingBottom: spacing.lg,
    paddingHorizontal: layout.pageInset,
    paddingTop: layout.pageTopInset,
  },
  registeredUsersLabel: {
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  textContainer: {
    fontSize: 16,
    fontWeight: '300',
    marginHorizontal: spacing.md,
  },
});

export default Users;
