import React from 'react';
import { NotificationItem } from '../types/index.ts';
import { Bell, Check, X, ShieldCheck, Heart, MessageCircle, ShoppingBag, Radio } from 'lucide-react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Notifications & Alerts
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllRead}
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold"
            >
              Mark all read
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-3">
          {notifications.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">
              No new notifications.
            </p>
          ) : (
            notifications.map(notif => (
              <div
                key={notif.id}
                className={`p-3.5 rounded-2xl border transition-colors flex items-start gap-3 ${
                  notif.read
                    ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/50 text-slate-900 dark:text-slate-100'
                }`}
              >
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm shrink-0">
                  {notif.type === 'geo_alert' && <Radio className="w-4 h-4 text-amber-500" />}
                  {notif.type === 'like' && <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />}
                  {notif.type === 'order' && <ShoppingBag className="w-4 h-4 text-emerald-500" />}
                  {notif.type === 'campaign' && <ShieldCheck className="w-4 h-4 text-indigo-500" />}
                </div>

                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold">{notif.title}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {notif.timestamp}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {notif.message}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};
