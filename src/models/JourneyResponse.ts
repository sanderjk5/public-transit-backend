import { Section } from "./Section";

export interface JourneyResponse {
    departureTime: string,
    arrivalTime: string,
    departureDate: string,
    arrivalDate: string,
    changes: number,
    sourceStop: string,
    targetStop: string,
    sections: Section[],
}