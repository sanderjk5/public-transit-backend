export interface StopTime {
    tripId: number,
    arrivalTime: number,
    departureTime: number,
    stopId: number,
    stopSequence: number,
    pickupType: string,
    dropOffType: string,
}