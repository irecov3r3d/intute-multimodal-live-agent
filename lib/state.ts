/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import {
  Agent,
  Alice,
  Irene,
  Juan,
  Rahul,
  Sam,
  Seema,
  Tom,
  Ari,
  Padmini,
  Amelie,
  Yael,
  Mei,
  Hiro,
  Jiwon,
  Hans,
  Defne,
  Karim,
  Reza,
  Ines,
} from './presets/agents';
import { themes } from './themes';

/**
 * ===================================================================
 *  ZUSTAND STATE MANAGEMENT
 * ===================================================================
 * This file centralizes the application's global state using Zustand.
 * Each "slice" of the state is managed by its own store.
 * ===================================================================
 */

/**
 * `useUser` Store
 * Manages all settings and context related to the end-user.
 */
export type User = {
  name?: string;
  info?: string;
  topic?: string;
};

export const useUser = create<
  {
    setName: (name: string) => void;
    setInfo: (info: string) => void;
    setTopic: (topic: string) => void;
    reset: () => void;
  } & User
>(set => ({
  name: '',
  info: '',
  topic: '',
  setName: name => set({ name }),
  setInfo: info => set({ info }),
  setTopic: topic => set({ topic }),
  reset: () => set({ name: '', info: '', topic: '' }),
}));

/**
 * `useAgent` Store
 * Manages the state of the AI agents, including the currently active agent
 * and the list of available agents.
 */
function getAgentById(id: string) {
  const { availablePersonal, availablePresets } = useAgent.getState();
  return (
    availablePersonal.find(agent => agent.id === id) ||
    availablePresets.find(agent => agent.id === id)
  );
}

export const useAgent = create<{
  current: Agent;
  availablePresets: Agent[];
  availablePersonal: Agent[];
  setCurrent: (agent: Agent | string) => void;
  addAgent: (agent: Agent) => void;
  update: (agentId: string, adjustments: Partial<Agent>) => void;
  reset: () => void;
}>(set => ({
  current: Alice,
  availablePresets: [
    Alice,
    Sam,
    Irene,
    Tom,
    Juan,
    Amelie,
    Ines,
    Mei,
    Hiro,
    Jiwon,
    Seema,
    Rahul,
    Padmini,
    Karim,
    Yael,
    Reza,
    Defne,
    Ari,
    Hans,
  ],
  availablePersonal: [],

  addAgent: (agent: Agent) => {
    set(state => ({
      availablePersonal: [...state.availablePersonal, agent],
      current: agent,
    }));
  },
  setCurrent: (agent: Agent | string) =>
    set({ current: typeof agent === 'string' ? getAgentById(agent) : agent }),
  update: (agentId: string, adjustments: Partial<Agent>) => {
    let agent = getAgentById(agentId);
    if (!agent) return;
    const updatedAgent = { ...agent, ...adjustments };
    set(state => ({
      availablePresets: state.availablePresets.map(a =>
        a.id === agentId ? updatedAgent : a
      ),
      availablePersonal: state.availablePersonal.map(a =>
        a.id === agentId ? updatedAgent : a
      ),
      current: state.current.id === agentId ? updatedAgent : state.current,
    }));
  },
  reset: () => set({ current: Alice }),
}));

export type DocumentMode = 'rendered' | 'editor';

/**
 * `useUI` Store
 * Manages the state of the user interface, such as the visibility of modals,
 * the selected theme, and other UI-related flags.
 */
export const useUI = create<{
  showWelcomeScreen: boolean;
  setShowWelcomeScreen: (show: boolean) => void;
  showUserConfig: boolean;
  setShowUserConfig: (show: boolean) => void;
  showAgentEdit: boolean;
  setShowAgentEdit: (show: boolean) => void;
  showDebugModal: boolean;
  setShowDebugModal: (show: boolean) => void;
  showHelpModal: boolean;
  setShowHelpModal: (show: boolean) => void;
  theme: string;
  setTheme: (themeName: string) => void;
  suppressRedundantLogs: boolean;
  setSuppressRedundantLogs: (suppress: boolean) => void;
  suppressStaleAgentResponses: boolean;
  setSuppressStaleAgentResponses: (suppress: boolean) => void;
  changeCount: number;
  incrementChangeCount: () => void;
  agentState: string | null;
  setAgentState: (state: string | null) => void;
  documentMode: DocumentMode;
  setDocumentMode: (mode: DocumentMode) => void;
  imageTimeoutSeconds: number;
  resetCounter: number;
  reset: () => void;
}>(set => ({
  showWelcomeScreen: true,
  setShowWelcomeScreen: (show: boolean) => set({ showWelcomeScreen: show }),
  showUserConfig: false,
  setShowUserConfig: (show: boolean) => set({ showUserConfig: show }),
  showAgentEdit: false,
  setShowAgentEdit: (show: boolean) => set({ showAgentEdit: show }),
  showDebugModal: false,
  setShowDebugModal: (show: boolean) => set({ showDebugModal: show }),
  showHelpModal: false,
  setShowHelpModal: (show: boolean) => set({ showHelpModal: show }),
  theme: themes[1].name,
  setTheme: (themeName: string) => set({ theme: themeName }),
  suppressRedundantLogs: true, // Default to ON
  setSuppressRedundantLogs: (suppress: boolean) =>
    set({ suppressRedundantLogs: suppress }),
  suppressStaleAgentResponses: false, // Default to OFF as requested
  setSuppressStaleAgentResponses: (suppress: boolean) =>
    set({ suppressStaleAgentResponses: suppress }),
  changeCount: 0,
  incrementChangeCount: () =>
    set(state => ({ changeCount: state.changeCount + 1 })),
  agentState: null,
  setAgentState: (state: string | null) => set({ agentState: state }),
  documentMode: 'rendered',
  setDocumentMode: (mode: DocumentMode) => set({ documentMode: mode }),
  imageTimeoutSeconds: 300,
  resetCounter: 0,
  reset: () => set(state => ({
    showWelcomeScreen: true,
    showUserConfig: false,
    showAgentEdit: false,
    showDebugModal: false,
    showHelpModal: false,
    agentState: null,
    documentMode: 'rendered',
    resetCounter: state.resetCounter + 1,
  })),
}));

/**
 * `useLogStore` Store
 * Manages a rolling list of log entries for the debug modal.
 */
export type LogEntry = {
  timestamp: Date;
  api: string;
  inputSize: number | string;
  outputSize: number | string;
  status: 'success' | 'error';
  error?: string;
  prompt?: string;
  response?: string;
  audioSize?: number;
  promptVersion?: number;
};

const MAX_LOG_ENTRIES = 50;

export const useLogStore = create<{
  logs: LogEntry[];
  addLog: (log: Omit<LogEntry, 'timestamp'>) => void;
}>(set => ({
  logs: [],
  addLog: log => {
    set(state => {
      const newLog: LogEntry = { ...log, timestamp: new Date() };
      const updatedLogs = [newLog, ...state.logs];
      // Keep the log array from growing indefinitely.
      if (updatedLogs.length > MAX_LOG_ENTRIES) {
        updatedLogs.pop();
      }
      return { logs: updatedLogs };
    });
  },
}));

/**
 * `usePerfLogStore` Store
 * Manages a rolling list of high-precision performance log entries for debugging latency.
 */
export type PerfLogEntry = {
  timestamp: number; // For display (Date.now())
  perfTimestamp: number; // For calculation (performance.now())
  sessionId: string;
  turn: number;
  event: string;
  delta?: number; // Time in ms since the previous performance log entry
  details?: any;
};

const MAX_PERF_LOG_ENTRIES = 200;

export const usePerfLogStore = create<{
  logs: PerfLogEntry[];
  sessionId: string | null;
  startNewSession: () => void;
  addLog: (log: Omit<PerfLogEntry, 'timestamp' | 'perfTimestamp' | 'delta' | 'sessionId'>) => void;
  clearLogs: () => void;
}>(set => ({
  logs: [],
  sessionId: null,
  startNewSession: () => set({ sessionId: `session_${Date.now()}` }),
  addLog: log => {
    set(state => {
      const nowPerf = performance.now();
      const nowReal = Date.now();
      const lastLog = state.logs[0];
      // Find the last log with the same session ID to calculate delta correctly
      const lastLogThisSession = state.logs.find(l => l.sessionId === state.sessionId);
      const delta = lastLogThisSession ? nowPerf - lastLogThisSession.perfTimestamp : undefined;

      const newLog: PerfLogEntry = {
        ...log,
        timestamp: nowReal,
        perfTimestamp: nowPerf,
        delta,
        sessionId: state.sessionId || 'session_unknown',
      };
      const updatedLogs = [newLog, ...state.logs];
      if (updatedLogs.length > MAX_PERF_LOG_ENTRIES) {
        updatedLogs.pop();
      }
      return { logs: updatedLogs };
    });
  },
  clearLogs: () => set({ logs: [], sessionId: null }),
}));


// Defines the shape for an entry in the text-based conversation transcript.
export type TranscriptEntry = {
  speaker: string;
  text: string;
};

// Defines the shape for an entry in the audio log, storing the raw audio blob.
export type AudioLogEntry = {
  speaker: string;
  blob: Blob;
  timestamp: Date;
};

export const useSessionStore = create<{
  transcript: TranscriptEntry[];
  addTranscriptEntry: (entry: TranscriptEntry) => void;
  audioLog: AudioLogEntry[];
  addAudioLogEntry: (entry: AudioLogEntry) => void;
  documentContent: string;
  setDocumentContent: (content: string | ((prev: string) => string)) => void;
  clearSession: () => void;
}>(set => ({
  transcript: [],
  addTranscriptEntry: (entry) => set(state => ({ transcript: [...state.transcript, entry] })),
  audioLog: [],
  addAudioLogEntry: (entry) => set(state => ({ audioLog: [...state.audioLog, entry] })),
  documentContent: 'As you talk, your teacher will update the lesson notes here...',
  setDocumentContent: (content) => set(state => ({
    documentContent: typeof content === 'function' ? content(state.documentContent) : content
  })),
  clearSession: () => set({ transcript: [], audioLog: [], documentContent: 'As you talk, your teacher will update the lesson notes here...' }),
}));

/**
 * Represents the state of a dynamic insert (like an image) in the document.
 */
export type ImageInsert = {
  id: string;
  type: 'image';
  prompt: string;
  status: 'loading' | 'done' | 'error';
  data?: string; // base64 string
  error?: string;
};

export type GraphData = {
  title: string;
  functions: string[];
  xDomain: [number, number];
  yDomain: [number, number];
  labels: string[];
  xLabel?: string;
  yLabel?: string;
  colors?: string[];
};

// The Insert type is now specific to images, as graphs are handled differently.
export type Insert = ImageInsert;


/**
 * `useInsertStore` Store
 * Manages the state of all dynamic inserts within the document.
 */
export const useInsertStore = create<{
  inserts: Insert[];
  addInsert: (insert: Insert) => void;
  updateInsert: (id: string, updates: Partial<Insert>) => void;
  removeInsert: (id: string) => void;
  clearInserts: () => void;
}>(set => ({
  inserts: [],
  addInsert: (insert: Insert) =>
    set(state => ({ inserts: [...state.inserts, insert] })),
  updateInsert: (id: string, updates: Partial<Insert>) =>
    set(state => ({
      inserts: state.inserts.map(insert =>
        insert.id === id ? { ...insert, ...updates } : insert
      ),
    })),
  removeInsert: (id: string) =>
    set(state => ({
      inserts: state.inserts.filter(insert => insert.id !== id),
    })),
  clearInserts: () => set({ inserts: [] }),
}));
