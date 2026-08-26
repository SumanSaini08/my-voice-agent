# LiveKit Voice Agent 🎙️

A real-time voice AI agent built with LiveKit, combining Groq (Speech-to-Text + LLM) and Cartesia (Text-to-Speech), with automatic Hindi/English language detection — enabling natural, low-latency voice conversations.

## 🎯 About

This project is a real-time conversational voice agent that listens, understands, and responds to users through natural speech — in both Hindi and English. It uses LiveKit's real-time infrastructure (WebRTC-based) to handle audio streaming, while Groq powers fast speech transcription and language understanding, and Cartesia generates natural-sounding voice responses.

## ✨ Features

- Real-time voice conversation using WebRTC (via LiveKit)
- Speech-to-Text and LLM response generation powered by Groq
- Natural-sounding voice output using Cartesia TTS
- Automatic Hindi/English language detection during conversation
- Low-latency pipeline designed for smooth, natural back-and-forth dialogue
- Next.js-based frontend for the voice assistant interface

## 🛠️ Tech Stack

**Real-time Infrastructure**
- LiveKit (WebRTC SFU, Agents Framework)

**AI / Voice Processing**
- Groq API — Speech-to-Text and LLM
- Cartesia — Text-to-Speech

**Frontend**
- Next.js
- React

## ⚙️ How It Works

1. User speaks into the microphone through the web interface
2. LiveKit streams the audio in real time to the agent backend
3. Groq transcribes the speech and detects the language (Hindi or English)
4. The transcribed text is processed by Groq's LLM to generate a response
5. Cartesia converts the response text into natural speech
6. The audio response is streamed back to the user in real time through LiveKit

## 📁 Project Structure

```
livekit-voice-agent/
├── agent/                 # Voice agent backend logic
│   ├── stt/                # Groq speech-to-text integration
│   ├── llm/                 # Groq LLM response handling
│   └── tts/                 # Cartesia text-to-speech integration
├── frontend/               # Next.js voice assistant interface
│   ├── components/
│   └── pages/
├── package.json
└── README.md
```

## 🚀 Getting Started

1. Clone the repository
   ```
   git clone https://github.com/SumanSaini08/livekit-voice-agent.git
   ```
2. Navigate into the project folder
   ```
   cd livekit-voice-agent
   ```
3. Install dependencies
   ```
   npm install
   ```
4. Add your API keys to a `.env` file (LiveKit, Groq, Cartesia)
5. Start the development server
   ```
   npm run dev
   ```

## 🔑 Environment Variables

```
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
GROQ_API_KEY=
CARTESIA_API_KEY=
```

## 🌐 Language Support

The agent automatically detects whether the user is speaking in Hindi or English and responds accordingly, enabling a seamless bilingual conversation experience.

## 📌 Roadmap

- [ ] Add support for more languages
- [ ] Improve response latency further
- [ ] Add conversation memory across sessions
- [ ] Add voice activity visualization on the frontend

## 📬 Contact

For questions or suggestions related to this project, feel free to open an issue in this repository.

---
Built to make voice-based AI conversations feel natural and real-time.
