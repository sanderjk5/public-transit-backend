export class Calculator {
    public static moduloSeven(value: number): number{
        return (value % 7 + 7) % 7;
    }
}