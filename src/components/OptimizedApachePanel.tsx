import { memo, useState, useCallback, useMemo } from 'react';
import { 
  Server, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Check, 
  FolderOpen,
  ExternalLink,
  Play,
  Globe
} from 'lucide-react';
import { useVirtualHosts } from '../hooks/useHosts';
import { getElectronAPI } from '../utils/electron';
import { ToastContainer, type ToastItem } from './Toast';

const VhostRow = memo(function VhostRow({ 
  vhost, 
  index, 
  onRemove,
  onOpen
}: { 
  vhost: { serverName: string; documentRoot: string; port: string; type: string };
  index: number; 
  onRemove: (serverName: string) => void;
  onOpen: (serverName: string) => void;
}) {
  const handleRemove = useCallback(() => {
    onRemove(vhost.serverName);
  }, [vhost.serverName, onRemove]);

  const handleOpen = useCallback(() => {
    onOpen(vhost.serverName);
  }, [vhost.serverName, onOpen]);

  return (
    <tr
      className="group animate-fadeIn"
      style={{ animationDelay: `${Math.min(index * 20, 300)}ms` }}
    >
      <td className="py-3 px-4">
        <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 text-xs font-medium">
          Apache
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center space-x-3">
          <span className="font-medium text-slate-200">{vhost.serverName}</span>
          <button
            onClick={handleOpen}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-cyan-500/20 text-cyan-400 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </td>
      <td className="py-3 px-4">
        <code className="text-sm text-slate-400 font-mono truncate max-w-[300px] block">
          {vhost.documentRoot}
        </code>
      </td>
      <td className="py-3 px-4">
        <span className="px-2 py-1 rounded bg-slate-700/50 text-slate-300 text-sm font-mono">
          {vhost.port}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpen}
            className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
          >
            <Globe className="w-4 h-4" />
          </button>
          <button
            onClick={handleRemove}
            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
});

const OptimizedApachePanel = memo(function OptimizedApachePanel() {
  const { vhosts, loading, loadVhosts, createVhost, removeVhost } = useVirtualHosts('apache');
  const [showAddForm, setShowAddForm] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [formData, setFormData] = useState({
    serverName: '',
    documentRoot: '',
    port: 80
  });

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

  const handleSelectDirectory = useCallback(async () => {
    const result = await getElectronAPI().selectDirectory();
    if (!result.canceled && result.filePaths.length > 0) {
      setFormData(prev => ({ ...prev, documentRoot: result.filePaths[0] }));
    }
  }, []);

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.serverName.trim() || !formData.documentRoot.trim()) return;

    const result = await createVhost({
      serverName: formData.serverName.trim(),
      documentRoot: formData.documentRoot.trim(),
      port: formData.port
    });
    
    if (result.success) {
      addToast(result.message || 'Virtual host created', 'success');
      setFormData({ serverName: '', documentRoot: '', port: 80 });
      setShowAddForm(false);
    } else {
      addToast(result.error || 'Failed to create virtual host', 'error');
    }
  }, [formData, createVhost, addToast]);

  const handleRemove = useCallback(async (serverName: string) => {
    if (!confirm(`Remove "${serverName}"?`)) return;
    
    const result = await removeVhost(serverName);
    if (result.success) {
      addToast(result.message || 'Virtual host removed', 'success');
    } else {
      addToast(result.error || 'Failed to remove', 'error');
    }
  }, [removeVhost, addToast]);

  const handleOpen = useCallback((serverName: string) => {
    getElectronAPI().openBrowser(`http://${serverName}`);
  }, []);

  const handleRestart = useCallback(async () => {
    const result = await getElectronAPI().restartApache();
    if (result.success) {
      addToast('Apache restarted', 'success');
    } else {
      addToast(result.error || 'Failed to restart', 'error');
    }
  }, [addToast]);

  return (
    <div className="h-full flex flex-col">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="glass-card-premium p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30">
              <Server className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Apache Virtual Hosts</h2>
              <p className="text-sm text-slate-400">Manage Apache configurations</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRestart}
              disabled={loading}
              className="glass-button flex items-center space-x-2"
            >
              <Play className="w-4 h-4" />
              <span>Restart</span>
            </button>
            
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="glass-button-success flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>New VHost</span>
            </button>
            
            <button
              onClick={() => loadVhosts(true)}
              disabled={loading}
              className="p-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-slate-300 hover:text-orange-400 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {showAddForm && (
          <form onSubmit={handleCreate} className="mt-6 pt-6 border-t border-white/10">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <label className="block text-sm font-medium text-slate-400 mb-2">Server Name</label>
                <input
                  type="text"
                  value={formData.serverName}
                  onChange={(e) => setFormData(prev => ({ ...prev, serverName: e.target.value }))}
                  placeholder="project.local"
                  className="glass-input w-full"
                />
              </div>
              
              <div className="col-span-6">
                <label className="block text-sm font-medium text-slate-400 mb-2">Document Root</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={formData.documentRoot}
                    onChange={(e) => setFormData(prev => ({ ...prev, documentRoot: e.target.value }))}
                    placeholder="/Users/username/Sites/project"
                    className="glass-input flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleSelectDirectory}
                    className="p-3 rounded-lg bg-slate-800/50 border border-slate-600/50 text-slate-400 hover:text-cyan-400 transition-colors"
                  >
                    <FolderOpen className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-400 mb-2">Port</label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) || 80 }))}
                  className="glass-input w-full"
                />
              </div>
            </div>
            
            <div className="mt-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-6 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.serverName.trim() || !formData.documentRoot.trim()}
                className="glass-button-success flex items-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>Create</span>
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="flex-1 glass-card-premium overflow-hidden">
        <div className="overflow-auto h-full scrollbar-thin">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur">
              <tr className="text-left text-xs font-medium text-orange-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-20">Type</th>
                <th className="py-3 px-4">Server Name</th>
                <th className="py-3 px-4">Document Root</th>
                <th className="py-3 px-4 w-20">Port</th>
                <th className="py-3 px-4 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {vhosts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-slate-500">
                    <Server className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No virtual hosts found</p>
                  </td>
                </tr>
              ) : (
                vhosts.map((vhost, index) => (
                  <VhostRow 
                    key={vhost.serverName} 
                    vhost={vhost} 
                    index={index}
                    onRemove={handleRemove}
                    onOpen={handleOpen}
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

export default OptimizedApachePanel;
