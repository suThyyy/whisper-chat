import PropTypes from 'prop-types';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useMemo, useState, useEffect, createContext } from 'react';

import { auth } from '../config/firebase';
import { ensureCurrentUserProfile } from '../services/userService';

export const AuthenticatedUserContext = createContext({});

export const AuthenticatedUserProvider = ({ children }) => {
  const [user, setUser] = useState();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (authenticatedUser) => {
      if (!authenticatedUser) {
        setUser(null);
        return;
      }

      try {
        await ensureCurrentUserProfile(authenticatedUser);
      } catch (error) {
        console.log('Unable to ensure the current user profile', error);
      }

      setUser(authenticatedUser);
    });
    return unsubscribeAuth;
  }, []);

  const value = useMemo(() => ({ user, setUser }), [user, setUser]);

  return (
    <AuthenticatedUserContext.Provider value={value}>{children}</AuthenticatedUserContext.Provider>
  );
};

AuthenticatedUserProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
