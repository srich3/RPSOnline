import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

interface ConnectionStatusProps {
  isConnected: boolean;
  isReconnecting: boolean;
  lastConnected: Date | null;
  reconnectAttempts: number;
  connectionError: string | null;
  onReconnect?: () => void;
  className?: string;
}

export default function ConnectionStatus({
  isConnected,
  isReconnecting,
  lastConnected,
  reconnectAttempts,
  connectionError,
  onReconnect,
  className = '',
}: ConnectionStatusProps) {
  const getStatusColor = () => {
    if (isConnected) return 'text-green-400';
    if (isReconnecting) return 'text-yellow-400';
    if (connectionError) return 'text-red-400';
    return 'text-gray-400';
  };

  const getStatusIcon = () => {
    if (isConnected) return <CheckCircle className="w-4 h-4" />;
    if (isReconnecting) return <RefreshCw className="w-4 h-4 animate-spin" />;
    if (connectionError) return <AlertCircle className="w-4 h-4" />;
    return <WifiOff className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (isConnected) return 'Connected';
    if (isReconnecting) return `Reconnecting... (${reconnectAttempts})`;
    if (connectionError) return 'Connection Error';
    return 'Disconnected';
  };

  const formatLastConnected = () => {
    if (!lastConnected) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - lastConnected.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Status Icon */}
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        className={`${getStatusColor()}`}
      >
        {getStatusIcon()}
      </motion.div>

      {/* Status Text */}
      <div className="flex flex-col">
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
        
        {isConnected && lastConnected && (
          <span className="text-xs text-gray-500">
            Last connected: {formatLastConnected()}
          </span>
        )}
      </div>

      {/* Reconnect Button */}
      <AnimatePresence>
        {!isConnected && !isReconnecting && onReconnect && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={onReconnect}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title="Reconnect"
          >
            <RefreshCw className="w-3 h-3" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Error Tooltip */}
      <AnimatePresence>
        {connectionError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-2 p-2 bg-red-900 text-red-100 text-xs rounded shadow-lg max-w-xs z-50"
          >
            {connectionError}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 