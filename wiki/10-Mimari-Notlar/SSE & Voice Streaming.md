# SSE & Voice Streaming

## SSE — `/api/v1/chat/stream`
`POST` ile çağrılır; aynı [[Hermes Orkestratör]] pipeline'ı koşar fakat her adımda `progress` event yayar:
- `task_started`
- `plan_ready`
- `agent_started`
- `tool_called`
- `critic_scored`
- `agent_retry`
- `agent_completed`
- `merging`
- son olarak `message` event'i (buffered endpoint ile aynı payload).

Frontend: `sendUserMessageStream` (Zustand store) bu stream'i sürür; ortada hata olursa buffered `sendUserMessage`'a düşer.

## Voice — `WS /ws/voice`
`routes/voice.py`:
1. İstemci PCM stream'ler.
2. Backend Gemini Live'a forward eder (`gemini-2.0-flash-live-001`).
3. Transcript Türkçe intent matcher'dan geçer (`detectIntent` portu).
4. Eşleşen intent → [[Hermes Orkestratör]]'e dispatch.
5. `GEMINI_API_KEY` yoksa → MockProvider + tarayıcı `SpeechRecognition` fallback.
