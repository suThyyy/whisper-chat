/*
 * Regression: nợ cũ #1 (TDZ `handleName`) và #2 (self-chat `isMessageYourselfExists === 2`)
 * trong src/screens/Users.js. Owner fix: Helper A (T-03).
 *
 * Trên bản HEAD 24a1900 cả 4 test FAIL (xem docs/plan/03-p0-helperB-notes.md, mục
 * "Bằng chứng fail trước fix"). Biến môi trường WC_USERS_SCREEN cho phép trỏ tới
 * một bản sao baseline (chỉ dùng khi tái hiện bằng chứng, không dùng trong CI).
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockCreateDirectChat = jest.fn();
const mockAuth = { currentUser: { uid: 'uid-me', email: 'me@example.com', displayName: 'Me' } };

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});
jest.mock('firebase/firestore', () => require('./helpers/memoryFirestore').firestoreModule);
jest.mock('../../src/config/firebase', () => ({
  auth: mockAuth,
  database: require('./helpers/memoryFirestore').testControl.database,
}));
jest.mock('../../src/services/chatService', () => ({
  createDirectChat: (...args) => mockCreateDirectChat(...args),
}));

const { testControl } = require('./helpers/memoryFirestore');

// eslint-disable-next-line import/no-dynamic-require
const loadUsers = () => require(process.env.WC_USERS_SCREEN || '../../src/screens/Users').default;

const seedUsers = () => {
  testControl.seed('users/uid-me', { name: 'Me', email: 'me@example.com' });
  testControl.seed('users/uid-ada', { name: 'Ada', email: 'ada@example.com' });
};

describe('Users screen regressions (legacy debt #1, #2)', () => {
  beforeEach(() => {
    testControl.reset();
    mockNavigate.mockReset();
    mockCreateDirectChat.mockReset();
    mockCreateDirectChat.mockResolvedValue('chat-created');
    seedUsers();
  });

  it('#1 renders without a TDZ ReferenceError on handleName', () => {
    const Users = loadUsers();
    expect(() => render(<Users />)).not.toThrow();
  });

  // Jest dùng babel-preset-expo, có thể hạ `const` thành `var` nên render test ở trên
  // KHÔNG tái hiện được TDZ (trên HEAD nó vẫn pass). Kiểm tĩnh dưới đây bắt đúng lỗi:
  // mọi tham chiếu được đánh giá ngay lúc render (cùng function scope, ví dụ deps array)
  // phải nằm sau khai báo const/let tương ứng.
  it('#1 static: no const/let binding is read at render time before its declaration', () => {
    const { findRenderTimeTdzReads } = require('./helpers/tdzCheck');
    const sourcePath = require.resolve(process.env.WC_USERS_SCREEN || '../../src/screens/Users');
    expect(findRenderTimeTdzReads(sourcePath)).toEqual([]);
  });

  it('#2 opens the existing self-chat instead of creating a duplicate', async () => {
    testControl.seed('chats/chat-self', { groupName: '', memberIds: ['uid-me'] });
    testControl.seed('chats/chat-ada', { groupName: '', memberIds: ['uid-me', 'uid-ada'] });
    const Users = loadUsers();
    const { getByText } = render(<Users />);

    fireEvent.press(getByText('Me*(You)'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(mockCreateDirectChat).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('Chat', expect.objectContaining({ id: 'chat-self' }));
  });

  it('#2b creates exactly one self-chat when none exists', async () => {
    testControl.seed('chats/chat-ada', { groupName: '', memberIds: ['uid-me', 'uid-ada'] });
    const Users = loadUsers();
    const { getByText } = render(<Users />);

    fireEvent.press(getByText('Me*(You)'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(mockCreateDirectChat).toHaveBeenCalledTimes(1);
    expect(mockCreateDirectChat.mock.calls[0][0].otherUser.uid).toBe('uid-me');
    expect(mockNavigate).toHaveBeenCalledWith(
      'Chat',
      expect.objectContaining({ id: 'chat-created' })
    );
  });

  it('opens the existing direct chat with another user (no duplicate)', async () => {
    testControl.seed('chats/chat-ada', { groupName: '', memberIds: ['uid-me', 'uid-ada'] });
    const Users = loadUsers();
    const { getByText } = render(<Users />);

    fireEvent.press(getByText('Ada'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(mockCreateDirectChat).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('Chat', expect.objectContaining({ id: 'chat-ada' }));
  });
});
