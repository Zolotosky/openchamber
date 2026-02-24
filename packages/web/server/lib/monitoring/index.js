import { exec } from 'child_process';

const SERVERS_CONFIG = [
  { id: 'aiko',   ip: '192.168.0.176', name: 'AI Brain',        role: 'Router, OpenCode, Cabinet', icon: 'cpu' },
  { id: 'proxy',  ip: '192.168.0.178', name: 'Proxy',           role: 'Xray, Cloudflare Tunnel',   icon: 'shield' },
  { id: 'qdrant', ip: '192.168.0.180', name: 'Qdrant',          role: 'Vector DB, Embedding',      icon: 'database' },
  { id: 'zabbix', ip: '192.168.0.181', name: 'Zabbix',          role: 'Monitoring',                icon: 'bar-chart' },
  { id: 'ha',     ip: '192.168.0.185', name: 'Home Assistant',   role: 'Smart Home, Alice',        icon: 'home' },
];

const LOCAL_IP = '192.168.0.176';
const SSH_TIMEOUT = 5;
const EXEC_TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 15_000;

let cachedResult = null;
let cacheTimestamp = 0;

const execPromise = (cmd, timeoutMs = EXEC_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const child = exec(cmd, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    });
    // Safety net: kill if still alive after timeout
    setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
    }, timeoutMs + 1000);
  });

const pingServer = async (ip) => {
  try {
    await execPromise(`ping -c 1 -W 2000 ${ip}`, 4000);
    return true;
  } catch {
    return false;
  }
};

const makeEmptyMetrics = (server) => ({
  id: server.id,
  name: server.name,
  ip: server.ip,
  role: server.role,
  icon: server.icon,
  online: false,
  cpu: 0,
  ram_percent: 0,
  ram_used: 0,
  ram_total: 0,
  disk_percent: 0,
  disk_used: 0,
  disk_total: 0,
  uptime: 'N/A',
});

const metricsCommand = "top -bn1 | grep 'Cpu(s)' | awk '{print $2}'; free -b | awk '/Mem/{print $2, $3}'; df -B1 / | awk 'NR==2{print $2, $3, $5}'; uptime -p";

const buildSshCommand = (server) => {
  // Escape single quotes in the command for shell execution
  const escapedCmd = metricsCommand.replace(/'/g, "'\\''");
  if (server.ip === '192.168.0.185') {
    // HA uses root with key
    return `ssh -o ConnectTimeout=${SSH_TIMEOUT} -o StrictHostKeyChecking=no -i /home/aiko/.ssh/id_ed25519 root@${server.ip} '${escapedCmd}'`;
  }
  return `ssh -o ConnectTimeout=${SSH_TIMEOUT} -o StrictHostKeyChecking=no aiko@${server.ip} '${escapedCmd}'`;
};

const parseMetricsOutput = (stdout, server) => {
  const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3) {
    return makeEmptyMetrics(server);
  }

  // Line 1: CPU percentage
  const cpu = parseFloat(lines[0]) || 0;

  // Line 2: ram_total ram_used (bytes)
  const ramParts = lines[1].split(/\s+/);
  const ramTotalBytes = parseInt(ramParts[0], 10) || 0;
  const ramUsedBytes = parseInt(ramParts[1], 10) || 0;
  const GB = 1024 ** 3;
  const ramTotal = Math.round((ramTotalBytes / GB) * 10) / 10;
  const ramUsed = Math.round((ramUsedBytes / GB) * 10) / 10;
  const ramPercent = ramTotal > 0 ? Math.round((ramUsed / ramTotal) * 1000) / 10 : 0;

  // Line 3: disk_total disk_used disk_percent
  const diskParts = lines[2].split(/\s+/);
  const diskTotalBytes = parseInt(diskParts[0], 10) || 0;
  const diskUsedBytes = parseInt(diskParts[1], 10) || 0;
  const diskPercentRaw = diskParts[2] ? parseInt(diskParts[2].replace('%', ''), 10) : 0;
  const diskTotal = Math.round((diskTotalBytes / GB) * 10) / 10;
  const diskUsed = Math.round((diskUsedBytes / GB) * 10) / 10;
  const diskPercent = diskPercentRaw || 0;

  // Line 4: uptime string
  let uptime = 'N/A';
  if (lines.length >= 4) {
    uptime = lines[3].replace(/^up\s+/i, '').trim() || 'N/A';
  }

  return {
    id: server.id,
    name: server.name,
    ip: server.ip,
    role: server.role,
    icon: server.icon,
    online: true,
    cpu: Math.round(cpu * 10) / 10,
    ram_percent: ramPercent,
    ram_used: ramUsed,
    ram_total: ramTotal,
    disk_percent: diskPercent,
    disk_used: diskUsed,
    disk_total: diskTotal,
    uptime,
  };
};

const getServerMetrics = async (server) => {
  try {
    const online = await pingServer(server.ip);
    if (!online) {
      return makeEmptyMetrics(server);
    }

    let cmd;
    if (server.ip === LOCAL_IP) {
      // Local server — execute directly
      cmd = metricsCommand;
    } else {
      cmd = buildSshCommand(server);
    }

    const { stdout } = await execPromise(cmd);
    return parseMetricsOutput(stdout, server);
  } catch (error) {
    console.warn(`[monitoring] Failed to collect metrics for ${server.name} (${server.ip}):`, error?.message || error);
    return makeEmptyMetrics(server);
  }
};

const collectAllMetrics = async () => {
  const results = await Promise.allSettled(
    SERVERS_CONFIG.map((server) => getServerMetrics(server))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return makeEmptyMetrics(SERVERS_CONFIG[index]);
  });
};

export async function getServersMetrics() {
  const now = Date.now();
  if (cachedResult && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedResult;
  }
  const result = await collectAllMetrics();
  cachedResult = result;
  cacheTimestamp = now;
  return result;
}
