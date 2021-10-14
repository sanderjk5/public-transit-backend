import { Cluster } from "./Cluster";
import { Link } from "./Link";
import { Node } from "./Node";

export interface DecisionGraph {
    nodes: Node[],
    links: Link[],
    clusters: Cluster[],
}