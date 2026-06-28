const { spawn } = require('child_process');
const path = require('path');

console.log('\x1b[36m%s\x1b[0m', '==================================================');
console.log('\x1b[36m%s\x1b[0m', '   Starting EasyBiz AI Full-Stack Application...   ');
console.log('\x1b[36m%s\x1b[0m', '==================================================');

// Start Backend (FastAPI)
const backendProcess = spawn(
  process.platform === 'win32' ? '.\\venv\\Scripts\\python.exe' : './venv/bin/python',
  ['-m', 'uvicorn', 'app.main:app', '--port', '8000'],
  {
    cwd: path.join(__dirname, 'backend'),
    shell: true,
    stdio: 'inherit'
  }
);

backendProcess.on('error', (err) => {
  console.error('\x1b[31m%s\x1b[0m', 'Failed to start backend process:', err);
});

// Start Frontend (Next.js)
const frontendProcess = spawn(
  'npm',
  ['run', 'dev'],
  {
    cwd: path.join(__dirname, 'frontend'),
    shell: true,
    stdio: 'inherit'
  }
);

frontendProcess.on('error', (err) => {
  console.error('\x1b[31m%s\x1b[0m', 'Failed to start frontend process:', err);
});

// Handle graceful termination
const killProcesses = () => {
  console.log('\x1b[33m%s\x1b[0m', '\nStopping all EasyBiz AI services...');
  if (process.platform === 'win32') {
    // On Windows, spawned processes in shell might not die with simple .kill()
    const { exec } = require('child_process');
    if (backendProcess && backendProcess.pid) {
      exec(`taskkill /pid ${backendProcess.pid} /T /F`, () => {});
    }
    if (frontendProcess && frontendProcess.pid) {
      exec(`taskkill /pid ${frontendProcess.pid} /T /F`, () => {});
    }
  } else {
    if (backendProcess) backendProcess.kill();
    if (frontendProcess) frontendProcess.kill();
  }
  process.exit();
};

process.on('SIGINT', killProcesses);
process.on('SIGTERM', killProcesses);
