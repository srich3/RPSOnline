"use client";

import React, { useState } from 'react';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import { useRealTimeGame } from '../../hooks/useRealTimeGame';

export default function TestOverlayPage() {
  const [showOverlay, setShowOverlay] = useState(false);
  const [mockGameId, setMockGameId] = useState('test-game-123');
  const [useRealTime, setUseRealTime] = useState(false);

  // Mock real-time game hook for testing
  const realTimeGame = useRealTimeGame({
    gameId: useRealTime ? mockGameId : 'disabled',
    autoReconnect: true,
    maxReconnectAttempts: 3,
  });

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold text-black mb-12 text-center tracking-wider">
          XO SPINNER TEST
        </h1>
        
        <div className="bg-gray-50 rounded-none border-2 border-black p-12 shadow-none">
          <h2 className="text-2xl font-bold mb-8 text-black tracking-wide uppercase">
            Test Controls
          </h2>
          
          <div className="space-y-6 mb-8">
            <div className="flex space-x-4">
              <button
                onClick={() => setShowOverlay(true)}
                className="bg-black text-white px-6 py-3 font-bold tracking-wide uppercase hover:bg-gray-800 transition-colors"
              >
                Show Loading Overlay
              </button>
              
              <button
                onClick={() => setShowOverlay(false)}
                className="bg-gray-600 text-white px-6 py-3 font-bold tracking-wide uppercase hover:bg-gray-700 transition-colors"
              >
                Hide Loading Overlay
              </button>
            </div>

            {/* Real-time Connection Test */}
            <div className="border-t-2 border-black pt-6">
              <h3 className="text-xl font-bold mb-4 text-black tracking-wide uppercase">
                Real-time Connection Test
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <label className="text-black font-medium">
                    <input
                      type="checkbox"
                      checked={useRealTime}
                      onChange={(e) => setUseRealTime(e.target.checked)}
                      className="mr-2"
                    />
                    Enable Real-time Connection
                  </label>
                </div>
                
                {useRealTime && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-black font-medium mb-2">
                        Mock Game ID:
                      </label>
                      <input
                        type="text"
                        value={mockGameId}
                        onChange={(e) => setMockGameId(e.target.value)}
                        className="w-full px-4 py-2 border-2 border-black bg-white text-black font-mono"
                        placeholder="Enter game ID"
                      />
                    </div>
                    
                    <div className="bg-black text-white p-4 font-mono text-sm">
                      <div className="space-y-1">
                        <div>Connection Status: {realTimeGame.isConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
                        <div>Reconnecting: {realTimeGame.isReconnecting ? '🔄 Yes' : '❌ No'}</div>
                        <div>Reconnect Attempts: {realTimeGame.reconnectAttempts}</div>
                        <div>Opponent Online: {realTimeGame.opponentOnline ? '🟢 Yes' : '🔴 No'}</div>
                        {realTimeGame.connectionError && (
                          <div className="text-red-400">Error: {realTimeGame.connectionError}</div>
                        )}
                        {realTimeGame.lastConnected && (
                          <div>Last Connected: {realTimeGame.lastConnected.toLocaleTimeString()}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Interactive Elements to Test Blocking */}
            <div className="border-t-2 border-black pt-6">
              <h3 className="text-xl font-bold mb-4 text-black tracking-wide uppercase">
                Interactive Elements (Should be blocked when overlay is active)
              </h3>
              
              <div className="space-y-4">
                <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
                  Test Button 1
                </button>
                
                <input
                  type="text"
                  placeholder="Test input field"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded focus:border-black focus:outline-none"
                />
                
                <select className="w-full px-4 py-2 border-2 border-gray-300 rounded focus:border-black focus:outline-none">
                  <option>Test Option 1</option>
                  <option>Test Option 2</option>
                  <option>Test Option 3</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      <LoadingOverlay 
        show={showOverlay} 
        onClose={() => setShowOverlay(false)}
        showCloseButton={true}
      />
    </div>
  );
} 