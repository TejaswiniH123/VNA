const axios = require("axios");

const getApiKey = () => {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || "";
};

/**
 * Resolve destination text to geographic coordinates using Google Places API (New).
 * @param {string} query - Destination search query (e.g., "Central Park", "Metro Station")
 * @param {{ latitude: number, longitude: number }} [origin] - Optional user GPS location for proximity bias
 * @param {string} [languageCode="en"] - Language code for results
 */
async function resolveDestination(query, origin, languageCode = "en") {
  const apiKey = getApiKey();
  if (!apiKey || apiKey === "your_google_maps_api_key_here") {
    return {
      status: "unconfigured",
      message: "Google Maps API Key is not configured. Please set GOOGLE_MAPS_API_KEY in backend/.env."
    };
  }

  if (!query || typeof query !== "string" || !query.trim()) {
    return {
      status: "error",
      message: "Destination query is required."
    };
  }

  const endpoint = "https://places.googleapis.com/v1/places:searchText";
  const requestBody = {
    textQuery: query.trim(),
    languageCode: languageCode.split("-")[0] || "en",
    maxResultCount: 5
  };

  // If user GPS origin is provided, bias results towards user location (10km radius)
  if (origin && typeof origin.latitude === "number" && typeof origin.longitude === "number") {
    requestBody.locationBias = {
      circle: {
        center: {
          latitude: origin.latitude,
          longitude: origin.longitude
        },
        radius: 10000.0 // 10km radius
      }
    };
  }

  try {
    const response = await axios.post(endpoint, requestBody, {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location"
      },
      timeout: 10000
    });

    const places = response.data?.places || [];
    if (places.length === 0) {
      return {
        status: "not_found",
        message: `Could not find any location matching "${query}".`
      };
    }

    // Check for high ambiguity across different locations
    if (places.length > 1) {
      const distinctNames = new Set(places.map(p => (p.displayName?.text || "").toLowerCase()));
      // If we have distinct places with very different names or addresses far apart
      if (distinctNames.size > 2) {
        return {
          status: "ambiguous",
          message: `Multiple places found for "${query}".`,
          candidates: places.slice(0, 3).map(p => ({
            id: p.id,
            name: p.displayName?.text || query,
            address: p.formattedAddress || "",
            latitude: p.location?.latitude,
            longitude: p.location?.longitude
          }))
        };
      }
    }

    const bestPlace = places[0];
    return {
      status: "success",
      place: {
        id: bestPlace.id,
        name: bestPlace.displayName?.text || query,
        address: bestPlace.formattedAddress || "",
        latitude: bestPlace.location?.latitude,
        longitude: bestPlace.location?.longitude
      }
    };
  } catch (error) {
    console.error("Google Places API error:", error.response?.data || error.message);
    const apiErrorMsg = error.response?.data?.error?.message || error.message;
    return {
      status: "error",
      message: `Failed to resolve destination: ${apiErrorMsg}`
    };
  }
}

/**
 * Calculate walking route using Google Routes API.
 * @param {{ latitude: number, longitude: number }} origin - User current location
 * @param {{ latitude: number, longitude: number }} destination - Destination coordinates
 * @param {string} [languageCode="en"] - Language code for instructions
 */
async function calculateWalkingRoute(origin, destination, languageCode = "en") {
  const apiKey = getApiKey();
  if (!apiKey || apiKey === "your_google_maps_api_key_here") {
    return {
      status: "unconfigured",
      message: "Google Maps API Key is not configured. Please set GOOGLE_MAPS_API_KEY in backend/.env."
    };
  }

  if (!origin?.latitude || !origin?.longitude || !destination?.latitude || !destination?.longitude) {
    return {
      status: "error",
      message: "Valid origin and destination coordinates are required."
    };
  }

  const endpoint = "https://routes.googleapis.com/directions/v2:computeRoutes";
  const requestBody = {
    origin: {
      location: {
        latLng: {
          latitude: origin.latitude,
          longitude: origin.longitude
        }
      }
    },
    destination: {
      location: {
        latLng: {
          latitude: destination.latitude,
          longitude: destination.longitude
        }
      }
    },
    travelMode: "WALK",
    routingPreference: "ROUTING_PREFERENCE_UNSPECIFIED",
    languageCode: languageCode.split("-")[0] || "en",
    units: "METRIC"
  };

  try {
    const response = await axios.post(endpoint, requestBody, {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps,routes.legs.distanceMeters,routes.legs.duration,routes.legs.startLocation,routes.legs.endLocation"
      },
      timeout: 12000
    });

    const route = response.data?.routes?.[0];
    if (!route) {
      return {
        status: "no_route",
        message: "No walking route could be found to the destination."
      };
    }

    const leg = route.legs?.[0] || {};
    const steps = (leg.steps || []).map((step, index) => {
      // Clean HTML instructions if present
      let instructionText = step.navigationInstruction?.instructions || "";
      instructionText = instructionText.replace(/<[^>]*>?/gm, "").trim();

      return {
        stepNumber: index + 1,
        instruction: instructionText || "Continue walking straight",
        maneuver: step.navigationInstruction?.maneuver || "STRAIGHT",
        distanceMeters: step.distanceMeters || 0,
        duration: step.staticDuration || "0s",
        startLocation: {
          latitude: step.startLocation?.latLng?.latitude,
          longitude: step.startLocation?.latLng?.longitude
        },
        endLocation: {
          latitude: step.endLocation?.latLng?.latitude,
          longitude: step.endLocation?.latLng?.longitude
        }
      };
    });

    return {
      status: "success",
      distanceMeters: route.distanceMeters || leg.distanceMeters || 0,
      duration: route.duration || leg.duration || "0s",
      polyline: route.polyline?.encodedPolyline || "",
      steps: steps
    };
  } catch (error) {
    console.error("Google Routes API error:", error.response?.data || error.message);
    const apiErrorMsg = error.response?.data?.error?.message || error.message;
    return {
      status: "error",
      message: `Route calculation failed: ${apiErrorMsg}`
    };
  }
}

/**
 * Translate dynamic text using Google Cloud Translation API if configured.
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code (e.g., 'hi', 'kn', 'ta', 'te', 'ml')
 * @param {string} [sourceLanguage="en"] - Source language
 */
async function translateDynamicText(text, targetLanguage, sourceLanguage = "en") {
  const apiKey = getApiKey();
  const targetCode = targetLanguage.split("-")[0];
  const sourceCode = sourceLanguage.split("-")[0];

  if (!text || targetCode === sourceCode) {
    return { text: text, translated: false };
  }

  if (!apiKey || apiKey === "your_google_maps_api_key_here") {
    // Graceful fallback when API key is not configured
    return { text: text, translated: false, fallback: true };
  }

  try {
    const endpoint = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    const response = await axios.post(endpoint, {
      q: text,
      target: targetCode,
      source: sourceCode,
      format: "text"
    }, { timeout: 8000 });

    const translatedText = response.data?.data?.translations?.[0]?.translatedText;
    if (translatedText) {
      return { text: translatedText, translated: true };
    }
    return { text: text, translated: false };
  } catch (error) {
    console.warn("Translation API warning:", error.message);
    return { text: text, translated: false, error: error.message };
  }
}

module.exports = {
  resolveDestination,
  calculateWalkingRoute,
  translateDynamicText
};
