// [Why use babel with rollup?](https://rollupjs.org/tools/#babel)

import babel from '@rollup/plugin-babel' // Transpiles modern JavaScript code
import { nodeResolve } from '@rollup/plugin-node-resolve' // Allows Rollup to resolve modules from node_modules
import commonjs from '@rollup/plugin-commonjs' // Converts CommonJS modules to ES6, allowing them to be included in the bundle.
import { terser } from 'rollup-plugin-terser' // Minifies the final output 
import clear from 'rollup-plugin-clear' // Cleans the `dist` folder before each build
import typescript from 'rollup-plugin-typescript2' // Compiles TypeScript files
import copy from 'rollup-plugin-copy' // Copy essential files
import path from 'path'; // Path declaration

export default [{
  // CJS & ESM Bundle Configuration
  input: 'src/index.ts', // Entry point for CommonJS and ESM builds
  output: [
    {
      dir: 'dist/cjs', // Output directory for CommonJS format
      format: 'cjs', // CommonJS format (for Node.js)
      preserveModules: true, // Keep the original module structure
      exports: 'auto', // Auto-detect export style
      sourcemap: true // Enable sourcemap
    },
    {
      dir: 'dist/esm', // Output directory for ESM format
      format: 'es', // ES Module format
      preserveModules: true, // Keep the original module structure
      exports: 'auto', // Auto-detect export style
      sourcemap: true // Enable sourcemap
    }
  ],
  plugins: [
    clear({ targets: ['dist/cjs', 'dist/esm'] }),
    nodeResolve(),
    commonjs(),
    typescript({
      tsconfig: path.resolve(__dirname, './tsconfig.json'),
    }),
    babel({
      exclude: 'node_modules/**',
      babelHelpers: 'runtime',
      plugins: ['@babel/plugin-transform-runtime']
    }),
    terser(),
    copy({
      targets: [
        { src: 'types/index.d.ts', dest: 'dist/cjs' }, // Copy TypeScript types to CJS
        { src: 'types/index.d.ts', dest: 'dist/esm' } // Copy TypeScript types to ESM
      ]
    })
  ]
}
];