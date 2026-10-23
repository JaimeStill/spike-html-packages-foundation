// The browser tier's static server: the repository root, or another directory, over plain http on
// the loopback address, every file sent as it is on disk. The pages load the package's built dist/,
// so nothing needs transforming.
// Adapted from spike-html-packages (7fb31a8): test/browser/support/server.js, without lit's /deps/.

import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

/** The repository root, which the server serves by default. */
export const root = join(import.meta.dirname, "../../..");

/** The content type of each extension served; any other file is a 404. */
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

/** Serves the tree on a free loopback port, resolving to its origin and a stop(). */
export async function serve(tree = root) {
  const server = createServer(async (request, response) => {
    // normalize() of an absolute path never climbs above its root, so no request leaves the tree.
    const pathname = new URL(request.url, "http://localhost").pathname;
    const path = join(tree, normalize(decodeURIComponent(pathname)));
    const type = types[extname(path)];
    const body = type && (await readFile(path).catch(() => undefined));
    if (body === undefined) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": type, "cache-control": "no-store" }).end(body);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    stop: () => new Promise((resolve) => server.close(resolve)),
  };
}
