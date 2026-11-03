import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { where, query, collection, onSnapshot } from 'firebase/firestore';
import {
  Text,
  View,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  BackHandler,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import ContactRow from '../components/ContactRow';
import { auth, database } from '../config/firebase';
import { deleteChatForUser } from '../services/chatService';
import { colors, layout, spacing } from '../config/constants';
import { scheduleChatNotification } from '../services/notificationService';
import {
  markChatAsRead,
  getChatMemberState,
} from '../services/chatMessageService';
import {
  getMessagePreview,
  getChatDisplayName,
  normalizeTimestamp,
  getLastMessageFromChat,
} from '../utils/chat';

const Chats = () => {
  const navigation = useNavigation();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const [memberStates, setMemberStates] = useState({});
  const notifiedMessageIdsRef = useRef(new Set());
  const previousUnreadCountsRef = useRef({});

  useEffect(() => {
    if (Platform.OS === 'android') {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (selectedItems.length > 0) {
          setSelectedItems([]);
          return true;
        }
        return false;
      });
      return () => subscription.remove();
    }

    return () => { };
  }, [selectedItems.length]);

  useFocusEffect(
    useCallback(() => {
      let unsubscribe = () => { };

      const subscribeToChats = async () => {
        const chatsRef = collection(database, 'chats');
        const chatsQuery = query(
          chatsRef,
          where('memberIds', 'array-contains', auth?.currentUser?.uid)
        );

        unsubscribe = onSnapshot(
          chatsQuery,
          async (snapshot) => {
            const chatEntries = await Promise.all(
              snapshot.docs.map(async (chatDocument) => ({
                chatDocument,
                memberState: await getChatMemberState(
                  chatDocument.id,
                  auth?.currentUser?.uid
                ),
              }))
            );
            const nextMemberStates = Object.fromEntries(
              chatEntries.map(({ chatDocument, memberState }) => [chatDocument.id, memberState])
            );
            const visibleDocs = chatEntries
              .filter(({ memberState }) => memberState && !memberState.hidden)
              .map(({ chatDocument }) => chatDocument);
            const sortedDocs = [...visibleDocs].sort((left, right) => {
              const leftDate = normalizeTimestamp(left.data().lastUpdated)?.getTime() ?? 0;
              const rightDate = normalizeTimestamp(right.data().lastUpdated)?.getTime() ?? 0;

              return rightDate - leftDate;
            });

            setChats(sortedDocs);
            setMemberStates(nextMemberStates);
            setLoading(false);

            snapshot.docChanges().forEach((change) => {
              const chatData = change.doc.data();
              const memberState = nextMemberStates[change.doc.id];

              if (!memberState || memberState.hidden) {
                return;
              }

              const unreadCount = memberState.unreadCount ?? 0;
              const previousUnreadCount = previousUnreadCountsRef.current[change.doc.id] ?? 0;
              const lastMessage = getLastMessageFromChat(chatData);

              previousUnreadCountsRef.current[change.doc.id] = unreadCount;

              if (
                !lastMessage?._id ||
                lastMessage.user?._id === auth?.currentUser?.email ||
                unreadCount <= previousUnreadCount ||
                notifiedMessageIdsRef.current.has(lastMessage._id)
              ) {
                return;
              }

              notifiedMessageIdsRef.current.add(lastMessage._id);
              scheduleChatNotification({
                chatId: change.doc.id,
                title: getChatDisplayName(chatData, auth?.currentUser),
                body: getMessagePreview(lastMessage, auth?.currentUser?.email),
              });
            });
          },
          (error) => {
            setLoading(false);
            Alert.alert('Unable to load chats', error.message);
          }
        );
      };

      subscribeToChats().catch((error) => {
        setLoading(false);
        Alert.alert('Unable to load chats', error.message);
      });

      return () => unsubscribe();
    }, [])
  );

  const getChatName = useCallback(
    (chat) => getChatDisplayName(chat.data(), auth?.currentUser),
    []
  );

  const selectItems = useCallback((chat) => {
    setSelectedItems((prev) =>
      prev.includes(chat.id)
        ? prev.filter((id) => id !== chat.id)
        : [...prev, chat.id]
    );
  }, []);

  const handleChatPress = useCallback(
    async (chat) => {
      const chatId = chat.id;

      if (selectedItems.length) {
        selectItems(chat);
        return;
      }

      try {
        await markChatAsRead({ chatId, userId: auth?.currentUser?.uid });
      } catch (error) {
        console.log('Unable to mark chat as read', error);
      }

      navigation.navigate('Chat', { id: chatId, chatName: getChatName(chat) });
    },
    [getChatName, navigation, selectItems, selectedItems.length]
  );

  const handleChatLongPress = useCallback((chat) => selectItems(chat), [selectItems]);

  const getSelected = useCallback((chat) => selectedItems.includes(chat.id), [selectedItems]);

  const deSelectItems = useCallback(() => setSelectedItems([]), []);

  const handleFabPress = useCallback(() => navigation.navigate('Users'), [navigation]);

  const handleDeleteChat = useCallback(() => {
    Alert.alert(
      selectedItems.length > 1 ? 'Delete selected chats?' : 'Delete this chat?',
      'Messages will be removed from this device.',
      [
        {
          text: 'Delete chat',
          style: 'destructive',
          onPress: async () => {
            try {
              const deletePromises = selectedItems.map(async (chatId) => {
                const chat = chats.find((chatDocument) => chatDocument.id === chatId);

                if (!chat) {
                  return;
                }

                await deleteChatForUser({
                  chatId,
                  userId: auth?.currentUser?.uid,
                });
              });

              await Promise.all(deletePromises);
              setChats((currentChats) =>
                currentChats.filter((chatDocument) => !selectedItems.includes(chatDocument.id))
              );
              deSelectItems();
            } catch (error) {
              Alert.alert('Delete failed', error.message);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  }, [selectedItems, chats, deSelectItems]);

  useEffect(() => {
    navigation.setOptions({
      headerRight:
        selectedItems.length > 0
          ? () => (
            <TouchableOpacity style={styles.trashBin} onPress={handleDeleteChat}>
              <Ionicons name="trash" size={24} color={colors.teal} />
            </TouchableOpacity>
          )
          : undefined,
      headerLeft:
        selectedItems.length > 0
          ? () => <Text style={styles.itemCount}>{selectedItems.length}</Text>
          : undefined,
    });
  }, [selectedItems, navigation, handleDeleteChat]);

  const getSubtitle = useCallback((chat) => {
    const lastMessage = getLastMessageFromChat(chat.data());

    return getMessagePreview(lastMessage, auth?.currentUser?.email);
  }, []);

  const getSubtitle2 = useCallback((chat) => {
    const lastUpdated = normalizeTimestamp(chat.data().lastUpdated);

    if (!lastUpdated) {
      return '';
    }

    const options = { year: '2-digit', month: 'numeric', day: 'numeric' };
    return lastUpdated.toLocaleDateString(undefined, options);
  }, []);

  const renderChat = useCallback(
    ({ item }) => (
      <ContactRow
        style={getSelected(item) ? styles.selectedContactRow : undefined}
        name={getChatName(item)}
        subtitle={getSubtitle(item)}
        subtitle2={getSubtitle2(item)}
        onPress={() => handleChatPress(item)}
        onLongPress={() => handleChatLongPress(item)}
        selected={getSelected(item)}
        showForwardIcon={false}
        newMessageCount={memberStates[item.id]?.unreadCount ?? 0}
      />
    ),
    [
      getChatName,
      getSelected,
      getSubtitle,
      getSubtitle2,
      handleChatLongPress,
      handleChatPress,
      memberStates,
    ]
  );

  const renderEmptyChats = useCallback(
    () => (
      <View style={styles.emptyStateContainer}>
        <Text style={styles.textContainer}>No conversations yet</Text>
      </View>
    ),
    []
  );

  const renderListFooter = useCallback(
    () => (
      <View style={styles.footerContainer}>
        <Text style={styles.disclaimerText}>
          <Ionicons name="lock-open" size={12} style={styles.disclaimerIcon} /> Your personal
          messages are not <Text style={styles.disclaimerEmphasis}>end-to-end-encrypted</Text>
        </Text>
      </View>
    ),
    []
  );

  return (
    <Pressable style={styles.container} onPress={deSelectItems}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.teal} style={styles.loadingContainer} />
      ) : (
        <View style={styles.pageContent}>
          <View style={styles.listCard}>
            <FlatList
              data={chats}
              renderItem={renderChat}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={renderEmptyChats}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
            />
          </View>
          {renderListFooter()}
        </View>
      )}
      <TouchableOpacity style={styles.fab} onPress={handleFabPress}>
        <View style={styles.fabContainer}>
          <Ionicons name="chatbox-ellipses" size={24} color="white" />
        </View>
      </TouchableOpacity>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  disclaimerEmphasis: {
    color: colors.teal,
  },
  disclaimerIcon: {
    color: '#565656',
  },
  disclaimerText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.lg,
    marginHorizontal: layout.pageInset,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  emptyStateContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  fab: {
    bottom: layout.fabOffset,
    position: 'absolute',
    right: layout.fabOffset,
  },
  fabContainer: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  footerContainer: {
    alignItems: 'center',
  },
  itemCount: {
    color: colors.teal,
    fontSize: 18,
    fontWeight: '400',
    marginLeft: layout.pageInset,
  },
  listCard: {
    backgroundColor: 'white',
    borderRadius: layout.cardRadius,
    flex: 1,
    overflow: 'hidden',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 88,
  },
  loadingContainer: {
    alignItems: 'center',
    color: colors.teal,
    flex: 1,
    justifyContent: 'center',
  },
  pageContent: {
    flex: 1,
    paddingHorizontal: layout.pageInset,
    paddingTop: layout.pageTopInset,
  },
  selectedContactRow: {
    backgroundColor: colors.grey,
  },
  textContainer: {
    color: '#565656',
    fontSize: 16,
    textAlign: 'center',
  },
  trashBin: {
    color: colors.teal,
    paddingRight: layout.pageInset,
  },
});

export default Chats;
