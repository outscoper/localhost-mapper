// Types for Electron API

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

export interface ProxyEntry {
  hostname: string;
  targetPort: number;
  wsEnabled: boolean;
}

export type HealthIssueType = 'malformed_config' | 'missing_host_entry' | 'apache_config_error' | 'conflicting_config';

export interface HealthIssue {
  type: HealthIssueType;
  hostname: string;
  details: string;
  fixable: boolean;
}

export interface OperationResult {
  success: boolean;
  message?: string;
  error?: string;
  hosts?: HostEntry[];
  vhosts?: VirtualHost[];
  status?: ServerStatus;
  proxies?: ProxyEntry[];
  issues?: HealthIssue[];
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
  targetPort: number;
  localPort: number;
  active: boolean;
}
