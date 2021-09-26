export class Calculator {

    /**
     * Calculates correct modulo seven result (even for negative numbers).
     * @param value 
     * @returns 
     */
    public static moduloSeven(value: number): number{
        return (value % 7 + 7) % 7;
    }

     /**
     * Calculates the approximated distance between two coordinates.
     * @param lat1 
     * @param lat2 
     * @param lon1 
     * @param lon2 
     * @returns 
     */
      public static calculateDistance(lat1: number, lat2: number, lon1: number, lon2: number): number {
        const R = 111.319;
        const x = (lon2 - lon1) * Math.cos(0.00872664626*(lat2+lat1));
        const y = lat2 - lat1;
        const d = R * Math.sqrt(x*x + y*y);
        return d;
    }
}