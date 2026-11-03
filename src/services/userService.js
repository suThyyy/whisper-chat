import { doc, getDoc, setDoc } from 'firebase/firestore';

import { database } from '../config/firebase';

const buildUserProfile = (user, nameOverride) => ({
  about: 'Available',
  email: user.email,
  name: (nameOverride ?? user.displayName ?? user.email).trim(),
  uid: user.uid,
});

export const ensureCurrentUserProfile = async (user, nameOverride) => {
  if (!user?.uid || !user?.email) {
    return null;
  }

  const profileRef = doc(database, 'users', user.uid);
  const profileSnapshot = await getDoc(profileRef);

  if (!profileSnapshot.exists()) {
    await setDoc(profileRef, buildUserProfile(user, nameOverride));
  }

  return profileRef;
};

export const createCurrentUserProfile = async (user, nameOverride) => {
  if (!user?.uid || !user?.email) {
    throw new Error('An authenticated user is required to create a profile.');
  }

  const profileRef = doc(database, 'users', user.uid);
  await setDoc(profileRef, buildUserProfile(user, nameOverride));

  return profileRef;
};
