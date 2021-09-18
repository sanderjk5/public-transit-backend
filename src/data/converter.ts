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
        while(timeInSeconds >= 24*3600){
            timeInSeconds = timeInSeconds - 24*3600;
        }
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
        let time = '';
        let calculation = 0;
        // subtracts additional days
        while(timeInSeconds >= 24*3600){
            timeInSeconds = timeInSeconds - 24*3600;
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
        let counter = 0;
        while(timeInSeconds >= 24*3600){
            timeInSeconds = timeInSeconds - 24*3600;
            counter++;
        }
        return counter * (24*3600);
    }

    /**
     * Calculates the number of days of the given time in seconds.
     * @param timeInSeconds 
     * @returns 
     */
    public static getDayDifference(timeInSeconds: number): number {
        let counter = 0;
        while(timeInSeconds >= 24*3600){
            timeInSeconds = timeInSeconds - 24*3600;
            counter++;
        }
        return counter;
    }
}