export class Reliability {

    private static longDistanceValues: number[];
    private static normalDistanceValues: number[];

    public static initReliability() {
        this.longDistanceValues = [];
        this.normalDistanceValues = [];
        const aLong = 0.5;
        const logValueLong = Math.log(1 - aLong)
        const bLong = 7;
        const aNormal = 0.65;
        const bNormal = 3.5;
        const logValueNormal = Math.log(1 - aNormal)
        for(let i = 0; i < 31; i++) {
            const value = 1 - Math.exp(logValueLong - (i/bLong));
            this.longDistanceValues.push(value)
        }
        for(let i = 0; i < 16; i++) {
            const value = 1 - Math.exp(logValueNormal - (i/bNormal));
            this.normalDistanceValues.push(value)
        }
    }

    public static getReliability(bufferTime: number, isLongDistance: boolean): number {
        let reliability = 1;
        let roundedBufferTime = Math.ceil(bufferTime/60);
        if(isLongDistance){
            if(roundedBufferTime < 31){
                reliability = this.longDistanceValues[roundedBufferTime];
            }
        } else {
            if(roundedBufferTime < 16){
                reliability = this.normalDistanceValues[roundedBufferTime];
            }
        }
        return reliability;
    }
}