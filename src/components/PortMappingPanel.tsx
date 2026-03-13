import { memo, useState, useCallback, useEffect } from 'react';
import {
  Network,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  ExternalLink,
  ArrowRight,
  Pencil,
  X,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { getElectronAPI } from '../utils/electron';
import { ToastContainer, type ToastItem } from './Toast';

interface PortMapping {
  id: string;
  hostname: string;
  targetPort: number;
  active: boolean;
}

// ─── Edit Row ────────────────────────────────────────────────────────────────

const EditRow = memo(function EditRow({
  mapping,
  onSave,
  onCancel,
}: {
  mapping: PortMapping;
  onSave: (id: string, hostname: string, targetPort: number) => void;
  onCancel: () => void;
}) {
  const [hostname, setHostname] = useState(mapping.hostname);
  const [port, setPort] = useState(mapping.targetPort);

  const handleSave = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (hostname.trim()) onSave(mapping.id, hostname.trim(), port);
  }, [mapping.id, hostname, port, onSave]);

  return (
    <tr className="bg-slate-800/40">
      <td colSpan={5} className="py-3 px-4">
        <form onSubmit={handleSave} className="flex items-center gap-3">
          <input
            type="text"
            value={hostname}
            onChange={e => setHostname(e.target.value)}
            className="glass-input font-mono text-sm w-48"
            placeholder="hostname"
            autoFocus
          />
          <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-slate-400 text-sm">localhost:</span>
          <input
            type="number"
            value={port}
            onChange={e => setPort(parseInt(e.target.value) || 0)}
            className="glass-input font-mono text-sm w-24"
            min="1"
            max="65535"
          />
          <button type="submit" className="glass-button-success flex items-center gap-1.5 text-sm px-3 py-1.5">
            <Check className="w-3.5 h-3.5" /> Save
          </button>
          <button type="button" onClick={onCancel} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </form>
      </td>
    </tr>
  );
});

// ─── Mapping Row ─────────────────────────────────────────────────────────────

const MappingRow = memo(function MappingRow({
  mapping,
  index,
  onRemove,
  onToggle,
  onOpen,
  onEdit,
}: {
  mapping: PortMapping;
  index: number;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onOpen: (hostname: string) => void;
  onEdit: (id: string) => void;
}) {
  return (
    <tr className="group animate-fadeIn" style={{ animationDelay: `${Math.min(index * 20, 300)}ms` }}>
      <td className="py-3 px-4">
        <button
          onClick={() => onToggle(mapping.id)}
          className={`w-10 h-6 rounded-full transition-colors relative ${mapping.active ? 'bg-emerald-500' : 'bg-slate-600'}`}
        >
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${mapping.active ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-slate-200">{mapping.hostname}</span>
          <button onClick={() => onOpen(mapping.hostname)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-cyan-500/20 text-cyan-400 transition-all">
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2 text-sm font-mono">
          <span className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-300">:80</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">:{mapping.targetPort}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${mapping.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
          {mapping.active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(mapping.id)} className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onRemove(mapping.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
});

// ─── Main Panel ───────────────────────────────────────────────────────────────

const PortMappingPanel = memo(function PortMappingPanel() {
  const [mappings, setMappings] = useState<PortMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [formData, setFormData] = useState({ hostname: '', targetPort: 3000 });

  // ── Load from system (source of truth = Apache vhost files) ──
  useEffect(() => {
    getElectronAPI().getPortProxies().then(result => {
      if (!result.success || !result.proxies) return;

      // Restore stable IDs from localStorage if available
      const savedIds: Record<string, string> = {};
      try {
        const saved = localStorage.getItem('portMappingIds');
        if (saved) Object.assign(savedIds, JSON.parse(saved));
      } catch (_) { /* ignore */ }

      const loaded: PortMapping[] = result.proxies.map(p => ({
        id: savedIds[p.hostname] ?? `${Date.now()}-${Math.random()}`,
        hostname: p.hostname,
        targetPort: p.targetPort,
        active: true,
      }));
      setMappings(loaded);
    });
  }, []);

  // ── Persist stable ID map to localStorage ──
  useEffect(() => {
    const idMap: Record<string, string> = {};
    mappings.forEach(m => { idMap[m.hostname] = m.id; });
    localStorage.setItem('portMappingIds', JSON.stringify(idMap));
  }, [mappings]);

  // ── Setup check ──
  useEffect(() => {
    getElectronAPI().checkSetup().then(r => setIsSetupComplete(r.complete));
  }, []);

  // ── Toast helpers ──
  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Setup ──
  const handleSetup = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getElectronAPI().setupHelper();
      if (result.success) {
        setIsSetupComplete(true);
        addToast('Setup complete — no more password prompts!', 'success');
      } else {
        addToast(result.error || 'Setup failed', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // ── Create ──
  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.hostname.trim()) return;
    setLoading(true);
    try {
      const result = await getElectronAPI().createPortProxy({
        hostname: formData.hostname.trim(),
        targetPort: formData.targetPort,
      });
      if (result.success) {
        const newMapping: PortMapping = {
          id: Date.now().toString(),
          hostname: formData.hostname.trim(),
          targetPort: formData.targetPort,
          active: true,
        };
        setMappings(prev => [...prev, newMapping]);
        addToast(`http://${newMapping.hostname} → localhost:${newMapping.targetPort}`, 'success');
        setFormData({ hostname: '', targetPort: 3000 });
        setShowAddForm(false);
      } else {
        addToast(result.error || 'Failed to create mapping', 'error');
      }
    } catch {
      addToast('Failed to create mapping', 'error');
    } finally {
      setLoading(false);
    }
  }, [formData, addToast]);

  // ── Edit ──
  const handleEditSave = useCallback(async (id: string, newHostname: string, newPort: number) => {
    const mapping = mappings.find(m => m.id === id);
    if (!mapping) return;

    const hostnameChanged = newHostname !== mapping.hostname;
    const portChanged = newPort !== mapping.targetPort;
    if (!hostnameChanged && !portChanged) { setEditingId(null); return; }

    setLoading(true);
    try {
      // Remove old proxy
      await getElectronAPI().removePortProxy(mapping.hostname);
      // Create new proxy
      const result = await getElectronAPI().createPortProxy({ hostname: newHostname, targetPort: newPort });
      if (result.success) {
        setMappings(prev => prev.map(m => m.id === id ? { ...m, hostname: newHostname, targetPort: newPort } : m));
        addToast(`Updated: http://${newHostname} → localhost:${newPort}`, 'success');
        setEditingId(null);
      } else {
        // Restore old proxy on failure
        await getElectronAPI().createPortProxy({ hostname: mapping.hostname, targetPort: mapping.targetPort });
        addToast(result.error || 'Failed to update mapping', 'error');
      }
    } catch {
      addToast('Failed to update mapping', 'error');
    } finally {
      setLoading(false);
    }
  }, [mappings, addToast]);

  // ── Remove ──
  const handleRemove = useCallback(async (id: string) => {
    if (!confirm('Remove this mapping?')) return;
    const mapping = mappings.find(m => m.id === id);
    if (!mapping) return;
    setLoading(true);
    try {
      await getElectronAPI().removePortProxy(mapping.hostname);
      setMappings(prev => prev.filter(m => m.id !== id));
      addToast('Mapping removed', 'success');
    } catch {
      addToast('Failed to remove mapping', 'error');
    } finally {
      setLoading(false);
    }
  }, [mappings, addToast]);

  // ── Toggle ──
  const handleToggle = useCallback((id: string) => {
    setMappings(prev => prev.map(m => {
      if (m.id !== id) return m;
      const newActive = !m.active;
      if (newActive) {
        getElectronAPI().createPortProxy({ hostname: m.hostname, targetPort: m.targetPort });
      } else {
        getElectronAPI().removePortProxy(m.hostname);
      }
      return { ...m, active: newActive };
    }));
  }, []);

  const handleOpen = useCallback((hostname: string) => {
    getElectronAPI().openBrowser(`http://${hostname}`);
  }, []);

  const activeCount = mappings.filter(m => m.active).length;

  return (
    <div className="h-full flex flex-col gap-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Setup banner */}
      {isSetupComplete === false && (
        <div className="glass-card-premium p-4 border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-300">One-time setup required</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Installs a privileged helper — you'll only be asked for your password <strong>once</strong>, ever.
                </p>
              </div>
            </div>
            <button
              onClick={handleSetup}
              disabled={loading}
              className="glass-button-success flex items-center gap-2 text-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              {loading ? 'Setting up…' : 'Authorize & Setup'}
            </button>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="glass-card-premium p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
              <Network className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Port Mapping</h2>
              <p className="text-xs text-slate-400">{activeCount} active mapping{activeCount !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSetupComplete && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 mr-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Helper installed</span>
              </div>
            )}
            <button
              onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); }}
              className="glass-button-success flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              New Mapping
            </button>
            <button
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-600/50 text-slate-300 hover:text-purple-400 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Add form */}
        {showAddForm && (
          <form onSubmit={handleCreate} className="mt-5 pt-5 border-t border-white/10 flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Hostname</label>
              <input
                type="text"
                value={formData.hostname}
                onChange={e => setFormData(prev => ({ ...prev, hostname: e.target.value }))}
                placeholder="myapp"
                className="glass-input w-full font-mono"
                required
                autoFocus
              />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 mb-3 shrink-0" />
            <div className="w-36">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">localhost: Port</label>
              <input
                type="number"
                value={formData.targetPort}
                onChange={e => setFormData(prev => ({ ...prev, targetPort: parseInt(e.target.value) || 0 }))}
                placeholder="3000"
                className="glass-input w-full font-mono"
                min="1"
                max="65535"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !formData.hostname.trim()}
              className="glass-button-success flex items-center gap-1.5 text-sm mb-0.5"
            >
              <Check className="w-4 h-4" />
              Add
            </button>
          </form>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 glass-card-premium overflow-hidden">
        <div className="overflow-auto h-full scrollbar-thin">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur">
              <tr className="text-left text-xs font-medium text-purple-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-16">Status</th>
                <th className="py-3 px-4">Hostname</th>
                <th className="py-3 px-4">Port</th>
                <th className="py-3 px-4 w-24">State</th>
                <th className="py-3 px-4 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-slate-500">
                    <Network className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No mappings yet</p>
                    <p className="text-xs mt-1">Click "New Mapping" to get started</p>
                  </td>
                </tr>
              ) : (
                mappings.map((mapping, index) =>
                  editingId === mapping.id ? (
                    <EditRow
                      key={mapping.id}
                      mapping={mapping}
                      onSave={handleEditSave}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <MappingRow
                      key={mapping.id}
                      mapping={mapping}
                      index={index}
                      onRemove={handleRemove}
                      onToggle={handleToggle}
                      onOpen={handleOpen}
                      onEdit={setEditingId}
                    />
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export default PortMappingPanel;
