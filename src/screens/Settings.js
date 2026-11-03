import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Alert, Share, ScrollView, StyleSheet } from 'react-native';

import Cell from '../components/Cell';
import { auth } from '../config/firebase';
import ContactRow from '../components/ContactRow';
import { layout, spacing } from '../config/constants';

const Settings = ({ navigation }) => {
  const handleInviteFriend = useCallback(async () => {
    try {
      await Share.share({
        message: 'Check out WhisperChat, a real-time chat app built with Expo and Firebase.',
      });
    } catch (error) {
      Alert.alert('Unable to share', error.message);
    }
  }, []);

  const handleOpenProfile = useCallback(() => navigation.navigate('Profile'), [navigation]);
  const handleOpenAccount = useCallback(() => navigation.navigate('Account'), [navigation]);
  const handleOpenHelp = useCallback(() => navigation.navigate('Help'), [navigation]);
  const handleOpenAbout = useCallback(() => navigation.navigate('About'), [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <ContactRow
            name={auth?.currentUser?.displayName ?? 'No name'}
            subtitle={auth?.currentUser?.email ?? 'No email'}
            style={styles.contactRow}
            onPress={handleOpenProfile}
          />
        </View>

        <View style={styles.card}>
          <Cell
            title="Account"
            subtitle="Privacy, logout, and account deletion"
            icon="key-outline"
            onPress={handleOpenAccount}
            iconColor="black"
            accessibilityHint="Opens account actions"
          />

          <Cell
            title="Help"
            subtitle="Support, troubleshooting, and project help"
            icon="help-circle-outline"
            iconColor="black"
            onPress={handleOpenHelp}
            accessibilityHint="Opens help and support"
          />

          <Cell
            title="About"
            subtitle="Project details and Firebase setup model"
            icon="information-circle-outline"
            iconColor="black"
            onPress={handleOpenAbout}
            accessibilityHint="Opens app information"
          />
        </View>

        <View style={styles.card}>
          <Cell
            title="Invite a friend"
            subtitle="Share the app with someone you trust"
            icon="people-outline"
            iconColor="black"
            onPress={handleInviteFriend}
            showForwardIcon={false}
            accessibilityHint="Opens the system share sheet"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: layout.cardRadius,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  contactRow: {
    backgroundColor: 'white',
  },
  container: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  content: {
    paddingBottom: spacing.lg,
    paddingHorizontal: layout.pageInset,
    paddingTop: layout.pageTopInset,
  },
});

Settings.propTypes = {
  navigation: PropTypes.object.isRequired,
};

export default Settings;
