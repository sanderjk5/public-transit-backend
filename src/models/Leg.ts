import { Stop } from './Stop';
export interface Leg {
    departureStop: Stop,
    arrivalStop: Stop,
    departureTime: number,
    arrivalTime: number,
    duration: string,
    departureDate: Date,
    arrivalDate: Date,
}