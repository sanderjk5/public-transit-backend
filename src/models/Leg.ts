import { Stop } from './Stop';
export interface Leg {
    departureStop: Stop,
    arrivalStop: Stop,
    departureTime: string,
    arrivalTime: string,
    duration: string
}