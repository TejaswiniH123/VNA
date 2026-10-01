import React, { useState, useEffect, useRef } from "react";
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  getMessage,
  translateObjectLabel,
  translateDirection,
  formatDetectionSentence
} from "./utils/languages";
import { SpeechController } from "./utils/speechController";
import { NavigationManager } from "./utils/navigationManager";

const backendURL = "";

function App() {
  // ---------------- Core Feature States ----------------
  const [ocrResult, setOcrResult] = useState("");
  const [objectResult, setObjectResult] = useState([]);
  const [sttResult, setSttResult] = useState("");
  const [ttsText, setTtsText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [activeTab, setActiveTab] = useState("home");

  // ---------------- Language State ----------------
  const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_LANGUAGE);

  // ---------------- Live Detection States ----------------
  // CAMERA_OFF | STARTING | DETECTING | PROCESSING | STOPPED | ERROR
  const [detectionState, setDetectionState] = useState("CAMERA_OFF");
  const [liveDetections, setLiveDetections] = useState([]);
  const [cameraError, setCameraError] = useState("");

  // ---------------- Voice Command / STT Control State ----------------
  const [isVoiceControlActive, setIsVoiceControlActive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [lastExecutedCommand, setLastExecutedCommand] = useState("");
  const [speechError, setSpeechError] = useState("");

  // ---------------- Navigation State ----------------
  const [navigationState, setNavigationState] = useState({
    isNavigating: false,
    status: "IDLE", // IDLE | RESOLVING | ACTIVE | ARRIVED | STOPPED | ERROR | UNCONFIGURED
    destination: null,
    formattedDistance: "",
    formattedDuration: "",
    currentStep: null,
    steps: [],
    currentStepIndex: 0
  });
  const [manualDestination, setManualDestination] = useState("");

  // ---------------- Refs for Hardware & Singletons ----------------
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const isProcessingFrameRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const latestDetectionsRef = useRef([]);

  // Smart announcement throttling refs
  const lastSpokenObjectsRef = useRef({});
  const lastGlobalAnnouncementRef = useRef(0);

  // Speech & Navigation controller refs (Guaranteed SINGLETON instances)
  const speechControllerRef = useRef(null);
  const navigationManagerRef = useRef(null);
  const selectedLanguageRef = useRef(selectedLanguage);
  selectedLanguageRef.current = selectedLanguage;

  const handleVoiceCommandRef = useRef(null);

  // ---------------- Helper: Text to Speech with Voice Selection ----------------
  const speakText = (text, customLang = null) => {
    if (!text || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    const lang = customLang || selectedLanguageRef.current;
    speech.lang = lang;

    // Pick appropriate localized voice if installed on system
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = lang.split("-")[0].toLowerCase();
    const matchedVoice = voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith(langPrefix) ||
        v.lang.toLowerCase() === lang.toLowerCase()
    );
    if (matchedVoice) {
      speech.voice = matchedVoice;
    }

    speech.onstart = () => {
      isSpeakingRef.current = true;
    };
    speech.onend = () => {
      isSpeakingRef.current = false;
    };
    speech.onerror = () => {
      isSpeakingRef.current = false;
    };

    window.speechSynthesis.speak(speech);
  };

  // ---------------- Voice Commands Handler ----------------
  const handleVoiceCommand = (command) => {
    console.log("Processing Voice Command:", command);
    setLastExecutedCommand(command.type + (command.destination ? `: ${command.destination}` : ""));

    switch (command.type) {
      case "HELP":
        speakText(getMessage("help", selectedLanguageRef.current));
        break;

      case "START_LIVE_DETECTION":
        startLiveDetection();
        break;

      case "STOP_LIVE_DETECTION":
        stopLiveDetection();
        break;

      case "DESCRIBE_AROUND":
        describeSurroundings();
        break;

      case "READ_TEXT":
        captureFrameForOCR();
        break;

      case "NAVIGATE_TO":
        if (command.destination) {
          initiateNavigation(command.destination);
        }
        break;

      case "STOP_NAVIGATION":
        stopNavigation();
        break;

      default:
        break;
    }
  };
  handleVoiceCommandRef.current = handleVoiceCommand;

  // ---------------- Initialize Singletons on Mount ----------------
  useEffect(() => {
    // 1. Initialize Speech Controller
    speechControllerRef.current = new SpeechController({
      onCommand: (cmd) => handleVoiceCommandRef.current?.(cmd),
      onTranscript: (transcript) => setLiveTranscript(transcript),
      onStateChange: ({ isListening }) => setIsVoiceControlActive(isListening),
      onError: (errMsg) => {
        setSpeechError(errMsg);
        speakText(errMsg);
      },
      getLanguage: () => selectedLanguageRef.current,
      isSpeakingRef: isSpeakingRef
    });

    // 2. Initialize Navigation Manager
    navigationManagerRef.current = new NavigationManager({
      onStateChange: (state) => {
        setNavigationState((prev) => ({ ...prev, ...state }));
      },
      onInstruction: ({ isInitial, destinationName, distanceText, durationText, instruction, firstInstruction }) => {
        if (isInitial) {
          const confirmation = getMessage("navRouteFound", selectedLanguageRef.current, {
            destination: destinationName,
            distance: distanceText,
            duration: durationText
          });
          speakText(`${confirmation} ${firstInstruction || ""}`);
        } else if (instruction) {
          speakText(instruction);
        }
      },
      onArrival: () => {
        speakText(getMessage("navArrived", selectedLanguageRef.current));
      },
      onOffRoute: () => {
        speakText(getMessage("navOffRoute", selectedLanguageRef.current));
      },
      onError: (errType, errMsg) => {
        if (errType === "API_KEY_UNCONFIGURED") {
          speakText(getMessage("navApiKeyMissing", selectedLanguageRef.current));
        } else if (errType === "LOCATION_ERROR") {
          speakText(getMessage("navGeoError", selectedLanguageRef.current));
        } else {
          speakText(errMsg || "Navigation error occurred.");
        }
      }
    });

    // Load available speech synthesis voices if needed
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (speechControllerRef.current) {
        speechControllerRef.current.stopListening(true);
      }
      if (navigationManagerRef.current) {
        navigationManagerRef.current.stopNavigation(true);
      }
    };
  }, []);

  // ---------------- Language Change Handler ----------------
  const handleLanguageChange = (langCode) => {
    setSelectedLanguage(langCode);
    selectedLanguageRef.current = langCode;
    if (speechControllerRef.current) {
      speechControllerRef.current.setLanguage(langCode);
    }
    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
    speakText(`Language changed to ${langObj?.name || langCode}`, langCode);
  };

  // ---------------- Voice Control Toggle ----------------
  const toggleVoiceControl = () => {
    if (isVoiceControlActive) {
      speechControllerRef.current?.stopListening(true);
      speakText(getMessage("voiceControlDisabled", selectedLanguage));
    } else {
      const started = speechControllerRef.current?.startListening();
      if (started) {
        setSpeechError("");
        speakText(getMessage("voiceControlEnabled", selectedLanguage));
      }
    }
  };

  // ---------------- Describe Surroundings Command ----------------
  const describeSurroundings = () => {
    const current = latestDetectionsRef.current;
    if (!current || current.length === 0) {
      speakText(getMessage("noObjectsInView", selectedLanguage));
      return;
    }

    const sentences = current.map((d) => formatDetectionSentence(d, selectedLanguage));
    const summary = sentences.join(". ");
    speakText(summary);
  };

  // ---------------- Smart Live Detection Announcement ----------------
  const announceLiveDetections = (detections) => {
    if (!detections || detections.length === 0) return;
    const now = Date.now();
    const GLOBAL_COOLDOWN_MS = 4000;
    const OBJECT_COOLDOWN_MS = 8000;

    if (now - lastGlobalAnnouncementRef.current < GLOBAL_COOLDOWN_MS) {
      return;
    }

    const toAnnounce = [];

    for (const obj of detections) {
      const label = obj.class_name;
      const lastObj = lastSpokenObjectsRef.current[label];
      const distance = obj.distance;
      const direction = obj.direction;

      let shouldAnnounce = false;

      if (!lastObj) {
        shouldAnnounce = true;
      } else {
        const timeSinceLast = now - lastObj.time;
        const distanceChanged =
          lastObj.distance && distance && Math.abs(distance - lastObj.distance) > 0.6;
        const directionChanged = lastObj.direction !== direction;

        if (timeSinceLast >= OBJECT_COOLDOWN_MS || distanceChanged || directionChanged) {
          shouldAnnounce = true;
        }
      }

      if (shouldAnnounce) {
        lastSpokenObjectsRef.current[label] = {
          time: now,
          distance: distance,
          direction: direction
        };
        toAnnounce.push(obj);
        break; // Keep announcements concise and avoid spam
      }
    }

    if (toAnnounce.length > 0) {
      const announcement = toAnnounce
        .map((d) => formatDetectionSentence(d, selectedLanguage))
        .join(", ");
      lastGlobalAnnouncementRef.current = now;
      speakText(announcement);
    }
  };

  // ---------------- Live Frame Capture Loop ----------------
  const captureAndSendFrame = async () => {
    if (isProcessingFrameRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    if (video.readyState < 2) return; // Wait until HAVE_CURRENT_DATA

    isProcessingFrameRef.current = true;
    setDetectionState("PROCESSING");

    try {
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            isProcessingFrameRef.current = false;
            setDetectionState("DETECTING");
            return;
          }

          const formData = new FormData();
          formData.append("file", blob, "frame.jpg");

          try {
            const res = await fetch(`${backendURL}/live/frame/`, {
              method: "POST",
              body: formData
            });
            const data = await res.json();
            if (data.detections) {
              setLiveDetections(data.detections);
              latestDetectionsRef.current = data.detections;
              announceLiveDetections(data.detections);
            }
          } catch (err) {
            console.error("Frame detection request error:", err);
          } finally {
            isProcessingFrameRef.current = false;
            setDetectionState("DETECTING");
          }
        },
        "image/jpeg",
        0.7
      );
    } catch (err) {
      console.error("Frame capture error:", err);
      isProcessingFrameRef.current = false;
      setDetectionState("DETECTING");
    }
  };

  // ---------------- Start / Stop Live Detection ----------------
  const startLiveDetection = async () => {
    setCameraError("");
    setDetectionState("STARTING");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } }
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setDetectionState("DETECTING");
      speakText(getMessage("cameraStarted", selectedLanguage));

      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(captureAndSendFrame, 2000);
    } catch (err) {
      console.error("Camera access failed:", err);
      const errMsg = getMessage("cameraError", selectedLanguage);
      setCameraError(errMsg);
      setDetectionState("ERROR");
      speakText(errMsg);
    }
  };

  const stopLiveDetection = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    isProcessingFrameRef.current = false;
    setDetectionState("STOPPED");
    setLiveDetections([]);
    latestDetectionsRef.current = [];
    speakText(getMessage("cameraStopped", selectedLanguage));
  };

  // ---------------- Snapshot OCR from Live Video ("Read this") ----------------
  const captureFrameForOCR = async () => {
    if (!videoRef.current || !canvasRef.current || !mediaStreamRef.current) {
      speakText("Camera is not active. Please start live detection first or upload an image.");
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2) {
      speakText("Camera is warming up. Please try again.");
      return;
    }

    speakText(getMessage("readingText", selectedLanguage));

    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const formData = new FormData();
        formData.append("file", blob, "snapshot_ocr.jpg");

        try {
          const res = await fetch(`${backendURL}/ocr/`, {
            method: "POST",
            body: formData
          });
          const data = await res.json();
          if (data.text && data.text.trim()) {
            setOcrResult(data.text);
            speakText(getMessage("textExtracted", selectedLanguage) + data.text);
          } else {
            setOcrResult("");
            speakText(getMessage("noTextFound", selectedLanguage));
          }
        } catch (err) {
          console.error(err);
          speakText("Error reading text from image.");
        }
      },
      "image/jpeg",
      0.9
    );
  };

  // ---------------- Static File OCR Handler ----------------
  const handleOCR = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${backendURL}/ocr/`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      setOcrResult(data.text);
      if (data.text) {
        speakText(getMessage("textExtracted", selectedLanguage) + data.text);
      } else {
        speakText(getMessage("noTextFound", selectedLanguage));
      }
    } catch (err) {
      console.error(err);
      speakText("Error reading text from image.");
    }
  };

  // ---------------- Static File Object Detection ----------------
  const handleObjectDetection = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch(`${backendURL}/detect/`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      setObjectResult(data.detections || []);
      if (data.detections?.length > 0) {
        const names = data.detections
          .map((d) => translateObjectLabel(d.class_name, selectedLanguage))
          .join(", ");
        speakText("Objects detected: " + names);
      } else {
        speakText("No objects detected.");
      }
    } catch (err) {
      console.error(err);
      speakText("Error detecting objects.");
    }
  };

  // ---------------- Speech to Text Recording ----------------
  const handleStartRecording = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert(getMessage("sttNotSupported", selectedLanguage));
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.lang = selectedLanguage;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");
      setSttResult(transcript);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    setIsRecording(true);
    speakText("Recording started. Speak now.");
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    speakText("Recording stopped.");
  };

  const handleTTS = () => {
    if (!ttsText.trim()) return;
    speakText(ttsText);
  };

  // ---------------- Walking Navigation Handlers ----------------
  const initiateNavigation = async (destinationQuery) => {
    if (!destinationQuery || !destinationQuery.trim()) return;
    const cleanDest = destinationQuery.trim();
    speakText(
      getMessage("navDestinationConfirmation", selectedLanguage, { destination: cleanDest })
    );
    navigationManagerRef.current?.startNavigation(cleanDest, selectedLanguage);
  };

  const stopNavigation = () => {
    navigationManagerRef.current?.stopNavigation(true);
    speakText(getMessage("navStopped", selectedLanguage));
  };

  // ---------------- UI Renderers ----------------
  const renderHome = () => (
    <div className="home-container" role="main">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .home-container {
          text-align: center;
          padding: 80px 20px;
          animation: fadeInUp 0.8s ease-out;
        }
        .hero-icon {
          font-size: 120px;
          animation: float 3s ease-in-out infinite;
          display: inline-block;
          margin-bottom: 30px;
        }
        .hero-title {
          font-size: 4rem;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 20px;
        }
        .hero-subtitle {
          font-size: 1.3rem;
          color: rgba(255, 255, 255, 0.8);
          max-width: 700px;
          margin: 0 auto 50px;
          line-height: 1.8;
        }
        .cta-button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 18px 45px;
          border-radius: 50px;
          color: white;
          border: none;
          font-size: 1.3rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }
        .cta-button:hover {
          transform: translateY(-3px);
          box-shadow: 0 15px 40px rgba(102, 126, 234, 0.6);
        }
      `}</style>

      <div className="hero-icon" aria-hidden="true">👁️</div>
      <h1 className="hero-title">Dhristi</h1>
      <p className="hero-subtitle">
        See the World Differently. An AI-powered voice navigation assistant designed to empower
        visually impaired individuals with speech-to-text, text-to-speech, smart obstacle detection,
        and pedestrian voice navigation.
      </p>
      <button
        className="cta-button"
        onClick={() => setActiveTab("dashboard")}
        aria-label="Open Voice Navigation Dashboard"
      >
        Get Started →
      </button>
    </div>
  );

  const renderDashboard = () => (
    <div className="dashboard" role="region" aria-label="Voice Navigation Dashboard">
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.15); }
        }

        .dashboard {
          animation: fadeInUp 0.6s ease-out;
          max-width: 1200px;
          margin: 0 auto;
        }
        .dashboard-header {
          text-align: center;
          margin-bottom: 30px;
        }
        .dashboard-title {
          font-size: 2.8rem;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 15px;
        }

        /* Language & Master Bar */
        .controls-topbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 18px 24px;
          margin-bottom: 25px;
          gap: 15px;
        }
        .lang-selector-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .lang-label {
          font-size: 1.1rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }
        .lang-select {
          background: #1a1a2e;
          color: #fff;
          border: 1px solid rgba(102, 126, 234, 0.5);
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 1.05rem;
          font-weight: 600;
          cursor: pointer;
          outline: none;
        }
        .lang-select:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
        }

        .feature-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 26px;
          margin-bottom: 25px;
          transition: all 0.3s ease;
        }
        .feature-card:hover {
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 18px;
        }
        .card-icon {
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
          font-size: 28px;
        }
        .card-title {
          font-size: 1.4rem;
          font-weight: 600;
          margin: 0;
        }

        .primary-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 14px 26px;
          border-radius: 12px;
          font-size: 1.05rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 6px;
        }
        .primary-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
        }
        .primary-btn:focus-visible {
          outline: 3px solid #667eea;
          outline-offset: 2px;
        }
        .danger-btn {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .success-btn {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }
        .accent-btn {
          background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
          color: #111;
        }

        .file-input-wrapper {
          position: relative;
          display: inline-block;
          margin: 10px 0;
        }
        .file-input-wrapper input[type="file"] {
          position: absolute;
          opacity: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
        }
        .file-input-label {
          background: rgba(255, 255, 255, 0.1);
          border: 2px dashed rgba(255, 255, 255, 0.3);
          padding: 18px 28px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.3s ease;
        }
        .file-input-label:hover {
          border-color: rgba(102, 126, 234, 0.6);
          background: rgba(102, 126, 234, 0.1);
        }

        .result-box {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 18px;
          border-radius: 12px;
          margin-top: 18px;
          animation: scaleIn 0.4s ease-out;
        }
        .result-title {
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 10px;
          font-size: 1.1rem;
        }
        .result-content {
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.6;
          font-size: 1.05rem;
        }

        .detection-list {
          list-style: none;
          padding: 0;
        }
        .detection-item {
          background: rgba(255, 255, 255, 0.05);
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 8px;
          border-left: 3px solid #667eea;
          font-size: 1.05rem;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 0.95rem;
        }
        .status-active {
          background: rgba(76, 175, 80, 0.2);
          color: #4caf50;
        }
        .status-inactive {
          background: rgba(244, 67, 54, 0.2);
          color: #f44336;
        }
        .status-processing {
          background: rgba(255, 152, 0, 0.2);
          color: #ff9800;
        }

        .pulse-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          animation: pulse 1.8s ease-in-out infinite;
        }

        .textarea-custom {
          width: 100%;
          min-height: 100px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 15px;
          color: white;
          font-size: 1.05rem;
          font-family: inherit;
          resize: vertical;
        }
        .textarea-custom:focus {
          outline: none;
          border-color: rgba(102, 126, 234, 0.6);
          background: rgba(255, 255, 255, 0.08);
        }

        /* Voice Commands Grid */
        .commands-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 12px;
          margin-top: 15px;
        }
        .command-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: white;
          padding: 14px 18px;
          border-radius: 12px;
          text-align: left;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .command-btn:hover {
          background: rgba(102, 126, 234, 0.2);
          border-color: #667eea;
          transform: translateY(-2px);
        }
        .command-btn:focus-visible {
          outline: 3px solid #667eea;
        }
        .command-icon {
          font-size: 1.4rem;
        }

        /* Navigation Input Bar */
        .nav-input-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 10px;
        }
        .nav-input {
          flex: 1;
          min-width: 250px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          padding: 12px 18px;
          color: white;
          font-size: 1.05rem;
        }
        .nav-input:focus {
          outline: none;
          border-color: #667eea;
          background: rgba(255, 255, 255, 0.12);
        }
      `}</style>

      <div className="dashboard-header">
        <h1 className="dashboard-title">Voice Navigation Dashboard</h1>
      </div>

      {/* Accessible Top Bar: Language & Master Voice Control */}
      <div className="controls-topbar" role="toolbar" aria-label="Language and Voice Control Toolbar">
        <div className="lang-selector-group">
          <label htmlFor="language-select" className="lang-label">
            🌐 Language:
          </label>
          <select
            id="language-select"
            className="lang-select"
            value={selectedLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            aria-label="Select Voice and Application Language"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.name} ({lang.nativeName})
              </option>
            ))}
          </select>
        </div>

        <div>
          <button
            onClick={toggleVoiceControl}
            className={`primary-btn ${isVoiceControlActive ? "danger-btn" : "success-btn"}`}
            aria-label={isVoiceControlActive ? "Stop Voice Listening" : "Start Voice Listening"}
          >
            <div
              className="pulse-dot"
              style={{ background: isVoiceControlActive ? "#ff4757" : "#2ed573" }}
              aria-hidden="true"
            />
            {isVoiceControlActive ? "⏹️ Stop Voice Listening" : "🎙️ Enable Voice Commands"}
          </button>
        </div>
      </div>

      {/* Live Voice Status Region */}
      {isVoiceControlActive && (
        <div
          className="result-box"
          style={{ borderColor: "#667eea", background: "rgba(102, 126, 234, 0.1)", marginBottom: "25px" }}
          aria-live="polite"
        >
          <div className="result-title" style={{ color: "#a5b4fc" }}>
            🎤 Voice Control Active ({SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.name}):
          </div>
          <div className="result-content">
            {liveTranscript ? (
              <span>Heard: "{liveTranscript}"</span>
            ) : (
              <span>Listening for commands... Speak now (or tap any command below).</span>
            )}
          </div>
          {lastExecutedCommand && (
            <div style={{ marginTop: "6px", fontSize: "0.95rem", color: "#4facfe" }}>
              ⚡ Last Action: <strong>{lastExecutedCommand}</strong>
            </div>
          )}
        </div>
      )}

      {/* Spoken / Recognized Voice Error */}
      {speechError && (
        <div
          className="result-box"
          style={{ borderColor: "#f44336", color: "#f44336", marginBottom: "25px" }}
          aria-live="polite"
        >
          ⚠️ {speechError}
        </div>
      )}

      {/* Accessible Voice Commands Reference Card */}
      <div className="feature-card" role="region" aria-label="Voice Commands Guide">
        <div className="card-header">
          <div className="card-icon" aria-hidden="true">🗣️</div>
          <div>
            <h2 className="card-title">Supported Voice Commands</h2>
            <p style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "0.95rem", marginTop: "4px" }}>
              Speak any command aloud when listening is enabled, or tap a button directly:
            </p>
          </div>
        </div>

        <div className="commands-grid">
          <button
            className="command-btn"
            onClick={() => handleVoiceCommand({ type: "START_LIVE_DETECTION" })}
            aria-label="Command: Start live detection"
          >
            <span className="command-icon">▶️</span>
            <div>
              <strong>"Start live detection"</strong>
              <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>Starts camera & obstacle detection</div>
            </div>
          </button>

          <button
            className="command-btn"
            onClick={() => handleVoiceCommand({ type: "STOP_LIVE_DETECTION" })}
            aria-label="Command: Stop live detection"
          >
            <span className="command-icon">⏹️</span>
            <div>
              <strong>"Stop live detection"</strong>
              <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>Stops camera & announcements</div>
            </div>
          </button>

          <button
            className="command-btn"
            onClick={() => handleVoiceCommand({ type: "DESCRIBE_AROUND" })}
            aria-label="Command: What is around me"
          >
            <span className="command-icon">🧭</span>
            <div>
              <strong>"What is around me?"</strong>
              <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>Spoken summary of objects in view</div>
            </div>
          </button>

          <button
            className="command-btn"
            onClick={() => handleVoiceCommand({ type: "READ_TEXT" })}
            aria-label="Command: Read this"
          >
            <span className="command-icon">📖</span>
            <div>
              <strong>"Read this" / "Read signboard"</strong>
              <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>Reads text/sign in front of camera</div>
            </div>
          </button>

          <button
            className="command-btn"
            onClick={() => speakText(getMessage("help", selectedLanguage))}
            aria-label="Command: Help"
          >
            <span className="command-icon">❓</span>
            <div>
              <strong>"Help" / "What can I say?"</strong>
              <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>Spoken list of available voice commands</div>
            </div>
          </button>

          <button
            className="command-btn"
            onClick={() => handleVoiceCommand({ type: "STOP_NAVIGATION" })}
            aria-label="Command: Stop navigation"
          >
            <span className="command-icon">🛑</span>
            <div>
              <strong>"Stop navigation"</strong>
              <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>Ends active route guidance</div>
            </div>
          </button>
        </div>
      </div>

      {/* Live Object Detection Card */}
      <div className="feature-card" role="region" aria-label="Live Object Detection">
        <div className="card-header">
          <div className="card-icon" aria-hidden="true">📸</div>
          <h2 className="card-title">Live Object & Obstacle Detection</h2>
        </div>

        {/* Live Status Region */}
        <div style={{ marginBottom: "18px" }} aria-live="polite">
          <span
            className={
              detectionState === "DETECTING" || detectionState === "PROCESSING"
                ? "status-badge status-active"
                : detectionState === "STARTING"
                ? "status-badge status-processing"
                : "status-badge status-inactive"
            }
          >
            <div
              className="pulse-dot"
              style={{
                background:
                  detectionState === "DETECTING"
                    ? "#4caf50"
                    : detectionState === "PROCESSING"
                    ? "#ff9800"
                    : detectionState === "STARTING"
                    ? "#00f2fe"
                    : "#f44336"
              }}
            />
            Status: {detectionState}
          </span>
        </div>

        {cameraError && (
          <div
            className="result-box"
            style={{ borderColor: "#f44336", color: "#f44336", marginBottom: "15px" }}
            aria-live="polite"
          >
            ⚠️ {cameraError}
          </div>
        )}

        <div
          style={{
            margin: "15px 0",
            display:
              detectionState === "DETECTING" ||
              detectionState === "PROCESSING" ||
              detectionState === "STARTING"
                ? "block"
                : "none"
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", maxHeight: "400px", borderRadius: "12px", background: "#000" }}
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", margin: "10px 0" }}>
          {detectionState !== "DETECTING" &&
          detectionState !== "PROCESSING" &&
          detectionState !== "STARTING" ? (
            <button
              onClick={startLiveDetection}
              className="primary-btn success-btn"
              aria-label="Start Live Camera Detection"
            >
              ▶️ Start Live Detection
            </button>
          ) : (
            <>
              <button
                onClick={stopLiveDetection}
                className="primary-btn danger-btn"
                aria-label="Stop Live Detection"
              >
                ⏹️ Stop Live Detection
              </button>
              <button
                onClick={captureFrameForOCR}
                className="primary-btn accent-btn"
                aria-label="Read Signboard or Text in Front of Camera"
              >
                📖 Read Text / Signboard Now
              </button>
              <button
                onClick={describeSurroundings}
                className="primary-btn"
                aria-label="Describe What is Around Me"
              >
                🧭 What is in Front of Me?
              </button>
            </>
          )}
        </div>

        {liveDetections.length > 0 && (
          <div className="result-box" aria-live="polite">
            <div className="result-title">Current Detections (Auto-Spoken with Cooldown):</div>
            <ul className="detection-list">
              {liveDetections.map((obj, i) => (
                <li key={i} className="detection-item">
                  <strong>{translateObjectLabel(obj.class_name, selectedLanguage)}</strong>
                  {obj.distance && ` - ${obj.distance}m away`}
                  {obj.direction && ` - ${translateDirection(obj.direction, selectedLanguage)}`}
                  {obj.confidence && ` (${(obj.confidence * 100).toFixed(1)}%)`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(detectionState === "DETECTING" || detectionState === "PROCESSING") &&
          liveDetections.length === 0 && (
            <div className="result-box" aria-live="polite">
              <div
                className="result-content"
                style={{ textAlign: "center", color: "rgba(255, 255, 255, 0.6)" }}
              >
                Monitoring surroundings with YOLOv8... No obstacles currently detected.
              </div>
            </div>
          )}
      </div>

      {/* Walking Voice Navigation Card */}
      <div className="feature-card" role="region" aria-label="Walking Voice Navigation">
        <div className="card-header">
          <div className="card-icon" aria-hidden="true">🚶</div>
          <div>
            <h2 className="card-title">Pedestrian Walking Voice Navigation</h2>
            <p style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "0.95rem", marginTop: "4px" }}>
              Say <em>"Take me to [destination]"</em> or type a destination below:
            </p>
          </div>
        </div>

        <div className="nav-input-row">
          <input
            type="text"
            className="nav-input"
            placeholder="e.g., Central Park, Nearest Metro Station..."
            value={manualDestination}
            onChange={(e) => setManualDestination(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && initiateNavigation(manualDestination)}
            aria-label="Enter Walking Destination"
          />
          <button
            onClick={() => initiateNavigation(manualDestination)}
            className="primary-btn"
            disabled={!manualDestination.trim()}
            aria-label="Start Walking Navigation to destination"
          >
            🧭 Navigate
          </button>
          {navigationState.isNavigating && (
            <button
              onClick={stopNavigation}
              className="primary-btn danger-btn"
              aria-label="Stop Navigation"
            >
              ⏹️ Stop Navigation
            </button>
          )}
        </div>

        {navigationState.isNavigating && (
          <div
            className="result-box"
            style={{ borderColor: "#4facfe", background: "rgba(79, 172, 254, 0.1)" }}
            aria-live="polite"
          >
            <div className="result-title" style={{ color: "#00f2fe" }}>
              🚶 Navigating to: {navigationState.destination?.name || "Destination"}
            </div>
            <div className="result-content">
              {navigationState.destination?.address && (
                <div style={{ fontSize: "0.95rem", opacity: 0.8, marginBottom: "8px" }}>
                  📍 {navigationState.destination.address}
                </div>
              )}
              <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", margin: "10px 0" }}>
                <div>
                  <strong>Remaining Distance:</strong> {navigationState.formattedDistance || "Calculating..."}
                </div>
                <div>
                  <strong>Estimated Time:</strong> {navigationState.formattedDuration || "Calculating..."}
                </div>
              </div>

              {navigationState.currentStep && (
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    padding: "14px 18px",
                    borderRadius: "10px",
                    marginTop: "12px",
                    borderLeft: "4px solid #00f2fe"
                  }}
                >
                  <div style={{ fontSize: "0.9rem", color: "#a5b4fc" }}>Current Spoken Step:</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 600, marginTop: "4px" }}>
                    {navigationState.currentStep.instruction}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* OCR Card (Single Image / Upload) */}
      <div className="feature-card" role="region" aria-label="Read Text from Image">
        <div className="card-header">
          <div className="card-icon" aria-hidden="true">📖</div>
          <h2 className="card-title">Read Text from Image (OCR)</h2>
        </div>

        <div className="file-input-wrapper">
          <input
            type="file"
            accept="image/*"
            onChange={handleOCR}
            id="ocr-input"
            aria-label="Choose an image file to extract text with OCR"
          />
          <label htmlFor="ocr-input" className="file-input-label">
            📤 Choose an image to extract text
          </label>
        </div>

        {ocrResult && (
          <div className="result-box" aria-live="polite">
            <div className="result-title">Extracted Text:</div>
            <div className="result-content">{ocrResult}</div>
          </div>
        )}
      </div>

      {/* Object Detection Card (Static Image Upload) */}
      <div className="feature-card" role="region" aria-label="Static Image Object Detection">
        <div className="card-header">
          <div className="card-icon" aria-hidden="true">👁️</div>
          <h2 className="card-title">Static Image Object Detection</h2>
        </div>

        <div className="file-input-wrapper">
          <input
            type="file"
            accept="image/*"
            onChange={handleObjectDetection}
            id="object-input"
            aria-label="Choose an image file to detect objects with YOLO"
          />
          <label htmlFor="object-input" className="file-input-label">
            📤 Choose an image to detect objects
          </label>
        </div>

        {objectResult.length > 0 && (
          <div className="result-box" aria-live="polite">
            <div className="result-title">Detected Objects:</div>
            <ul className="detection-list">
              {objectResult.map((obj, i) => (
                <li key={i} className="detection-item">
                  <strong>{translateObjectLabel(obj.class_name, selectedLanguage)}</strong> -{" "}
                  {(obj.confidence * 100).toFixed(1)}% confidence
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Speech to Text Card */}
      <div className="feature-card" role="region" aria-label="Speech to Text Recorder">
        <div className="card-header">
          <div className="card-icon" aria-hidden="true">🎤</div>
          <h2 className="card-title">Speech to Text</h2>
        </div>

        {isRecording && (
          <div className="result-box" style={{ borderColor: "#f44336", margin: "10px 0" }} aria-live="polite">
            <div className="pulse-dot" style={{ background: "#f44336", display: "inline-block", marginRight: "8px" }} />
            Recording in progress... Speak into microphone.
          </div>
        )}

        {!isRecording ? (
          <button
            onClick={handleStartRecording}
            className="primary-btn"
            aria-label="Start Voice Recording for Speech to Text"
          >
            🎙️ Start Recording
          </button>
        ) : (
          <button
            onClick={handleStopRecording}
            className="primary-btn danger-btn"
            aria-label="Stop Voice Recording"
          >
            ⏹️ Stop Recording
          </button>
        )}

        {sttResult && (
          <div className="result-box" aria-live="polite">
            <div className="result-title">Transcribed Text:</div>
            <div className="result-content">{sttResult}</div>
          </div>
        )}
      </div>

      {/* Text to Speech Card */}
      <div className="feature-card" role="region" aria-label="Text to Speech Player">
        <div className="card-header">
          <div className="card-icon" aria-hidden="true">🔊</div>
          <h2 className="card-title">Text to Speech</h2>
        </div>

        <textarea
          className="textarea-custom"
          placeholder="Type something to speak..."
          value={ttsText}
          onChange={(e) => setTtsText(e.target.value)}
          aria-label="Type text to speak"
        />

        <button
          onClick={handleTTS}
          className="primary-btn"
          style={{ marginTop: "12px" }}
          aria-label="Speak Typed Text"
        >
          🔉 Speak This Text
        </button>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: #0f0f1e;
          color: white;
          overflow-x: hidden;
        }
        .app-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 50%, #16213e 100%);
          padding: 20px;
          position: relative;
        }
        .app-container::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(circle at 20% 50%, rgba(102, 126, 234, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(118, 75, 162, 0.1) 0%, transparent 50%);
          pointer-events: none;
          z-index: 0;
        }
        .app-content {
          position: relative;
          z-index: 1;
        }
        .nav-bar {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-bottom: 40px;
          animation: fadeInUp 0.6s ease-out;
        }
        .nav-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 12px 30px;
          border-radius: 50px;
          color: white;
          font-size: 1.05rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .nav-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-2px);
        }
        .nav-btn.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-color: transparent;
          box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        }
      `}</style>

      <div className="app-container">
        <div className="app-content">
          <nav className="nav-bar" role="navigation" aria-label="Main Navigation">
            <button
              className={`nav-btn ${activeTab === "home" ? "active" : ""}`}
              onClick={() => setActiveTab("home")}
              aria-label="Go to Home Tab"
            >
              Home
            </button>
            <button
              className={`nav-btn ${activeTab === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveTab("dashboard")}
              aria-label="Go to Dashboard Tab"
            >
              Dashboard
            </button>
          </nav>

          {activeTab === "home" ? renderHome() : renderDashboard()}
        </div>
      </div>
    </>
  );
}

export default App;