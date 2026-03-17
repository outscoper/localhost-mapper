import { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import sudo from 'sudo-prompt';
import type { OperationResult, HealthIssue, HostEntry, VirtualHost, ServerStatus, CreateVhostData, AddHostData } from './types';

// ES Module polyfills for __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for file paths on macOS
const HOSTS_FILE = '/etc/hosts';
const APACHE_VHOSTS_DIR = '/etc/apache2/other/';
const NGINX_SITES_DIR = '/opt/homebrew/etc/nginx/servers/';
const NGINX_SITES_DIR_INTEL = '/usr/local/etc/nginx/servers/';

// Privileged helper — installed once, runs via NOPASSWD sudoers rule
const HELPER_PATH = '/usr/local/bin/localhost-mapper-helper';
const SUDOERS_PATH = '/etc/sudoers.d/localhost-mapper';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const appName = 'Virtual Host Manager';
const iconPath = path.join(__dirname, '../build/icon.icns');
const sudoOptions = {
  name: appName,
  icns: fs.existsSync(iconPath) ? iconPath : undefined
};

// Get correct nginx directory based on architecture
function getNginxSitesDir(): string {
  if (fs.existsSync(NGINX_SITES_DIR)) {
    return NGINX_SITES_DIR;
  }
  return NGINX_SITES_DIR_INTEL;
}

function createWindow(): void {
  // Resolve preload script path
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('Preload script path:', preloadPath);
  console.log('Preload exists:', fs.existsSync(preloadPath));
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
    icon: path.join(__dirname, '../build/icon.png'),
    show: false,
    vibrancy: 'under-window',
    visualEffectState: 'active'
  });
  
  // Debug: Log when window is ready
  mainWindow.webContents.on('dom-ready', () => {
    console.log('DOM ready, injecting test...');
    mainWindow?.webContents.executeJavaScript(`
      console.log('electronAPI available:', typeof window.electronAPI !== 'undefined');
    `);
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createApplicationMenu();
}

function createApplicationMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: appName,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray(): void {
  // Create a 16x16 template image for the tray
  const trayIcon = nativeImage.createEmpty();
  
  tray = new Tray(trayIcon);
  tray.setToolTip('Virtual Host Manager');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Virtual Host Manager',
      click: () => {
        if (mainWindow === null) {
          createWindow();
        } else {
          mainWindow.show();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Restart Apache',
      click: async () => {
        const result = await restartApache();
        console.log('Restart Apache:', result);
      }
    },
    {
      label: 'Restart Nginx',
      click: async () => {
        const result = await restartNginx();
        console.log('Restart Nginx:', result);
      }
    },
    { type: 'separator' },
    { role: 'quit' }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

// ============ HOSTS FILE MANAGEMENT ============

async function getHosts(): Promise<OperationResult> {
  try {
    const content = fs.readFileSync(HOSTS_FILE, 'utf8');
    const lines = content.split('\n');
    const hosts: HostEntry[] = [];

    lines.forEach((line, index) => {
      let trimmed = line.trim();
      
      // Skip empty lines and lines that start with #
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }
      
      // Remove inline comments (anything after #)
      const commentIndex = trimmed.indexOf('#');
      if (commentIndex !== -1) {
        trimmed = trimmed.substring(0, commentIndex).trim();
      }
      
      // Parse the line
      const parts = trimmed.split(/\s+/).filter(p => p.length > 0);
      
      if (parts.length < 2) {
        return; // Need at least IP and one hostname
      }
      
      const ip = parts[0];
      const hostnames = parts.slice(1);
      
      // Only include localhost entries
      if (ip === '127.0.0.1' || ip === '::1') {
        hostnames.forEach(hostname => {
          // Skip system hostnames and empty strings
          if (hostname && 
              hostname !== 'localhost' && 
              hostname !== 'localhost.localdomain' && 
              hostname !== 'broadcasthost' &&
              !hostname.startsWith('#')) {
            hosts.push({
              ip,
              hostname,
              lineNumber: index + 1,
              active: true
            });
          }
        });
      }
    });

    return { success: true, hosts };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function addHost(hostname: string, ip: string = '127.0.0.1', port?: number): Promise<OperationResult> {
  return new Promise((resolve) => {
    // Check if host already exists
    const checkCommand = `grep -q "${hostname}" ${HOSTS_FILE} && echo "EXISTS" || echo "NOT_EXISTS"`;
    
    sudo.exec(checkCommand, sudoOptions, (_err, stdout) => {
      if (stdout?.toString().trim() === 'EXISTS') {
        resolve({ success: false, error: `Host ${hostname} already exists` });
        return;
      }

      // Add host entry with optional port mapping comment
      let entry = `${ip}    ${hostname}`;
      if (port && port !== 80) {
        entry += `    # port:${port}`;
      }
      
      const command = `echo "${entry}" | sudo tee -a ${HOSTS_FILE} > /dev/null && echo "ADDED"`;
      
      sudo.exec(command, sudoOptions, (error) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          const message = port && port !== 80 
            ? `Host ${hostname} added successfully (mapped to port ${port})`
            : `Host ${hostname} added successfully`;
          resolve({ success: true, message });
        }
      });
    });
  });
}

async function removeHost(hostname: string): Promise<OperationResult> {
  return new Promise((resolve) => {
    // Remove lines containing the hostname (but not localhost)
    const command = `sed -i '' '/127\.0\.0\.1[[:space:]]\+${hostname}[[:space:]]*$/d' ${HOSTS_FILE}`;
    
    sudo.exec(command, sudoOptions, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true, message: `Host ${hostname} removed successfully` });
      }
    });
  });
}

// ============ APACHE VIRTUAL HOSTS ============

async function getApacheVhosts(): Promise<OperationResult> {
  try {
    const vhosts: VirtualHost[] = [];
    
    if (!fs.existsSync(APACHE_VHOSTS_DIR)) {
      return { success: true, vhosts: [], message: 'Apache vhosts directory not found' };
    }

    const files = fs.readdirSync(APACHE_VHOSTS_DIR);
    
    for (const file of files) {
      if (file.endsWith('.conf')) {
        const filePath = path.join(APACHE_VHOSTS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Parse VirtualHost entries
        const vhostRegex = /<VirtualHost\s+([^>]+)>([\s\S]*?)<\/VirtualHost>/gi;
        let match;
        
        while ((match = vhostRegex.exec(content)) !== null) {
          const vhostBlock = match[2];
          const serverNameMatch = vhostBlock.match(/ServerName\s+(\S+)/i);
          const documentRootMatch = vhostBlock.match(/DocumentRoot\s+"([^"]+)"/i);
          
          if (serverNameMatch) {
            vhosts.push({
              serverName: serverNameMatch[1],
              documentRoot: documentRootMatch ? documentRootMatch[1] : 'Unknown',
              configFile: file,
              port: match[1].includes(':') ? match[1].split(':')[1] : '80',
              type: 'apache'
            });
          }
        }
      }
    }

    return { success: true, vhosts };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function createApacheVhost(serverName: string, documentRoot: string, port: number = 80): Promise<OperationResult> {
  return new Promise((resolve) => {
    const vhostConfig = `<VirtualHost *:${port}>
    DocumentRoot "${documentRoot}"
    ServerName ${serverName}
    
    <Directory "${documentRoot}">
        Options Indexes FollowSymLinks MultiViews
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog "/private/var/log/apache2/${serverName}-error_log"
    CustomLog "/private/var/log/apache2/${serverName}-access_log" common
</VirtualHost>`;

    const configFileName = `${serverName}.conf`;
    const tempFile = `/tmp/${configFileName}`;
    
    fs.writeFileSync(tempFile, vhostConfig);
    
    const command = `mkdir -p "${documentRoot}" && cp "${tempFile}" "${APACHE_VHOSTS_DIR}${configFileName}" && chmod 644 "${APACHE_VHOSTS_DIR}${configFileName}" && rm "${tempFile}"`;
    
    sudo.exec(command, sudoOptions, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true, message: `Apache virtual host ${serverName} created successfully` });
      }
    });
  });
}

async function removeApacheVhost(serverName: string): Promise<OperationResult> {
  return new Promise((resolve) => {
    const configFile = path.join(APACHE_VHOSTS_DIR, `${serverName}.conf`);
    const command = `rm -f "${configFile}"`;
    
    sudo.exec(command, sudoOptions, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true, message: `Apache virtual host ${serverName} removed successfully` });
      }
    });
  });
}

// ============ NGINX VIRTUAL HOSTS ============

async function getNginxVhosts(): Promise<OperationResult> {
  try {
    const vhosts: VirtualHost[] = [];
    const nginxDir = getNginxSitesDir();
    
    if (!fs.existsSync(nginxDir)) {
      return { success: true, vhosts: [], message: 'Nginx sites directory not found' };
    }

    const files = fs.readdirSync(nginxDir);
    
    for (const file of files) {
      if (file.endsWith('.conf')) {
        const filePath = path.join(nginxDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Parse server blocks
        const serverRegex = /server\s*\{([\s\S]*?)\}/gi;
        let match;
        
        while ((match = serverRegex.exec(content)) !== null) {
          const serverBlock = match[1];
          const serverNameMatch = serverBlock.match(/server_name\s+([^;]+);/i);
          const rootMatch = serverBlock.match(/root\s+([^;]+);/i);
          const listenMatch = serverBlock.match(/listen\s+([^;]+);/i);
          
          if (serverNameMatch) {
            vhosts.push({
              serverName: serverNameMatch[1].trim().split(' ')[0],
              documentRoot: rootMatch ? rootMatch[1].trim() : 'Unknown',
              configFile: file,
              port: listenMatch ? listenMatch[1].trim() : '80',
              type: 'nginx'
            });
          }
        }
      }
    }

    return { success: true, vhosts };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function createNginxVhost(serverName: string, documentRoot: string, port: number = 80): Promise<OperationResult> {
  return new Promise((resolve) => {
    const nginxDir = getNginxSitesDir();
    
    const vhostConfig = `server {
    listen ${port};
    server_name ${serverName};
    root ${documentRoot};
    index index.html index.htm index.php;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ \\.php$ {
        include fastcgi_params;
        fastcgi_pass 127.0.0.1:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }

    error_log /usr/local/var/log/nginx/${serverName}-error.log;
    access_log /usr/local/var/log/nginx/${serverName}-access.log;
}`;

    const configFileName = `${serverName}.conf`;
    const tempFile = `/tmp/${configFileName}`;
    
    fs.writeFileSync(tempFile, vhostConfig);
    
    const command = `mkdir -p "${documentRoot}" && cp "${tempFile}" "${nginxDir}${configFileName}" && chmod 644 "${nginxDir}${configFileName}" && rm "${tempFile}"`;
    
    sudo.exec(command, sudoOptions, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true, message: `Nginx virtual host ${serverName} created successfully` });
      }
    });
  });
}

async function removeNginxVhost(serverName: string): Promise<OperationResult> {
  return new Promise((resolve) => {
    const nginxDir = getNginxSitesDir();
    const configFile = path.join(nginxDir, `${serverName}.conf`);
    const command = `rm -f "${configFile}"`;
    
    sudo.exec(command, sudoOptions, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true, message: `Nginx virtual host ${serverName} removed successfully` });
      }
    });
  });
}

// ============ PRIVILEGED HELPER SETUP ============
// Installs a helper script + sudoers rule (NOPASSWD) once.
// After setup, all proxy operations run via `sudo helper` with no dialog.

function isSafeHostname(hostname: string): boolean {
  return /^[a-zA-Z0-9]([a-zA-Z0-9\-\.]{0,61}[a-zA-Z0-9])?$/.test(hostname);
}

function isSetupComplete(): boolean {
  return fs.existsSync(HELPER_PATH) && fs.existsSync(SUDOERS_PATH);
}

function buildHelperScript(): string {
  // Built as array of lines to avoid JS template literal / bash variable conflicts
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    'VHOSTS_DIR="/etc/apache2/other"',
    'HTTPD_CONF="/etc/apache2/httpd.conf"',
    '',
    'validate_hostname() {',
    '  [[ "$1" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]{0,61}[a-zA-Z0-9])?$ ]] || { echo "Invalid hostname" >&2; exit 1; }',
    '}',
    'validate_port() {',
    '  [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge 1 ] && [ "$1" -le 65535 ] || { echo "Invalid port" >&2; exit 1; }',
    '}',
    '',
    'case "${1:-}" in',
    '  add)',
    '    H="${2:-}"; P="${3:-}"',
    '    validate_hostname "$H"; validate_port "$P"',
    '    /usr/bin/grep -qE "127\\.0\\.0\\.1[[:space:]]+${H}([[:space:]]|$)" /etc/hosts 2>/dev/null \\',
    "      || printf '\\n127.0.0.1    %s\\n' \"$H\" >> /etc/hosts",
    '    /usr/bin/sed -i \'\' \'s|#LoadModule proxy_module libexec|LoadModule proxy_module libexec|\' "$HTTPD_CONF"',
    '    /usr/bin/sed -i \'\' \'s|#LoadModule proxy_http_module libexec|LoadModule proxy_http_module libexec|\' "$HTTPD_CONF"',
    '    /usr/bin/sed -i \'\' \'s|#LoadModule proxy_wstunnel_module libexec|LoadModule proxy_wstunnel_module libexec|\' "$HTTPD_CONF"',
    '    /usr/bin/sed -i \'\' \'s|#LoadModule rewrite_module libexec|LoadModule rewrite_module libexec|\' "$HTTPD_CONF"',
    '    cat > "${VHOSTS_DIR}/${H}-proxy.conf" << VHOSTEOF',
    '<VirtualHost *:80>',
    '    ServerName ${H}',
    '    ProxyPreserveHost On',
    '    RewriteEngine on',
    '    RewriteCond %{HTTP:Upgrade} websocket [NC]',
    '    RewriteCond %{HTTP:Connection} upgrade [NC]',
    '    RewriteRule ^/?(.*) "ws://127.0.0.1:${P}/$1" [P,L]',
    '    ProxyPass / http://127.0.0.1:${P}/',
    '    ProxyPassReverse / http://127.0.0.1:${P}/',
    '</VirtualHost>',
    'VHOSTEOF',
    '    /bin/chmod 644 "${VHOSTS_DIR}/${H}-proxy.conf"',
    '    /usr/sbin/apachectl restart',
    '    ;;',
    '  remove)',
    '    H="${2:-}"',
    '    validate_hostname "$H"',
    '    /usr/bin/sed -i \'\' "/127\\.0\\.0\\.1[[:space:]]\\+${H}[[:space:]]*$/d" /etc/hosts',
    '    /bin/rm -f "${VHOSTS_DIR}/${H}-proxy.conf"',
    '    /usr/sbin/apachectl restart',
    '    ;;',
    '  *)',
    '    echo "Usage: $0 {add <hostname> <port>|remove <hostname>}" >&2; exit 1',
    '    ;;',
    'esac',
  ].join('\n') + '\n';
}

async function setupHelper(): Promise<OperationResult> {
  const helperContent = buildHelperScript();
  const helperTemp = '/tmp/localhost_mapper_helper_install';
  const setupScript = '/tmp/localhost_mapper_setup.sh';

  try {
    fs.writeFileSync(helperTemp, helperContent, { mode: 0o755 });
    fs.writeFileSync(setupScript, [
      '#!/bin/bash',
      'set -e',
      `cp "${helperTemp}" "${HELPER_PATH}"`,
      `chmod 755 "${HELPER_PATH}"`,
      `chown root:wheel "${HELPER_PATH}"`,
      `printf '%%admin ALL=(ALL) NOPASSWD: ${HELPER_PATH}\\n' > "${SUDOERS_PATH}"`,
      `chmod 440 "${SUDOERS_PATH}"`,
      `visudo -c -f "${SUDOERS_PATH}" || { rm -f "${SUDOERS_PATH}"; exit 1; }`,
      `rm -f "${helperTemp}"`,
    ].join('\n') + '\n', { mode: 0o755 });
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  return new Promise((resolve) => {
    sudo.exec(`/bin/bash "${setupScript}"`, sudoOptions, (error, _stdout, stderr) => {
      try { fs.unlinkSync(setupScript); } catch (_) { /* ignore */ }
      if (error) {
        const msg = stderr?.toString().trim() || error.message;
        resolve({ success: false, error: msg });
      } else {
        resolve({ success: true, message: 'Helper installed. No more password prompts needed.' });
      }
    });
  });
}

// ============ PORT PROXY (Apache reverse proxy) ============

function buildProxyVhostConfigContent(hostname: string, port: number): string {
  return [
    '<VirtualHost *:80>',
    `    ServerName ${hostname}`,
    '    ProxyPreserveHost On',
    '    RewriteEngine on',
    '    RewriteCond %{HTTP:Upgrade} websocket [NC]',
    '    RewriteCond %{HTTP:Connection} upgrade [NC]',
    `    RewriteRule ^/?(.*) "ws://127.0.0.1:${port}/$1" [P,L]`,
    `    ProxyPass / http://127.0.0.1:${port}/`,
    `    ProxyPassReverse / http://127.0.0.1:${port}/`,
    '</VirtualHost>',
  ].join('\n') + '\n';
}


async function ensureSetup(): Promise<OperationResult> {
  if (isSetupComplete()) return { success: true };
  return setupHelper();
}

function runHelper(...args: string[]): Promise<OperationResult> {
  const safeArgs = args.map(a => `"${a}"`).join(' ');
  return new Promise((resolve) => {
    exec(`sudo "${HELPER_PATH}" ${safeArgs}`, (error, _stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr?.trim() || error.message });
      } else {
        resolve({ success: true });
      }
    });
  });
}

async function createPortProxy(hostname: string, targetPort: number): Promise<OperationResult> {
  if (!isSafeHostname(hostname)) {
    return { success: false, error: 'Invalid hostname: only letters, numbers, dots, and hyphens allowed' };
  }
  if (!Number.isInteger(targetPort) || targetPort < 1 || targetPort > 65535) {
    return { success: false, error: 'Invalid port number' };
  }
  const setup = await ensureSetup();
  if (!setup.success) return setup;

  const result = await runHelper('add', hostname, String(targetPort));
  return result.success
    ? { success: true, message: `Proxy created: http://${hostname} → localhost:${targetPort}` }
    : result;
}

async function removePortProxy(hostname: string): Promise<OperationResult> {
  if (!isSafeHostname(hostname)) {
    return { success: false, error: 'Invalid hostname' };
  }

  // If helper is installed: silent, no dialog
  if (isSetupComplete()) {
    const result = await runHelper('remove', hostname);
    return result.success ? { success: true, message: `Proxy removed: ${hostname}` } : result;
  }

  // Fallback: direct sudo-prompt script (works even without helper)
  const configFile = path.join(APACHE_VHOSTS_DIR, `${hostname}-proxy.conf`);
  const scriptPath = `/tmp/localhost_mapper_rm_${hostname}.sh`;
  const script = [
    '#!/bin/bash',
    'set -e',
    `/usr/bin/sed -i '' '/127\\.0\\.0\\.1[[:space:]]\\+${hostname}[[:space:]]*$/d' /etc/hosts`,
    `/bin/rm -f "${configFile}"`,
    '/usr/sbin/apachectl restart',
  ].join('\n') + '\n';

  try {
    fs.writeFileSync(scriptPath, script, { mode: 0o755 });
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  return new Promise((resolve) => {
    sudo.exec(`/bin/bash "${scriptPath}"`, sudoOptions, (error, _stdout, stderr) => {
      try { fs.unlinkSync(scriptPath); } catch (_) { /* ignore */ }
      if (error) {
        resolve({ success: false, error: stderr?.toString().trim() || error.message });
      } else {
        resolve({ success: true, message: `Proxy removed: ${hostname}` });
      }
    });
  });
}

// Read actual proxy configs from Apache vhost files (source of truth)
function getPortProxies(): OperationResult {
  try {
    if (!fs.existsSync(APACHE_VHOSTS_DIR)) {
      return { success: true, proxies: [] };
    }
    const proxies: Array<{ hostname: string; targetPort: number }> = [];
    for (const file of fs.readdirSync(APACHE_VHOSTS_DIR)) {
      if (!file.endsWith('-proxy.conf')) continue;
      const content = fs.readFileSync(path.join(APACHE_VHOSTS_DIR, file), 'utf8');
      const serverName = content.match(/ServerName\s+(\S+)/i)?.[1];
      const port = content.match(/ProxyPass\s+\/\s+http:\/\/127\.0\.0\.1:(\d+)\//i)?.[1];
      if (serverName && port) {
        proxies.push({ hostname: serverName, targetPort: parseInt(port), wsEnabled: content.includes('RewriteEngine') });
      }
    }
    return { success: true, proxies };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

async function migratePortProxies(): Promise<OperationResult> {
  const result = getPortProxies();
  if (!result.success || !result.proxies) return result;

  const needsMigration = result.proxies.filter(p => !p.wsEnabled);
  if (needsMigration.length === 0) {
    return { success: true, message: 'All configs already support WebSocket' };
  }

  const scriptLines = ['#!/bin/bash', 'set -e'];

  // All hostnames are pre-validated by isSafeHostname — alphanumeric, dots, hyphens only
  for (const proxy of needsMigration) {
    const tempFile = `/tmp/${proxy.hostname}-proxy-ws.conf`;
    try {
      fs.writeFileSync(tempFile, buildProxyVhostConfigContent(proxy.hostname, proxy.targetPort));
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
    scriptLines.push(`cp "${tempFile}" "${APACHE_VHOSTS_DIR}${proxy.hostname}-proxy.conf"`);
    scriptLines.push(`chmod 644 "${APACHE_VHOSTS_DIR}${proxy.hostname}-proxy.conf"`);
    scriptLines.push(`rm -f "${tempFile}"`);
  }

  scriptLines.push('/usr/sbin/apachectl restart');

  const scriptPath = '/tmp/localhost_mapper_migrate_ws.sh';
  try {
    fs.writeFileSync(scriptPath, scriptLines.join('\n') + '\n', { mode: 0o755 });
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  return new Promise((resolve) => {
    sudo.exec(`/bin/bash "${scriptPath}"`, sudoOptions, (error, _stdout, stderr) => {
      try { fs.unlinkSync(scriptPath); } catch (_) { /* ignore */ }
      if (error) {
        resolve({ success: false, error: stderr?.toString().trim() || error.message });
      } else {
        resolve({ success: true, message: `Migrated ${needsMigration.length} config(s) with WebSocket support` });
      }
    });
  });
}

// ============ PROXY HEALTH CHECK ============

async function checkProxyHealth(): Promise<OperationResult> {
  const issues: HealthIssue[] = [];

  if (!fs.existsSync(APACHE_VHOSTS_DIR)) {
    return { success: true, issues: [] };
  }

  let hostsContent = '';
  try {
    hostsContent = fs.readFileSync(HOSTS_FILE, 'utf8');
  } catch (_) { /* if we can't read hosts, skip those checks */ }

  // Collect ServerNames from our proxy configs to detect external conflicts
  const ourServerNames = new Set<string>();

  // --- Scan our proxy configs ---
  for (const file of fs.readdirSync(APACHE_VHOSTS_DIR)) {
    if (!file.endsWith('-proxy.conf')) continue;

    let content: string;
    try {
      content = fs.readFileSync(path.join(APACHE_VHOSTS_DIR, file), 'utf8');
    } catch (_) {
      issues.push({ type: 'malformed_config', hostname: file.replace('-proxy.conf', ''), details: 'Cannot read config file', fixable: false });
      continue;
    }

    const serverName = content.match(/ServerName\s+(\S+)/i)?.[1];
    const port = content.match(/ProxyPass\s+\/\s+http:\/\/127\.0\.0\.1:(\d+)\//i)?.[1];

    if (!serverName || !port) {
      issues.push({ type: 'malformed_config', hostname: file.replace('-proxy.conf', ''), details: 'Missing ServerName or ProxyPass — config may be from an older install', fixable: false });
      continue;
    }

    ourServerNames.add(serverName);

    // Check /etc/hosts entry
    if (hostsContent) {
      const escaped = serverName.replace(/\./g, '\\.');
      const pattern = new RegExp(`127\\.0\\.0\\.1[\\t ]+${escaped}([\\t ]|$)`, 'm');
      if (!pattern.test(hostsContent)) {
        issues.push({ type: 'missing_host_entry', hostname: serverName, details: `/etc/hosts entry missing for ${serverName} (port ${port})`, fixable: true });
      }
    }
  }

  // --- Scan non-app configs for conflicts ---
  for (const file of fs.readdirSync(APACHE_VHOSTS_DIR)) {
    if (file.endsWith('-proxy.conf')) continue; // already handled
    if (!file.endsWith('.conf')) continue;

    let content: string;
    try {
      content = fs.readFileSync(path.join(APACHE_VHOSTS_DIR, file), 'utf8');
    } catch (_) { continue; }

    const serverNameRegex = /ServerName\s+(\S+)/gi;
    let match: RegExpExecArray | null;
    while ((match = serverNameRegex.exec(content)) !== null) {
      const name = match[1];
      if (ourServerNames.has(name)) {
        issues.push({ type: 'conflicting_config', hostname: name, details: `Pre-existing config "${file}" uses the same ServerName — may override your mapping`, fixable: false });
      }
    }
  }

  // --- Apache config syntax test ---
  const apacheOk = await new Promise<{ ok: boolean; output: string }>((resolve) => {
    exec('apachectl configtest 2>&1', (error, stdout, stderr) => {
      const output = (stdout || stderr || '').trim();
      resolve({ ok: !error, output });
    });
  });

  if (!apacheOk.ok) {
    issues.push({ type: 'apache_config_error', hostname: '', details: apacheOk.output || 'Apache config syntax test failed', fixable: false });
  }

  return { success: true, issues };
}

async function fixProxyIssues(): Promise<OperationResult> {
  const healthResult = await checkProxyHealth();
  if (!healthResult.success || !healthResult.issues) return healthResult;

  const fixable = healthResult.issues.filter(i => i.fixable && i.type === 'missing_host_entry');
  if (fixable.length === 0) {
    return { success: true, message: 'No auto-fixable issues found' };
  }

  const scriptLines = ['#!/bin/bash', 'set -e'];
  for (const issue of fixable) {
    // isSafeHostname validated — only alphanumeric, dots, hyphens
    const escaped = issue.hostname.replace(/\./g, '\\.');
    scriptLines.push(
      `/usr/bin/grep -qE "127\\.0\\.0\\.1[[:space:]]+${escaped}([[:space:]]|$)" /etc/hosts 2>/dev/null || printf '\\n127.0.0.1    ${issue.hostname}\\n' >> /etc/hosts`
    );
  }
  scriptLines.push('/usr/sbin/apachectl restart');

  const scriptPath = '/tmp/localhost_mapper_fix_health.sh';
  try {
    fs.writeFileSync(scriptPath, scriptLines.join('\n') + '\n', { mode: 0o755 });
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  return new Promise((resolve) => {
    sudo.exec(`/bin/bash "${scriptPath}"`, sudoOptions, (error, _stdout, stderr) => {
      try { fs.unlinkSync(scriptPath); } catch (_) { /* ignore */ }
      if (error) {
        resolve({ success: false, error: stderr?.toString().trim() || error.message });
      } else {
        resolve({ success: true, message: `Fixed ${fixable.length} issue(s) and restarted Apache` });
      }
    });
  });
}

// ============ SERVER CONTROL ============

async function restartApache(): Promise<OperationResult> {
  return new Promise((resolve) => {
    const command = 'apachectl restart';
    
    sudo.exec(command, sudoOptions, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true, message: 'Apache restarted successfully' });
      }
    });
  });
}

async function restartNginx(): Promise<OperationResult> {
  return new Promise((resolve) => {
    const command = 'nginx -s reload';
    
    sudo.exec(command, sudoOptions, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true, message: 'Nginx reloaded successfully' });
      }
    });
  });
}

async function checkServerStatus(): Promise<ServerStatus> {
  return new Promise((resolve) => {
    const results: ServerStatus = {
      apache: false,
      nginx: false
    };

    exec('pgrep -x httpd || pgrep -x apache2', (error) => {
      results.apache = !error;
      
      exec('pgrep -x nginx', (error) => {
        results.nginx = !error;
        resolve(results);
      });
    });
  });
}

// ============ IPC HANDLERS ============

ipcMain.handle('get-hosts', async (): Promise<OperationResult> => {
  return await getHosts();
});

ipcMain.handle('add-host', async (_event, data: AddHostData): Promise<OperationResult> => {
  return await addHost(data.hostname, data.ip, data.port);
});

ipcMain.handle('remove-host', async (_event, hostname: string): Promise<OperationResult> => {
  return await removeHost(hostname);
});

ipcMain.handle('get-apache-vhosts', async (): Promise<OperationResult> => {
  return await getApacheVhosts();
});

ipcMain.handle('create-apache-vhost', async (_event, data: CreateVhostData): Promise<OperationResult> => {
  return await createApacheVhost(data.serverName, data.documentRoot, data.port);
});

ipcMain.handle('remove-apache-vhost', async (_event, serverName: string): Promise<OperationResult> => {
  return await removeApacheVhost(serverName);
});

ipcMain.handle('get-nginx-vhosts', async (): Promise<OperationResult> => {
  return await getNginxVhosts();
});

ipcMain.handle('create-nginx-vhost', async (_event, data: CreateVhostData): Promise<OperationResult> => {
  return await createNginxVhost(data.serverName, data.documentRoot, data.port);
});

ipcMain.handle('remove-nginx-vhost', async (_event, serverName: string): Promise<OperationResult> => {
  return await removeNginxVhost(serverName);
});

ipcMain.handle('get-port-proxies', async (): Promise<OperationResult> => {
  return getPortProxies();
});

ipcMain.handle('check-setup', async (): Promise<{ complete: boolean }> => {
  return { complete: isSetupComplete() };
});

ipcMain.handle('setup-helper', async (): Promise<OperationResult> => {
  return await setupHelper();
});

ipcMain.handle('create-port-proxy', async (_event, data: { hostname: string; targetPort: number }): Promise<OperationResult> => {
  return await createPortProxy(data.hostname, data.targetPort);
});

ipcMain.handle('remove-port-proxy', async (_event, hostname: string): Promise<OperationResult> => {
  return await removePortProxy(hostname);
});

ipcMain.handle('migrate-port-proxies', async (): Promise<OperationResult> => {
  return await migratePortProxies();
});

ipcMain.handle('check-proxy-health', async (): Promise<OperationResult> => {
  return await checkProxyHealth();
});

ipcMain.handle('fix-proxy-issues', async (): Promise<OperationResult> => {
  return await fixProxyIssues();
});

ipcMain.handle('restart-apache', async (): Promise<OperationResult> => {
  return await restartApache();
});

ipcMain.handle('restart-nginx', async (): Promise<OperationResult> => {
  return await restartNginx();
});

ipcMain.handle('check-server-status', async (): Promise<ServerStatus> => {
  return await checkServerStatus();
});

ipcMain.handle('select-directory', async (): Promise<{ canceled: boolean; filePaths: string[] }> => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  });
  return result;
});

ipcMain.handle('open-browser', async (_event, url: string): Promise<void> => {
  shell.openExternal(url);
});

ipcMain.handle('get-default-root', async (): Promise<string> => {
  return path.join(process.env.HOME || '/Users', 'Sites');
});

// ============ APP EVENTS ============

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (tray) {
    tray.destroy();
  }
});
