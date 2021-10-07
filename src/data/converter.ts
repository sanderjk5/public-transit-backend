import { SECONDS_OF_A_DAY } from "../constants";
export class Converter {
    /**
     * Converts a given time to its number of seconds since 00:00:00.
     * @param time 
     * @returns 
     */
    public static timeToSeconds(time: string): number{
        let timeInSeconds = 0;
        const splittedString: string[] = time.split(':');
        //hours
        timeInSeconds += Number(splittedString[0]) * 3600;
        //minutes
        timeInSeconds += Number(splittedString[1]) * 60;
        //seconds
        timeInSeconds += Number(splittedString[2]);
        return timeInSeconds;
    }

    /**
     * Transforms a number of seconds to a valid time (between 00:00:00 and 23:59:59).
     * @param timeInSeconds 
     * @returns 
     */
    public static secondsToTime(timeInSeconds: number): string {
        //Would give a invalid time.
        if(timeInSeconds === Number.MAX_VALUE){
            return timeInSeconds.toString();
        }
        timeInSeconds = Math.floor(timeInSeconds);
        let time = '';
        let calculation = 0;
        // subtracts additional days
        while(timeInSeconds >= SECONDS_OF_A_DAY){
            timeInSeconds = timeInSeconds - SECONDS_OF_A_DAY;
        }
        // calculates hours and minutes
        let divider = 3600;
        for(let i = 0; i < 2; i++){
            calculation = Math.floor(timeInSeconds/divider);
            if(calculation < 10){
                time += '0' + calculation + ':';
            } else {
                time += calculation + ':';
            }
            timeInSeconds = timeInSeconds % divider;
            divider = divider/60;
        }
        // seconds are equal to the remaining part
        if(timeInSeconds < 10){
            time += '0' + timeInSeconds;
        } else {
            time += timeInSeconds;
        }
        return time;
    }

    /**
     * Calculates the day offset of a given number of seconds.
     * @param timeInSeconds 
     * @returns 
     */
    public static getDayOffset(timeInSeconds: number): number {
        if(timeInSeconds === Number.MAX_VALUE) {
            return 0;
        }
        let counter = 0;
        while(timeInSeconds >= SECONDS_OF_A_DAY){
            timeInSeconds = timeInSeconds - SECONDS_OF_A_DAY;
            counter++;
        }
        return counter * SECONDS_OF_A_DAY;
    }

    /**
     * Calculates the number of days of the given time in seconds.
     * @param timeInSeconds 
     * @returns 
     */
    public static getDayDifference(timeInSeconds: number): number {
        if(timeInSeconds === Number.MAX_VALUE) {
            return 0;
        }
        let counter = 0;
        while(timeInSeconds >= SECONDS_OF_A_DAY){
            timeInSeconds = timeInSeconds - SECONDS_OF_A_DAY;
            counter++;
        }
        return counter;
    }
}