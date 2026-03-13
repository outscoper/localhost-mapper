export interface HostEntry {
  ip: string;
  hostname: string;
  lineNumber: number;
  active: boolean;
}

export interface VirtualHost {
  serverName: string;
  documentRoot: string;
  configFile: string;
  port: string;
  type: 'apache' | 'nginx';
}

export interface ServerStatus {
  apache: boolean;
  nginx: boolean;
}

export interface OperationResult {
  success: boolean;
  message?: string;
  error?: string;
  hosts?: HostEntry[];
  vhosts?: VirtualHost[];
  status?: ServerStatus;
}

export interface CreateVhostData {
  serverName: string;
  documentRoot: string;
  port?: number;
}

export interface AddHostData {
  hostname: string;
  ip?: string;
  port?: number;
}

// Port mapping for localhost
export interface PortMapping {
  id: string;
  hostname: string;
  targetIp: string;      // Target IP address (default: 127.0.0.1)
  targetPort: number;    // Target port
  localPort: number;     // Display port
  active: boolean;
  description?: string;
}

