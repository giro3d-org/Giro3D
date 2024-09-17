// original code from https://github.com/jakesgordon/bin-packing
// MIT License

export interface Node {
    x: number;
    y: number;
    w: number;
    h: number;

    offset?: number;

    right?: Node;
    down?: Node;

    used?: boolean;
}

export interface UsedNode extends Node {
    used: true;
    right: Node;
    down: Node;
}

export interface Block {
    w: number;
    h: number;
    fit: Node;
}

function findNode(root: Node, w: number, h: number): Node | null {
    if (root.used === true) {
        const used = root as UsedNode;
        return findNode(used.right, w, h) || findNode(used.down, w, h);
    }
    if (w <= root.w && h <= root.h) {
        return root;
    }
    return null;
}

function splitNode(node: Node, w: number, h: number) {
    node.used = true;
    node.down = {
        x: node.x,
        y: node.y + h,
        w: node.w,
        h: node.h - h,
    };
    node.right = {
        x: node.x + w,
        y: node.y,
        w: node.w - w,
        h,
    };
    return node;
}

// 2D Bin Packing algorithm (fit N random dimension blocks in a w * h rectangle) implementation
function fit(
    blocks: Block[],
    w: number,
    h: number,
    previousRoot: Node | null,
): {
    maxX: number;
    maxY: number;
} {
    const root: Node = previousRoot || {
        x: 0,
        y: 0,
        w,
        h,
    };
    let maxX = 0;
    let maxY = 0;
    for (const block of blocks) {
        const node = findNode(root, block.w, block.h);
        if (node) {
            block.fit = splitNode(node, block.w, block.h);
            maxX = Math.max(maxX, node.x + block.w);
            maxY = Math.max(maxY, node.y + block.h);
        }
    }

    return { maxX, maxY };
}

export default fit;
