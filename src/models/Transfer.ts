import { Stop } from "./Stop";

export interface Transfer {
    departureStop: Stop,
    arrivalStop: Stop,
    duration: number
}