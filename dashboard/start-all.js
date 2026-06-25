'use strict';

/**
 * One command to launch the whole stack:
 *   • the dashboard web server  (Node, long-running)
 *   • the Go health monitor      (long-running, prefers the prebuilt exe)
 *   • the C# log analyzer        (one-shot: builds report.html, then exits)
 *
 * Run with:  npm run start:all
 *
 * Each child's output is prefixed and colorized so you can tell them apart.
 * Ctrl-C cleanly tears every child down.
 */

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

// Load the project-root .env so every child (incl. the C# analyzer) inherits
// MONGO_URI and friends.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT = __dirname;
const isWin = process.platform === 'win32';

const COLORS = {
  DASHBOARD: '\x1b[35m', // magenta
  GO: '\x1b[36m',        // cyan
  CSHARP: '\x1b[33m',    // yellow
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

const children = [];

function launch(name, command, args, opts = {}) {
  const color = COLORS[name] || '';
  // On Windows we use a shell so "go"/"dotnet" resolve from PATH, but that means
  // a command path containing spaces (e.g. "New folder (7)") must be quoted.
  const useShell = isWin;
  const cmd = useShell && /\s/.test(command) ? `"${command}"` : command;
  const child = spawn(cmd, args, {
    cwd: opts.cwd || ROOT,
    env: { ...process.env, ...(opts.env || {}) },
    shell: useShell,
  });
  children.push(child);

  const prefix = `${color}[${name}]${COLORS.reset} `;
  const pipe = (stream, isErr) => {
    stream.setEncoding('utf8');
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        process[isErr ? 'stderr' : 'stdout'].write(prefix + line + '\n');
      }
    });
  };
  pipe(child.stdout, false);
  pipe(child.stderr, true);

  child.on('exit', (code) => {
    process.stdout.write(`${prefix}${COLORS.dim}exited with code ${code}${COLORS.reset}\n`);
  });
  child.on('error', (err) => {
    process.stdout.write(`${prefix}failed to start: ${err.message}\n`);
  });
  return child;
}

function goMonitorCommand() {
  const exe = path.join(ROOT, 'helpers', 'go-health', isWin ? 'healthmon.exe' : 'healthmon');
  if (fs.existsSync(exe)) return { command: exe, args: [] };
  // Fall back to `go run .` if the binary hasn't been built yet.
  return { command: 'go', args: ['run', '.'] };
}

function banner() {
  console.log('========================================================');
  console.log('  🌴 Kansas State Roleplay — full stack launcher');
  console.log('========================================================');
}

function main() {
  banner();

  const port = process.env.DASHBOARD_PORT || '3000';

  // 1. Dashboard web server.
  launch('DASHBOARD', 'node', ['server.js']);

  // 2. Go health monitor — watch the dashboard's /healthz.
  const go = goMonitorCommand();
  launch('GO', go.command, go.args, {
    cwd: path.join(ROOT, 'helpers', 'go-health'),
    env: { TARGETS: `dashboard=http://localhost:${port}/healthz` },
  });

  // 3. C# log analyzer — generate an initial report (one-shot).
  // Note: no extra flags after "run" — they'd be forwarded to the app as args.
  launch('CSHARP', 'dotnet', ['run', '-c', 'Release'], {
    cwd: path.join(ROOT, 'helpers', 'csharp-loganalyzer'),
  });

  console.log(`${COLORS.dim}Dashboard:  http://localhost:${port}${COLORS.reset}`);
  console.log(`${COLORS.dim}Health UI:  http://localhost:8090${COLORS.reset}`);
  console.log(`${COLORS.dim}Press Ctrl-C to stop everything.${COLORS.reset}\n`);
}

function shutdown() {
  console.log('\nShutting down…');
  for (const child of children) {
    try { child.kill('SIGTERM'); } catch { /* already gone */ }
  }
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main();
