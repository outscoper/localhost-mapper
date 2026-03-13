import { contextBridge, ipcRenderer } from 'electron';
import type { OperationResult, HostEntry, VirtualHost, ServerStatus, CreateVhostData, AddHostData, PortMapping } from './types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Hosts management
  getHosts: (): Promise<OperationResult> => ipcRenderer.invoke('get-hosts'),
  addHost: (data: AddHostData): Promise<OperationResult> => ipcRenderer.invoke('add-host', data),
  removeHost: (hostname: string): Promise<OperationResult> => ipcRenderer.invoke('remove-host', hostname),

  // Port proxy management
  getPortProxies: (): Promise<OperationResult> => ipcRenderer.invoke('get-port-proxies'),

  // Setup (one-time privileged helper install)
  checkSetup: (): Promise<{ complete: boolean }> => ipcRenderer.invoke('check-setup'),
  setupHelper: (): Promise<OperationResult> => ipcRenderer.invoke('setup-helper'),

  // Port proxy (Apache reverse proxy for hostname → port mapping)
  createPortProxy: (data: { hostname: string; targetPort: number }): Promise<OperationResult> => ipcRenderer.invoke('create-port-proxy', data),
  removePortProxy: (hostname: string): Promise<OperationResult> => ipcRenderer.invoke('remove-port-proxy', hostname),

  // Apache virtual hosts
  getApacheVhosts: (): Promise<OperationResult> => ipcRenderer.invoke('get-apache-vhosts'),
  createApacheVhost: (data: CreateVhostData): Promise<OperationResult> => ipcRenderer.invoke('create-apache-vhost', data),
  removeApacheVhost: (serverName: string): Promise<OperationResult> => ipcRenderer.invoke('remove-apache-vhost', serverName),

  // Nginx virtual hosts
  getNginxVhosts: (): Promise<OperationResult> => ipcRenderer.invoke('get-nginx-vhosts'),
  createNginxVhost: (data: CreateVhostData): Promise<OperationResult> => ipcRenderer.invoke('create-nginx-vhost', data),
  removeNginxVhost: (serverName: string): Promise<OperationResult> => ipcRenderer.invoke('remove-nginx-vhost', serverName),

  // Server control
  restartApache: (): Promise<OperationResult> => ipcRenderer.invoke('restart-apache'),
  restartNginx: (): Promise<OperationResult> => ipcRenderer.invoke('restart-nginx'),
  checkServerStatus: (): Promise<ServerStatus> => ipcRenderer.invoke('check-server-status'),

  // Utilities
  selectDirectory: (): Promise<{ canceled: boolean; filePaths: string[] }> => ipcRenderer.invoke('select-directory'),
  openBrowser: (url: string): Promise<void> => ipcRenderer.invoke('open-browser', url),
  getDefaultRoot: (): Promise<string> => ipcRenderer.invoke('get-default-root'),
});

// Type definitions for TypeScript in renderer
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
