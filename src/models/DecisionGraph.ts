import { Cluster } from "./Cluster";
import { Link } from "./Link";
import { Node } from "./Node";

export interface DecisionGraph {
    sourceStop?: string,
    targetStop?: string,
    departureTime?: string,
    departureDate?: string,
    meatTime?: string,
    meatDate?: string,
    eatTime?: string,
    esatTime?: string,
    nodes: Node[],
    links: Link[],
    clusters: Cluster[],
}