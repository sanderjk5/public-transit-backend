export interface Trip {
    routeId: number,
    serviceId: number,
    id: number,
    directionId: number,
    isLongDistance: boolean,
    isAvailable?: number,
}