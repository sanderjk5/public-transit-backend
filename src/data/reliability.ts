export class Reliability {

    private static longDistanceValues: number[];
    private static normalDistanceValues: number[];
    public static longDistanceExpectedValue: number;
    public static normalDistanceExpectedValue: number;

    /**
     * Initializes the probability values of trip delays.
     */
    public static initReliability() {
        this.longDistanceValues = [];
        this.normalDistanceValues = [];
        const aLong = 0.5;
        const logValueLong = Math.log(1 - aLong)
        const bLong = 7;
        const aNormal = 0.65;
        const logValueNormal = Math.log(1 - aNormal)
        const bNormal = 3.5;
        
        for(let i = 0; i < 30; i++) {
            const value = 1 - Math.exp(logValueLong - (i/bLong));
            this.longDistanceValues.push(value);
        }
        this.longDistanceValues.push(1);
        for(let i = 0; i < 15; i++) {
            const value = 1 - Math.exp(logValueNormal - (i/bNormal));
            this.normalDistanceValues.push(value)
            this.normalDistanceExpectedValue += (i * value);
        }
        this.normalDistanceValues.push(1);

        this.longDistanceExpectedValue = 0;
        this.normalDistanceExpectedValue = 0;
        for(let i = 1; i < 31; i++){
            this.longDistanceExpectedValue += i * (this.longDistanceValues[i] - this.longDistanceValues[i-1]);
        }
        this.longDistanceExpectedValue *= 60;
        for(let i = 1; i < 16; i++){
            this.normalDistanceExpectedValue += i * (this.normalDistanceValues[i] - this.normalDistanceValues[i-1]);
        }
        this.normalDistanceExpectedValue *= 60;
    }

    /**
     * Gets the probability of a given arrival time interval.
     * @param minValue 
     * @param maxValue 
     * @param isLongDistance 
     * @returns 
     */
    public static getProbabilityOfArrivalTime(minValue: number, maxValue: number, isLongDistance: boolean): number {
        let reliability = 1;
        let roundedMaxValue = Math.ceil(maxValue/60);
        if(isLongDistance){
            if(roundedMaxValue < 31){
                reliability = this.longDistanceValues[roundedMaxValue];
            }
        } else {
            if(roundedMaxValue < 16){
                reliability = this.normalDistanceValues[roundedMaxValue];
            }
        }
        if(minValue >= 0) {
            let roundedMinValue = Math.ceil(minValue/60);
            if(isLongDistance){
                if(roundedMinValue < 31){
                    reliability = reliability - this.longDistanceValues[roundedMinValue];
                }
            } else {
                if(roundedMinValue < 16){
                    reliability = reliability - this.normalDistanceValues[roundedMinValue];
                }
            }
        }
        return reliability;
    }

    /**
     * Returns a random delay.
     * @param isLongDistance 
     * @returns 
     */
    public static getRandomDelay(isLongDistance: boolean): number {
        let probability = Math.random();
        if(isLongDistance){
            for(let i = 0; i < this.longDistanceValues.length; i++){
                if(probability <= this.longDistanceValues[i]){
                    return i * 60;
                }
            }
        } else {
            for(let i = 0; i < this.normalDistanceValues.length; i++){
                if(probability <= this.normalDistanceValues[i]){
                    return i * 60;
                }
            }
        }
        return Number.MAX_VALUE;
    }
}