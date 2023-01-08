import {nodeResolve} from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
    input: 'js/index.js',
    output: {
        file: 'build/bundle.js',
        format: 'es'
    },
    plugins: [nodeResolve(), commonjs()]
};