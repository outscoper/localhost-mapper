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

export interface PortMapping {
  id: string;
  hostname: string;
  targetIp: string;
  targetPort: number;
  localPort: number;
  active: boolean;
  description?: string;
}

declare global {
  interface Window {
    electronAPI: {
      getHosts: () => Promise<OperationResult>;
      addHost: (data: AddHostData) => Promise<OperationResult>;
      removeHost: (hostname: string) => Promise<OperationResult>;
      getPortProxies: () => Promise<OperationResult>;
      checkSetup: () => Promise<{ complete: boolean }>;
      setupHelper: () => Promise<OperationResult>;
      createPortProxy: (data: { hostname: string; targetPort: number }) => Promise<OperationResult>;
      removePortProxy: (hostname: string) => Promise<OperationResult>;
      migratePortProxies: () => Promise<OperationResult>;
      checkProxyHealth: () => Promise<OperationResult>;
      fixProxyIssues: () => Promise<OperationResult>;
      getApacheVhosts: () => Promise<OperationResult>;
      createApacheVhost: (data: CreateVhostData) => Promise<OperationResult>;
      removeApacheVhost: (serverName: string) => Promise<OperationResult>;
      getNginxVhosts: () => Promise<OperationResult>;
      createNginxVhost: (data: CreateVhostData) => Promise<OperationResult>;
      removeNginxVhost: (serverName: string) => Promise<OperationResult>;
      restartApache: () => Promise<OperationResult>;
      restartNginx: () => Promise<OperationResult>;
      checkServerStatus: () => Promise<ServerStatus>;
      selectDirectory: () => Promise<{ canceled: boolean; filePaths: string[] }>;
      openBrowser: (url: string) => Promise<void>;
      getDefaultRoot: () => Promise<string>;
    };
  }
}

export {};
