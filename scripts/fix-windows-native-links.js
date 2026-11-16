/**
 * scripts/fix-windows-native-links.js
 *
 * Idempotent postinstall helper for Windows environments.
 * Creates NTFS Directory Junctions inside node_modules for 3rd-party React Native
 * C++ libraries (reanimated, gesture-handler, worklets) whose Android build systems
 * expect Unix-style symlinks that Windows npm may omit without Developer Mode.
 *
 * Safety constraints:
 * - Only runs when process.platform === 'win32'.
 * - ONLY creates or updates junctions inside node_modules.
 * - NEVER deletes or modifies files outside node_modules.
 * - Idempotent: safe to run multiple times without re-creating valid links.
 */

const fs = require('fs');
const path = require('path');

function run() {
  if (process.platform !== 'win32') {
    console.log('[fix-windows-native-links] Non-Windows OS detected (' + process.platform + '). Skipping junction setup.');
    return;
  }

  const projectRoot = path.resolve(__dirname, '..');
  console.log('[fix-windows-native-links] Running Windows native link helper...');

  const targets = [
    {
      pkg: 'react-native-reanimated',
      linkPath: path.join(projectRoot, 'node_modules', 'react-native-reanimated', 'android', 'Common'),
      targetDir: path.join(projectRoot, 'node_modules', 'react-native-reanimated', 'Common'),
    },
    {
      pkg: 'react-native-gesture-handler',
      linkPath: path.join(projectRoot, 'node_modules', 'react-native-gesture-handler', 'android', 'shared'),
      targetDir: path.join(projectRoot, 'node_modules', 'react-native-gesture-handler', 'shared'),
    },
    {
      pkg: 'react-native-worklets',
      linkPath: path.join(projectRoot, 'node_modules', 'react-native-worklets', 'android', 'Common'),
      targetDir: path.join(projectRoot, 'node_modules', 'react-native-worklets', 'Common'),
    },
  ];

  for (const item of targets) {
    const relLink = path.relative(projectRoot, item.linkPath);
    const relTarget = path.relative(projectRoot, item.targetDir);

    // Guard: Ensure linkPath is strictly inside node_modules
    if (!item.linkPath.includes('node_modules')) {
      console.warn(`[fix-windows-native-links] Security check failed: ${relLink} is outside node_modules. Skipping.`);
      continue;
    }

    // Check if target directory exists
    if (!fs.existsSync(item.targetDir)) {
      console.log(`[fix-windows-native-links] Target directory ${relTarget} does not exist (package ${item.pkg} might not be installed). Skipping.`);
      continue;
    }

    // Check parent directory of link (e.g. android/)
    const parentDir = path.dirname(item.linkPath);
    if (!fs.existsSync(parentDir)) {
      console.log(`[fix-windows-native-links] Parent directory for ${relLink} does not exist. Skipping.`);
      continue;
    }

    // Check existing linkPath status
    let lstat = null;
    try {
      lstat = fs.lstatSync(item.linkPath);
    } catch (e) {
      // Does not exist, proceed to create
    }

    if (lstat) {
      if (lstat.isSymbolicLink()) {
        try {
          const currentTarget = fs.readlinkSync(item.linkPath);
          const resolvedCurrent = path.resolve(parentDir, currentTarget);
          const resolvedTarget = path.resolve(item.targetDir);

          if (resolvedCurrent.toLowerCase() === resolvedTarget.toLowerCase() && fs.existsSync(item.linkPath)) {
            console.log(`[fix-windows-native-links] Valid junction already exists: ${relLink} -> ${relTarget}.`);
            continue;
          }
        } catch (e) {
          // If readlink fails or link is broken, fall through to remove and recreate
        }

        // Remove stale/broken link
        try {
          fs.unlinkSync(item.linkPath);
        } catch (err) {
          try {
            fs.rmdirSync(item.linkPath);
          } catch (rmErr) {
            console.error(`[fix-windows-native-links] Could not remove stale link ${relLink}:`, rmErr.message);
            continue;
          }
        }
      } else if (lstat.isDirectory()) {
        // It's a real directory, not a junction
        console.log(`[fix-windows-native-links] Real directory already present at ${relLink}. Skipping.`);
        continue;
      }
    }

    // Create the junction
    try {
      fs.symlinkSync(path.resolve(item.targetDir), path.resolve(item.linkPath), 'junction');
      console.log(`[fix-windows-native-links] Successfully created junction: ${relLink} -> ${relTarget}`);
    } catch (err) {
      console.error(`[fix-windows-native-links] Failed to create junction for ${relLink}:`, err.message);
    }
  }

  console.log('[fix-windows-native-links] Windows native link setup complete.');
}

run();
