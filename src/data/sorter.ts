import { Connection } from "../models/Connection";
import { Footpath } from "../models/Footpath";
import { StopTime } from "../models/StopTime";
import { TempEdge } from "../models/TempEdge";
import { TempNode } from "../models/TempNode";

export class Sorter {

    /**
     * Sorts stop times by their departure time.
     * @param a 
     * @param b 
     * @returns 
     */
    public static sortStopTimesByDeparture(a: StopTime, b: StopTime): number{
        if(a.departureTime < b.departureTime){
            return -1;
        }
        if(a.departureTime === b.departureTime){
            return 0;
        }
        if(a.departureTime > b.departureTime){
            return 1;
        }
    }

    /**
     * Sorts stop times by their trip id and sequence.
     * @param a 
     * @param b 
     * @returns 
     */
    public static sortStopTimesByTripIdAndSequence(a: StopTime, b: StopTime){
        if(a.tripId < b.tripId){
            return -1;
        }
        if(a.tripId === b.tripId){
            if(a.stopSequence < b.stopSequence){
                return -1;
            }
            if(a.stopSequence === b.stopSequence){
                return 0;
            }
            if(a.stopSequence > b.stopSequence){
                return 1;
            }
        }
        if(a.tripId > b.tripId){
            return 1;
        }
    }

    /**
     * Sorts connections by their departure time.
     * @param a 
     * @param b 
     * @returns 
     */
    public static sortConnectionsByDepartureTime(a: Connection, b: Connection){
        if(a.departureTime < b.departureTime){
            return -1;
        }
        if(a.departureTime === b.departureTime){
            return 0;
        }
        if(a.departureTime > b.departureTime){
            return 1;
        }
    }

    /**
     * Sorts footpaths by their departure stop.
     * @param a 
     * @param b 
     * @returns 
     */
    public static sortFootpathsByDepartureStop(a: Footpath, b: Footpath){
        if(a.departureStop < b.departureStop) {
            return -1;
        }
        if(a.departureStop === b.departureStop) {
            return 0;
        }
        if(a.departureStop > b.departureStop) {
            return 1;
        }
    }

    /**
     * Sorts footpaths by their arrival stop.
     * @param a 
     * @param b 
     * @returns 
     */
     public static sortFootpathsByArrivalStop(a: Footpath, b: Footpath){
        if(a.arrivalStop < b.arrivalStop) {
            return -1;
        }
        if(a.arrivalStop === b.arrivalStop) {
            return 0;
        }
        if(a.arrivalStop > b.arrivalStop) {
            return 1;
        }
    }

    /**
     * Sorts temp edges by departure time, arrival time, source stop, target stop and type.
     * @param a 
     * @param b 
     * @returns 
     */
    public static sortEdgesByDepartureTime(a: TempEdge, b: TempEdge){
        if(a.departureTime < b.departureTime){
            return -1;
        }
        if(a.departureTime === b.departureTime){
            if(a.arrivalTime < b.arrivalTime){
                return -1;
            }
            if(a.arrivalTime === b.arrivalTime){
                if(a.departureStop < b.departureStop){
                    return -1;
                }
                if(a.departureStop === b.departureStop){
                    if(a.arrivalStop < b.arrivalStop){
                        return -1;
                    }
                    if(a.arrivalStop === b.arrivalStop){
                        if(a.type < b.type){
                            return -1;
                        }
                        if(a.type === b.type){
                            return 0;
                        }
                        if(a.type > b.type){
                            return 1;
                        }
                    }
                    if(a.arrivalStop > b.arrivalStop){
                        return 1;
                    }
                }
                if(a.departureStop > b.departureStop){
                    return 1;
                }
            }
            if(a.arrivalTime > b.arrivalTime){
                return 1;
            }
        }
        if(a.departureTime > b.departureTime){
            return 1
        }
    }

    /**
     * Sorts temp edges by source stop, target stop, type and departure time.
     * @param a 
     * @param b 
     * @returns 
     */
     public static sortEdgesByDepartureStop(a: TempEdge, b: TempEdge){
        if(a.departureStop < b.departureStop){
            return -1;
        }
        if(a.departureStop === b.departureStop){
            if(a.arrivalStop < b.arrivalStop){
                return -1;
            }
            if(a.arrivalStop === b.arrivalStop){
                if(a.type < b.type){
                    return -1;
                }
                if(a.type === b.type){
                    if(a.departureTime < b.departureTime){
                        return -1;
                    }
                    if(a.departureTime === b.departureTime){
                        return 0;
                    }
                    if(a.departureTime > b.departureTime){
                        return 1;
                    }
                }
                if(a.type > b.type){
                    return 1;
                }
            }
            if(a.arrivalStop > b.arrivalStop){
                return 1;
            }
        }
        if(a.departureStop > b.departureStop){
            return 1
        }
    }

    /**
     * Sorts edges by departure stop and departure time.
     * @param a 
     * @param b 
     * @returns 
     */
    public static sortEdgesByDepartureStopAndDepartureTime(a: TempEdge, b: TempEdge){
        if(a.departureStop < b.departureStop){
            return -1;
        }
        if(a.departureStop === b.departureStop){
            if(a.departureTime < b.departureTime){
                return -1;
            }
            if(a.departureTime === b.departureTime){
                return 0;
            }
            if(a.departureTime > b.departureTime){
                return 1;
            }
        }
        if(a.departureStop > b.departureStop){
            return 1
        }
    }

    /**
     * Sorts tempNodes by time, stop and type.
     * @param a 
     * @param b 
     * @returns 
     */
    public static sortNodesByTime(a: TempNode, b: TempNode){
        if(a.time < b.time){
            return -1;
        }
        if(a.time === b.time){
            if(a.stop < b.stop){
                return -1;
            }
            if(a.stop === b.stop){
                if(a.type < b.type){
                    return -1;
                }
                if(a.type === b.type){
                    return 0;
                }
                if(a.type > b.type){
                    return 1;
                }
            }
            if(a.stop > b.stop){
                return 1;
            }
        }
        if(a.time > b.time){
            return 1;
        }
    }
}