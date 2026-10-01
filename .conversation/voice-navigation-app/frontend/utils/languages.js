// frontend/utils/languages.js

export const SUPPORTED_LANGUAGES = [
  { code: "en-US", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "hi-IN", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "kn-IN", name: "Kannada", nativeName: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "ta-IN", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳" },
  { code: "te-IN", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳" },
  { code: "ml-IN", name: "Malayalam", nativeName: "മലയാളം", flag: "🇮🇳" },
];

export const DEFAULT_LANGUAGE = "en-US";

// Core UI and Spoken Phrases Dictionary
export const TRANSLATIONS = {
  // Common Object Labels
  objects: {
    person: {
      "en-US": "person",
      "hi-IN": "व्यक्ति",
      "kn-IN": "ವ್ಯಕ್ತಿ",
      "ta-IN": "நபர்",
      "te-IN": "వ్యక్తి",
      "ml-IN": "വ്യക്തി"
    },
    car: {
      "en-US": "car",
      "hi-IN": "गाड़ी",
      "kn-IN": "ಕಾರು",
      "ta-IN": "கார்",
      "te-IN": "కారు",
      "ml-IN": "കാർ"
    },
    chair: {
      "en-US": "chair",
      "hi-IN": "कुर्सी",
      "kn-IN": "ಕುರ್ಚಿ",
      "ta-IN": "நாற்காலி",
      "te-IN": "కుర్చీ",
      "ml-IN": "കസേര"
    },
    bottle: {
      "en-US": "bottle",
      "hi-IN": "बोतल",
      "kn-IN": "ಬಾಟಲಿ",
      "ta-IN": "பாட்டில்",
      "te-IN": "సీసా",
      "ml-IN": "കുപ്പി"
    },
    bicycle: {
      "en-US": "bicycle",
      "hi-IN": "साइकिल",
      "kn-IN": "ಸೈಕಲ್",
      "ta-IN": "சைக்கிள்",
      "te-IN": "సైకిల్",
      "ml-IN": "സൈക്കിൾ"
    },
    dog: {
      "en-US": "dog",
      "hi-IN": "कुत्ता",
      "kn-IN": "ನಾಯಿ",
      "ta-IN": "நாய்",
      "te-IN": "కుక్క",
      "ml-IN": "നായ"
    },
    cat: {
      "en-US": "cat",
      "hi-IN": "बिल्ली",
      "kn-IN": "ಬೆಕ್ಕು",
      "ta-IN": "பூனை",
      "te-IN": "పిల్లి",
      "ml-IN": "പൂച്ച"
    },
    table: {
      "en-US": "table",
      "hi-IN": "मेज़",
      "kn-IN": "ಮೇಜು",
      "ta-IN": "மேசை",
      "te-IN": "బల్ల",
      "ml-IN": "മേശ"
    },
    cell_phone: {
      "en-US": "cell phone",
      "hi-IN": "मोबाइल फोन",
      "kn-IN": "ಮೊಬೈಲ್ ಫೋನ್",
      "ta-IN": "கைப்பேசி",
      "te-IN": "సెల్ ఫోన్",
      "ml-IN": "മൊബൈൽ ഫോൺ"
    },
    laptop: {
      "en-US": "laptop",
      "hi-IN": "लैपटॉप",
      "kn-IN": "ಲ್ಯಾಪ್‌ಟಾಪ್",
      "ta-IN": "மடிக்கணினி",
      "te-IN": "ల్యాప్‌టాప్",
      "ml-IN": "ലാപ്‌ടോപ്പ്"
    },
    book: {
      "en-US": "book",
      "hi-IN": "किताब",
      "kn-IN": "ಪುಸ್ತಕ",
      "ta-IN": "புத்தகம்",
      "te-IN": "పుస్తకం",
      "ml-IN": "പുസ്തകം"
    },
    door: {
      "en-US": "door",
      "hi-IN": "दरवाज़ा",
      "kn-IN": "ಬಾಗಿಲು",
      "ta-IN": "கதவு",
      "te-IN": "తలుపు",
      "ml-IN": "വാതിൽ"
    },
    stair: {
      "en-US": "stairs",
      "hi-IN": "सीढ़ियाँ",
      "kn-IN": "ಮೆಟ್ಟಿಲುಗಳು",
      "ta-IN": "படிகள்",
      "te-IN": "మెట్లు",
      "ml-IN": "പടികൾ"
    }
  },

  // Directions
  directions: {
    "in front of you": {
      "en-US": "in front of you",
      "hi-IN": "आपके सामने",
      "kn-IN": "ನಿಮ್ಮ ಮುಂದೆ",
      "ta-IN": "உங்கள் முன்னால்",
      "te-IN": "మీ ఎదురుగా",
      "ml-IN": "നിങ്ങളുടെ മുന്നിൽ"
    },
    "on your left": {
      "en-US": "on your left",
      "hi-IN": "आपके बाईं ओर",
      "kn-IN": "ನಿಮ್ಮ ಎಡಭಾಗದಲ್ಲಿ",
      "ta-IN": "உங்கள் இடதுபுறத்தில்",
      "te-IN": "మీ ఎడమ వైపున",
      "ml-IN": "നിങ്ങളുടെ ഇടതുവശത്ത്"
    },
    "on your right": {
      "en-US": "on your right",
      "hi-IN": "आपके दाईं ओर",
      "kn-IN": "ನಿಮ್ಮ ಬಲಭಾಗದಲ್ಲಿ",
      "ta-IN": "உங்கள் வலதுபுறத்தில்",
      "te-IN": "మీ కుడి వైపున",
      "ml-IN": "നിങ്ങളുടെ വലതുവശത്ത്"
    }
  },

  // System & Status Messages
  messages: {
    voiceControlEnabled: {
      "en-US": "Voice control listening enabled. You can speak commands.",
      "hi-IN": "ध्वनि नियंत्रण शुरू हो गया है। आप आदेश बोल सकते हैं।",
      "kn-IN": "ಧ್ವನಿ ನಿಯಂತ್ರಣ ಸಕ್ರಿಯಗೊಂಡಿದೆ. ನೀವು ಆಜ್ಞೆಗಳನ್ನು ಮಾತನಾಡಬಹುದು.",
      "ta-IN": "குரல் கட்டுப்பாடு இயக்கப்பட்டது. நீங்கள் கட்டளைகளை பேசலாம்.",
      "te-IN": "వాయిస్ నియంత్రణ ప్రారంభించబడింది. మీరు ఆదేశాలు మాట్లాడవచ్చు.",
      "ml-IN": "ശബ്ദ നിയന്ത്രണം പ്രവർത്തനക്ഷമമാക്കി. നിങ്ങൾക്ക് കമാൻഡുകൾ സംസാരിക്കാം."
    },
    voiceControlDisabled: {
      "en-US": "Voice control stopped.",
      "hi-IN": "ध्वनि नियंत्रण बंद कर दिया गया है।",
      "kn-IN": "ಧ್ವನಿ ನಿಯಂತ್ರಣ ನಿಲ್ಲಿಸಲಾಗಿದೆ.",
      "ta-IN": "குரல் கட்டுப்பாடு நிறுத்தப்பட்டது.",
      "te-IN": "వాయిస్ నియంత్రణ నిలిపివేయబడింది.",
      "ml-IN": "ശബ്ദ നിയന്ത്രണം നിർത്തി."
    },
    cameraStarted: {
      "en-US": "Live camera detection started.",
      "hi-IN": "लाइव कैमरा पहचान शुरू हो गई है।",
      "kn-IN": "ಲೈವ್ ಕ್ಯಾಮೆರಾ ಪತ್ತೆ ಪ್ರಾರಂಭವಾಗಿದೆ.",
      "ta-IN": "நேரலை கேமரா கண்டறிதல் தொடங்கியது.",
      "te-IN": "లైవ్ కెమెరా గుర్తింపు ప్రారంభమైంది.",
      "ml-IN": "തത്സമയ ക്യാമറ കണ്ടെത്തൽ ആരംഭിച്ചു."
    },
    cameraStopped: {
      "en-US": "Live detection stopped.",
      "hi-IN": "लाइव पहचान बंद कर दी गई है।",
      "kn-IN": "ಲೈವ್ ಪತ್ತೆ ನಿಲ್ಲಿಸಲಾಗಿದೆ.",
      "ta-IN": "நேரலை கண்டறிதல் நிறுத்தப்பட்டது.",
      "te-IN": "లైవ్ గుర్తింపు నిలిపివేయబడింది.",
      "ml-IN": "തത്സമയ കണ്ടെത്തൽ നിർത്തി."
    },
    cameraError: {
      "en-US": "Camera permission is required for live detection.",
      "hi-IN": "लाइव पहचान के लिए कैमरा अनुमति आवश्यक है।",
      "kn-IN": "ಲೈವ್ ಪತ್ತೆಗಾಗಿ ಕ್ಯಾಮೆರಾ ಅನುಮತಿ ಅಗತ್ಯವಿದೆ.",
      "ta-IN": "நேரலை கண்டறிதலுக்கு கேமரா அனுமதி தேவை.",
      "te-IN": "లైవ్ గుర్తింపు కోసం కెమెరా అనుమతి అవసరం.",
      "ml-IN": "തത്സമയ കണ്ടെത്തലിനായി ക്യാമറ അനുമതി ആവശ്യമാണ്."
    },
    micPermissionError: {
      "en-US": "Microphone permission denied. Please allow microphone access.",
      "hi-IN": "माइक्रोफ़ोन अनुमति अस्वीकृत। कृपया माइक्रोफ़ोन अनुमति दें।",
      "kn-IN": "ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿಯನ್ನು ನಿರಾಕರಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಅನುಮತಿಸಿ.",
      "ta-IN": "மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது. தயவுசெய்து அனுமதி வழங்கவும்.",
      "te-IN": "మైక్రోఫోన్ అనుమతి నిరాకరించబడింది. దయచేసి అనుమతించండి.",
      "ml-IN": "മൈക്രോഫോൺ അനുമതി നിരസിച്ചു. ദയവായി അനുമതി നൽകുക."
    },
    sttNotSupported: {
      "en-US": "Speech recognition is not supported in this browser.",
      "hi-IN": "इस ब्राउज़र में वाक् पहचान समर्थित नहीं है।",
      "kn-IN": "ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಭಾಷಣ ಗುರುತಿಸುವಿಕೆ ಬೆಂಬಲಿತವಾಗಿಲ್ಲ.",
      "ta-IN": "இந்த உலாவியில் பேச்சு அறிதல் ஆதரிக்கப்படவில்லை.",
      "te-IN": "ఈ బ్రౌజర్‌లో స్పీచ్ రికగ్నిషన్ సపోర్ట్ చేయబడలేదు.",
      "ml-IN": "ഈ ബ്രൗസറിൽ സംഭാഷണം തിരിച്ചറിയൽ പിന്തുണയ്ക്കുന്നില്ല."
    },
    help: {
      "en-US": "You can say: Start live detection, Stop live detection, What is around me, Read this, or Take me to followed by a destination.",
      "hi-IN": "आप कह सकते हैं: स्टार्ट लाइव डिटेक्शन, स्टॉप लाइव डिटेक्शन, व्हाट इज अराउंड मी, रीड दिस, या टेक मी टू के बाद गंतव्य।",
      "kn-IN": "ನೀವು ಹೀಗೆ ಹೇಳಬಹುದು: Start live detection, Stop live detection, What is around me, Read this, ಅಥವಾ Take me to ಮತ್ತು ಸ್ಥಳ.",
      "ta-IN": "நீங்கள் கூறலாம்: Start live detection, Stop live detection, What is around me, Read this, அல்லது Take me to தொடர்ந்து சேருமிடம்.",
      "te-IN": "మీరు ఇలా చెప్పవచ్చు: Start live detection, Stop live detection, What is around me, Read this, లేదా Take me to మరియు గమ్యస్థానం.",
      "ml-IN": "നിങ്ങൾക്ക് പറയാം: Start live detection, Stop live detection, What is around me, Read this, അല്ലെങ്കിൽ Take me to തുടർന്ന് ലക്ഷ്യസ്ഥാനം."
    },
    noObjectsInView: {
      "en-US": "No objects currently detected in front of the camera.",
      "hi-IN": "कैमरे के सामने वर्तमान में कोई वस्तु नहीं मिली।",
      "kn-IN": "ಕ್ಯಾಮರಾದ ಮುಂದೆ ಯಾವುದೇ ವಸ್ತುಗಳು ಕಂಡುಬಂದಿಲ್ಲ.",
      "ta-IN": "கேமராவின் முன்னால் தற்போது எந்த பொருளும் இல்லை.",
      "te-IN": "కెమెరా ముందు ప్రస్తుతం ఎటువంటి వస్తువులు కనిపించలేదు.",
      "ml-IN": "ക്യാമറയ്ക്ക് മുന്നിൽ ഇപ്പോൾ വസ്തുക്കളൊന്നും കണ്ടെത്തിയില്ല."
    },
    readingText: {
      "en-US": "Capturing frame and reading text...",
      "hi-IN": "छवि लेकर पाठ पढ़ा जा रहा है...",
      "kn-IN": "ಫ್ರೇಮ್ ಸೆರೆಹಿಡಿದು ಪಠ್ಯವನ್ನು ಓದಲಾಗುತ್ತಿದೆ...",
      "ta-IN": "உரையைப் படிக்கிறது...",
      "te-IN": "ఫ్రేమ్‌ను క్యాప్చర్ చేసి టెక్స్ట్ చదువుతోంది...",
      "ml-IN": "ചിത്രം പകർത്തി എഴുത്ത് വായിക്കുന്നു..."
    },
    textExtracted: {
      "en-US": "Text read successfully: ",
      "hi-IN": "पाठ सफलतापूर्वक पढ़ा गया: ",
      "kn-IN": "ಪಠ್ಯವನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಓದಲಾಗಿದೆ: ",
      "ta-IN": "உரை வெற்றிகரமாக படிக்கப்பட்டது: ",
      "te-IN": "వచనం విజయవంతంగా చదవబడింది: ",
      "ml-IN": "വാചകം വിജയകരമായി വായിച്ചു: "
    },
    noTextFound: {
      "en-US": "No readable text found in the image.",
      "hi-IN": "छवि में कोई पढ़ने योग्य पाठ नहीं मिला।",
      "kn-IN": "ಚಿತ್ರದಲ್ಲಿ ಯಾವುದೇ ಓದಬಹುದಾದ ಪಠ್ಯ ಕಂಡುಬಂದಿಲ್ಲ.",
      "ta-IN": "படத்தில் படிக்கக்கூடிய உரை எதுவும் கிடைக்கவில்லை.",
      "te-IN": "చిత్రంలో చదవదగిన వచనం ఏదీ కనుగొనబడలేదు.",
      "ml-IN": "ചിത്രത്തിൽ വായിക്കാൻ സാധിക്കുന്ന വാചകമൊന്നും കണ്ടെത്തിയില്ല."
    },
    navDestinationConfirmation: {
      "en-US": "You want to go to {destination}. Finding route...",
      "hi-IN": "आप {destination} जाना चाहते हैं। रास्ता खोजा जा रहा है...",
      "kn-IN": "ನೀವು {destination} ಗೆ ಹೋಗಲು ಬಯಸುತ್ತೀರಿ. ಮಾರ್ಗವನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ...",
      "ta-IN": "நீங்கள் {destination} செல்ல விரும்புகிறீர்கள். பாதை கண்டறியப்படுகிறது...",
      "te-IN": "మీరు {destination} కి వెళ్లాలనుకుంటున్నారు. మార్గాన్ని శోధిస్తోంది...",
      "ml-IN": "നിങ്ങൾ {destination} ലേക്ക് പോകാൻ ആഗ്രഹിക്കുന്നു. വഴി കണ്ടെത്തുന്നു..."
    },
    navRouteFound: {
      "en-US": "Route found to {destination}. Distance is {distance} and estimated time is {duration}.",
      "hi-IN": "{destination} का रास्ता मिल गया। दूरी {distance} है और अनुमानित समय {duration} है।",
      "kn-IN": "{destination} ಗೆ ಮಾರ್ಗ ಸಿಕ್ಕಿದೆ. ದೂರ {distance} ಮತ್ತು ಅಂದಾಜು ಸಮಯ {duration}.",
      "ta-IN": "{destination} க்கான பாதை கிடைத்தது. தூரம் {distance} மற்றும் மதிப்பிடப்பட்ட நேரம் {duration}.",
      "te-IN": "{destination} మార్గం కనుగొనబడింది. దూరం {distance} మరియు అంచనా సమయం {duration}.",
      "ml-IN": "{destination} ലേക്കുള്ള വഴി കണ്ടെത്തി. ദൂരം {distance}, കണക്കാക്കിയ സമയം {duration}."
    },
    navArrived: {
      "en-US": "You have arrived at your destination.",
      "hi-IN": "आप अपने गंतव्य पर पहुँच गए हैं।",
      "kn-IN": "ನಿಮ್ಮ ಗಮ್ಯಸ್ಥಾನವನ್ನು ನೀವು ತಲುಪಿದ್ದೀರಿ.",
      "ta-IN": "நீங்கள் உங்கள் சேருமிடத்தை அடைந்துவிட்டீர்கள்.",
      "te-IN": "మీరు మీ గమ్యాన్ని చేరుకున్నారు.",
      "ml-IN": "നിങ്ങൾ ലക്ഷ്യസ്ഥാനത്ത് എത്തിച്ചേർന്നു."
    },
    navOffRoute: {
      "en-US": "You appear to be off the route. Recalculating route.",
      "hi-IN": "आप रास्ते से अलग हो गए हैं। नया रास्ता खोजा जा रहा है।",
      "kn-IN": "ನೀವು ಮಾರ್ಗದಿಂದ ದೂರ ಸರಿದಿರುವಿರಿ. ಮರು ಲೆಕ್ಕಾಚಾರ ಮಾಡಲಾಗುತ್ತಿದೆ.",
      "ta-IN": "நீங்கள் பாதையிலிருந்து விலகிவிட்டீர்கள். மீண்டும் கணக்கிடப்படுகிறது.",
      "te-IN": "మీరు మార్గం నుండి తప్పుకున్నారు. తిరిగి లెక్కించబడుతోంది.",
      "ml-IN": "നിങ്ങൾ റൂട്ടിൽ നിന്ന് മാറിയതായി തോന്നുന്നു. വഴി പുനർനിർണ്ണയിക്കുന്നു."
    },
    navStopped: {
      "en-US": "Navigation stopped.",
      "hi-IN": "नेविगेशन रोक दिया गया है।",
      "kn-IN": "ನ್ಯಾವಿಗೇಷನ್ ನಿಲ್ಲಿಸಲಾಗಿದೆ.",
      "ta-IN": "வழிசெலுத்தல் நிறுத்தப்பட்டது.",
      "te-IN": "నావిగేషన్ నిలిపివేయబడింది.",
      "ml-IN": "നാവിഗേഷൻ നിർത്തി."
    },
    navApiKeyMissing: {
      "en-US": "Google Maps API key is not configured in backend. Please configure GOOGLE_MAPS_API_KEY in backend/.env.",
      "hi-IN": "बैकएंड में गूगल मैप्स एपीआई कुंजी कॉन्फ़िगर नहीं है। कृपया backend/.env में GOOGLE_MAPS_API_KEY सेट करें।",
      "kn-IN": "ಬ್ಯಾಕೆಂಡ್‌ನಲ್ಲಿ Google Maps API ಕೀಲಿಯನ್ನು ಕಾನ್ಫಿಗರ್ ಮಾಡಲಾಗಿಲ್ಲ. backend/.env ನಲ್ಲಿ ಹೊಂದಿಸಿ.",
      "ta-IN": "Google Maps API விசை பேக்கெண்டில் கட்டமைக்கப்படவில்லை. backend/.env இல் அமைக்கவும்.",
      "te-IN": "బ్యాకెండ్‌లో Google Maps API కీ కాన్ఫిగర్ చేయబడలేదు. backend/.env లో సెట్ చేయండి.",
      "ml-IN": "ബാക്കെൻഡിൽ Google Maps API കീ കോൺഫിഗർ ചെയ്തിട്ടില്ല. backend/.env-ൽ സജ്ജമാക്കുക."
    },
    navGeoError: {
      "en-US": "Unable to get your current GPS location. Please ensure location services are enabled.",
      "hi-IN": "वर्तमान जीपीएस स्थान प्राप्त करने में असमर्थ। कृपया स्थान सेवाएँ चालू करें।",
      "kn-IN": "ಪ್ರಸ್ತುತ ಜಿಪಿಎಸ್ ಸ್ಥಳವನ್ನು ಪಡೆಯಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲ. ಸ್ಥಳ ಸೇವೆಗಳನ್ನು ಆನ್ ಮಾಡಿ.",
      "ta-IN": "தற்போதைய ஜிபிஎஸ் இருப்பிடத்தைப் பெற முடியவில்லை. இருப்பிட சேவையை இயக்கவும்.",
      "te-IN": "ప్రస్తుత జీపీఎస్ స్థానాన్ని పొందలేకపోయాము. దయచేసి స్థాన సేవలను ఆన్ చేయండి.",
      "ml-IN": "നിലവിലെ ജിപിഎസ് ലൊക്കേഷൻ ലഭ്യമാക്കാൻ കഴിഞ്ഞില്ല. ലൊക്കേഷൻ സേവനങ്ങൾ ഓണാക്കുക."
    }
  }
};

/**
 * Get translated message by key with optional placeholders.
 */
export function getMessage(key, langCode = DEFAULT_LANGUAGE, params = {}) {
  const lang = TRANSLATIONS.messages[key] ? langCode : DEFAULT_LANGUAGE;
  let text = TRANSLATIONS.messages[key]?.[lang] || TRANSLATIONS.messages[key]?.[DEFAULT_LANGUAGE] || key;

  for (const [paramKey, paramVal] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), paramVal);
  }
  return text;
}

/**
 * Translate an object label to target language.
 */
export function translateObjectLabel(label, langCode = DEFAULT_LANGUAGE) {
  if (!label) return "";
  const normalized = label.toLowerCase().replace(/\s+/g, "_");
  if (TRANSLATIONS.objects[normalized]?.[langCode]) {
    return TRANSLATIONS.objects[normalized][langCode];
  }
  if (TRANSLATIONS.objects[label.toLowerCase()]?.[langCode]) {
    return TRANSLATIONS.objects[label.toLowerCase()][langCode];
  }
  return label;
}

/**
 * Translate a direction phrase to target language.
 */
export function translateDirection(direction, langCode = DEFAULT_LANGUAGE) {
  if (!direction) return "";
  const key = direction.toLowerCase().trim();
  if (TRANSLATIONS.directions[key]?.[langCode]) {
    return TRANSLATIONS.directions[key][langCode];
  }
  return direction;
}

/**
 * Format a detection summary in target language.
 */
export function formatDetectionSentence(item, langCode = DEFAULT_LANGUAGE) {
  const translatedLabel = translateObjectLabel(item.class_name, langCode);
  const translatedDir = translateDirection(item.direction, langCode);

  if (langCode.startsWith("hi")) {
    return item.distance
      ? `${translatedDir} लगभग ${item.distance} मीटर पर ${translatedLabel}`
      : `${translatedDir} ${translatedLabel}`;
  }
  if (langCode.startsWith("kn")) {
    return item.distance
      ? `${translatedDir} ಸುಮಾರು ${item.distance} ಮೀಟರ್ ದೂರದಲ್ಲಿ ${translatedLabel}`
      : `${translatedDir} ${translatedLabel}`;
  }
  if (langCode.startsWith("ta")) {
    return item.distance
      ? `${translatedDir} சுமார் ${item.distance} மீட்டர் தொலைவில் ${translatedLabel}`
      : `${translatedDir} ${translatedLabel}`;
  }
  if (langCode.startsWith("te")) {
    return item.distance
      ? `${translatedDir} దాదాపు ${item.distance} మీటర్ల దూరంలో ${translatedLabel}`
      : `${translatedDir} ${translatedLabel}`;
  }
  if (langCode.startsWith("ml")) {
    return item.distance
      ? `${translatedDir} ഏകദേശം ${item.distance} മീറ്റർ അകലെ ${translatedLabel}`
      : `${translatedDir} ${translatedLabel}`;
  }

  // Default English
  return item.distance
    ? `${translatedLabel} approximately ${item.distance} meters ${translatedDir}`
    : `${translatedLabel} ${translatedDir}`;
}
