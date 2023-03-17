# Fast-Fuzz, the First Smart Fuzzing Framework for Typescript

Production shim for the [fast-fuzz](https://www.npmjs.com/package/fast-fuzz) package.

## Getting Started

```bash
npm install fast-fuzz-shim
npm install --save-dev reflect-metadata fast-fuzz
```

The Fast-Fuzz shim installs in the ```dependencies``` because Fast-Fuzz relies on decorators.
The project requires ```reflect-metadata``` in the fuzzed project.
