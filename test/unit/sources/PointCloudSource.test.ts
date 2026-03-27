/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';

import type { PointCloudNode } from '@giro3d/giro3d/sources/PointCloudSource';

import { traverseNode } from '@giro3d/giro3d/sources/PointCloudSource';

describe('traverseNode', () => {
    it('should traverse entire hierarchy, unless the callback returns false', () => {
        function makeNode(id: string, children?: (PointCloudNode | undefined)[]): PointCloudNode {
            // @ts-expect-error incomplete definition
            return {
                id,
                children,
            };
        }

        const root: PointCloudNode = makeNode('root', [
            makeNode('0-0', [
                makeNode('0-0-0'),
                makeNode('0-0-1'),
                undefined,
                undefined,
                makeNode('0-0-4', [makeNode('0-0-4-0')]),
                undefined,
                undefined,
            ]),
            makeNode('0-1', [
                makeNode('0-1-0'),
                undefined,
                makeNode('0-1-2'),
                undefined,
                undefined,
            ]),
        ]);

        const visited: string[] = [];
        traverseNode(root, n => {
            visited.push(n.id);
            return true;
        });

        expect(visited).toEqual([
            'root',
            '0-0',
            '0-0-0',
            '0-0-1',
            '0-0-4',
            '0-0-4-0',
            '0-1',
            '0-1-0',
            '0-1-2',
        ]);

        visited.length = 0;

        traverseNode(root, n => {
            visited.push(n.id);

            if (n.id === '0-1') {
                return false;
            }

            return true;
        });

        expect(visited).toEqual(['root', '0-0', '0-0-0', '0-0-1', '0-0-4', '0-0-4-0', '0-1']);
    });
});
