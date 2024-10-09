class SpeechSynthesizer {
    constructor() {
      this.synth = window.speechSynthesis;
      this.voices = [];
      this.currentVoice = null;
      this.currentLang = 'en-AU'; // Default language
      this.voiceNames = {
        'en': ['Gordon', 'William', 'James', 'Male voice 1', 'Male voice 2', 'Australian voice'],
        'fr': ['Remy', 'Henri', 'Thomas', 'Paul', 'Voix masculine 1', 'Voix masculine 2', 'Voix française'],
        'ja': ['Keita', 'Otoya', 'Hattori', 'Ichiro', '男性の声1', '男性の声2', '日本の音声']
      };
  
      this.populateVoiceList();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = this.populateVoiceList.bind(this);
      }
    }
  
    populateVoiceList() {
      this.voices = this.synth.getVoices().sort((a, b) => {
        const aname = a.name.toUpperCase();
        const bname = b.name.toUpperCase();
        return aname < bname ? -1 : aname > bname ? 1 : 0;
      });
      console.log("Available voices:", this.voices.map(v => `${v.name} (${v.lang})`));
    }
  
    setLanguage(lang) {
      this.currentLang = lang;
    }
  
    findVoiceByName(lang) {
      const langCode = lang.split('-')[0].toLowerCase();
      const names = this.voiceNames[langCode] || [];
      const langVoices = this.voices.filter(v => v.lang.toLowerCase().startsWith(langCode));
      
      for (let name of names) {
        const voice = langVoices.find(v => v.name.toLowerCase().includes(name.toLowerCase()));
        if (voice) {
          return voice;
        }
      }
      return null;
    }
  
    speak(textToBeSpoken) {
      if (this.synth.speaking) {
        console.error("speechSynthesis.speaking");
        return;
      }
      if (textToBeSpoken !== "") {
        const utterThis = new SpeechSynthesisUtterance(textToBeSpoken);
        utterThis.onend = function (event) {
          console.log("SpeechSynthesisUtterance.onend");
        };
        utterThis.onerror = function (event) {
          console.error("SpeechSynthesisUtterance.onerror");
        };
        if (this.currentVoice) {
          utterThis.voice = this.currentVoice;
        }
        utterThis.lang = this.currentLang;
        utterThis.pitch = 0.5;
        utterThis.rate = 1;
        this.synth.speak(utterThis);
      }
    }
  
    stopSpeech() {
      if (this.synth.speaking) {
        this.synth.cancel();
        console.log("Speech stopped");
      }
    }
  
    changeLanguage(text, lang) {
      if (this.synth.speaking) {
        console.error("Cannot change language while speaking");
        return false;
      }
      const voice = this.findVoiceByName(lang);
      this.currentVoice = voice;
      this.currentLang = lang;
      this.speak(text);
      return true;
    }
  }

  let tts;

  function initTTS() {
    try {
      if (typeof SpeechSynthesizer === 'function') {
        tts = new SpeechSynthesizer();
        console.log("SpeechSynthesizer initialized successfully");
      } else {
        throw new Error("SpeechSynthesizer is not a constructor");
      }
    } catch (error) {
      console.log("Failed to initialize SpeechSynthesizer:", error.message);
    }
    return tts;
  }
  
  function readMessage(text, languageSet, soundIsOn) {
    if (tts) {
      tts.stopSpeech();
      if (languageSet && soundIsOn) {
        tts.setLanguage(languageSet);
        tts.speak(text);
      }
    }
  }
  
  window.SpeechSynthesizer = SpeechSynthesizer;

  export { initTTS, readMessage };