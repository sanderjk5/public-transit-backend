export interface TempEdge {
    departureStop: string,
    arrivalStop: string,
    departureTime: number,
    lastDepartureTime?: number
    arrivalTime?: number,
    type: string,
}