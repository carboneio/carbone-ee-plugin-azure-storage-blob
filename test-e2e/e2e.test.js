const assert = require('assert');
const path = require('path');
const { execFileSync } = require('child_process');
const { BlobServiceClient } = require('@azure/storage-blob');

const CARBONE_IMAGE = process.env.CARBONE_IMAGE ?? 'carbone/carbone-ee:slim-5.15.4';
const AZURITE_IMAGE = 'mcr.microsoft.com/azure-storage/azurite:3.35.0';
// Well-known Azurite development key, not a secret.
const AZURITE_KEY = 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';
const TEMPLATES = 'templates';
const RENDERS = 'renders';

const suffix = `${process.pid}`;
const network = `azure-plugin-e2e-${suffix}`;
const azurite = `azure-plugin-e2e-azurite-${suffix}`;
const carbone = `azure-plugin-e2e-carbone-${suffix}`;
const distDir = path.join(__dirname, '..', 'dist');

const connectionString = (host) => `DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=${AZURITE_KEY};BlobEndpoint=http://${host}/devstoreaccount1;`;

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function removeContainer(name) {
  try { docker('rm', '-f', name); } catch (e) {}
}

function hostPort(container, port) {
  return docker('port', container, String(port)).split('\n')[0].split(':').pop();
}

async function waitFor(check, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch (e) {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

describe('End-to-end with Carbone Community and Azurite', function () {
  let api;
  let blobService;
  let templateId;

  async function startCarbone() {
    removeContainer(carbone);
    docker('run', '-d', '--name', carbone, '--network', network, '-p', '127.0.0.1::4000',
      '-v', `${distDir}:/app/plugin`,
      '-e', 'CARBONE_USE_S3_PLUGIN=false',
      '-e', 'CARBONE_TEMPLATE_MANAGEMENT=true',
      '-e', `CONTAINER_TEMPLATES=${TEMPLATES}`,
      '-e', `CONTAINER_RENDERS=${RENDERS}`,
      '-e', `AZURE_STORAGE_CONNECTION_STRING=${connectionString(`${azurite}:10000`)}`,
      CARBONE_IMAGE);
    api = `http://127.0.0.1:${hostPort(carbone, 4000)}`;
    await waitFor(async () => (await fetch(`${api}/status`)).ok, 60000, 'Carbone to be ready');
  }

  async function listBlobs(container) {
    const names = [];
    for await (const blob of blobService.getContainerClient(container).listBlobsFlat()) {
      // Carbone also stores its own template metadata (.metadata.db*) in the templates container.
      if (!blob.name.startsWith('.')) names.push(blob.name);
    }
    return names;
  }

  function render(name, query = '') {
    return fetch(`${api}/render/${templateId}${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { name }, convertTo: 'html' })
    });
  }

  before(async function () {
    this.timeout(300000);
    docker('network', 'create', network);
    docker('run', '-d', '--name', azurite, '--network', network, '-p', '127.0.0.1::10000',
      AZURITE_IMAGE, 'azurite-blob', '--blobHost', '0.0.0.0', '--skipApiVersionCheck', '--loose');

    blobService = BlobServiceClient.fromConnectionString(connectionString(`127.0.0.1:${hostPort(azurite, 10000)}`));
    await waitFor(async () => {
      await blobService.getContainerClient(TEMPLATES).createIfNotExists();
      await blobService.getContainerClient(RENDERS).createIfNotExists();
      return true;
    }, 30000, 'Azurite to be ready');

    await startCarbone();
  });

  after(function () {
    this.timeout(60000);
    removeContainer(carbone);
    removeContainer(azurite);
    try { docker('network', 'rm', network); } catch (e) {}
  });

  it('loads the bundled plugin with its git sha and reaches both containers', async () => {
    await waitFor(() => /Access on renders : 🟢/.test(docker('logs', carbone)), 10000, 'storage access check');
    const logs = docker('logs', carbone);
    assert.match(logs, /AZURE BLOB STORAGE PLUGIN/);
    assert.match(logs, /Version \(git sha\)\s*: [0-9a-f]{8}/);
    assert.match(logs, /Access on templates : 🟢/);
  });

  it('stores an uploaded template in the templates container', async () => {
    const form = new FormData();
    form.append('template', new Blob(['<html><body><p>Hello {d.name}</p></body></html>'], { type: 'text/html' }), 'template.html');
    const body = await (await fetch(`${api}/template`, { method: 'POST', body: form })).json();

    assert.strictEqual(body.success, true);
    templateId = body.data.templateId;
    assert.deepStrictEqual(await listBlobs(TEMPLATES), [templateId]);
  });

  it('stores the render, serves it, then deletes it from the renders container', async () => {
    const body = await (await render('Azure')).json();
    assert.strictEqual(body.success, true);
    const { renderId } = body.data;
    assert.deepStrictEqual(await listBlobs(RENDERS), [renderId]);

    const res = await fetch(`${api}/render/${renderId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(await res.text(), '<html><body><p>Hello Azure</p></body></html>');
    assert.deepStrictEqual(await listBlobs(RENDERS), []);
  });

  it('does not store directly downloaded renders (?download=true)', async () => {
    const res = await render('Direct', '?download=true');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(await res.text(), '<html><body><p>Hello Direct</p></body></html>');
    assert.deepStrictEqual(await listBlobs(RENDERS), []);
  });

  it('fetches the template from Azure when the local cache is empty', async function () {
    this.timeout(90000);
    await startCarbone();

    const res = await render('Fresh', '?download=true');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(await res.text(), '<html><body><p>Hello Fresh</p></body></html>');
  });

  it('deletes the template from the templates container', async () => {
    const body = await (await fetch(`${api}/template/${templateId}`, { method: 'DELETE' })).json();
    assert.strictEqual(body.success, true);
    assert.deepStrictEqual(await listBlobs(TEMPLATES), []);
  });
});
