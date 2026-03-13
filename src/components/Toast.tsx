import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertCircle, X } from 'lucide-react';

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: number) => void;
}

function ToastItemComponent({ toast, onRemove }: { toast: ToastItem; onRemove: (id: number) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className={`alert-cyber ${toast.type} shadow-lg min-w-[300px] flex items-center justify-between`}
    >
      <div className="flex items-center space-x-3">
        {toast.type === 'success' ? (
          <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
        )}
        <span className="text-sm">{toast.message}</span>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="p-1 hover:bg-white/10 rounded transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export const ToastContainer = memo(function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-6 right-6 z-50 space-y-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItemComponent key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
});
