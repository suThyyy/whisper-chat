/*
 * Regression: nợ cũ #3 — outbox `pendingChatMessages` (AsyncStorage) không namespace
 * theo UID/device. A logout, B login trên cùng máy thì flush của B gửi tin pending của A
 * dưới danh nghĩa B (src/services/chatMessageService.js).
 *
 * Hành vi mong muốn (plan §3 "Enrollment và Android storage", T-07/T-08/T-17):
 *   - pending bound UID/device, kiểm cả lúc enqueue và flush;
 *   - B không đọc được và không gửi pending của A;
 *   - outbox at-rest không chứa plaintext (AES-256-GCM từng record).
 *
 * Các test đánh dấu `test.failing` là EXPECTED-FAIL trên code hiện tại. Khi T-07/T-08
 * sửa xong, jest sẽ báo "failing test passed" → đổi `test.failing` thành `test`.
 * Lưu ý: T-08 thay API service (src/api, outbox mã hóa); khi đó lead/C cung cấp adapter
 * mới và file này được viết lại theo API mới, giữ nguyên kịch bản.
 */
// WC_SHOW_EXPECTED_FAILURES=1 chạy các case expected-fail như test thường để xem lỗi thật.
const expectedFail = process.env.WC_SHOW_EXPECTED_FAILURES ? test : test.failing;
const mockAuth = { currentUser: null };

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('firebase/firestore', () => require('./helpers/memoryFirestore').firestoreModule);
jest.mock('../../src/config/firebase', () => ({
  auth: mockAuth,
  database: require('./helpers/memoryFirestore').testControl.database,
}));

const AsyncStorage = require('@react-native-async-storage/async-storage');
const { testControl } = require('./helpers/memoryFirestore');
const service = require('../../src/services/chatMessageService');

const USER_A = { uid: 'uid-a', email: 'a@example.com', displayName: 'A' };
const USER_B = { uid: 'uid-b', email: 'b@example.com', displayName: 'B' };
const SECRET_TEXT = 'A-private-draft-7c1e';

const seedSharedChat = () => {
  testControl.seed('chats/chat-ab', { memberIds: [USER_A.uid, USER_B.uid] });
  testControl.seed(`chats/chat-ab/members/${USER_A.uid}`, { unreadCount: 0 });
  testControl.seed(`chats/chat-ab/members/${USER_B.uid}`, { unreadCount: 0 });
};

const sentMessages = () =>
  testControl
    .paths()
    .filter((p) => p.startsWith('chats/chat-ab/messages/'))
    .map((p) => testControl.read(p));

const enqueueAsA = async () => {
  mockAuth.currentUser = USER_A;
  await service.upsertPendingMessage('chat-ab', {
    _id: 'msg-a-1',
    text: SECRET_TEXT,
    status: 'failed',
    user: { _id: USER_A.email },
  });
};

const switchToB = () => {
  // Ghi chú: code hiện tại không có hook logout nào xóa outbox; mô phỏng A logout → B login.
  mockAuth.currentUser = USER_B;
};

describe('Outbox account switch (legacy debt #3)', () => {
  beforeEach(async () => {
    testControl.reset();
    await AsyncStorage.clear();
    seedSharedChat();
  });

  it('control: the same user can still flush their own pending message', async () => {
    await enqueueAsA();
    await service.flushPendingMessages({ chatId: 'chat-ab' });
    const messages = sentMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].senderId).toBe(USER_A.uid);
  });

  expectedFail('B must not see A pending messages after account switch [expected-fail until T-07/T-08]', async () => {
    await enqueueAsA();
    switchToB();
    const pendingSeenByB = await service.loadPendingMessages('chat-ab');
    expect(pendingSeenByB).toHaveLength(0);
  });

  expectedFail('B flush must not send A pending message as B [expected-fail until T-07/T-08]', async () => {
    await enqueueAsA();
    switchToB();
    await service.flushPendingMessages({ chatId: 'chat-ab' });
    const leaked = sentMessages().filter((m) => m.text === SECRET_TEXT);
    expect(leaked).toHaveLength(0);
  });

  expectedFail('outbox at rest must not contain plaintext [expected-fail until T-07/T-17]', async () => {
    await enqueueAsA();
    const keys = await AsyncStorage.getAllKeys();
    const values = await AsyncStorage.multiGet(keys);
    const dump = values.map(([, v]) => v).join('\n');
    expect(dump).not.toContain(SECRET_TEXT);
  });
});
