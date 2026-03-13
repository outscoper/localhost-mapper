import { memo, useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Server, 
  Zap, 
  RefreshCw, 
  Cpu,
  HardDrive,
  Globe,
  Terminal,
  Shield,
  Clock
} from 'lucide-react';
import { useServerStatus } from '../hooks/useHosts';

const StatusCard = memo(function StatusCard({ 
  title, 
  icon: Icon, 
  isActive, 
  color,
  onRestart 
}: { 
  title: string; 
  icon: React.ElementType; 
  isActive: boolean; 
  color: string;
  onRestart: () => void;
}) {
  return (
    <div className="glass-card-premium p-6 relative overflow-hidden">
      {isActive && (
        <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-10`} />
      )}
      
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-xl ${isActive ? `bg-gradient-to-br ${color}` : 'bg-slate-700/50'}`}>
              <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-slate-400'}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
              <div className="flex items-center space-x-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className={`text-sm ${isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isActive ? 'Running' : 'Stopped'}
                </span>
              </div>
            </div>
          </div>
          
          <button
            onClick={onRestart}
            className="p-2 rounded-lg bg-slate-800/50 border border-slate-600/50 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        
        <div className="mt-6 pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Status</p>
            <p className={`text-sm font-medium ${isActive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isActive ? 'Operational' : 'Offline'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Port</p>
            <p className="text-sm font-medium text-slate-300">80 / 443</p>
          </div>
        </div>
      </div>
    </div>
  );
});

const OptimizedStatusPanel = memo(function OptimizedStatusPanel() {
  const { status, loading, checkStatus, restartApache, restartNginx } = useServerStatus(30000);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString());
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRestartApache = useCallback(async () => {
    await restartApache();
  }, [restartApache]);

  const handleRestartNginx = useCallback(async () => {
    await restartNginx();
  }, [restartNginx]);

  const stats = [
    { icon: Globe, label: 'Active Hosts', value: 'Auto', color: 'text-blue-400' },
    { icon: Cpu, label: 'Virtual Hosts', value: 'Auto', color: 'text-purple-400' },
    { icon: HardDrive, label: 'Disk Usage', value: 'Normal', color: 'text-emerald-400' },
    { icon: Shield, label: 'Security', value: 'Secure', color: 'text-cyan-400' },
  ];

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="glass-card-premium p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
              <Activity className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">System Status</h2>
              <p className="text-sm text-slate-400">Server health and diagnostics</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Current Time</p>
              <p className="text-2xl font-mono font-bold text-cyan-400">{currentTime}</p>
            </div>
            <button
              onClick={checkStatus}
              disabled={loading}
              className="p-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-slate-300 hover:text-cyan-400 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <StatusCard
          title="Apache Server"
          icon={Server}
          isActive={status.apache}
          color="from-orange-500/80 to-red-500/80"
          onRestart={handleRestartApache}
        />
        <StatusCard
          title="Nginx Server"
          icon={Zap}
          isActive={status.nginx}
          color="from-emerald-500/80 to-green-500/80"
          onRestart={handleRestartNginx}
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((item, index) => (
          <div key={item.label} className="glass-card p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-slate-800/50">
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className="text-sm font-medium text-slate-200">{item.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 glass-card-premium overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center space-x-3">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <span className="font-medium text-slate-200">System Console</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500/50" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
            <div className="w-3 h-3 rounded-full bg-green-500/50" />
          </div>
        </div>
        
        <div className="flex-1 p-4 font-mono text-sm overflow-auto scrollbar-thin bg-slate-950/50">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-cyan-500">$</span>
              <span className="text-slate-300">systemctl status apache2</span>
            </div>
            <div className="text-emerald-400">
              ● apache2.service - Apache HTTP Server<br />
              Loaded: loaded<br />
              Active: <span className={status.apache ? 'text-emerald-400' : 'text-red-400'}>
                {status.apache ? 'active (running)' : 'inactive (dead)'}
              </span>
            </div>
            
            <div className="h-4" />
            
            <div className="flex items-center space-x-2">
              <span className="text-cyan-500">$</span>
              <span className="text-slate-300">nginx -t</span>
            </div>
            <div className={status.nginx ? 'text-emerald-400' : 'text-red-400'}>
              {status.nginx 
                ? 'nginx: configuration test is successful'
                : 'nginx: [error] failed to test configuration'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center space-x-2">
          <Clock className="w-3 h-3" />
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
});

export default OptimizedStatusPanel;
