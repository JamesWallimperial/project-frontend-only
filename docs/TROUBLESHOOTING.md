# Troubleshooting

## Web UI build errors

Building the web interface may fail with messages such as:

```
Illegal instruction
ERR_PACKAGE_PATH_NOT_EXPORTED
```

Install older versions of the build tools to resolve the issue:

```bash
npm install vite@^4 rollup@^3 --save-dev
```

This downgrade uses pure-JS bundles compatible with older Pi CPUs.
