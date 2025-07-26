/**
 * WebSocket room implementation using Durable Objects
 * Provides real-time communication capabilities
 */

import type {
  IRoomDurableObject,
  IWebSocketHandler,
  IDurableObjectState,
} from '../../interfaces/durable-objects';

import { BaseDurableObject } from './base-durable-object';

interface Connection {
  userId: string;
  ws: WebSocket;
  metadata?: Record<string, unknown>;
  joinedAt: number;
}

interface RoomState {
  connections: Map<string, Connection>;
  roomData: Record<string, unknown>;
  messageHistory: Array<{
    userId: string;
    message: unknown;
    timestamp: number;
  }>;
}

/**
 * WebSocket room for real-time collaboration
 */
export class WebSocketRoom
  extends BaseDurableObject
  implements IRoomDurableObject, IWebSocketHandler
{
  private connections = new Map<string, Connection>();
  private roomData: Record<string, unknown> = {};
  private messageHistory: Array<{ userId: string; message: unknown; timestamp: number }> = [];
  private maxHistorySize = 100;

  constructor(state: IDurableObjectState, env: unknown) {
    super(state, env);
  }

  protected async onInitialize(): Promise<void> {
    // Load room state from storage
    const storedState = await this.get<RoomState>('room:state');
    if (storedState) {
      this.roomData = storedState.roomData || {};
      this.messageHistory = storedState.messageHistory || [];
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    // Route HTTP requests
    switch (path) {
      case '/state':
        return this.handleGetState();
      case '/broadcast':
        return this.handleBroadcast(request);
      case '/history':
        return this.handleGetHistory();
      default:
        return this.error('Not found', 404);
    }
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return this.error('userId is required', 400);
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    server.accept();

    // Handle the connection
    this.handleConnect(server, request);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleConnect(ws: WebSocket, request: Request): Promise<void> {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || `user-${Date.now()}`;
    const metadata = this.parseMetadata(url.searchParams);

    // Store connection
    const connection: Connection = {
      userId,
      ws,
      metadata,
      joinedAt: Date.now(),
    };
    this.connections.set(userId, connection);

    // Set up event handlers
    ws.addEventListener('message', (event) => {
      this.handleMessage(ws, event.data).catch(console.error);
    });

    ws.addEventListener('close', (event) => {
      this.handleClose(ws, event.code, event.reason);
    });

    ws.addEventListener('error', (_event) => {
      this.handleError(ws, new Error('WebSocket error'));
    });

    // Send welcome message
    this.sendToWebSocket(ws, {
      type: 'welcome',
      userId,
      roomState: await this.getState(),
      history: this.messageHistory.slice(-20), // Last 20 messages
    });

    // Notify others about new user
    await this.broadcast(
      {
        type: 'user_joined',
        userId,
        metadata,
        timestamp: Date.now(),
      },
      userId,
    );

    // Save state
    await this.saveState();
  }

  async handleMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') {
      this.sendToWebSocket(ws, { type: 'error', message: 'Binary messages not supported' });
      return;
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(message) as Record<string, unknown>;
    } catch (_error) {
      this.sendToWebSocket(ws, { type: 'error', message: 'Invalid JSON' });
      return;
    }

    // Find the user ID for this WebSocket
    const userId = this.findUserIdByWebSocket(ws);
    if (!userId) {
      this.sendToWebSocket(ws, { type: 'error', message: 'User not found' });
      return;
    }

    // Handle different message types
    switch (data.type) {
      case 'message':
        await this.handleUserMessage(userId, data.payload);
        break;

      case 'update_state':
        await this.handleStateUpdate(userId, data.updates);
        break;

      case 'ping':
        this.sendToWebSocket(ws, { type: 'pong', timestamp: Date.now() });
        break;

      default:
        this.sendToWebSocket(ws, { type: 'error', message: `Unknown message type: ${data.type}` });
    }
  }

  handleClose(ws: WebSocket, code: number, reason: string): void {
    const userId = this.findUserIdByWebSocket(ws);
    if (!userId) return;

    // Remove connection
    this.connections.delete(userId);

    // Notify others
    this.broadcast(
      {
        type: 'user_left',
        userId,
        code,
        reason,
        timestamp: Date.now(),
      },
      userId,
    ).catch(console.error);

    // Save state
    this.saveState().catch(console.error);
  }

  handleError(ws: WebSocket, error: Error): void {
    console.error('WebSocket error:', error);
    const userId = this.findUserIdByWebSocket(ws);
    if (userId) {
      this.connections.delete(userId);
    }
  }

  async join(_userId: string, _metadata?: Record<string, unknown>): Promise<void> {
    // This method is for HTTP-based joining, not WebSocket
    // In practice, joining happens through WebSocket upgrade
    throw new Error('Use WebSocket connection to join the room');
  }

  async leave(userId: string): Promise<void> {
    const connection = this.connections.get(userId);
    if (connection) {
      connection.ws.close(1000, 'User left');
      this.connections.delete(userId);
    }
  }

  async broadcast(message: unknown, excludeUserId?: string): Promise<void> {
    const payload = JSON.stringify(message);

    for (const [userId, connection] of this.connections) {
      if (userId === excludeUserId) continue;

      try {
        connection.ws.send(payload);
      } catch (error) {
        console.error(`Failed to send to ${userId}:`, error);
        // Remove dead connections
        this.connections.delete(userId);
      }
    }
  }

  async sendToUser(userId: string, message: unknown): Promise<void> {
    const connection = this.connections.get(userId);
    if (!connection) {
      throw new Error(`User ${userId} not connected`);
    }

    this.sendToWebSocket(connection.ws, message);
  }

  async getState(): Promise<unknown> {
    return {
      roomData: this.roomData,
      connectedUsers: Array.from(this.connections.entries()).map(([userId, conn]) => ({
        userId,
        metadata: conn.metadata,
        joinedAt: conn.joinedAt,
      })),
      messageCount: this.messageHistory.length,
    };
  }

  async updateState(updates: Record<string, unknown>): Promise<void> {
    // Update room data
    Object.assign(this.roomData, updates);

    // Notify all users
    await this.broadcast({
      type: 'state_updated',
      updates,
      timestamp: Date.now(),
    });

    // Save state
    await this.saveState();
  }

  private async handleGetState(): Promise<Response> {
    const state = await this.getState();
    return this.json(state);
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    const body = await request.json();
    await this.broadcast(body.message, body.excludeUserId);
    return this.success();
  }

  private async handleGetHistory(): Promise<Response> {
    return this.json({
      history: this.messageHistory,
      total: this.messageHistory.length,
    });
  }

  private async handleUserMessage(userId: string, message: unknown): Promise<void> {
    // Add to history
    const entry = {
      userId,
      message,
      timestamp: Date.now(),
    };
    this.messageHistory.push(entry);

    // Trim history if needed
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
    }

    // Broadcast to all users
    await this.broadcast({
      type: 'message',
      userId,
      message,
      timestamp: entry.timestamp,
    });

    // Save state periodically
    if (this.messageHistory.length % 10 === 0) {
      await this.saveState();
    }
  }

  private async handleStateUpdate(userId: string, updates: Record<string, unknown>): Promise<void> {
    // Validate user has permission (could add role checking here)
    await this.updateState(updates);
  }

  private findUserIdByWebSocket(ws: WebSocket): string | undefined {
    for (const [userId, connection] of this.connections) {
      if (connection.ws === ws) {
        return userId;
      }
    }
    return undefined;
  }

  private sendToWebSocket(ws: WebSocket, message: unknown): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
    }
  }

  private parseMetadata(params: URLSearchParams): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    for (const [key, value] of params) {
      if (key !== 'userId') {
        metadata[key] = value;
      }
    }
    return metadata;
  }

  private async saveState(): Promise<void> {
    const state: RoomState = {
      connections: new Map(), // Don't persist WebSocket connections
      roomData: this.roomData,
      messageHistory: this.messageHistory,
    };
    await this.put('room:state', state);
  }
}
