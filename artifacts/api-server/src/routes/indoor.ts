import { Router, type IRouter, type Response } from "express";
import {
  CalculateIndoorRouteBody,
  CalculateIndoorRouteResponse,
  GetIndoorFloorMapParams,
  GetIndoorFloorMapResponse,
  ListIndoorBuildingsResponse,
  ListIndoorFloorsParams,
  ListIndoorFloorsResponse,
  ResolveIndoorLocationBody,
  ResolveIndoorLocationResponse,
  SearchIndoorDestinationsQueryParams,
  SearchIndoorDestinationsResponse,
} from "@workspace/api-zod";
import {
  IndoorNavigationError,
  calculateRoute,
  getFloorMap,
  listBuildings,
  listFloors,
  resolveLocation,
  searchDestinations,
} from "../services/indoorNavigation";

const router: IRouter = Router();

function sendResult(
  res: Response,
  responseSchema: { parse: (value: unknown) => unknown },
  operation: () => unknown,
) {
  try {
    return res.json(responseSchema.parse(operation()));
  } catch (error) {
    return sendError(res, error);
  }
}

function sendError(res: Response, error: unknown) {
  if (error instanceof IndoorNavigationError) {
    if (error.statusCode === 500) {
      return res.status(500).json({ error: "Indoor navigation is temporarily unavailable." });
    }
    return res.status(error.statusCode).json({ error: error.message });
  }
  return res.status(500).json({ error: "Indoor navigation is temporarily unavailable." });
}

router.get("/indoor/buildings", (_req, res) =>
  sendResult(res, ListIndoorBuildingsResponse, listBuildings),
);

router.get("/indoor/buildings/:buildingId/floors", (req, res) => {
  const parsed = ListIndoorFloorsParams.safeParse({ buildingId: req.params.buildingId });
  if (!parsed.success) return res.status(400).json({ error: "Invalid building ID." });
  return sendResult(res, ListIndoorFloorsResponse, () => listFloors(parsed.data.buildingId));
});

router.get("/indoor/floors/:floorId/map", (req, res) => {
  const parsed = GetIndoorFloorMapParams.safeParse({ floorId: req.params.floorId });
  if (!parsed.success) return res.status(400).json({ error: "Invalid floor ID." });
  return sendResult(res, GetIndoorFloorMapResponse, () => getFloorMap(parsed.data.floorId));
});

router.get("/indoor/destinations", (req, res) => {
  const parsed = SearchIndoorDestinationsQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "A valid building ID is required." });
  return sendResult(res, SearchIndoorDestinationsResponse, () =>
    searchDestinations(parsed.data.buildingId, parsed.data.query),
  );
});

router.post("/indoor/location", (req, res) => {
  const parsed = ResolveIndoorLocationBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Provide a building and a QR marker or manual checkpoint." });
  }
  return sendResult(res, ResolveIndoorLocationResponse, () => resolveLocation(parsed.data));
});

router.post("/indoor/route", (req, res) => {
  const parsed = CalculateIndoorRouteBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Provide a building, starting checkpoint, and destination." });
  }
  return sendResult(res, CalculateIndoorRouteResponse, () => calculateRoute(parsed.data));
});

export default router;