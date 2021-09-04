export class Converter {
    public static timeToSeconds(time: string): number{
        let timeInSeconds = 0;
        const splittedString: string[] = time.split(':');
        timeInSeconds += Number(splittedString[0]) * 3600;
        timeInSeconds += Number(splittedString[1]) * 60;
        timeInSeconds += Number(splittedString[2]);
        return timeInSeconds;
    }

    public static secondsToTime(timeInSeconds: number): string {
        let time = '';
        time += timeInSeconds/3600 + ':';
        timeInSeconds = timeInSeconds % 3600;
        time += timeInSeconds/60 + ':';
        timeInSeconds = timeInSeconds % 60;
        time += timeInSeconds;
        return time;
    }
}