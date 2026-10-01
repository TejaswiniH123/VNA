import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowRight, AudioLines, Camera, CircleStop, FileImage, FileText,
  Compass, Crosshair, LocateFixed, MapPin, Mic, Navigation, Pause, Play,
  QrCode, Route as RouteIcon, ScanLine, Volume2, VolumeX
} from 'lucide-react';
import {
  getGetIndoorFloorMapQueryKey,
  getListIndoorFloorsQueryKey,
  getSearchIndoorDestinationsQueryKey,
  useCalculateIndoorRoute,
  useGetIndoorFloorMap,
  useListIndoorBuildings,
  useListIndoorFloors,
  useResolveIndoorLocation,
  useSearchIndoorDestinations,
} from '@workspace/api-client-react';
import type { IndoorDestination, IndoorFloor, IndoorNode, IndoorRoute } from '@workspace/api-client-react';

type Mode = 'indoor' | 'outdoor';
type LocationMethod = 'QR' | 'MANUAL';
type RecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => RecognitionInstance;
  webkitSpeechRecognition?: new () => RecognitionInstance;
  BarcodeDetector?: new (options?: { formats?: string[] }) => {
    detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
  };
};

const languages = [
  { code: 'en-US', name: 'English' }, { code: 'hi-IN', name: 'Hindi' },
  { code: 'kn-IN', name: 'Kannada' }, { code: 'ta-IN', name: 'Tamil' },
  { code: 'te-IN', name: 'Telugu' }, { code: 'ml-IN', name: 'Malayalam' },
];

function apiError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'error' in error) return String(error.error);
  return fallback;
}

async function responseError(response: Response, fallback: string) {
  try {
    const body = await response.json() as { detail?: unknown; error?: unknown; message?: unknown };
    const message = body.detail ?? body.error ?? body.message;
    if (typeof message === 'string' && message.trim()) return message;
  } catch {
    // Keep the HTTP status as a useful fallback if the service response is not JSON.
  }
  return `${fallback} (HTTP ${response.status})`;
}

function App() {
  const [mode, setMode] = useState<Mode>('indoor');
  const [buildingId, setBuildingId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [locationMethod, setLocationMethod] = useState<LocationMethod>('QR');
  const [markerPayload, setMarkerPayload] = useState('BUILDING=MAIN\nFLOOR=2\nNODE=CORRIDOR_B');
  const [manualNodeId, setManualNodeId] = useState('');
  const [location, setLocation] = useState<{ nodeId: string; nodeName: string; floorId: string; message: string } | null>(null);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [route, setRoute] = useState<IndoorRoute | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [guidanceActive, setGuidanceActive] = useState(false);
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [indoorError, setIndoorError] = useState('');
  const [speechLanguage, setSpeechLanguage] = useState('en-US');
  const [speechError, setSpeechError] = useState('');
  const [listening, setListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [scanState, setScanState] = useState('');
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
  const [cameraError, setCameraError] = useState('');
  const [detections, setDetections] = useState<Array<{ class_name: string; direction?: string; distance?: number }>>([]);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrCompleted, setOcrCompleted] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [imageDetectionFile, setImageDetectionFile] = useState<File | null>(null);
  const [imageDetections, setImageDetections] = useState<Array<{ class_name: string; confidence?: number; bbox?: unknown; [key: string]: unknown }>>([]);
  const [imageDetectionCompleted, setImageDetectionCompleted] = useState(false);
  const [imageDetectionBusy, setImageDetectionBusy] = useState(false);
  const [imageDetectionError, setImageDetectionError] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  const [dictationTranscript, setDictationTranscript] = useState('');
  const [dictationError, setDictationError] = useState('');
  const [ttsText, setTtsText] = useState('');
  const [outdoorDestination, setOutdoorDestination] = useState('');
  const [outdoorStatus, setOutdoorStatus] = useState('Outdoor guidance uses GPS. It is not available for indoor positioning.');
  const [outdoorBusy, setOutdoorBusy] = useState(false);
  const [outdoorSteps, setOutdoorSteps] = useState<Array<{ instruction: string }>>([]);
  const [outdoorStepIndex, setOutdoorStepIndex] = useState(0);
  const [outdoorError, setOutdoorError] = useState('');
  const [srAnnouncement, setSrAnnouncement] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const captureTimerRef = useRef<number | null>(null);
  const scanVideoRef = useRef<HTMLVideoElement>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const dictationRecognitionRef = useRef<RecognitionInstance | null>(null);
  const speechWindow = window as SpeechWindow;

  const buildingsQuery = useListIndoorBuildings();
  const buildings = buildingsQuery.data ?? [];
  const floorsQuery = useListIndoorFloors(buildingId, {
    query: { enabled: !!buildingId, queryKey: getListIndoorFloorsQueryKey(buildingId) },
  });
  const floors = floorsQuery.data ?? [];
  const selectedFloor = floors.find((floor) => floor.id === floorId) ?? null;
  const mapQuery = useGetIndoorFloorMap(floorId, {
    query: { enabled: !!floorId, queryKey: getGetIndoorFloorMapQueryKey(floorId) },
  });
  const floorMap = mapQuery.data;
  const searchParams = useMemo(() => ({
    buildingId,
    ...(destinationQuery.trim() ? { query: destinationQuery.trim() } : {}),
  }), [buildingId, destinationQuery]);
  const destinationsQuery = useSearchIndoorDestinations(searchParams, {
    query: { enabled: !!buildingId, queryKey: getSearchIndoorDestinationsQueryKey(searchParams) },
  });
  const destinations = destinationsQuery.data ?? [];
  const selectedDestination = destinations.find((destination) => destination.id === destinationId) ?? null;
  const resolveLocation = useResolveIndoorLocation();
  const calculateRoute = useCalculateIndoorRoute();
  const currentStep = route?.steps?.[stepIndex];
  const routeFloorNodeIds = useMemo(() => new Set(route?.nodes.map((node) => node.id) ?? []), [route]);

  useEffect(() => {
    if (!buildingId && buildings.length) setBuildingId(buildings[0].id);
  }, [buildingId, buildings]);
  useEffect(() => {
    if (!floors.length) {
      setFloorId('');
      return;
    }
    if (!floorId || !floors.some((floor) => floor.id === floorId)) {
      setFloorId(location?.floorId && floors.some((floor) => floor.id === location.floorId) ? location.floorId : floors[0].id);
    }
  }, [floors, floorId, location?.floorId]);
  useEffect(() => {
    if (!manualNodeId && floorMap?.nodes.length) setManualNodeId(floorMap.nodes[0].id);
  }, [floorMap, manualNodeId]);
  useEffect(() => {
    setDestinationId('');
    setRoute(null);
    setGuidanceActive(false);
    setLocation(null);
  }, [buildingId]);
  useEffect(() => () => {
    if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach((track) => track.stop());
    if (scanStreamRef.current) scanStreamRef.current.getTracks().forEach((track) => track.stop());
    if (captureTimerRef.current) window.clearInterval(captureTimerRef.current);
    if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
    recognitionRef.current?.stop();
    dictationRecognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  const speak = (text: string) => {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLanguage;
    const voice = window.speechSynthesis.getVoices().find((candidate) => candidate.lang.toLowerCase().startsWith(speechLanguage.toLowerCase().split('-')[0]));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };

  const runImageOcr = async () => {
    if (!ocrFile) {
      setOcrError('Choose an image before reading text.');
      return;
    }
    setOcrBusy(true);
    setOcrError('');
    setOcrText('');
    setOcrCompleted(false);
    const body = new FormData();
    body.append('file', ocrFile);
    try {
      const response = await fetch('/ocr/', { method: 'POST', body });
      if (!response.ok) throw new Error(await responseError(response, 'Text reading failed'));
      const result = await response.json() as { text?: string };
      if (typeof result.text !== 'string') throw new Error('The text-reading service returned an unexpected response.');
      const text = result.text.trim();
      setOcrText(text);
      setOcrCompleted(true);
      speak(text || 'No readable text was found in this image.');
    } catch (error) {
      setOcrError(apiError(error, 'Text reading could not complete. Check the service connection and try again.'));
    } finally {
      setOcrBusy(false);
    }
  };

  const runStaticDetection = async () => {
    if (!imageDetectionFile) {
      setImageDetectionError('Choose an image before detecting objects.');
      return;
    }
    setImageDetectionBusy(true);
    setImageDetectionError('');
    setImageDetections([]);
    setImageDetectionCompleted(false);
    const body = new FormData();
    body.append('image', imageDetectionFile);
    try {
      const response = await fetch('/detect/', { method: 'POST', body });
      if (!response.ok) throw new Error(await responseError(response, 'Object detection failed'));
      const result = await response.json() as { detections?: Array<{ class_name: string; confidence?: number; bbox?: unknown; [key: string]: unknown }> };
      if (!Array.isArray(result.detections)) throw new Error('The object-detection service returned an unexpected response.');
      setImageDetections(result.detections);
      setImageDetectionCompleted(true);
      const labels = result.detections.map((detection) => detection.class_name).filter(Boolean);
      speak(labels.length ? `Objects detected: ${labels.join(', ')}.` : 'No objects detected in this image.');
    } catch (error) {
      setImageDetectionError(apiError(error, 'Object detection could not complete. Check the service connection and try again.'));
    } finally {
      setImageDetectionBusy(false);
    }
  };

  const toggleDictation = () => {
    if (isDictating) {
      dictationRecognitionRef.current?.stop();
      dictationRecognitionRef.current = null;
      setIsDictating(false);
      return;
    }
    const Speech = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Speech) {
      setDictationError('Speech recognition is not supported by this browser. You can still type in the transcript field.');
      return;
    }
    const recognition = new Speech();
    recognition.lang = speechLanguage;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript?.trim() ?? '').filter(Boolean).join(' ');
      if (transcript) setDictationTranscript(transcript);
    };
    recognition.onerror = (event) => {
      setDictationError(event.error === 'not-allowed'
        ? 'Microphone access was denied. Allow microphone access in browser settings, then try again.'
        : `Speech dictation could not continue (${event.error}). You can type in the transcript field.`);
      setIsDictating(false);
    };
    recognition.onend = () => setIsDictating(false);
    try {
      dictationRecognitionRef.current = recognition;
      recognition.start();
      setDictationTranscript('');
      setDictationError('');
      setIsDictating(true);
    } catch {
      dictationRecognitionRef.current = null;
      setDictationError('Speech dictation could not start. Check microphone access or type in the transcript field.');
      setIsDictating(false);
    }
  };

  const beginResolve = (method: LocationMethod) => {
    if (!buildingId) return;
    setIndoorError('');
    setRoute(null);
    setGuidanceActive(false);
    if (method === 'QR') {
      if (!markerPayload.trim()) {
        setIndoorError('Enter a QR marker payload before continuing.');
        return;
      }
      resolveLocation.mutate({ data: { buildingId, method: 'QR', markerPayload: markerPayload.trim() } }, {
        onSuccess: (resolved) => {
          setLocation({ nodeId: resolved.nodeId, nodeName: resolved.nodeName, floorId: resolved.floorId, message: resolved.message });
          setFloorId(resolved.floorId);
          setSrAnnouncement(resolved.message);
          speak(resolved.message);
        },
        onError: (error) => setIndoorError(apiError(error, 'Unable to resolve this marker. Check the payload and try again.')),
      });
    } else {
      if (!manualNodeId) {
        setIndoorError('Choose a node on the selected floor first.');
        return;
      }
      resolveLocation.mutate({ data: { buildingId, method: 'MANUAL', nodeId: manualNodeId } }, {
        onSuccess: (resolved) => {
          setLocation({ nodeId: resolved.nodeId, nodeName: resolved.nodeName, floorId: resolved.floorId, message: resolved.message });
          setFloorId(resolved.floorId);
          setSrAnnouncement(resolved.message);
          speak(resolved.message);
        },
        onError: (error) => setIndoorError(apiError(error, 'Unable to set this starting point. Choose another node.')),
      });
    }
  };

  const findIndoorRoute = () => {
    if (!location || !selectedDestination || !buildingId) {
      setIndoorError('Set a starting point and choose a destination to find a route.');
      return;
    }
    setIndoorError('');
    calculateRoute.mutate({ data: {
      buildingId, fromNodeId: location.nodeId, destinationId: selectedDestination.id,
      ...(accessibleOnly ? { accessibleOnly: true } : {}),
    } }, {
      onSuccess: (result) => {
        setRoute(result);
        setStepIndex(0);
        setGuidanceActive(false);
        const opening = result.steps[0]?.instruction ?? `Route ready to ${result.destination.name}.`;
        setSrAnnouncement(`Route ready to ${result.destination.name}. ${opening}`);
        speak(`Route ready to ${result.destination.name}. ${opening}`);
      },
      onError: (error) => {
        setRoute(null);
        setIndoorError(apiError(error, 'No route was found. Try a different destination or starting point.'));
      },
    });
  };

  const advanceIndoorStep = () => {
    if (!route) return;
    if (stepIndex < route.steps.length - 1) {
      const next = stepIndex + 1;
      setStepIndex(next);
      setSrAnnouncement(route.steps[next].instruction);
      speak(route.steps[next].instruction);
      return;
    }
    setGuidanceActive(false);
    setSrAnnouncement(`You have reached ${route.destination.name}.`);
    speak(`You have reached ${route.destination.name}.`);
  };

  const parseMarkerFloor = (payload: string) => {
    const floorValue = payload.split(/\r?\n/).find((line) => line.trim().toUpperCase().startsWith('FLOOR='))
      ?.split('=').slice(1).join('=').trim();
    const floorNumber = Number(floorValue);
    if (!floorValue || Number.isNaN(floorNumber)) return;
    const match = floors.find((floor) => floor.floorNumber === floorNumber);
    if (match) setFloorId(match.id);
  };

  const stopQrScan = () => {
    if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
    scanTimerRef.current = null;
    scanStreamRef.current?.getTracks().forEach((track) => track.stop());
    scanStreamRef.current = null;
    setScanState('');
  };
  const startQrScan = async () => {
    const Detector = speechWindow.BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setScanState('Camera QR scanning is not supported here. Paste the QR marker text or choose manual node selection.');
      return;
    }
    try {
      setScanState('Requesting camera access for QR marker scanning.');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      scanStreamRef.current = stream;
      if (scanVideoRef.current) {
        scanVideoRef.current.srcObject = stream;
        await scanVideoRef.current.play();
      }
      const detector = new Detector({ formats: ['qr_code'] });
      setScanState('Camera is ready. Point it at a Dhristi QR marker.');
      scanTimerRef.current = window.setInterval(async () => {
        if (!scanVideoRef.current || scanVideoRef.current.readyState < 2) return;
        try {
          const codes = await detector.detect(scanVideoRef.current);
          if (codes[0]?.rawValue) {
            setMarkerPayload(codes[0].rawValue);
            parseMarkerFloor(codes[0].rawValue);
            setScanState('QR marker captured. Review its contents, then set the start.');
            stopQrScan();
          }
        } catch { setScanState('Could not read that marker. Keep the camera steady or enter its text manually.'); }
      }, 600);
    } catch {
      setScanState('Camera permission was not granted. Paste the QR marker text or choose manual node selection.');
    }
  };

  const toggleSpeechRecognition = () => {
    const Speech = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (listening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setListening(false);
      setSpeechError('');
      return;
    }
    if (!Speech) {
      setSpeechError('Speech recognition is not supported by this browser. You can still use the buttons and destination field.');
      return;
    }
    const recognition = new Speech();
    recognition.lang = speechLanguage;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? '';
      if (!transcript) return;
      setSrAnnouncement(`Heard: ${transcript}`);
      const command = transcript.toLowerCase();
      if (command.includes('help') || command.includes('what can i say')) {
        speak('You can say a destination to search, start guidance, next step, repeat, or stop guidance. You can also use the labeled controls.');
        return;
      }
      if (command.includes('stop navigation') || command.includes('stop guidance')) {
        setGuidanceActive(false);
        window.speechSynthesis?.cancel();
        setSrAnnouncement('Voice guidance stopped.');
        speak('Voice guidance stopped.');
        return;
      }
      if (command.includes('repeat')) {
        const instruction = mode === 'indoor' ? currentStep?.instruction : outdoorSteps[outdoorStepIndex]?.instruction;
        if (instruction) speak(instruction);
        else speak('There is no current direction to repeat.');
        return;
      }
      if (command.includes('next step') || command.includes('next direction')) {
        if (mode === 'indoor' && route) {
          setGuidanceActive(true);
          advanceIndoorStep();
        } else if (mode === 'outdoor' && outdoorSteps.length) {
          const next = Math.min(outdoorStepIndex + 1, outdoorSteps.length - 1);
          setOutdoorStepIndex(next);
          speak(outdoorSteps[next].instruction);
        } else speak('There is no active route yet.');
        return;
      }
      if (command.includes('start guidance') || command.includes('start navigation')) {
        if (mode === 'indoor' && route) {
          setGuidanceActive(true);
          speak(currentStep?.instruction ?? 'Indoor guidance started.');
        } else if (mode === 'outdoor' && outdoorSteps.length) speak(outdoorSteps[outdoorStepIndex]?.instruction ?? 'Outdoor guidance started.');
        else speak('Set a starting point and destination first.');
        return;
      }
      const destinationPhrase = transcript.replace(/^(take me to|navigate to|guide me to|go to|directions to)\s+/i, '').trim();
      if (mode === 'indoor') setDestinationQuery(destinationPhrase);
      else setOutdoorDestination(destinationPhrase);
      speak(`I heard ${destinationPhrase}. Review the matching destination, then choose find route.`);
    };
    recognition.onerror = (event) => {
      setSpeechError(event.error === 'not-allowed'
        ? 'Microphone access was denied. Allow microphone access in browser settings to use speech input.'
        : `Speech recognition could not start (${event.error}). Use the text field instead.`);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    try {
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
      setSpeechError('');
    } catch {
      setSpeechError('Speech recognition could not start. Use the text field instead.');
      setListening(false);
    }
  };

  const stopObstacleCamera = () => {
    if (captureTimerRef.current) window.clearInterval(captureTimerRef.current);
    captureTimerRef.current = null;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState('idle');
  };
  const startObstacleCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('error');
      setCameraError('Camera access is not supported by this browser. Obstacle detection needs a camera-capable device.');
      return;
    }
    setCameraState('starting');
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState('active');
      const capture = async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || !video.videoWidth) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) return;
        context.drawImage(video, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', .72));
        if (!blob) return;
        const body = new FormData();
        body.append('file', blob, 'frame.jpg');
        try {
          const response = await fetch('/live/frame/', { method: 'POST', body });
          if (!response.ok) throw new Error('Obstacle detection service is unavailable.');
          const data = await response.json() as { detections?: Array<{ class_name: string; direction?: string; distance?: number }> };
          const found = data.detections ?? [];
          setDetections(found);
          if (found[0]) speak(`${found[0].class_name}${found[0].direction ? ` ${found[0].direction}` : ''}${found[0].distance ? `, about ${found[0].distance} meters away` : ''}.`);
        } catch (error) {
          setCameraError(apiError(error, 'Obstacle detection service could not process the camera image.'));
        }
      };
      captureTimerRef.current = window.setInterval(() => void capture(), 2400);
    } catch {
      setCameraState('error');
      setCameraError('Camera permission was denied or the camera is unavailable. Allow access and try again.');
    }
  };

  const startOutdoorNavigation = async () => {
    const destination = outdoorDestination.trim();
    if (!destination) {
      setOutdoorError('Enter a destination to request outdoor guidance.');
      return;
    }
    if (!navigator.geolocation) {
      setOutdoorError('GPS location is not supported in this browser. Outdoor guidance cannot start.');
      return;
    }
    setOutdoorBusy(true);
    setOutdoorError('');
    setOutdoorSteps([]);
    setOutdoorStatus('Finding your outdoor GPS position…');
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const response = await fetch('/api/navigation/route', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: { latitude: position.coords.latitude, longitude: position.coords.longitude },
            destination, language: speechLanguage,
          }),
        });
        const data = await response.json() as {
          status?: string; message?: string; steps?: Array<{ instruction: string }>;
          distanceMeters?: number; duration?: number | string; destination?: { name?: string };
        };
        if (!response.ok || data.status !== 'success' || !data.steps?.length) {
          throw new Error(data.message || 'No outdoor route was returned. Check the destination and try again.');
        }
        setOutdoorSteps(data.steps);
        setOutdoorStepIndex(0);
        setOutdoorStatus(`Outdoor route to ${data.destination?.name ?? destination}. ${data.distanceMeters ?? ''} metres. Follow each spoken instruction and advance when ready.`);
        speak(data.steps[0].instruction);
      } catch (error) {
        setOutdoorError(apiError(error, 'Outdoor route could not be calculated.'));
        setOutdoorStatus('No active outdoor route.');
      } finally { setOutdoorBusy(false); }
    }, (error) => {
      setOutdoorError(error.code === error.PERMISSION_DENIED
        ? 'Location permission was denied. Allow GPS access to use outdoor navigation.'
        : 'Your GPS position could not be read. Check location services and try again.');
      setOutdoorStatus('No active outdoor route.');
      setOutdoorBusy(false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
  };

  const announceStep = () => {
    if (!route || !currentStep) return;
    setSrAnnouncement(currentStep.instruction);
    speak(currentStep.instruction);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="Dhristi voice navigation">
          <span className="brand-mark" aria-hidden="true"><AudioLines size={23} strokeWidth={2.2} /></span>
          <span><span className="brand-name">Dhristi</span><span className="brand-sub">Voice navigation</span></span>
        </div>
        <div className="topbar-right">
          <label className="sr-only" htmlFor="language-select">Spoken language</label>
          <select id="language-select" className="control" value={speechLanguage} onChange={(event) => setSpeechLanguage(event.target.value)} aria-label="Spoken language" data-testid="select-language">
            {languages.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}
          </select>
          <button className="sound-state" type="button" onClick={() => {
            setTtsEnabled((enabled) => !enabled);
            if (ttsEnabled) window.speechSynthesis?.cancel();
          }} aria-label={ttsEnabled ? 'Turn spoken feedback off' : 'Turn spoken feedback on'} data-testid="button-toggle-speech">
            {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span>{ttsEnabled ? 'Voice ready' : 'Voice muted'}</span>
          </button>
        </div>
      </header>

      <main className="page-wrap">
        <div className="intro-row">
          <div>
            <div className="eyebrow"><Compass size={15} /> Move with confidence</div>
            <h1 className="intro-title">Where would you like to go?</h1>
            <p className="intro-copy">Choose a navigation mode. Dhristi gives clear spoken directions and keeps your next step easy to find.</p>
          </div>
          <div className="mode-switch" role="group" aria-label="Navigation mode">
            <button className={`mode-button ${mode === 'indoor' ? 'active' : ''}`} type="button" aria-pressed={mode === 'indoor'} onClick={() => setMode('indoor')} data-testid="button-mode-indoor"><MapPin size={17} /> Indoor</button>
            <button className={`mode-button ${mode === 'outdoor' ? 'active' : ''}`} type="button" aria-pressed={mode === 'outdoor'} onClick={() => setMode('outdoor')} data-testid="button-mode-outdoor"><Navigation size={17} /> Outdoor</button>
          </div>
        </div>

        {mode === 'indoor' ? (
          <div className="main-layout">
            <div>
              <section className="panel" aria-labelledby="indoor-title">
                <div className="panel-head">
                  <div><h2 className="panel-title" id="indoor-title">Set up an indoor route</h2><p className="panel-note">Choose a building, set your starting point, then find a destination.</p></div>
                  <span className="sample-tag" data-testid="text-sample-map">Sample map</span>
                </div>
                <div className="builder">
                  {buildingsQuery.isLoading ? <div className="outdoor-status" role="status" data-testid="status-buildings-loading"><span className="spinner" /> Loading available buildings…</div> : null}
                  {buildingsQuery.isError ? <div className="error-text" role="alert" data-testid="error-buildings">{apiError(buildingsQuery.error, 'Buildings could not be loaded.')} <button className="button button-soft" type="button" onClick={() => void buildingsQuery.refetch()} data-testid="button-retry-buildings">Try again</button></div> : null}
                  {!buildingsQuery.isLoading && !buildingsQuery.isError && buildings.length === 0 ? <div className="outdoor-status" role="status" data-testid="status-no-buildings">No indoor buildings are available yet. Try again later.</div> : null}
                  <div className="form-grid">
                    <label className="field"><span className="field-label">Building</span>
                      <select className="control" value={buildingId} onChange={(event) => setBuildingId(event.target.value)} disabled={!buildings.length} data-testid="select-building">
                        {buildings.length ? buildings.map((building) => <option key={building.id} value={building.id}>{building.name}{building.isDemo ? ' · sample map' : ''}</option>) : <option value="">No buildings available</option>}
                      </select>
                    </label>
                    <label className="field"><span className="field-label">Floor</span>
                      <select className="control" value={floorId} onChange={(event) => { setFloorId(event.target.value); setManualNodeId(''); }} disabled={!floors.length} data-testid="select-floor">
                        {floors.length ? floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>) : <option value="">Loading floors…</option>}
                      </select>
                    </label>
                  </div>
                  {floorsQuery.isLoading && buildingId ? <p className="panel-note" role="status" data-testid="status-floors-loading">Loading floors…</p> : null}
                  {floorsQuery.isError ? <div className="error-text" role="alert" data-testid="error-floors">{apiError(floorsQuery.error, 'Floors could not be loaded.')} <button type="button" className="button button-soft" onClick={() => void floorsQuery.refetch()} data-testid="button-retry-floors">Try again</button></div> : null}

                  <div className="location-block">
                    <p className="block-title"><LocateFixed size={16} /> Where are you starting?</p>
                    <div className="choice-row" role="group" aria-label="Starting point method">
                      <button type="button" className={`choice-button ${locationMethod === 'QR' ? 'selected' : ''}`} aria-pressed={locationMethod === 'QR'} onClick={() => setLocationMethod('QR')} data-testid="button-method-qr"><QrCode size={16} /> Scan a QR marker</button>
                      <button type="button" className={`choice-button ${locationMethod === 'MANUAL' ? 'selected' : ''}`} aria-pressed={locationMethod === 'MANUAL'} onClick={() => setLocationMethod('MANUAL')} data-testid="button-method-manual"><MapPin size={16} /> Choose a node</button>
                    </div>
                    {locationMethod === 'QR' ? (
                      <>
                        <label className="field"><span className="field-label">Marker text</span>
                          <textarea className="control" rows={3} value={markerPayload} onChange={(event) => { setMarkerPayload(event.target.value); parseMarkerFloor(event.target.value); }} placeholder={'BUILDING=MAIN\nFLOOR=2\nNODE=CORRIDOR_B'} aria-describedby="qr-help" data-testid="input-marker-payload" style={{ padding: '10px 12px', resize: 'vertical' }} />
                        </label>
                        <p className="panel-note" id="qr-help">Paste the marker text or use your camera. Example format: BUILDING=MAIN / FLOOR=2 / NODE=CORRIDOR_B.</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                          <button className="button button-outline" type="button" onClick={() => void startQrScan()} data-testid="button-scan-qr"><ScanLine size={16} /> Scan with camera</button>
                          {scanState && scanStreamRef.current ? <button className="button button-soft" type="button" onClick={stopQrScan} data-testid="button-stop-qr-scan">Stop camera</button> : null}
                        </div>
                        {scanState ? <p role="status" className="capability-status" data-testid="status-qr-scan">{scanState}</p> : null}
                      </>
                    ) : (
                      <label className="field"><span className="field-label">Starting node on {selectedFloor?.name ?? 'this floor'}</span>
                        <select className="control" value={manualNodeId} onChange={(event) => setManualNodeId(event.target.value)} disabled={!floorMap?.nodes.length} data-testid="select-start-node">
                          {floorMap?.nodes.length ? floorMap.nodes.map((node) => <option key={node.id} value={node.id}>{node.name} · {node.type.toLowerCase()}</option>) : <option value="">Map nodes unavailable</option>}
                        </select>
                      </label>
                    )}
                    <div style={{ marginTop: 12 }}>
                      <button className="button button-primary" type="button" onClick={() => beginResolve(locationMethod)} disabled={!buildingId || resolveLocation.isPending} data-testid="button-set-start">
                        {resolveLocation.isPending ? <span className="spinner" /> : <Crosshair size={17} />}
                        {resolveLocation.isPending ? 'Setting start…' : 'Set starting point'}
                      </button>
                    </div>
                    {location ? <div className="capability-status" role="status" data-testid="status-location"><strong>Starting point set:</strong> {location.nodeName}. {location.message}</div> : <p className="panel-note" role="status" data-testid="status-no-location">No starting point set yet. QR markers or manual node selection are used indoors; GPS is not used.</p>}
                  </div>

                  <div className="location-block">
                    <p className="block-title"><RouteIcon size={16} /> Choose your destination</p>
                    <label className="field"><span className="field-label">Search destinations</span>
                      <input className="control" type="search" value={destinationQuery} onChange={(event) => { setDestinationQuery(event.target.value); setDestinationId(''); }} placeholder="Try reception, restroom, or room name" data-testid="input-destination-search" />
                    </label>
                    {destinationsQuery.isLoading ? <p className="panel-note" role="status" data-testid="status-destinations-loading">Searching destinations…</p> : null}
                    {destinationsQuery.isError ? <div className="error-text" role="alert" data-testid="error-destinations">{apiError(destinationsQuery.error, 'Destinations could not be loaded.')} <button className="button button-soft" type="button" onClick={() => void destinationsQuery.refetch()} data-testid="button-retry-destinations">Try again</button></div> : null}
                    {!destinationsQuery.isLoading && !destinationsQuery.isError && destinations.length === 0 ? <p className="panel-note" role="status" data-testid="status-no-destinations">{destinationQuery ? 'No matching destinations. Try a different search.' : 'No destinations are available in this building.'}</p> : null}
                    <label className="field" style={{ marginTop: 10 }}><span className="field-label">Destination</span>
                      <select className="control" value={destinationId} onChange={(event) => setDestinationId(event.target.value)} disabled={!destinations.length} data-testid="select-destination">
                        <option value="">Choose a destination</option>
                        {destinations.map((destination: IndoorDestination) => <option key={destination.id} value={destination.id}>{destination.name} · {destination.floorName}</option>)}
                      </select>
                    </label>
                    <label style={{ display: 'flex', gap: 9, alignItems: 'center', marginTop: 12, color: '#405650', fontSize: 13 }}>
                      <input type="checkbox" checked={accessibleOnly} onChange={(event) => setAccessibleOnly(event.target.checked)} data-testid="checkbox-accessible-route" /> Prefer accessible paths
                    </label>
                    <button className="button button-primary" type="button" style={{ marginTop: 13 }} onClick={findIndoorRoute} disabled={!location || !selectedDestination || calculateRoute.isPending} data-testid="button-find-route">
                      {calculateRoute.isPending ? <span className="spinner" /> : <ArrowRight size={17} />}
                      {calculateRoute.isPending ? 'Finding route…' : 'Find indoor route'}
                    </button>
                    {!location ? <p className="panel-note" style={{ marginTop: 9 }}>Set a starting point before requesting directions.</p> : null}
                  </div>
                  {indoorError ? <div className="error-text" role="alert" data-testid="error-indoor">{indoorError}</div> : null}
                  <div className="notice" role="note" data-testid="notice-indoor-caveat">
                    <AlertCircle size={17} style={{ flex: 'none', marginTop: 1 }} />
                    <span><strong>Indoor maps are samples.</strong> Routes depend on the building map and QR/manual localization. They are not live indoor tracking; follow local signs and use a cane or human assistance as needed.</span>
                  </div>
                </div>
              </section>

              <section className="panel map-panel" aria-labelledby="map-title" style={{ marginTop: 17 }}>
                <div className="panel-head">
                  <div><h2 className="panel-title" id="map-title">Floor map</h2><p className="panel-note">{floorMap ? `${floorMap.building.name} · ${floorMap.floor.name}` : 'A visual reference for the selected floor.'}</p></div>
                  {mapQuery.isLoading ? <span className="spinner" role="status" aria-label="Loading map" data-testid="status-map-loading" /> : null}
                </div>
                <div className="map-wrap">
                  {mapQuery.isError ? <div className="map-empty" role="alert" data-testid="error-map"><AlertCircle size={22} /><strong>Map unavailable</strong><span>{apiError(mapQuery.error, 'The map could not be loaded. Choose another floor or retry.')}</span><button className="button button-soft" type="button" onClick={() => void mapQuery.refetch()} data-testid="button-retry-map">Retry map</button></div> : null}
                  {!mapQuery.isLoading && !mapQuery.isError && !floorMap ? <div className="map-empty" role="status" data-testid="status-map-empty"><MapPin size={23} /><strong>Select a building and floor</strong><span>Available floor maps will appear here.</span></div> : null}
                  {floorMap ? <div className="map-canvas">
                    <svg viewBox="0 0 600 300" role="img" aria-labelledby="svg-map-title svg-map-description" data-testid="indoor-map">
                      <title id="svg-map-title">{floorMap.building.name}, {floorMap.floor.name} sample map</title>
                      <desc id="svg-map-description">Floor plan showing mapped nodes, route where available, your set starting node, and destination.</desc>
                      {(() => {
                        const xs = floorMap.nodes.map((node) => node.x);
                        const ys = floorMap.nodes.map((node) => node.y);
                        const minX = Math.min(...xs, 0); const maxX = Math.max(...xs, 100);
                        const minY = Math.min(...ys, 0); const maxY = Math.max(...ys, 100);
                        const coord = (node: IndoorNode) => ({
                          x: 42 + ((node.x - minX) / Math.max(1, maxX - minX)) * 516,
                          y: 32 + ((node.y - minY) / Math.max(1, maxY - minY)) * 236,
                        });
                        const byId = new Map(floorMap.nodes.map((node) => [node.id, node]));
                        const pathIds = route?.nodes.filter((node) => node.floorId === floorMap.floor.id).map((node) => node.id) ?? [];
                        return <>
                          {floorMap.edges.map((edge) => {
                            const from = byId.get(edge.fromNodeId); const to = byId.get(edge.toNodeId);
                            if (!from || !to) return null;
                            const start = coord(from); const end = coord(to);
                            return <line key={edge.id} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#c7c6b8" strokeWidth="5" strokeLinecap="round" data-testid={`map-edge-${edge.id}`} />;
                          })}
                          {pathIds.slice(0, -1).map((nodeId, index) => {
                            const from = byId.get(nodeId); const to = byId.get(pathIds[index + 1]);
                            if (!from || !to) return null;
                            const start = coord(from); const end = coord(to);
                            return <line key={`route-${nodeId}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#c66a48" strokeWidth="7" strokeLinecap="round" data-testid={`map-route-segment-${index}`} />;
                          })}
                          {floorMap.nodes.map((node) => {
                            const point = coord(node);
                            const isStart = location?.nodeId === node.id;
                            const isDestination = route?.destination.nodeId === node.id;
                            const inPath = routeFloorNodeIds.has(node.id);
                            return <g key={node.id} transform={`translate(${point.x} ${point.y})`} aria-label={`${node.name}${isStart ? ', your starting point' : ''}${isDestination ? ', destination' : ''}`}>
                              {inPath ? <circle r="12" fill="none" stroke="#c66a48" strokeWidth="2" opacity=".7" /> : null}
                              <circle r={isStart || isDestination ? 9 : 6} fill={isDestination ? '#cb6341' : isStart ? '#155d51' : '#6e8c7c'} stroke="#fffdf5" strokeWidth="3" />
                              <text x="0" y="-13" textAnchor="middle" fontSize="10" fontWeight="700" fill="#304b44">{node.name}</text>
                            </g>;
                          })}
                        </>;
                      })()}
                    </svg>
                  </div> : null}
                  {floorMap ? <div className="map-legend" aria-label="Map legend">
                    <span className="legend-item"><span className="legend-dot" /> Starting point</span>
                    <span className="legend-item"><span className="legend-line" /> Route</span>
                    <span className="legend-item"><span className="legend-dot destination" /> Destination</span>
                    <span className="legend-item" data-testid="text-map-sample-label">Sample map · not live positioning</span>
                  </div> : null}
                </div>
              </section>

              <section className="panel steps-panel" aria-labelledby="steps-title">
                <div className="panel-head">
                  <div><h2 className="panel-title" id="steps-title">Route steps</h2><p className="panel-note">{route ? `Directions to ${route.destination.name}` : 'Your step-by-step directions will appear here.'}</p></div>
                  {route ? <span className="sample-tag" data-testid="status-route-ready">Route ready</span> : null}
                </div>
                {!route && calculateRoute.isPending ? <p className="panel-note" role="status" style={{ padding: '0 22px 18px' }} data-testid="status-route-loading">Calculating a route from your selected starting point…</p> : null}
                {!route && !calculateRoute.isPending ? <div className="map-empty" style={{ minHeight: 115 }} role="status" data-testid="status-no-route"><RouteIcon size={21} /><strong>No route yet</strong><span>Set your location and destination to see spoken steps.</span></div> : null}
                {route ? <>
                  <div className="route-summary" style={{ margin: '0 20px 13px', borderTop: 0, paddingTop: 0 }} data-testid="summary-route">
                    <div><div className="summary-value">{Math.round(route.distanceMeters)} m</div><div className="summary-label">Route distance</div></div>
                    <div><div className="summary-value">{Math.max(1, Math.round(route.durationSeconds / 60))} min</div><div className="summary-label">Estimated walk</div></div>
                  </div>
                  <ol className="steps-list" aria-label="Indoor route steps">
                    {route.steps.map((step, index) => <li key={`${step.order}-${step.toNodeId}`} className={`step-row ${index === stepIndex ? 'step-current' : ''}`} data-testid={`route-step-${step.order}`}>
                      <span className="step-count">{step.order}</span>
                      <span className="step-text">{step.instruction}{step.floorTransition ? ` Floor change: ${step.fromFloorName} to ${step.toFloorName}.` : ''}</span>
                      <span className="step-distance">{Math.round(step.distanceMeters)} m</span>
                    </li>)}
                  </ol>
                  <div className="route-actions">
                    <button className="button button-primary" type="button" onClick={() => {
                      if (!guidanceActive) {
                        setGuidanceActive(true);
                        setSrAnnouncement(currentStep?.instruction ?? 'Voice guidance started.');
                        speak(currentStep?.instruction ?? 'Voice guidance started.');
                      } else advanceIndoorStep();
                    }} data-testid="button-start-guidance">
                      {guidanceActive ? <ArrowRight size={17} /> : <Play size={16} />}
                      {guidanceActive ? 'Next direction' : 'Start voice guidance'}
                    </button>
                    <button className="button button-outline" type="button" onClick={announceStep} disabled={!currentStep} data-testid="button-repeat-step"><Volume2 size={16} /> Repeat step</button>
                    {guidanceActive ? <button className="button button-danger" type="button" onClick={() => { setGuidanceActive(false); window.speechSynthesis?.cancel(); setSrAnnouncement('Voice guidance stopped.'); }} data-testid="button-stop-guidance"><CircleStop size={16} /> Stop</button> : null}
                  </div>
                </> : null}
              </section>
            </div>

            <aside className="side-stack" aria-label="Navigation status and voice tools">
              <section className="panel state-card" aria-labelledby="location-status-title">
                <div className="state-head">
                  <div><div className="state-label" id="location-status-title">Indoor location</div>
                    <div className="state-value" data-testid="text-current-location">{location?.nodeName ?? 'Not set'}</div>
                    <p className="state-detail" data-testid="status-current-floor">{location ? `${floors.find((floor: IndoorFloor) => floor.id === location.floorId)?.name ?? 'Floor'} · set ${location.method === 'QR' ? 'from QR marker' : 'manually'}` : 'Set a QR marker or choose a map node to begin.'}</p>
                  </div>
                  <span className="state-icon"><LocateFixed size={20} /></span>
                </div>
              </section>
              <section className="panel state-card guidance-card" aria-labelledby="guidance-title">
                <div className="state-head">
                  <div><div className="state-label" id="guidance-title">{guidanceActive ? 'Now guiding' : 'Next direction'}</div>
                    <div className="state-value" data-testid="text-current-instruction">{currentStep?.instruction ?? 'Your route will speak one clear step at a time.'}</div>
                    <p className="state-detail">{currentStep ? `${Math.round(currentStep.distanceMeters)} metres${currentStep.floorTransition ? ` · ${currentStep.fromFloorName} to ${currentStep.toFloorName}` : ''}` : 'You stay in control of when to begin.'}</p>
                  </div>
                  <span className="state-icon">{guidanceActive ? <AudioLines size={20} /> : <Navigation size={19} />}</span>
                </div>
                {route ? <div className="guidance-actions">
                  <button className="button button-primary" type="button" onClick={() => guidanceActive ? advanceIndoorStep() : (setGuidanceActive(true), speak(currentStep?.instruction ?? 'Guidance started.'))} data-testid="button-quick-guidance">{guidanceActive ? 'Next step' : 'Start'}</button>
                  <button className="button button-outline" type="button" onClick={() => { setGuidanceActive(false); window.speechSynthesis?.cancel(); }} data-testid="button-quick-stop">Stop</button>
                </div> : null}
              </section>
              <section className="panel capability-card" aria-labelledby="voice-title">
                <div className="capability-heading"><span className="state-icon"><Mic size={18} /></span><h2 id="voice-title">Voice & spoken help</h2></div>
                <p className="capability-intro">Use your voice to search, or have the current direction read aloud.</p>
                <div className="capability-controls">
                  <button className={`button ${listening ? 'button-danger' : 'button-soft'}`} type="button" onClick={toggleSpeechRecognition} data-testid="button-speech-input">{listening ? <Pause size={16} /> : <Mic size={16} />}{listening ? 'Stop listening' : 'Speak a destination'}</button>
                  <button className="button button-outline" type="button" onClick={() => speak(currentStep?.instruction ?? (location ? `You are at ${location.nodeName}.` : 'Choose a starting point to begin indoor navigation.'))} data-testid="button-speak-status"><Volume2 size={16} /> Speak status</button>
                </div>
                {speechError ? <p className="error-text" role="alert" data-testid="error-speech">{speechError}</p> : null}
                <div className="capability-status" role="status" data-testid="status-speech-support">
                  {'speechSynthesis' in window ? 'Spoken feedback is available.' : 'Speech synthesis is not supported; directions remain available as text.'}
                  {((speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition)) ? ' Speech input is available.' : ' Speech input is not supported; use the destination field.'}
                </div>
              </section>
              <section className="panel capability-card" aria-labelledby="obstacle-title">
                <div className="capability-heading"><span className="state-icon"><Camera size={18} /></span><h2 id="obstacle-title">Obstacle awareness</h2></div>
                <p className="capability-intro">Optional camera-based object detection. Keep your usual mobility aid in use.</p>
                <video ref={videoRef} muted playsInline aria-label="Live obstacle detection camera view" style={{ display: cameraState === 'active' ? 'block' : 'none', width: '100%', borderRadius: 10, margin: '0 0 10px' }} />
                <div className="capability-controls">
                  {cameraState === 'active' ? <button className="button button-danger" type="button" onClick={stopObstacleCamera} data-testid="button-stop-obstacle-camera"><CircleStop size={16} /> Stop camera</button> : <button className="button button-outline" type="button" onClick={() => void startObstacleCamera()} disabled={cameraState === 'starting'} data-testid="button-start-obstacle-camera">{cameraState === 'starting' ? <span className="spinner" /> : <Camera size={16} />}{cameraState === 'starting' ? 'Starting…' : 'Start camera'}</button>}
                </div>
                {cameraError ? <p className="error-text" role="alert" data-testid="error-obstacle-camera">{cameraError}</p> : null}
                {detections.length ? <div className="capability-status" role="status" data-testid="status-detections"><strong>Detected:</strong> {detections.map((item, index) => `${item.class_name}${item.direction ? `, ${item.direction}` : ''}${item.distance ? `, ${item.distance} m` : ''}`).join('; ')}</div> : null}
                <p className="quiet-footnote">Detection depends on camera permission and the connected Dhristi service. It may miss obstacles and is not a substitute for safe mobility practices.</p>
              </section>
            </aside>
          </div>
        ) : (
          <div className="main-layout">
            <section className="panel" aria-labelledby="outdoor-title">
              <div className="panel-head">
                <div><h2 className="panel-title" id="outdoor-title">Outdoor navigation</h2><p className="panel-note">Get walking directions using your device GPS and spoken turn instructions.</p></div>
                <span className="state-icon"><Navigation size={19} /></span>
              </div>
              <div className="outdoor-body">
                <label className="field"><span className="field-label">Where would you like to go?</span>
                  <div className="outdoor-destination">
                    <input className="control" value={outdoorDestination} onChange={(event) => setOutdoorDestination(event.target.value)} placeholder="Enter a place or address" data-testid="input-outdoor-destination" />
                    <button className="button button-soft" type="button" onClick={toggleSpeechRecognition} aria-label="Speak outdoor destination" data-testid="button-outdoor-speech"><Mic size={17} /> Speak</button>
                  </div>
                </label>
                <button className="button button-primary" type="button" style={{ marginTop: 13 }} onClick={() => void startOutdoorNavigation()} disabled={outdoorBusy} data-testid="button-start-outdoor">
                  {outdoorBusy ? <span className="spinner" /> : <LocateFixed size={17} />}{outdoorBusy ? 'Finding route…' : 'Use GPS & find route'}
                </button>
                {outdoorError ? <div className="error-text" role="alert" data-testid="error-outdoor">{outdoorError}</div> : null}
                <div className="outdoor-status" role="status" data-testid="status-outdoor">{outdoorStatus}</div>
                {outdoorSteps.length ? <div style={{ marginTop: 17 }}>
                  <p className="block-title"><RouteIcon size={16} /> Turn-by-turn directions</p>
                  <ol className="steps-list" style={{ margin: 0 }} data-testid="list-outdoor-steps">
                    {outdoorSteps.map((step, index) => <li className={`step-row ${index === outdoorStepIndex ? 'step-current' : ''}`} key={`${index}-${step.instruction}`}><span className="step-count">{index + 1}</span><span className="step-text">{step.instruction}</span></li>)}
                  </ol>
                  <div className="route-actions" style={{ padding: '12px 0 0' }}>
                    <button className="button button-primary" type="button" onClick={() => {
                      const next = Math.min(outdoorStepIndex + 1, outdoorSteps.length - 1);
                      setOutdoorStepIndex(next);
                      speak(outdoorSteps[next].instruction);
                    }} data-testid="button-next-outdoor-step"><ArrowRight size={16} /> Next direction</button>
                    <button className="button button-outline" type="button" onClick={() => speak(outdoorSteps[outdoorStepIndex]?.instruction ?? '')} data-testid="button-repeat-outdoor-step"><Volume2 size={16} /> Repeat</button>
                  </div>
                </div> : null}
                <div className="notice" role="note" data-testid="notice-gps-scope"><AlertCircle size={17} style={{ flex: 'none' }} /><span>GPS navigation is for outdoor use only. GPS does not provide reliable indoor positioning; switch to Indoor and use a QR marker or select a mapped node.</span></div>
              </div>
            </section>
            <aside className="side-stack">
              <section className="panel state-card">
                <div className="state-head"><div><div className="state-label">Outdoor route</div><div className="state-value" data-testid="text-outdoor-destination">{outdoorSteps.length ? outdoorDestination : 'Ready when you are'}</div><p className="state-detail">Location access is requested only when you start an outdoor route.</p></div><span className="state-icon"><MapPin size={20} /></span></div>
              </section>
              <section className="panel capability-card">
                <div className="capability-heading"><span className="state-icon"><Volume2 size={18} /></span><h2>Spoken directions</h2></div>
                <p className="capability-intro">Dhristi reads each outdoor route instruction aloud. You can repeat or move to the next step at any time.</p>
                <button className="button button-soft" type="button" onClick={() => speak(outdoorSteps[outdoorStepIndex]?.instruction ?? 'Enter a destination and start an outdoor GPS route to hear directions.')} data-testid="button-outdoor-speak-status"><Volume2 size={16} /> Speak current status</button>
                {speechError ? <p className="error-text" role="alert" data-testid="error-speech-outdoor">{speechError}</p> : null}
              </section>
              <section className="panel capability-card">
                <div className="capability-heading"><span className="state-icon"><Camera size={18} /></span><h2>Obstacle awareness</h2></div>
                <p className="capability-intro">Optional live camera object detection remains available in Indoor mode, alongside your usual mobility aid.</p>
                <button className="button button-outline" type="button" onClick={() => { setMode('indoor'); setSrAnnouncement('Obstacle awareness is available in the indoor tools panel.'); }} data-testid="button-open-obstacle-tools">Open camera tools</button>
              </section>
            </aside>
          </div>
        )}
        <section className="tools-section" aria-labelledby="vision-tools-title">
          <div className="tools-section-head">
            <div>
              <h2 className="tools-title" id="vision-tools-title">Vision and speech tools</h2>
              <p className="tools-copy">Read text, identify objects in a photo, dictate words, or hear your own text spoken aloud.</p>
            </div>
          </div>
          <div className="tools-grid">
            <section className="panel tool-card" aria-labelledby="ocr-tool-title">
              <div className="tool-card-head"><span className="state-icon"><FileText size={18} /></span><h3 id="ocr-tool-title">Read text from an image</h3></div>
              <p className="tool-description">Choose a photo or image. Dhristi will read detected text aloud and show it here.</p>
              <label className="field">
                <span className="field-label">Image for text reading</span>
                <input className="tool-field" type="file" accept="image/*" aria-label="Choose image for text reading" onChange={(event) => { setOcrFile(event.target.files?.[0] ?? null); setOcrError(''); setOcrText(''); setOcrCompleted(false); }} data-testid="input-ocr-image" />
              </label>
              <div className="tool-actions">
                <button className="button button-primary" type="button" onClick={() => void runImageOcr()} disabled={ocrBusy || !ocrFile} data-testid="button-run-ocr">
                  {ocrBusy ? <span className="spinner" /> : <FileText size={16} />}{ocrBusy ? 'Reading image…' : 'Read image text'}
                </button>
                {ocrFile ? <span className="tool-muted" data-testid="text-ocr-filename">{ocrFile.name}</span> : null}
              </div>
              {ocrError ? <div className="error-text tool-error" role="alert" data-testid="error-ocr">{ocrError}{ocrFile ? <button className="button button-soft" type="button" onClick={() => void runImageOcr()} disabled={ocrBusy} data-testid="button-retry-ocr">Try again</button> : null}</div> : null}
              {ocrCompleted && ocrText ? <div className="tool-result" role="status" aria-live="polite" data-testid="result-ocr"><strong>Text found</strong>{ocrText}</div> : null}
              {ocrCompleted && !ocrText ? <div className="tool-result" role="status" data-testid="status-ocr-no-text"><strong>No readable text found</strong>Try a sharper image with clear, well-lit text.</div> : null}
              {!ocrCompleted && !ocrError && !ocrBusy ? <p className="tool-muted" role="status" data-testid="status-ocr-empty">Text results will appear here.</p> : null}
            </section>

            <section className="panel tool-card" aria-labelledby="image-detection-title">
              <div className="tool-card-head"><span className="state-icon"><FileImage size={18} /></span><h3 id="image-detection-title">Identify objects in an image</h3></div>
              <p className="tool-description">Run object detection on a still image. Detected labels are spoken and listed with their available details.</p>
              <label className="field">
                <span className="field-label">Image for object detection</span>
                <input className="tool-field" type="file" accept="image/*" aria-label="Choose image for object detection" onChange={(event) => { setImageDetectionFile(event.target.files?.[0] ?? null); setImageDetectionError(''); setImageDetections([]); setImageDetectionCompleted(false); }} data-testid="input-detection-image" />
              </label>
              <div className="tool-actions">
                <button className="button button-primary" type="button" onClick={() => void runStaticDetection()} disabled={imageDetectionBusy || !imageDetectionFile} data-testid="button-run-image-detection">
                  {imageDetectionBusy ? <span className="spinner" /> : <FileImage size={16} />}{imageDetectionBusy ? 'Checking image…' : 'Detect objects'}
                </button>
                {imageDetectionFile ? <span className="tool-muted" data-testid="text-detection-filename">{imageDetectionFile.name}</span> : null}
              </div>
              {imageDetectionError ? <div className="error-text tool-error" role="alert" data-testid="error-image-detection">{imageDetectionError}{imageDetectionFile ? <button className="button button-soft" type="button" onClick={() => void runStaticDetection()} disabled={imageDetectionBusy} data-testid="button-retry-image-detection">Try again</button> : null}</div> : null}
              {imageDetections.length ? <div className="tool-result" role="status" aria-live="polite" data-testid="result-image-detections">
                <strong>{imageDetections.length} {imageDetections.length === 1 ? 'object found' : 'objects found'}</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 19 }}>
                  {imageDetections.map((item, index) => <li key={`${item.class_name}-${index}`} style={{ marginTop: 6 }} data-testid={`result-detection-${index}`}>
                    <b>{item.class_name}</b>
                    {typeof item.confidence === 'number' ? ` · ${Math.round(item.confidence <= 1 ? item.confidence * 100 : item.confidence)}% confidence` : ''}
                    {item.bbox !== undefined ? <pre aria-label={`Bounds for ${item.class_name}`}>Bounds: {JSON.stringify(item.bbox)}</pre> : null}
                  </li>)}
                </ul>
              </div> : null}
              {imageDetectionCompleted && !imageDetections.length ? <div className="tool-result" role="status" data-testid="status-no-image-detections"><strong>No objects detected</strong>Try another image with objects in clear view.</div> : null}
              {!imageDetectionCompleted && !imageDetectionError && !imageDetectionBusy ? <p className="tool-muted" role="status" data-testid="status-detection-empty">Object results will appear here.</p> : null}
            </section>

            <section className="panel tool-card" aria-labelledby="dictation-title">
              <div className="tool-card-head"><span className="state-icon"><Mic size={18} /></span><h3 id="dictation-title">Speech-to-text dictation</h3></div>
              <p className="tool-description">Use the browser’s speech recognition to dictate. The transcript stays editable so you can correct it.</p>
              <label className="field">
                <span className="field-label">Dictated text</span>
                <textarea className="tool-field tool-transcript" rows={3} value={dictationTranscript} onChange={(event) => setDictationTranscript(event.target.value)} placeholder="Your dictated words will appear here." data-testid="input-dictation-transcript" />
              </label>
              <div className="tool-actions">
                <button className={`button ${isDictating ? 'button-danger' : 'button-soft'}`} type="button" onClick={toggleDictation} data-testid="button-toggle-dictation">
                  {isDictating ? <CircleStop size={16} /> : <Mic size={16} />}{isDictating ? 'Stop dictation' : 'Start dictation'}
                </button>
                <span className="tool-muted" role="status" data-testid="status-dictation">{isDictating ? 'Listening. Speak clearly.' : ((speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition) ? 'Browser speech recognition is ready.' : 'Speech recognition is not supported in this browser.')}</span>
              </div>
              {dictationError ? <div className="error-text tool-error" role="alert" data-testid="error-dictation">{dictationError}</div> : null}
            </section>

            <section className="panel tool-card" aria-labelledby="custom-tts-title">
              <div className="tool-card-head"><span className="state-icon"><Volume2 size={18} /></span><h3 id="custom-tts-title">Speak your text</h3></div>
              <p className="tool-description">Type or paste a message and hear it in your selected spoken language.</p>
              <label className="field">
                <span className="field-label">Text to speak</span>
                <textarea className="tool-field tool-transcript" rows={3} value={ttsText} onChange={(event) => setTtsText(event.target.value)} placeholder="Type something for Dhristi to say." data-testid="input-custom-tts" />
              </label>
              <div className="tool-actions">
                <button className="button button-primary" type="button" onClick={() => speak(ttsText.trim())} disabled={!ttsText.trim()} data-testid="button-speak-custom-text"><Volume2 size={16} /> Speak text</button>
                <span className="tool-muted" role="status" data-testid="status-custom-tts">{'speechSynthesis' in window ? (ttsEnabled ? `Spoken feedback uses ${languages.find((language) => language.code === speechLanguage)?.name ?? speechLanguage}.` : 'Voice is muted. Turn Voice ready on to hear speech.') : 'Speech synthesis is not supported in this browser.'}</span>
              </div>
            </section>
          </div>
        </section>
        <p className="sr-only" aria-live="polite" aria-atomic="true" data-testid="announcement-live">{srAnnouncement}</p>
      </main>
    </div>
  );
}

export default App;