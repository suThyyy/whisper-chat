#!/usr/bin/env node
/*
 * Tái hiện bằng chứng "FAIL trước fix" cho tests/regression/users-screen.test.js khi
 * src/screens/Users.js đã được sửa trong working tree.
 *
 *   node tests/regression/tools/make-head-baseline.js [rev=HEAD]
 *   WC_USERS_SCREEN=../../tests/regression/.baseline/Users.head.js npx jest tests/regression/users-screen
 *   (xong thì xóa tests/regression/.baseline/)
 *
 * Bản sao viết lại import tương đối '../x' thành '../../../src/x' để dùng chung mock.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rev = process.argv[2] || 'HEAD';
const root = path.resolve(__dirname, '../../..');
const outDir = path.join(root, 'tests/regression/.baseline');
const source = execFileSync('git', ['show', `${rev}:src/screens/Users.js`], { cwd: root, encoding: 'utf8' });
const rewritten = source.replace(/from '\.\.\//g, "from '../../../src/");

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'Users.head.js'), rewritten);
console.log(`wrote ${path.relative(root, path.join(outDir, 'Users.head.js'))} from ${rev}`);
