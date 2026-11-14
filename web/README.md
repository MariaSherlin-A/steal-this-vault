# web

The site: React 18, Vite, plain CSS. No backend and no secrets.

```sh
npm run dev               # http://localhost:5173
npm run build -w web      # into web/dist
npm run test -w web
```

`http://localhost:5173/?mockwallet` installs the official QoreX mock (development builds
only), to exercise the wallet flow without the extension.

| Path | What it is |
|---|---|
| `src/lib/useChain.tsx` | live chain state for the page, polled; never cached or invented |
| `src/lib/clients.ts` | light: addresses and the EVM client |
| `src/lib/lab.ts` | heavy: the SDK and the attack runner, loaded on demand |
| `src/lib/explain.ts` | turns a runner result into a plain sentence |
| `src/lib/qorex.ts`, `msgSend.ts` | QoreX connection and the visitor's own hybrid payment |
| `src/components/` | header and hero, the two vaults, the attack lab, the record, how it works, the payment, technical details |

The native REST API has no CORS headers, so the browser calls `/lcd/*` on the site's own
origin. `vite.config.ts` forwards that in development and `vercel.json` in production.

Every number on the page is read from the chain. Before a value is known it is a grey
placeholder; if the chain is unreachable, the last real values stay and the header says so.

Icons: "Sharp Line - Free" by [Streamline](https://www.streamlinehq.com/), CC BY 4.0.
