import { Leg } from './Leg';
import { Transfer } from './Transfer';
export interface JourneyCSA {
    legs: Leg[],
    transfers: Transfer[],
    reliability: number,
}