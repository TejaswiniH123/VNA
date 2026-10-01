import sampleMapJson from "../data/indoor-map.json";

export type IndoorNodeType =
  | "ENTRANCE"
  | "ROOM"
  | "CORRIDOR"
  | "JUNCTION"
  | "STAIRCASE"
  | "ELEVATOR"
  | "RESTROOM"
  | "RECEPTION"
  | "EXIT"
  | "OTHER";

export interface IndoorBuilding {
  id: string;
  name: string;
  description: string;
  isDemo: boolean;
}

export interface IndoorFloor {
  id: string;
  buildingId: string;
  floorNumber: number;
  name: string;
}

export interface IndoorNode {
  id: string;
  floorId: string;
  name: string;
  type: IndoorNodeType;
  x: number;
  y: number;
  description: string;
}

export interface IndoorEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  distanceMeters: number;
  accessible: boolean;
  direction: string;
  description: string;
}

export interface IndoorDestination {
  id: string;
  buildingId: string;
  floorId: string;
  floorName: string;
  nodeId: string;
  name: string;
  type: "ROOM" | "RESTROOM" | "RECEPTION" | "ENTRANCE" | "EXIT" | "OTHER";
}

interface IndoorMapData {
  building: IndoorBuilding;
  floors: IndoorFloor[];
  nodes: IndoorNode[];
  edges: IndoorEdge[];
  destinations: IndoorDestination[];
}

interface IndoorLocationInput {
  buildingId: string;
  method: "QR" | "MANUAL";
  markerPayload?: string;
  nodeId?: string;
}

interface IndoorLocation {
  buildingId: string;
  floorId: string;
  nodeId: string;
  nodeName: string;
  method: "QR" | "MANUAL";
  message: string;
}

interface IndoorRouteInput {
  buildingId: string;
  fromNodeId: string;
  destinationId: string;
  accessibleOnly?: boolean;
}

interface IndoorRouteStep {
  order: number;
  fromNodeId: string;
  toNodeId: string;
  instruction: string;
  distanceMeters: number;
  floorTransition: boolean;
  fromFloorName: string;
  toFloorName: string;
}

interface IndoorRoute {
  buildingId: string;
  fromNodeId: string;
  destination: IndoorDestination;
  distanceMeters: number;
  durationSeconds: number;
  nodes: IndoorNode[];
  steps: IndoorRouteStep[];
}

export class IndoorNavigationError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 422 | 500,
  ) {
    super(message);
    this.name = "IndoorNavigationError";
  }
}

const mapData = sampleMapJson as IndoorMapData;

function requireBuilding(buildingId: string): IndoorBuilding {
  if (buildingId !== mapData.building.id) {
    throw new IndoorNavigationError("Building not found.", 404);
  }
  return mapData.building;
}

function requireNode(nodeId: string, buildingId: string): IndoorNode {
  requireBuilding(buildingId);
  const node = mapData.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || !mapData.floors.some((floor) => floor.id === node.floorId)) {
    throw new IndoorNavigationError("Location checkpoint not found in this building.", 404);
  }
  return node;
}

export function listBuildings(): IndoorBuilding[] {
  return [mapData.building];
}

export function listFloors(buildingId: string): IndoorFloor[] {
  requireBuilding(buildingId);
  return mapData.floors;
}

export function getFloorMap(floorId: string) {
  const floor = mapData.floors.find((candidate) => candidate.id === floorId);
  if (!floor) {
    throw new IndoorNavigationError("Floor not found.", 404);
  }

  const nodes = mapData.nodes.filter((node) => node.floorId === floor.id);
  const nodeIds = new Set(nodes.map((node) => node.id));
  return {
    building: mapData.building,
    floor,
    nodes,
    edges: mapData.edges.filter(
      (edge) => nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId),
    ),
  };
}

export function searchDestinations(buildingId: string, query?: string): IndoorDestination[] {
  requireBuilding(buildingId);
  const search = query?.trim().toLocaleLowerCase();
  return mapData.destinations.filter(
    (destination) =>
      destination.buildingId === buildingId &&
      (!search || destination.name.toLocaleLowerCase().includes(search)),
  );
}

function parseMarker(payload: string): { buildingId: string; floorValue: string; nodeId: string } {
  const values = new Map<string, string>();
  for (const line of payload.split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    values.set(line.slice(0, separator).trim().toUpperCase(), line.slice(separator + 1).trim());
  }
  const buildingId = values.get("BUILDING");
  const floorValue = values.get("FLOOR");
  const nodeId = values.get("NODE");
  if (!buildingId || !floorValue || !nodeId) {
    throw new IndoorNavigationError(
      "QR marker is missing its building, floor, or checkpoint. Choose a location manually instead.",
      400,
    );
  }
  return { buildingId, floorValue, nodeId };
}

export function resolveLocation(input: IndoorLocationInput): IndoorLocation {
  const building = requireBuilding(input.buildingId);
  let node: IndoorNode;
  let method: "QR" | "MANUAL";

  if (input.method === "QR") {
    if (!input.markerPayload?.trim()) {
      throw new IndoorNavigationError("No QR marker data was received. Try scanning again or choose a location manually.", 400);
    }
    const marker = parseMarker(input.markerPayload);
    if (marker.buildingId.toUpperCase() !== building.id.toUpperCase()) {
      throw new IndoorNavigationError("This QR marker belongs to a different building.", 400);
    }
    const floor = mapData.floors.find(
      (candidate) =>
        candidate.id.toUpperCase() === marker.floorValue.toUpperCase() ||
        candidate.name.toUpperCase() === marker.floorValue.toUpperCase() ||
        String(candidate.floorNumber) === marker.floorValue,
    );
    if (!floor) {
      throw new IndoorNavigationError("The QR marker refers to a floor that is not on this map.", 404);
    }
    node = requireNode(marker.nodeId, input.buildingId);
    if (node.floorId !== floor.id) {
      throw new IndoorNavigationError("The QR marker's checkpoint does not match its floor.", 400);
    }
    method = "QR";
  } else {
    if (!input.nodeId) {
      throw new IndoorNavigationError("Choose a starting checkpoint.", 400);
    }
    node = requireNode(input.nodeId, input.buildingId);
    method = "MANUAL";
  }

  const floor = mapData.floors.find((candidate) => candidate.id === node.floorId);
  if (!floor) {
    throw new IndoorNavigationError("Floor not found for this checkpoint.", 404);
  }

  return {
    buildingId: building.id,
    floorId: floor.id,
    nodeId: node.id,
    nodeName: node.name,
    method,
    message:
      method === "QR"
        ? `QR checkpoint recognized: ${node.name}, ${floor.name}. This is a one-time location check, not live indoor tracking.`
        : `Starting checkpoint set to ${node.name}, ${floor.name}. Manual selection does not provide live indoor tracking.`,
  };
}

function reverseDirection(direction: string): string {
  if (direction === "LEFT") return "RIGHT";
  if (direction === "RIGHT") return "LEFT";
  if (direction === "UP") return "DOWN";
  if (direction === "DOWN") return "UP";
  return direction;
}

function getStepInstruction(
  fromNode: IndoorNode,
  toNode: IndoorNode,
  edge: IndoorEdge,
  direction: string,
  floorTransition: boolean,
): string {
  if (floorTransition) {
    const fromFloor = mapData.floors.find((floor) => floor.id === fromNode.floorId)!;
    const toFloor = mapData.floors.find((floor) => floor.id === toNode.floorId)!;
    const connector = fromNode.type === "STAIRCASE" || fromNode.type === "ELEVATOR" ? fromNode : toNode;
    const connectorName = connector.type === "STAIRCASE" ? "stairs" : "elevator";
    const verticalDirection = toFloor.floorNumber > fromFloor.floorNumber ? "up" : "down";
    return `Take the ${connectorName} ${verticalDirection} to ${toFloor.name}.`;
  }

  if (toNode.type === "ROOM" || toNode.type === "RESTROOM") {
    if (direction === "LEFT" || direction === "RIGHT") {
      const side = direction.toLowerCase();
      return `${toNode.name} is on your ${side}.`;
    }
    return `Continue to ${toNode.name}.`;
  }
  if (direction === "LEFT" || direction === "RIGHT") {
    return `Turn ${direction.toLowerCase()} at ${toNode.name}.`;
  }
  if (toNode.type === "ELEVATOR" || toNode.type === "STAIRCASE") {
    return `Walk to ${toNode.name}.`;
  }
  return `Continue for ${Math.round(edge.distanceMeters)} meters to ${toNode.name}.`;
}

function findShortestPath(
  startNodeId: string,
  endNodeId: string,
  accessibleOnly: boolean,
): IndoorNode[] {
  const distance = new Map(mapData.nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
  const previous = new Map<string, string>();
  const pending = new Set(mapData.nodes.map((node) => node.id));
  distance.set(startNodeId, 0);

  while (pending.size > 0) {
    let currentId: string | undefined;
    let currentDistance = Number.POSITIVE_INFINITY;
    for (const nodeId of pending) {
      const candidateDistance = distance.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (candidateDistance < currentDistance) {
        currentId = nodeId;
        currentDistance = candidateDistance;
      }
    }
    if (!currentId || !Number.isFinite(currentDistance) || currentId === endNodeId) break;
    pending.delete(currentId);

    for (const edge of mapData.edges) {
      if (accessibleOnly && !edge.accessible) continue;
      const nextId =
        edge.fromNodeId === currentId
          ? edge.toNodeId
          : edge.toNodeId === currentId
            ? edge.fromNodeId
            : undefined;
      if (!nextId || !pending.has(nextId)) continue;
      const nextDistance = currentDistance + edge.distanceMeters;
      if (nextDistance < (distance.get(nextId) ?? Number.POSITIVE_INFINITY)) {
        distance.set(nextId, nextDistance);
        previous.set(nextId, currentId);
      }
    }
  }

  if (!Number.isFinite(distance.get(endNodeId))) {
    throw new IndoorNavigationError(
      accessibleOnly
        ? "No accessible route is available for this destination."
        : "No route is available for this destination.",
      422,
    );
  }

  const nodesById = new Map(mapData.nodes.map((node) => [node.id, node]));
  const path = [nodesById.get(endNodeId)!];
  let currentId = endNodeId;
  while (currentId !== startNodeId) {
    const previousId = previous.get(currentId);
    if (!previousId) {
      throw new IndoorNavigationError("No route is available for this destination.", 422);
    }
    path.push(nodesById.get(previousId)!);
    currentId = previousId;
  }
  return path.reverse();
}

export function calculateRoute(input: IndoorRouteInput): IndoorRoute {
  requireBuilding(input.buildingId);
  const startNode = requireNode(input.fromNodeId, input.buildingId);
  const destination = mapData.destinations.find(
    (candidate) =>
      candidate.id === input.destinationId && candidate.buildingId === input.buildingId,
  );
  if (!destination) {
    throw new IndoorNavigationError("Destination not found in this building.", 404);
  }
  const destinationNode = requireNode(destination.nodeId, input.buildingId);
  const nodes = findShortestPath(
    startNode.id,
    destinationNode.id,
    input.accessibleOnly ?? false,
  );
  const steps: IndoorRouteStep[] = [];
  let distanceMeters = 0;

  for (let index = 0; index < nodes.length - 1; index += 1) {
    const fromNode = nodes[index]!;
    const toNode = nodes[index + 1]!;
    const edge = mapData.edges.find(
      (candidate) =>
        (candidate.fromNodeId === fromNode.id && candidate.toNodeId === toNode.id) ||
        (candidate.fromNodeId === toNode.id && candidate.toNodeId === fromNode.id),
    );
    if (!edge) {
      throw new IndoorNavigationError("Route data is incomplete for this map.", 500);
    }
    const reversed = edge.fromNodeId !== fromNode.id;
    const direction = reversed ? reverseDirection(edge.direction) : edge.direction;
    const floorTransition = fromNode.floorId !== toNode.floorId;
    const fromFloor = mapData.floors.find((floor) => floor.id === fromNode.floorId)!;
    const toFloor = mapData.floors.find((floor) => floor.id === toNode.floorId)!;
    distanceMeters += edge.distanceMeters;
    steps.push({
      order: index + 1,
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      instruction: getStepInstruction(fromNode, toNode, edge, direction, floorTransition),
      distanceMeters: edge.distanceMeters,
      floorTransition,
      fromFloorName: fromFloor.name,
      toFloorName: toFloor.name,
    });
  }

  return {
    buildingId: input.buildingId,
    fromNodeId: startNode.id,
    destination,
    distanceMeters,
    durationSeconds: Math.round(distanceMeters / 1.1),
    nodes,
    steps,
  };
}