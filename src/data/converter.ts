export class Converter {
    public static timeToSeconds(time: string): number{
        let timeInSeconds = 0;
        const splittedString: string[] = time.split(':');
        timeInSeconds += Number(splittedString[0]) * 3600;
        timeInSeconds += Number(splittedString[1]) * 60;
        timeInSeconds += Number(splittedString[2]);
        while(timeInSeconds >= 24*3600){
            timeInSeconds = timeInSeconds - 24*3600;
        }
        return timeInSeconds;
    }

    public static secondsToTime(timeInSeconds: number): string {
        let time = '';
        let calculation = 0;
        while(timeInSeconds >= 24*3600){
            timeInSeconds = timeInSeconds - 24*3600;
        }
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
        if(timeInSeconds < 10){
            time += '0' + timeInSeconds;
        } else {
            time += timeInSeconds;
        }
        return time;
    }
}