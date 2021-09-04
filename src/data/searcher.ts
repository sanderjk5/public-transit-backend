import { GoogleTransitData } from "./google-transit-data";

export class Searcher {
    public static binarySearchOfConnections(value: number): number{
        let start = 0;
        let end = GoogleTransitData.CONNECTIONS.length -1;
        while(start <= end) {
            let middle = Math.floor((start + end) / 2);
            if(GoogleTransitData.CONNECTIONS[middle].departureTime >= value && ( middle === 0 || GoogleTransitData.CONNECTIONS[middle - 1].departureTime < value)){
                return middle;
            } else if(GoogleTransitData.CONNECTIONS[middle].departureTime < value) {
                start = middle + 1;
            } else {
                end = middle - 1;
            }
        }
        return 0;
    }
}