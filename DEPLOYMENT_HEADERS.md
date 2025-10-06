# Production Deployment Headers

## Required Headers for FFmpeg.wasm (SharedArrayBuffer)

Your app uses `ffmpeg.wasm` for client-side video processing, which requires `SharedArrayBuffer`. This requires these HTTP headers on **all HTML pages**:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These headers are already configured for local development in `vite.config.ts`.

## Setting Headers in Production

### Vercel

Create `vercel.json` in project root:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        }
      ]
    }
  ]
}
```

### Netlify

Create `netlify.toml` in project root:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
```

### Lovable (Built-in)

Lovable hosting automatically includes these headers - no configuration needed.

## Why These Headers Matter

Without these headers:
- `SharedArrayBuffer` will be disabled by the browser
- `ffmpeg.wasm` will fail silently
- Downloads will be 0-2KB empty files
- No error messages in console

With these headers:
- ✅ Client-side video processing works
- ✅ FFmpeg can use multi-threading
- ✅ Videos process 5-10x faster

## Testing

After deployment, verify headers using browser DevTools:
1. Open DevTools → Network tab
2. Reload the page
3. Click on the HTML document
4. Check Response Headers for both `Cross-Origin-*` headers

Or use curl:
```bash
curl -I https://your-domain.com
```

## References

- [MDN: Cross-Origin-Opener-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy)
- [MDN: Cross-Origin-Embedder-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy)
- [FFmpeg.wasm Documentation](https://github.com/ffmpegwasm/ffmpeg.wasm)
