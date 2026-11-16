/*
 * Static Temporal-Dead-Zone check.
 *
 * Báo các tham chiếu tới binding `const`/`let` mà:
 *   - nằm TRƯỚC khai báo trong source, và
 *   - được đánh giá đồng bộ trong cùng function với khai báo (không nằm trong
 *     function lồng nhau được gọi muộn hơn).
 * Đây chính là dạng lỗi `[existingChats, handleName, navigation]` (deps array được
 * đánh giá khi render, trước `const handleName`). Không phụ thuộc Babel transform của Jest.
 */
const fs = require('fs');
const { parseSync, traverse } = require('@babel/core');

const findRenderTimeTdzReads = (filePath) => {
  const code = fs.readFileSync(filePath, 'utf8');
  const ast = parseSync(code, {
    filename: filePath,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['jsx'] },
    sourceType: 'module',
  });
  const findings = [];

  traverse(ast, {
    VariableDeclarator(declPath) {
      const { kind } = declPath.parentPath.node;
      if (kind !== 'const' && kind !== 'let') return;
      const declFn = declPath.getFunctionParent();

      Object.values(declPath.getBindingIdentifiers()).forEach((idNode) => {
        const binding = declPath.scope.getBinding(idNode.name);
        if (!binding) return;
        binding.referencePaths.forEach((ref) => {
          if (ref.node.start >= declPath.node.start) return;
          if (ref.getFunctionParent() !== declFn) return;
          findings.push(`${idNode.name} read at line ${ref.node.loc.start.line} before declaration at line ${declPath.node.loc.start.line}`);
        });
      });
    },
  });

  return findings;
};

module.exports = { findRenderTimeTdzReads };
