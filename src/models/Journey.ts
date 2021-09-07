import { Leg } from './Leg';
import { Transfer } from './Transfer';
export interface Journey {
    legs: Leg[],
    transfers: Transfer[]
}