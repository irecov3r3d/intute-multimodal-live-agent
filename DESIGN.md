# Intute: Technical Design Document

## 1. Overview
Intute is a real-time, AI-powered teaching assistant that combines low-latency voice interaction with a collaborative "digital blackboard." It leverages the **Gemini Live API** for multimodal conversation and the **Gemini 3 Pro Image** model for dynamic visual generation.

The core value proposition is "Document-First Teaching": the AI is instructed to write down notes and create diagrams *before* or *during* its verbal explanation, ensuring the student has a permanent, visual record of the lesson.

---

## 2. System Architecture

### 2.1 Core Technologies
- **Frontend**: React 18, TypeScript, Tailwind CSS.
- **State Management**: Zustand (Global stores for User, Agent, UI, Logs, and Inserts).
- **AI Integration**: `@google/genai` (Gemini Live API & Image API).
- **Rendering**: `marked` (Markdown), `MathJax` (LaTeX), `function-plot` (Mathematical graphing).
- **Audio**: Web Audio API (AudioWorklets for PCM processing).

### 2.2 Component Hierarchy
- **App**: Root component managing providers and the main layout.
- **KeynoteCompanion**: The primary orchestrator. Manages the document state, tool calls, and event listeners.
- **ControlTray**: Handles the session lifecycle (Connect/Disconnect) and microphone input.
- **DocumentRenderer**: A memoized component that parses Markdown and renders custom tags (`[illustration]`, `[graph]`).
- **BasicFace (Avatar)**: A canvas-based visual representation of the agent that reacts to audio volume.

---

## 3. Core Functional Loops

### 3.1 The Live Agent Loop
The interaction follows a continuous WebSocket-based cycle:
1.  **Input**: `AudioRecorder` captures PCM audio at 16kHz. Chunks are base64-encoded and sent via `sendRealtimeInput`.
2.  **Processing**: The Gemini Live API processes audio natively. Simultaneously, it streams back an `inputTranscription`.
3.  **Response**: The model streams back PCM audio (played via `AudioStreamer`) and text parts.
4.  **Tool Orchestration**: The model executes tools to sync with the UI:
    - `getContext()`: Retrieves the current document, transcript, and student info.
    - `updateDocument(content)`: Replaces the document state with new Markdown/LaTeX content.
    - `insertIllustration(prompt, style)`: Triggers a side-channel call to the Image API.
    - `inspectIllustration(id)`: Sends an existing image back to the model's visual buffer.

### 3.2 Visual Generation & Inspection
- **Generation**: When `insertIllustration` is called, the client returns a placeholder tag to the model immediately. In the background, it calls `gemini-3-pro-image-preview`. Once the image is ready, the `InsertStore` is updated, and the `DocumentRenderer` replaces the placeholder with the actual image.
- **Inspection**: Since the model cannot "see" the document by default, it uses `inspectIllustration`. The client retrieves the base64 data from the local store and sends it to the model as a `media` chunk, allowing the model to describe specific visual details accurately.

---

## 4. Multimodal Context Management

### 4.1 The Dual-Memory System
Intute manages two distinct types of "memory" for the Gemini model:
1.  **Textual Context (The "What")**: Managed via the `getContext` tool. This provides the model with the high-level state of the lesson, including the full Markdown document and the recent conversation history.
2.  **Visual Buffer (The "How it Looks")**: Managed via `inspectIllustration`. Because the Live API's visual input is a "buffer" rather than a persistent state, the model must explicitly request an image to be "pushed" into its field of vision.

### 4.2 Just-in-Time Context Injection
To keep the model focused and prevent hallucinations, the app uses "Whisper Prompts" (hidden system messages). These are injected into the transcript or sent as direct messages during session transitions (e.g., when resuming a session or after a user cancels an action).

---

## 5. Life of a Turn: Sequence Walkthroughs

### Example 1: Visual Inspection (Explaining an existing image)
1.  **User Input**: User says, "Can you explain the diagram of the heart you just made?"
2.  **Native Audio Processing**: The model "hears" the request and recognizes the intent to discuss a specific visual.
3.  **Context Sync (`getContext`)**:
    - The model calls `getContext()`.
    - The client responds with the current `documentContent` containing `[illustration id="img_heart_1"]`.
4.  **Visual Fetch (`inspectIllustration`)**:
    - The model identifies the ID and calls `inspectIllustration(id="img_heart_1")`.
    - The client sends the actual image data to the model's visual buffer.
5.  **Multimodal Synthesis**: The model now "sees" the image and "knows" the context.
6.  **Verbal Response**: The model generates an audio response: "Certainly! If you look at the top left of the diagram..."

### Example 2: Content Creation (Updating the document)
1.  **User Input**: User says, "Can you list the main types of renewable energy?"
2.  **Context Sync (`getContext`)**: The model calls `getContext()` to see where to append the new information.
3.  **Document Update (`updateDocument`)**:
    - The model generates a structured Markdown list (Solar, Wind, Hydro, etc.).
    - It calls `updateDocument(content)` with the *entire* updated document string.
    - The client updates the UI, renders the new Markdown, and adds the previous version to the Undo history.
4.  **Verbal Response**: Only *after* the tool call is issued, the model speaks: "I've added a summary of the five main types of renewable energy to your notes. Would you like to dive into how Solar power works first?"

---

## 6. State & Persistence

### 4.1 Document State
The document is stored as a single Markdown string. 
- **History**: Every change is pushed to a `documentHistory` array, enabling multi-level **Undo/Redo**.
- **Inserts**: Images are managed in a separate `useInsertStore` to keep the document string lightweight (storing only IDs).

### 4.2 Session Logs
- **Transcript**: A text-based record of the conversation.
- **Audio Log**: Raw audio blobs from both the user and the agent are stored in memory, allowing the user to review the "voice" of the lesson later.

---

## 5. Robustness & Error Handling

### 5.1 Connection Lifecycle
- **Clean Shutdown**: The `disconnect` function ensures the WebSocket is closed and the microphone hardware is released.
- **Race Condition Protection**: The `AudioRecorder` uses a `starting` promise to ensure that a `stop()` call always cleans up correctly, even if the recorder was still initializing.
- **Error Recovery**: The `ErrorScreen` monitors WebSocket close codes. It specifically identifies **1006 (Abnormal Closure)** and **RESOURCE_EXHAUSTED** errors, providing user-friendly guidance and a "Close" mechanism to reset the state.

### 5.2 Handshake Synchronization
The app uses a "Defensive Handshake" protocol:
- It waits for the server's `setupcomplete` signal before allowing audio input.
- It resets all internal buffers and flags on every new connection attempt to prevent state leakage.

---

## 6. UI/UX Principles
- **Vibrant & Playful**: Uses spring-based animations (via `motion`) and a reactive avatar.
- **Context-Aware**: The avatar's status label changes based on the agent's internal state (e.g., "Thinking", "Creating Diagram", "Getting Image").
- **Responsive**: The layout adapts from a side-by-side desktop view to a stacked mobile view, with a floating toolbar for document actions.
