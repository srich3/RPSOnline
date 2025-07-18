import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Types for real-time messages
export interface PresenceData {
  user_id: string;
  username: string;
  status: 'online' | 'away' | 'in-game' | 'offline';
  last_seen: string;
  game_id?: string;
}

export interface GameMessage {
  type: 'player_action' | 'turn_submitted' | 'game_start' | 'game_end' | 'chat';
  player_id: string;
  data: any;
  timestamp: string;
}

export interface ConnectionConfig {
  autoReconnect: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  presenceTimeout: number;
}

// Default configuration
export const DEFAULT_CONNECTION_CONFIG: ConnectionConfig = {
  autoReconnect: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000, // 30 seconds
  presenceTimeout: 60000, // 1 minute
};

// Connection state management
export class ConnectionManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();
  private presenceTimers: Map<string, NodeJS.Timeout> = new Map();
  private config: ConnectionConfig;

  constructor(config: Partial<ConnectionConfig> = {}) {
    this.config = { ...DEFAULT_CONNECTION_CONFIG, ...config };
  }

  // Create a new channel with automatic reconnection
  async createChannel(
    channelName: string,
    options: {
      table?: string;
      event?: string;
      filter?: string;
      onMessage?: (message: any) => void;
      onPresence?: (presence: any) => void;
      onError?: (error: any) => void;
    } = {}
  ): Promise<RealtimeChannel> {
    console.log(`🔌 Creating channel: ${channelName}`);

    let channel = supabase.channel(channelName);

    // Add PostgreSQL changes if table is specified
    if (options.table) {
      channel = channel.on(
        'postgres_changes' as any,
        {
          event: options.event || '*',
          schema: 'public',
          table: options.table,
          filter: options.filter,
        },
        (payload: any) => {
          console.log(`📡 ${channelName} message:`, payload);
          options.onMessage?.(payload);
        }
      );
    }

    // Add presence tracking
    channel = channel
      .on('presence', { event: 'sync' }, () => {
        console.log(`👥 ${channelName} presence sync`);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log(`👋 ${channelName} user joined:`, key, newPresences);
        options.onPresence?.({ type: 'join', key, presences: newPresences });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log(`👋 ${channelName} user left:`, key, leftPresences);
        options.onPresence?.({ type: 'leave', key, presences: leftPresences });
      });

    // Add broadcast message handling
    channel = channel.on('broadcast', { event: '*' }, (payload) => {
      console.log(`📡 ${channelName} broadcast:`, payload);
      options.onMessage?.(payload);
    });

    // Subscribe with error handling
    const subscribedChannel = await channel.subscribe((status) => {
      console.log(`🔌 ${channelName} status:`, status);
      
      if (status === 'SUBSCRIBED') {
        this.reconnectAttempts.set(channelName, 0);
        this.startHeartbeat(channelName);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.handleChannelError(channelName, status);
      }
    });

    this.channels.set(channelName, subscribedChannel);
    return subscribedChannel;
  }

  // Handle channel errors and attempt reconnection
  private handleChannelError(channelName: string, status: string) {
    console.log(`❌ ${channelName} error:`, status);
    
    const attempts = this.reconnectAttempts.get(channelName) || 0;
    
    if (attempts < this.config.maxReconnectAttempts && this.config.autoReconnect) {
      console.log(`🔄 Attempting to reconnect ${channelName} (${attempts + 1}/${this.config.maxReconnectAttempts})`);
      
      this.reconnectAttempts.set(channelName, attempts + 1);
      
      setTimeout(() => {
        this.reconnectChannel(channelName);
      }, this.config.reconnectInterval);
    }
  }

  // Reconnect a specific channel
  private async reconnectChannel(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      try {
        await channel.subscribe();
      } catch (error) {
        console.error(`❌ Failed to reconnect ${channelName}:`, error);
      }
    }
  }

  // Start heartbeat for a channel
  private startHeartbeat(channelName: string) {
    const timer = setInterval(() => {
      const channel = this.channels.get(channelName);
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: { timestamp: new Date().toISOString() },
        });
      }
    }, this.config.heartbeatInterval);

    this.heartbeatTimers.set(channelName, timer);
  }

  // Track presence for a channel
  trackPresence(channelName: string, presenceData: PresenceData) {
    const channel = this.channels.get(channelName);
    if (channel) {
      console.log(`👥 Tracking presence on ${channelName}:`, presenceData);
      channel.track(presenceData);
      
      // Set up presence timeout
      const timer = setTimeout(() => {
        this.updatePresence(channelName, { ...presenceData, status: 'away' });
      }, this.config.presenceTimeout);
      
      this.presenceTimers.set(channelName, timer);
    }
  }

  // Update presence for a channel
  updatePresence(channelName: string, presenceData: PresenceData) {
    const channel = this.channels.get(channelName);
    if (channel) {
      console.log(`👥 Updating presence on ${channelName}:`, presenceData);
      channel.track(presenceData);
    }
  }

  // Untrack presence for a channel
  untrackPresence(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      console.log(`👥 Untracking presence on ${channelName}`);
      channel.untrack();
      
      // Clear presence timer
      const timer = this.presenceTimers.get(channelName);
      if (timer) {
        clearTimeout(timer);
        this.presenceTimers.delete(channelName);
      }
    }
  }

  // Send a message to a channel
  sendMessage(channelName: string, message: GameMessage) {
    const channel = this.channels.get(channelName);
    if (channel) {
      console.log(`📡 Sending message to ${channelName}:`, message);
      channel.send({
        type: 'broadcast',
        event: message.type,
        payload: message,
      });
    }
  }

  // Get all active channels
  getActiveChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  // Check if a channel is connected
  isChannelConnected(channelName: string): boolean {
    const channel = this.channels.get(channelName);
    return (channel as any)?.subscription?.state === 'SUBSCRIBED';
  }

  // Disconnect a specific channel
  async disconnectChannel(channelName: string) {
    console.log(`🔌 Disconnecting channel: ${channelName}`);
    
    const channel = this.channels.get(channelName);
    if (channel) {
      // Clear timers
      const heartbeatTimer = this.heartbeatTimers.get(channelName);
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        this.heartbeatTimers.delete(channelName);
      }
      
      const presenceTimer = this.presenceTimers.get(channelName);
      if (presenceTimer) {
        clearTimeout(presenceTimer);
        this.presenceTimers.delete(channelName);
      }
      
      // Untrack presence
      this.untrackPresence(channelName);
      
      // Unsubscribe
      await channel.unsubscribe();
      this.channels.delete(channelName);
      this.reconnectAttempts.delete(channelName);
    }
  }

  // Disconnect all channels
  async disconnectAll() {
    console.log('🔌 Disconnecting all channels');
    
    const disconnectPromises = Array.from(this.channels.keys()).map(
      (channelName) => this.disconnectChannel(channelName)
    );
    
    await Promise.all(disconnectPromises);
  }

  // Get connection statistics
  getConnectionStats() {
    return {
      totalChannels: this.channels.size,
      connectedChannels: Array.from(this.channels.values()).filter(
        (channel) => (channel as any)?.subscription?.state === 'SUBSCRIBED'
      ).length,
      reconnectAttempts: Object.fromEntries(this.reconnectAttempts),
    };
  }
}

// Message utilities
export const createGameMessage = (
  type: GameMessage['type'],
  playerId: string,
  data: any
): GameMessage => ({
  type,
  player_id: playerId,
  data,
  timestamp: new Date().toISOString(),
});

export const createPresenceData = (
  userId: string,
  username: string,
  status: PresenceData['status'] = 'online',
  gameId?: string
): PresenceData => ({
  user_id: userId,
  username,
  status,
  last_seen: new Date().toISOString(),
  game_id: gameId,
});

// Connection optimization utilities
export const optimizeConnection = (config: Partial<ConnectionConfig>) => {
  // Adjust configuration based on network conditions
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  if (connection) {
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      // Slow connection - increase intervals
      return {
        ...config,
        heartbeatInterval: 60000, // 1 minute
        reconnectInterval: 10000, // 10 seconds
        presenceTimeout: 120000, // 2 minutes
      };
    } else if (connection.effectiveType === '4g') {
      // Fast connection - decrease intervals
      return {
        ...config,
        heartbeatInterval: 15000, // 15 seconds
        reconnectInterval: 1000, // 1 second
        presenceTimeout: 30000, // 30 seconds
      };
    }
  }
  
  return config;
};

// Message queue for offline scenarios
export class MessageQueue {
  private queue: GameMessage[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  add(message: GameMessage) {
    if (this.queue.length >= this.maxSize) {
      this.queue.shift(); // Remove oldest message
    }
    this.queue.push(message);
  }

  getMessages(): GameMessage[] {
    return [...this.queue];
  }

  clear() {
    this.queue = [];
  }

  size(): number {
    return this.queue.length;
  }
}

// Export singleton instance
export const connectionManager = new ConnectionManager();
export const messageQueue = new MessageQueue(); 