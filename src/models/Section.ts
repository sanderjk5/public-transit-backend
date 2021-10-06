export interface Section {
    departureTime: string,
    arrivalTime: string,
    duration: string,
    departureStop: string,
    arrivalStop: string,
    type: string,
    departureDate?: Date,
    arrivalDate?: Date,
}