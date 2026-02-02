import ELK from 'elkjs/lib/elk.bundled.js';
import { type Node, type Edge } from '@xyflow/react';

export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';

const elk = new ELK();

const NODE_WIDTH = 272; // w-72 in presentation = 18rem = 288px, using slightly less
const NODE_HEIGHT = 120;

// Map our direction to ELK direction
const directionMap: Record<LayoutDirection, string> = {
  TB: 'DOWN',
  BT: 'UP',
  LR: 'RIGHT',
  RL: 'LEFT',
};

export async function getLayoutedElements<T extends Record<string, unknown> = Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  direction: LayoutDirection = 'TB'
): Promise<{ nodes: Node<T>[]; edges: Edge[] }> {
  // If no nodes, return empty
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Build ELK graph structure
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': directionMap[direction],
      // Spacing options
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.spacing.edgeNode': '40',
      'elk.spacing.edgeEdge': '20',
      // Edge routing - orthogonal with splines for cleaner look
      'elk.edgeRouting': 'ORTHOGONAL',
      // Crossing minimization
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      // Node placement
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      // Separate connected components
      'elk.separateConnectedComponents': 'true',
      // Port constraints for cleaner edge connections
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    edges: edges.map((edge, index) => ({
      id: edge.id || `e${index}`,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  try {
    const layoutedGraph = await elk.layout(elkGraph);

    // Map ELK positions back to React Flow nodes
    const layoutedNodes = nodes.map((node) => {
      const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);

      if (elkNode && elkNode.x !== undefined && elkNode.y !== undefined) {
        return {
          ...node,
          position: {
            x: elkNode.x,
            y: elkNode.y,
          },
        };
      }
      return node;
    });

    // Don't change edge handles - preserve user's manual connections
    // Just return the edges as-is, only node positions change
    return { nodes: layoutedNodes as Node<T>[], edges };
  } catch (error) {
    console.error('ELK layout failed:', error);
    // Return original nodes/edges if layout fails
    return { nodes, edges };
  }
}

// Synchronous version that returns a promise - for backwards compatibility
export function getLayoutedElementsSync<T extends Record<string, unknown> = Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  direction: LayoutDirection = 'TB'
): Promise<{ nodes: Node<T>[]; edges: Edge[] }> {
  return getLayoutedElements(nodes, edges, direction);
}
