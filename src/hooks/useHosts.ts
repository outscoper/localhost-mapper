import { useState, useEffect, useCallback, useRef } from 'react';
import type { HostEntry, VirtualHost, ServerStatus } from '../types';
import { getElectronAPI } from '../utils/electron';

// Singleton cache for hosts data
let hostsCache: HostEntry[] | null = null;
let lastFetch = 0;
const CACHE_DURATION = 5000; // 5 seconds

export function useHosts() {
  const [hosts, setHosts] = useState<HostEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadHosts = useCallback(async (force = false) => {
    // Use cache if available and not expired
    if (!force && hostsCache && Date.now() - lastFetch < CACHE_DURATION) {
      setHosts(hostsCache);
      return { success: true, hosts: hostsCache };
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    try {
      const result = await getElectronAPI().getHosts();
      if (result.success && result.hosts) {
        hostsCache = result.hosts;
        lastFetch = Date.now();
        setHosts(result.hosts);
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const addHost = useCallback(async (hostname: string, ip: string = '127.0.0.1', port?: number) => {
    setLoading(true);
    try {
      const result = await getElectronAPI().addHost({ hostname, ip, port });
      if (result.success) {
        hostsCache = null; // Invalidate cache
        await loadHosts(true);
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, [loadHosts]);

  const removeHost = useCallback(async (hostname: string) => {
    setLoading(true);
    try {
      const result = await getElectronAPI().removeHost(hostname);
      if (result.success) {
        hostsCache = null; // Invalidate cache
        await loadHosts(true);
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, [loadHosts]);

  useEffect(() => {
    loadHosts();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadHosts]);

  return { hosts, loading, loadHosts, addHost, removeHost };
}

// Cache for virtual hosts
let apacheCache: VirtualHost[] | null = null;
let nginxCache: VirtualHost[] | null = null;
let lastApacheFetch = 0;
let lastNginxFetch = 0;

export function useVirtualHosts(type: 'apache' | 'nginx') {
  const [vhosts, setVhosts] = useState<VirtualHost[]>([]);
  const [loading, setLoading] = useState(false);

  const loadVhosts = useCallback(async (force = false) => {
    const cache = type === 'apache' ? apacheCache : nginxCache;
    const lastFetch = type === 'apache' ? lastApacheFetch : lastNginxFetch;

    if (!force && cache && Date.now() - lastFetch < CACHE_DURATION) {
      setVhosts(cache);
      return { success: true, vhosts: cache };
    }

    setLoading(true);
    try {
      const result = type === 'apache' 
        ? await getElectronAPI().getApacheVhosts()
        : await getElectronAPI().getNginxVhosts();
        
      if (result.success && result.vhosts) {
        if (type === 'apache') {
          apacheCache = result.vhosts;
          lastApacheFetch = Date.now();
        } else {
          nginxCache = result.vhosts;
          lastNginxFetch = Date.now();
        }
        setVhosts(result.vhosts);
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, [type]);

  const createVhost = useCallback(async (data: { serverName: string; documentRoot: string; port?: number }) => {
    setLoading(true);
    try {
      const result = type === 'apache'
        ? await getElectronAPI().createApacheVhost(data)
        : await getElectronAPI().createNginxVhost(data);
      if (result.success) {
        if (type === 'apache') apacheCache = null;
        else nginxCache = null;
        await loadVhosts(true);
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, [type, loadVhosts]);

  const removeVhost = useCallback(async (serverName: string) => {
    setLoading(true);
    try {
      const result = type === 'apache'
        ? await getElectronAPI().removeApacheVhost(serverName)
        : await getElectronAPI().removeNginxVhost(serverName);
      if (result.success) {
        if (type === 'apache') apacheCache = null;
        else nginxCache = null;
        await loadVhosts(true);
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, [type, loadVhosts]);

  useEffect(() => {
    loadVhosts();
  }, [loadVhosts]);

  return { vhosts, loading, loadVhosts, createVhost, removeVhost };
}

export function useServerStatus(interval = 10000) {
  const [status, setStatus] = useState<ServerStatus>({ apache: false, nginx: false });
  const [loading, setLoading] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const result = await getElectronAPI().checkServerStatus();
      setStatus(result);
      return result;
    } catch (error) {
      console.error('Failed to check status:', error);
      return null;
    }
  }, []);

  const restartApache = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getElectronAPI().restartApache();
      setTimeout(checkStatus, 1000);
      return result;
    } finally {
      setLoading(false);
    }
  }, [checkStatus]);

  const restartNginx = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getElectronAPI().restartNginx();
      setTimeout(checkStatus, 1000);
      return result;
    } finally {
      setLoading(false);
    }
  }, [checkStatus]);

  useEffect(() => {
    checkStatus();
    const timer = setInterval(checkStatus, interval);
    return () => clearInterval(timer);
  }, [checkStatus, interval]);

  return { status, loading, checkStatus, restartApache, restartNginx };
}
