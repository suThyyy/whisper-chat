/*
 * Regression: nợ cũ #4 — retry `transaction.set` vào messageId cũ khi mất ACK.
 *
 * Kịch bản: commit lần 1 thành công nhưng client không nhận ACK (mạng rớt) → message
 * vẫn ở outbox → flush gửi lại cùng messageId.
 *
 * Code hiện tại: ghi đè message, tăng unreadCount người nhận thêm lần nữa, cập nhật
 * lastMessage lần nữa; nếu server từ chối ghi đè (ví dụ Rules cấm update message) thì
 * flush ném lỗi mãi và pending kẹt vĩnh viễn (retry vô hạn).
 *
 * Kỳ vọng mới theo plan §5 "Retry, replay, roster change" + T-13:
 *   - cùng messageId + cùng envelopeHash → idempotent 200, trả kết quả đã commit;
 *     đúng 1 message row, 1 inbox event, unread +1, không push trùng;
 *   - client coi phản hồi idempotent là delivered → xóa khỏi outbox, không retry nữa;
 *   - cùng messageId khác hash → 409 (kiểm ở tests/server/message* T-15).
 *
 * `test.failing` = EXPECTED-FAIL trên code hiện tại; đổi thành `test` khi T-13/T-08 xong.
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

const SENDER = { uid: 'uid-a', email: 'a@example.com', displayName: 'A' };
const RECIPIENT = 'uid-b';
const MESSAGE = { _id: 'msg-1', text: 'hello', status: 'failed', user: { _id: SENDER.email } };

const seedChat = () => {
  testControl.seed('chats/chat-ab', { memberIds: [SENDER.uid, RECIPIENT] });
  testControl.seed(`chats/chat-ab/members/${SENDER.uid}`, { unreadCount: 0 });
  testControl.seed(`chats/chat-ab/members/${RECIPIENT}`, { unreadCount: 0 });
};

const recipientUnread = () => testControl.read(`chats/chat-ab/members/${RECIPIENT}`).unreadCount;
const messageCount = () =>
  testControl.paths().filter((p) => p.startsWith('chats/chat-ab/messages/')).length;

/** First attempt commits on the "server" but the ACK is lost on the way back. */
const sendWithLostAck = async () => {
  await service.upsertPendingMessage('chat-ab', MESSAGE);
  await service.sendChatMessage({ chatId: 'chat-ab', message: MESSAGE });
  // ACK lost: client never reached removePendingMessage, so the message stays pending.
};

describe('Retry after lost ACK (legacy debt #4)', () => {
  beforeEach(async () => {
    testControl.reset();
    await AsyncStorage.clear();
    mockAuth.currentUser = SENDER;
    seedChat();
  });

  it('control: a single send creates one message and unread=1', async () => {
    await service.sendChatMessage({ chatId: 'chat-ab', message: MESSAGE });
    expect(messageCount()).toBe(1);
    expect(recipientUnread()).toBe(1);
  });

  expectedFail('retry of an already-committed message is idempotent: unread stays 1 [expected-fail until T-13]', async () => {
    await sendWithLostAck();
    await service.flushPendingMessages({ chatId: 'chat-ab' });

    expect(messageCount()).toBe(1);
    expect(recipientUnread()).toBe(1);
    expect(await service.loadPendingMessages('chat-ab')).toHaveLength(0);
  });

  expectedFail('server rejecting overwrite of an existing ID must not leave the message stuck forever [expected-fail until T-08/T-13]', async () => {
    await sendWithLostAck();
    // Model the legacy Rules: message docs are create-only, a second `set` is denied.
    testControl.setCommitInterceptor((writes) => {
      const overwrite = writes.find(
        (w) => w.op === 'set' && w.ref.path.includes('/messages/') && testControl.read(w.ref.path)
      );
      if (overwrite) {
        const error = new Error('Missing or insufficient permissions.');
        error.code = 'permission-denied';
        throw error;
      }
    });

    // Expected contract: the retry is answered as "already committed" (idempotent 200)
    // and the outbox entry is cleared, so a bounded number of flushes empties it.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      await service.flushPendingMessages({ chatId: 'chat-ab' }).catch(() => {});
    }
    expect(await service.loadPendingMessages('chat-ab')).toHaveLength(0);
    expect(messageCount()).toBe(1);
  });
});
