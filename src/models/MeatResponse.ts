import { DecisionGraph } from "./DecisionGraph";

export interface MeatResponse {
    sourceStop: string,
    targetStop: string,
    departureTime?: string,
    departureDate?: string,
    meatTime?: string,
    meatDate?: string,
    eatTime: string,
    esatTime: string,
    expandedDecisionGraph: DecisionGraph;
    compactDecisionGraph: DecisionGraph;
}