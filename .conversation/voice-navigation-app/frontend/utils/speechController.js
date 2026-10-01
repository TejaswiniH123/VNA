// frontend/utils/speechController.js

export class SpeechController {
  constructor({
    onCommand,
    onTranscript,
    onStateChange,
    onError,
    getLanguage,
    isSpeakingRef
  }) {
    this.onCommand = onCommand || (() => {});
    this.onTranscript = onTranscript || (() => {});
    this.onStateChange = onStateChange || (() => {});
    this.onError = onError || (() => {});
    this.getLanguage = getLanguage || (() => "en-US");
    this.isSpeakingRef = isSpeakingRef || { current: false };

    this.recognition = null;
    this.isListeningIntentional = false;
    this.isListening = false;
    this.lastCommandTime = 0;
    this.commandDebounceMs = 1500;
    this.restartTimeout = null;
  }

  isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  startListening() {
    if (!this.isSupported()) {
      this.onError("Speech recognition not supported in this browser.");
      return false;
    }

    this.isListeningIntentional = true;

    // Clean up any existing instance to guarantee strictly ONE active instance
    this.stopListening(false);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = this.getLanguage();

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onStateChange({ isListening: true, intentional: true });
    };

    this.recognition.onresult = (event) => {
      // Prevent feedback loops if TTS is actively speaking
      if (this.isSpeakingRef.current) {
        console.log("Ignoring speech input during TTS playback.");
        return;
      }

      const results = event.results;
      if (!results || results.length === 0) return;

      const latestResult = results[results.length - 1];
      if (latestResult.isFinal || latestResult[0]?.transcript) {
        const transcript = latestResult[0].transcript.trim();
        this.onTranscript(transcript);
        this.handleTranscript(transcript);
      }
    };

    this.recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      const errorType = event.error;

      if (errorType === "not-allowed" || errorType === "service-not-allowed") {
        this.isListeningIntentional = false;
        this.isListening = false;
        this.onStateChange({ isListening: false, intentional: false });
        this.onError("Microphone permission denied.");
        return;
      }

      if (errorType === "no-speech") {
        // Normal silence timeout; do not trigger error loop
        return;
      }

      if (errorType === "aborted") {
        return;
      }

      // Non-fatal error notification
      this.onError(`Voice recognition: ${errorType}`);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.onStateChange({ isListening: false, intentional: this.isListeningIntentional });

      // Only restart if the user intentionally enabled listening,
      // and we are not speaking TTS, and not in an error state
      if (this.isListeningIntentional) {
        if (this.restartTimeout) clearTimeout(this.restartTimeout);
        this.restartTimeout = setTimeout(() => {
          if (this.isListeningIntentional && !this.isSpeakingRef.current) {
            try {
              if (this.recognition) {
                this.recognition.lang = this.getLanguage();
                this.recognition.start();
              }
            } catch (err) {
              console.warn("Failed to restart speech recognition:", err);
            }
          }
        }, 500);
      }
    };

    try {
      this.recognition.start();
      return true;
    } catch (err) {
      console.error("Error starting speech recognition:", err);
      this.isListeningIntentional = false;
      this.isListening = false;
      this.onStateChange({ isListening: false, intentional: false });
      return false;
    }
  }

  stopListening(userInitiated = true) {
    if (userInitiated) {
      this.isListeningIntentional = false;
    }
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.onerror = null;
        this.recognition.onresult = null;
        this.recognition.stop();
      } catch (err) {
        console.warn("Error stopping recognition:", err);
      }
      this.recognition = null;
    }
    this.isListening = false;
    this.onStateChange({ isListening: false, intentional: this.isListeningIntentional });
  }

  setLanguage(langCode) {
    if (this.recognition) {
      this.recognition.lang = langCode;
    }
  }

  handleTranscript(rawTranscript) {
    const now = Date.now();
    if (now - this.lastCommandTime < this.commandDebounceMs) {
      return; // Debounce rapid triggers
    }

    const text = rawTranscript.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "").trim();

    // Match supported commands
    const command = this.parseCommand(text, rawTranscript);
    if (command) {
      this.lastCommandTime = now;
      this.onCommand(command);
    }
  }

  parseCommand(text, original) {
    // 1. HELP / COMMANDS
    if (
      text === "help" ||
      text.includes("what can i say") ||
      text.includes("commands") ||
      text.includes("voice commands") ||
      text.includes("मदद") ||
      text.includes("सहायता") ||
      text.includes("ಸಹಾಯ") ||
      text.includes("உதவி") ||
      text.includes("సహాయం") ||
      text.includes("സഹായം")
    ) {
      return { type: "HELP" };
    }

    // 2. START CAMERA / START LIVE DETECTION
    if (
      text.includes("start live detection") ||
      text.includes("start camera") ||
      text.includes("start live") ||
      text.includes("start detection") ||
      text.includes("open camera") ||
      text.includes("turn on camera") ||
      text.includes("कैमरा शुरू") ||
      text.includes("लाइव पहचान शुरू") ||
      text.includes("ಕ್ಯಾಮರಾ ಪ್ರಾರಂಭಿಸಿ") ||
      text.includes("கேமராவை தொடங்கு") ||
      text.includes("కెమెరాను ప్రారంభించండి") ||
      text.includes("ക്യാമറ ആരംഭിക്കുക")
    ) {
      return { type: "START_LIVE_DETECTION" };
    }

    // 3. STOP CAMERA / STOP LIVE DETECTION
    if (
      text.includes("stop live detection") ||
      text.includes("stop camera") ||
      text.includes("stop live") ||
      text.includes("stop detection") ||
      text.includes("close camera") ||
      text.includes("turn off camera") ||
      text.includes("कैमरा बंद") ||
      text.includes("लाइव पहचान बंद") ||
      text.includes("ಕ್ಯಾಮರಾ ನಿಲ್ಲಿಸಿ") ||
      text.includes("கேமராவை நிறுத்து") ||
      text.includes("కెమెరాను ఆపండి") ||
      text.includes("ക്യാമറ നിർത്തുക")
    ) {
      return { type: "STOP_LIVE_DETECTION" };
    }

    // 4. WHAT IS AROUND ME / WHAT IS IN FRONT OF ME / LOOK AROUND
    if (
      text.includes("what is around me") ||
      text.includes("what's around me") ||
      text.includes("what is in front of me") ||
      text.includes("what's in front of me") ||
      text.includes("look around") ||
      text.includes("what do you see") ||
      text.includes("what is in front") ||
      text.includes("मेरे सामने क्या है") ||
      text.includes("आसपास क्या है") ||
      text.includes("ನನ್ನ ಮುಂದೆ ಏನಿದೆ") ||
      text.includes("சுற்றி என்ன இருக்கிறது") ||
      text.includes("నా ముందు ఏముంది") ||
      text.includes("എന്റെ മുന്നിൽ എന്താണ്")
    ) {
      return { type: "DESCRIBE_AROUND" };
    }

    // 5. READ THIS / READ SIGNBOARD / READ TEXT
    if (
      text.includes("read this") ||
      text.includes("read signboard") ||
      text.includes("read text") ||
      text.includes("read sign") ||
      text.includes("read board") ||
      text.includes("यह पढ़ो") ||
      text.includes("बोर्ड पढ़ो") ||
      text.includes("ಇದನ್ನು ಓದಿ") ||
      text.includes("இதைப் படியுங்கள்") ||
      text.includes("దీన్ని చదవండి") ||
      text.includes("ഇത് വായിക്കുക")
    ) {
      return { type: "READ_TEXT" };
    }

    // 6. STOP NAVIGATION / CANCEL NAVIGATION
    if (
      text.includes("stop navigation") ||
      text.includes("cancel navigation") ||
      text.includes("end navigation") ||
      text.includes("नेविगेशन बंद") ||
      text.includes("ನ್ಯಾವಿಗೇಷನ್ ನಿಲ್ಲಿಸಿ") ||
      text.includes("வழிசெலுத்தலை நிறுத்து") ||
      text.includes("నావిగేషన్ ఆపండి") ||
      text.includes("നാവിഗേഷൻ നിർത്തുക")
    ) {
      return { type: "STOP_NAVIGATION" };
    }

    // 7. TAKE ME TO [DESTINATION] / NAVIGATE TO [DESTINATION]
    const navPatterns = [
      /take me to (.+)/i,
      /navigate to (.+)/i,
      /directions to (.+)/i,
      /guide me to (.+)/i,
      /go to (.+)/i,
      /मुझे (.+) ले चलो/i,
      /(.+) का रास्ता बताओ/i,
      /(.+) ಗೆ ಕರೆದೊಯ್ಯಿರಿ/i,
      /(.+) க்கு அழைத்துச் செல்லுங்கள்/i,
      /(.+) కి తీసుకెళ్లండి/i,
      /(.+) ലേക്ക് കൊണ്ടുപോകൂ/i,
    ];

    for (const pattern of navPatterns) {
      const match = original.match(pattern);
      if (match && match[1]) {
        const destination = match[1].replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "").trim();
        if (destination.length > 0) {
          return { type: "NAVIGATE_TO", destination };
        }
      }
    }

    return null;
  }
}
