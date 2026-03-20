/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  LiveCallbacks,
  LiveClientToolResponse,
  LiveConnectConfig,
  LiveServerContent,
  LiveServerMessage,
  LiveServerToolCall,
  LiveServerToolCallCancellation,
  Part,
  Session,
} from '@google/genai';
import EventEmitter from 'eventemitter3';
import { DEFAULT_LIVE_API_MODEL } from './constants';
import { difference } from 'lodash';
import { base64ToArrayBuffer } from './utils';

/**
 * Represents a single log entry for debugging purposes.
 */
export interface StreamingLog {
  count?: number;
  data?: unknown;
  date: Date;
  message: string | object;
  type: string;
}

/**
 * Defines the event types that can be emitted by the GenAILiveClient.
 * This provides a clean, typed interface for the rest of the application
 * to listen for specific server messages or client state changes.
 */
export interface LiveClientEventTypes {
  audio: (data: ArrayBuffer) => void;
  userAudio: (data: ArrayBuffer) => void;
  close: (event: CloseEvent) => void;
  content: (data: LiveServerContent) => void;
  error: (e: ErrorEvent) => void;
  interrupted: () => void;
  log: (log: StreamingLog) => void;
  open: () => void;
  setupcomplete: () => void;
  toolcall: (toolCall: LiveServerToolCall) => void;
  toolcallcancellation: (
    toolcallCancellation: LiveServerToolCallCancellation
  ) => void;
  turncomplete: () => void;
  inputTranscription: (text: string) => void;
  outputTranscription: (text: string) => void;
}

/**
 * A wrapper class around the GoogleGenAI Live API.
 * It provides an event-driven interface for managing the connection,
 * sending data, and receiving structured events from the server.
 */
export class GenAILiveClient {
  private emitter = new EventEmitter<LiveClientEventTypes>();
  public on = this.emitter.on.bind(this.emitter);
  public off = this.emitter.off.bind(this.emitter);
  public emit = this.emitter.emit.bind(this.emitter);

  public readonly model: string = DEFAULT_LIVE_API_MODEL;

  protected readonly client: GoogleGenAI;
  protected session?: Session;

  private _status: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  public get status() {
    return this._status;
  }

  constructor(apiKey: string, model?: string) {
    if (model) this.model = model;
    this.client = new GoogleGenAI({ apiKey: apiKey });
  }

  /**
   * Establishes a connection to the Live API with the provided configuration.
   * @param config The configuration for the Live API session.
   * @returns A boolean indicating whether the connection was successfully initiated.
   */
  public async connect(config: LiveConnectConfig): Promise<boolean> {
    if (this._status === 'connected' || this._status === 'connecting') {
      return false;
    }

    this._status = 'connecting';
    const callbacks: LiveCallbacks = {
      onopen: this.onOpen.bind(this),
      onmessage: this.onMessage.bind(this),
      onerror: this.onError.bind(this),
      onclose: this.onClose.bind(this),
    };

    let attempt = 0;
    const maxRetries = 3;
    const initialDelay = 1000;
    
    // Attempt to connect up to maxRetries times with exponential backoff.
    // This is crucial for handling temporary network blips or service unavailability.
    while (attempt < maxRetries) {
      try {
        this.session = await this.client.live.connect({
          model: this.model,
          config: { ...config },
          callbacks,
        });
        this._status = 'connected';
        return true; // Success
      } catch (e: any) {
        attempt++;
        if (e.message?.includes('Service is currently unavailable') && attempt < maxRetries) {
          const delay = initialDelay * Math.pow(2, attempt -1);
          console.warn(`Connection failed, attempt ${attempt}. Retrying in ${delay}ms...`);
          await new Promise(res => setTimeout(res, delay));
        } else {
          console.error('Error connecting to GenAI Live:', e);
          this._status = 'disconnected';
          this.session = undefined;
          return false; // Final failure
        }
      }
    }
    
    // This point is reached only if all retries fail.
    this._status = 'disconnected';
    this.session = undefined;
    return false;
  }

  /**
   * Closes the connection to the Live API.
   */
  public disconnect() {
    this.session?.close();
    this.session = undefined;
    this._status = 'disconnected';
    this.log('client.close', 'Disconnected');
    return true;
  }

  /**
   * Sends discrete content to the server, such as a text message.
   */
  public send(parts: Part | Part[], turnComplete: boolean = true) {
    if (this._status !== 'connected' || !this.session) {
      this.emitter.emit('error', new ErrorEvent('Client is not connected'));
      return;
    }
    this.session.sendClientContent({ turns: { parts: Array.isArray(parts) ? parts : [parts] }, turnComplete });
    this.log('client.send', parts);
  }

  /**
   * Sends real-time media data (e.g., audio from the microphone) to the server.
   */
  public sendRealtimeInput(chunks: { media: { mimeType: string; data: string } }) {
    if (this._status !== 'connected' || !this.session) {
      this.emitter.emit('error', new ErrorEvent('Client is not connected'));
      return;
    }
    this.session!.sendRealtimeInput(chunks);

    // Also emit the user's audio locally for logging purposes.
    if (chunks.media.mimeType.includes('audio')) {
      const data = base64ToArrayBuffer(chunks.media.data);
      this.emitter.emit('userAudio', data);
    }
    // Logging for debugging.
    const message = chunks.media.mimeType.includes('image') ? 'audio + video' : 'audio';
    this.log('client.realtimeInput', message);
  }

  /**
   * Sends a response back to the server after a function call has been executed.
   */
  // FIX: The type `LiveClientToolResponse` has `functionResponses` as optional, but the underlying
  // `session.sendToolResponse` expects it to be required. Using `Required` enforces this contract.
  public sendToolResponse(toolResponse: Required<LiveClientToolResponse>) {
    if (this._status !== 'connected' || !this.session) {
      this.emitter.emit('error', new ErrorEvent('Client is not connected'));
      return;
    }
    this.session.sendToolResponse(toolResponse);
    this.log('client.toolResponse', { toolResponse });
  }

  /**
   * The main message handler. It receives all messages from the server,
   * inspects their type, and emits the corresponding typed event.
   */
  protected onMessage(message: LiveServerMessage) {
    if (this._status !== 'connected' || !this.session) {
      return;
    }

    if (message.setupComplete) {
      this.emitter.emit('setupcomplete');
      return;
    }
    if (message.toolCall) {
      this.log('server.toolCall', message);
      this.emitter.emit('toolcall', message.toolCall);
      return;
    }
    if (message.toolCallCancellation) {
      this.log('receive.toolCallCancellation', message);
      this.emitter.emit('toolcallcancellation', message.toolCallCancellation);
      return;
    }

    if (message.serverContent) {
      const { serverContent } = message;

      if (serverContent.inputTranscription) {
        this.log('server.inputTranscription', serverContent.inputTranscription.text);
        this.emitter.emit('inputTranscription', serverContent.inputTranscription.text);
      }
      if (serverContent.outputTranscription) {
        this.log('server.outputTranscription', serverContent.outputTranscription.text);
        this.emitter.emit('outputTranscription', serverContent.outputTranscription.text);
      }
      
      if (serverContent.interrupted) {
        this.log('receive.serverContent', 'interrupted');
        this.emitter.emit('interrupted');
        return;
      }
      if (serverContent.turnComplete) {
        this.log('server.send', 'turnComplete');
        this.emitter.emit('turncomplete');
      }

      if (serverContent.modelTurn) {
        let parts: Part[] = serverContent.modelTurn.parts || [];

        // Separate audio parts from other content types.
        const audioParts = parts.filter(p => p.inlineData?.mimeType?.startsWith('audio/pcm'));
        if (audioParts.length > 0) {
          const b64 = audioParts[0].inlineData?.data;
          if (b64) {
            const data = base64ToArrayBuffer(b64);
            this.emitter.emit('audio', data);
            this.log('server.audio', `buffer (${data.byteLength})`);
          }
        }
        
        // Handle any non-audio parts.
        const otherParts = difference(parts, audioParts);
        if (otherParts.length > 0) {
            const content: LiveServerContent = { modelTurn: { parts: otherParts } };
            this.emitter.emit('content', content);
            this.log('server.content', message);
        }
      } else if (!serverContent.inputTranscription && !serverContent.outputTranscription && !serverContent.turnComplete && !serverContent.generationComplete) {
        console.log('received unmatched message', message);
      }
    }
  }

  protected onError(e: any) {
    if (this._status === 'disconnected') return;
    this._status = 'disconnected';
    console.error('Live API Error:', e);
    
    // Extract meaningful detail from the error object
    let detail = '';
    if (e && typeof e === 'object') {
      detail = e.message || e.reason || '';
      if (!detail && e.target instanceof WebSocket) {
        detail = 'WebSocket connection failed (check API key, network, or concurrent session limits)';
      }
    } else if (typeof e === 'string') {
      detail = e;
    }

    const message = `Could not connect to GenAI Live: ${detail || 'Unknown error'}`;
    this.log('server.error', message);
    this.emitter.emit('error', e);
  }

  protected onOpen() {
    if (this._status !== 'connecting') return;
    this._status = 'connected';
    this.log('client.open', 'Connected');
    this.emitter.emit('open');
  }

  protected onClose(e: CloseEvent) {
    if (this._status === 'disconnected') return;
    this._status = 'disconnected';
    let reason = e.reason || '';
    
    // Handle common abnormal closure codes
    if (!reason) {
      if (e.code === 1006) {
        reason = "Connection closed abnormally (1006). This often happens due to rate limits or invalid credentials.";
      } else if (e.code === 1000) {
        reason = "Normal closure";
      } else {
        reason = `Closed with code ${e.code}`;
      }
    }

    if (reason.toLowerCase().includes('error')) {
      const prelude = 'ERROR]';
      const preludeIndex = reason.indexOf(prelude);
      if (preludeIndex > 0) {
        reason = reason.slice(preludeIndex + prelude.length + 1, Infinity);
      }
    }
    this.log('server.close', `Disconnected: ${reason}`);
    this.emitter.emit('close', e);
  }

  /**
   * Internal method to emit a standardized log event.
   */
  protected log(type: string, message: string | object) {
    this.emitter.emit('log', { type, message, date: new Date() });
  }
}
