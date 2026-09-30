(() => {
  const mkVoice = (name, lang, localService) => ({ name, lang, localService, default: false, voiceURI: name });
  window.__VOICES = [
    mkVoice("eSpeak NG English (Traditional Male)", "en-GB", true),
    mkVoice("Microsoft David - English (United States)", "en-US", true),
    mkVoice("Google US English", "en-US", false),
    mkVoice("Google বাংলা", "bn-BD", false),
    mkVoice("Samsung TTS Bangla Female", "bn-IN", true),
  ];
  window.__utts = [];
  class MockUtt {
    constructor(text){ this.text = text; this.lang = ""; this.rate = 1; this.pitch = 1; this.volume = 1; this._voice = null; this.onstart = null; this.onend = null; this.onerror = null; }
    get voice(){ return this._voice; }
    set voice(v){ this._voice = v; }
  }
  window.SpeechSynthesisUtterance = MockUtt;
  const ssMock = {
    getVoices: () => window.__VOICES,
    speak: (u) => { window.__utts.push({ text: u.text, lang: u.lang, voice: u.voice ? u.voice.name : null, volume: u.volume, pitch: u.pitch, rate: u.rate }); setTimeout(() => { try { u.onend && u.onend(); } catch(e){} }, 30); },
    cancel: () => {}, resume: () => {}, pause: () => {},
    get speaking(){ return false; }, get pending(){ return false; }, get paused(){ return false; },
    addEventListener: () => {}, removeEventListener: () => {},
  };
  Object.defineProperty(window, "speechSynthesis", { configurable: true, get: () => ssMock });
  return "harness ready";
})()
