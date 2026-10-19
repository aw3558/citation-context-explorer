// Offline preview only. This server NEVER reads a key or makes an outbound request.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHandler } from '../netlify/functions/analyze.mjs';

const assets = new Map([['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']], ['/app.mjs', ['app.mjs', 'text/javascript']],
  ['/citations.mjs', ['citations.mjs', 'text/javascript']]]);
const handler = createHandler({getApiKey: () => 'offline-preview-sentinel-not-a-credential', fetchImpl: async (_, options) => {
  const items = JSON.parse(JSON.parse(options.body).messages[1].content).document_data;
  const results = items.map(item => ({id: item.id,
    role: item.citation === '347 U.S. 483' ? 'supporting authority' : 'background',
    explanation: 'OFFLINE MOCK RESPONSE: This is a fixed demonstration of the interface, not live AI analysis. Review the supplied passage to evaluate the citation’s role.'}));
  return new Response(JSON.stringify({choices: [{finish_reason: 'stop', message: {content: JSON.stringify({results})}}]}));
}});
const port = Number(process.env.PORT || 8888);
const server = createServer(async (incoming, outgoing) => {
  try {
    const path = new URL(incoming.url, `http://127.0.0.1:${port}`).pathname;
    if (path === '/.netlify/functions/analyze') {
      const chunks = []; let bytes = 0;
      for await (const chunk of incoming) {
        bytes += chunk.length;
        if (bytes > 260000) { outgoing.writeHead(413).end(); return; }
        chunks.push(chunk);
      }
      const request = new Request(`http://127.0.0.1:${port}${path}`, {method: incoming.method,
        headers: incoming.headers, ...(!['GET', 'HEAD'].includes(incoming.method) ? {body: Buffer.concat(chunks)} : {})});
      const result = await handler(request);
      outgoing.writeHead(result.status, Object.fromEntries(result.headers)); outgoing.end(await result.text());
      return;
    }
    const asset = assets.get(path);
    if (!asset) { outgoing.writeHead(404).end('Not found'); return; }
    if (!['GET', 'HEAD'].includes(incoming.method)) { outgoing.writeHead(405).end(); return; }
    let content = await readFile(new URL(`../public/${asset[0]}`, import.meta.url), 'utf8');
    if (asset[0] === 'index.html') content = content.replace('<header>', '<header><p class="sample-note"><strong>OFFLINE MOCK PREVIEW</strong> · No live AI requests. No key is read.</p>');
    outgoing.writeHead(200, {'Content-Type': `${asset[1]}; charset=utf-8`, 'Cache-Control': 'no-store'});
    outgoing.end(incoming.method === 'HEAD' ? '' : content);
  } catch { outgoing.writeHead(500).end('Preview failed.'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Offline mock preview: http://127.0.0.1:${port}`));
