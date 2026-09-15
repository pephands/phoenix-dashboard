const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\tamiz\\.gemini\\antigravity-ide\\brain\\55954573-f5c4-4e41-b097-5e665cb75fd4';

async function run() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\tamiz\\AppData\\Local\\Temp\\chrome-marathon-test';

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--window-size=1440,900',
    'http://localhost:4202/login'
  ]);

  console.log('Started Chrome with PID:', chromeProc.pid);

  // Wait for remote debugging to be ready
  await new Promise(r => setTimeout(r, 2000));

  // Get websocket debugger URL
  const res = await fetch('http://127.0.0.1:9222/json/version');
  const ver = await res.json();
  const wsUrl = ver.webSocketDebuggerUrl;
  console.log('CDP WS URL:', wsUrl);

  const ws = new WebSocket(wsUrl);

  let id = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise(r => ws.onopen = r);
  console.log('Connected to CDP');

  // Create target/page
  const { targetId } = await send('Target.createTarget', { url: 'http://localhost:4202/login' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  function sendPage(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, sessionId, method, params }));
    });
  }

  await sendPage('Page.enable');
  await sendPage('Runtime.enable');
  await sendPage('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('Clearing auth storage to capture login screen...');
  await sendPage('Runtime.evaluate', { expression: 'localStorage.clear(); sessionStorage.clear();' });
  await sendPage('Page.navigate', { url: 'http://localhost:4202/login' });
  await new Promise(r => setTimeout(r, 2000));

  // Capture Login screenshot
  console.log('Capturing login screenshot...');
  const loginShot = await sendPage('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'login_screen.png'), Buffer.from(loginShot.data, 'base64'));
  console.log('Saved login_screen.png');

  // Inject auth token so dashboard & leads can be rendered
  console.log('Injecting session auth...');
  await sendPage('Runtime.evaluate', {
    expression: `
      localStorage.setItem('token', '33b070f6348bcf13cd7d1fe24a8ae0f5a1ed6ea7');
      localStorage.setItem('auth_token', '33b070f6348bcf13cd7d1fe24a8ae0f5a1ed6ea7');
      localStorage.setItem('auth_user', JSON.stringify({ id: 1, username: 'admin', email: 'admin@pinkmarathon.org' }));
      localStorage.setItem('user', JSON.stringify({ id: 1, username: 'admin', email: 'admin@pinkmarathon.org' }));
    `
  });

  // Navigate to /dashboard
  console.log('Navigating to dashboard...');
  await sendPage('Page.navigate', { url: 'http://localhost:4202/dashboard' });
  await new Promise(r => setTimeout(r, 2500));

  // Capture Dashboard screenshot
  console.log('Capturing dashboard screenshot...');
  const dashShot = await sendPage('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'dashboard_fullpage.png'), Buffer.from(dashShot.data, 'base64'));
  console.log('Saved dashboard_fullpage.png');

  // Navigate to /leads
  console.log('Navigating to leads...');
  await sendPage('Page.navigate', { url: 'http://localhost:4202/leads' });
  await new Promise(r => setTimeout(r, 2000));

  // Capture Leads screenshot
  console.log('Capturing leads screenshot...');
  const leadsShot = await sendPage('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'leads_desktop.png'), Buffer.from(leadsShot.data, 'base64'));
  console.log('Saved leads_desktop.png');

  // Open Lead Drawer
  console.log('Clicking lead row to open drawer...');
  await sendPage('Runtime.evaluate', {
    expression: `
      const row = document.querySelector('tbody tr');
      if (row) row.click();
    `
  });
  await new Promise(r => setTimeout(r, 1000));

  const drawerShot = await sendPage('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'leads_drawer.png'), Buffer.from(drawerShot.data, 'base64'));
  console.log('Saved leads_drawer.png');

  // Navigate to /lead-counts (New Role-Based Lead Counts Update Page)
  console.log('Navigating to lead-counts...');
  await sendPage('Page.navigate', { url: 'http://localhost:4202/lead-counts' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Capturing lead-counts screenshot...');
  const leadCountsShot = await sendPage('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'lead_counts_page.png'), Buffer.from(leadCountsShot.data, 'base64'));
  console.log('Saved lead_counts_page.png');

  // Mobile Viewport (375x812)
  console.log('Switching to mobile 375x812...');
  await sendPage('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 812,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sendPage('Page.navigate', { url: 'http://localhost:4202/dashboard' });
  await new Promise(r => setTimeout(r, 2000));

  const mobileShot = await sendPage('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'dashboard_mobile.png'), Buffer.from(mobileShot.data, 'base64'));
  console.log('Saved dashboard_mobile.png');

  ws.close();
  chromeProc.kill();
  console.log('All screenshots completed successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('Error running test_ui:', err);
  process.exit(1);
});
