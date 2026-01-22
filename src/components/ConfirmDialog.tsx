import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}

interface DialogState extends ConfirmOptions {
  isOpen: boolean;
  resolve: ((value: boolean) => void) | null;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    message: '',
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        isOpen: true,
        ...options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = () => {
    dialog.resolve?.(true);
    setDialog((prev) => ({ ...prev, isOpen: false, resolve: null }));
  };

  const handleCancel = () => {
    dialog.resolve?.(false);
    setDialog((prev) => ({ ...prev, isOpen: false, resolve: null }));
  };

  const variant = dialog.variant || 'danger';

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {/* Backdrop */}
      {dialog.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCancel}
          />

          {/* Dialog */}
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-scale-in">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-full ${
                  variant === 'danger' ? 'bg-red-100' : 'bg-amber-100'
                }`}>
                  <ExclamationTriangleIcon className={`w-6 h-6 ${
                    variant === 'danger' ? 'text-red-600' : 'text-amber-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {dialog.title || 'Confirm'}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {dialog.message}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {dialog.cancelText || 'Cancel'}
              </button>
              <button
                onClick={handleConfirm}
                className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {dialog.confirmText || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
