/**
 * This file fills the global object with Node-based alternatives when
 * they are missing in a non-browser environement.
 */
import { TextDecoder as NodeTextDecoder } from 'node:util';

global.TextDecoder = NodeTextDecoder;
