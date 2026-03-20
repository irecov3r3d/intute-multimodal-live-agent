# Intute Multimodal Live Agent

Intute is a high-performance React-based dashboard designed to facilitate seamless, real-time interactions with the **Google Gemini Generative AI Live API**. It combines audio streaming, visual feedback components, and a suite of tools to create a rich, multimodal AI assistant experience.

## 🚀 Features

- **Real-time Multimodal Interaction**: Full integration with the Google GenAI Live SDK for low-latency voice and data exchange.
- **Visual AI Feedback**: Includes `BasicFace`, a visual representation component that reacts to AI state and audio.
- **Interactive Tools**: Built-in `KeynoteCompanion` and `FunctionPlotter` for visualizing data and presentations in real-time.
- **Advanced Audio Stack**: Custom implementations for `audio-recorder`, `audio-streamer`, and `audioworklet-registry` to ensure high-quality voice input/output.
- **State Management**: Powered by `Zustand` for lightweight, reactive state across the dashboard and settings.
- **Modern Tech Stack**: Built with React 19, Vite, TypeScript, and Tailwind CSS 4.

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **AI SDK**: [@google/genai](https://www.npmjs.com/package/@google/genai)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Visualization**: [Recharts](https://recharts.org/) and [Function-plot](https://github.com/mauriciopoppe/function-plot)

## 📦 Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- A Google Gemini API Key with access to the Multimodal Live API.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/intute-multimodal-live-agent.git
   cd intute-multimodal-live-agent
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root and add your API credentials:
   ```env
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

## 📂 Project Structure

- `/components`: UI building blocks including the `ControlTray`, `AgentEdit`, and specialized `demo` widgets.
- `/contexts`: Context providers for the Live API integration.
- `/hooks`: Custom hooks for managing media streams (`use-live-api`) and UI animations (`use-tilt`, `use-face`).
- `/lib`: Core logic including the `genai-live-client`, audio worklets, and prompt presets.

## 📜 License

This project is licensed under the MIT License - see the `LICENSE` file for details.