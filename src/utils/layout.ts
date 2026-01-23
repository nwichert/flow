import Dagre from '@dagrejs/dagre';
import { type Node, type Edge } from '@xyflow/react';

export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';

const NODE_WIDTH = 256; // w-64 = 16rem = 256px
const NODE_HEIGHT = 120;

export function getLayoutedElements<T extends Record<string, unknown> = Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  direction: LayoutDirection = 'TB'
): { nodes: Node<T>[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  g.setGraph({
    rankdir: direction,
    nodesep: 50,
    ranksep: 80,
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  Dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);

    // Dagre uses center coordinates, React Flow uses top-left
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
      // Update handle positions based on layout direction
      sourcePosition: direction === 'LR' || direction === 'RL' ? 'right' : 'bottom',
      targetPosition: direction === 'LR' || direction === 'RL' ? 'left' : 'top',
    };
  });

  return { nodes: layoutedNodes as Node<T>[], edges };
}
