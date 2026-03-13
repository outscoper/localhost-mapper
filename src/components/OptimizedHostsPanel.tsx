import { memo, useState, useCallback, useMemo } from 'react';
import { 
  Globe, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Check, 
  Search,
  ExternalLink
} from 'lucide-react';
import { useHosts } from '../hooks/useHosts';
import { useDebounce } from '../hooks/useDebounce';
import { getElectronAPI } from '../utils/electron';
import { ToastContainer, type ToastItem } from './Toast';

const HostRow = memo(function HostRow({ 
  host, 
  index, 
  onRemove 
}: { 
  host: { ip: string; hostname: string }; 
  index: number; 
  onRemove: (hostname: string) => void;
}) {
  const handleRemove = useCallback(() => {
    onRemove(host.hostname);
  }, [host.hostname, onRemove]);

  const handleOpen = useCallback(() => {
    getElectronAPI().openBrowser(`http://${host.hostname}`);
  }, [host.hostname]);

  return (
    <tr
      className="group animate-fadeIn"
      style={{ animationDelay: `${Math.min(index * 20, 300)}ms` }}
    >
      <td className="py-3">
        <div className="flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
        </div>
      </td>
      <td className="py-3">
        <div className="flex items-center space-x-3">
          <span className="font-medium text-slate-200">{host.hostname}</span>
          <button
            onClick={handleOpen}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-cyan-500/20 text-cyan-400 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </td>
      <td className="py-3">
        <code className="px-2 py-1 rounded bg-slate-800/50 text-cyan-400 text-sm font-mono">
          {host.ip}
        </code>
      </td>
      <td className="py-3">
        <button
          onClick={handleRemove}
          className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
});

const OptimizedHostsPanel = memo(function OptimizedHostsPanel() {
  const { hosts, loading, loadHosts, addHost, removeHost } = useHosts();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHostname, setNewHostname] = useState('');
  const [newIp, setNewIp] = useState('127.0.0.1');  // Default to localhost
  const [newPort, setNewPort] = useState<string>('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const filteredHosts = useMemo(() => {
    if (!debouncedSearch) return hosts;
    return hosts.filter(h => 
      h.hostname.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      h.ip.includes(debouncedSearch)
    );
  }, [hosts, debouncedSearch]);

  const handleAddHost = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHostname.trim()) return;

    // Validate IP format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(newIp)) {
      addToast('Invalid IP address format', 'error');
      return;
    }

    const port = newPort ? parseInt(newPort) : undefined;
    const result = await addHost(newHostname.trim(), newIp, port);
    
    if (result.success) {
      addToast(result.message || 'Host added successfully', 'success');
      setNewHostname('');
      setNewIp('127.0.0.1');  // Reset to default
      setNewPort('');
      setShowAddForm(false);
    } else {
      addToast(result.error || 'Failed to add host', 'error');
    }
  }, [newHostname, newIp, newPort, addHost, addToast]);

  const handleRemoveHost = useCallback(async (hostname: string) => {
    if (!confirm(`Remove "${hostname}"?`)) return;
    
    const result = await removeHost(hostname);
    if (result.success) {
      addToast(result.message || 'Host removed', 'success');
    } else {
      addToast(result.error || 'Failed to remove host', 'error');
    }
  }, [removeHost, addToast]);

  const handleRefresh = useCallback(() => {
    loadHosts(true);
    addToast('Refreshed', 'success');
  }, [loadHosts, addToast]);

  return (
    <div className="h-full flex flex-col">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="glass-card-premium p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
              <Globe className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">System Hosts</h2>
              <p className="text-sm text-slate-400">/etc/hosts management</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="glass-button flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Host</span>
            </button>
            
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-slate-300 hover:text-cyan-400 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddHost} className="mt-6 pt-6 border-t border-white/10">
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Hostname *
                </label>
                <input
                  type="text"
                  value={newHostname}
                  onChange={(e) => setNewHostname(e.target.value)}
                  placeholder="myproject.local"
                  className="glass-input w-full"
                  required
                />
              </div>
              <div className="w-40">
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  IP Address *
                </label>
                <input
                  type="text"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  placeholder="127.0.0.1"
                  className="glass-input w-full font-mono"
                  required
                />
              </div>
              <div className="w-24">
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Port
                </label>
                <input
                  type="number"
                  value={newPort}
                  onChange={(e) => setNewPort(e.target.value)}
                  placeholder="80"
                  className="glass-input w-full"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !newHostname.trim()}
                className="glass-button-success flex items-center space-x-2 h-[46px]"
              >
                <Check className="w-4 h-4" />
                <span>Save</span>
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Default IP: 127.0.0.1 (localhost) • Port is optional
            </p>
          </form>
        )}
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hosts..."
            className="glass-input w-full pl-11"
          />
        </div>
        <div className="text-sm text-slate-500">
          {filteredHosts.length} hosts
        </div>
      </div>

      {/* Hosts List */}
      <div className="flex-1 glass-card-premium overflow-hidden">
        <div className="overflow-auto h-full scrollbar-thin">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur">
              <tr className="text-left text-xs font-medium text-cyan-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-16 text-center">Status</th>
                <th className="py-3 px-4">Hostname</th>
                <th className="py-3 px-4">IP</th>
                <th className="py-3 px-4 w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredHosts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-slate-500">
                    <Globe className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No hosts found</p>
                  </td>
                </tr>
              ) : (
                filteredHosts.map((host, index) => (
                  <HostRow 
                    key={host.hostname} 
                    host={host} 
                    index={index}
                    onRemove={handleRemoveHost}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export default OptimizedHostsPanel;
