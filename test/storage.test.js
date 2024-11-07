const assert = require('assert');
const nock = require('nock');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const _rendersContainer = 'renders-container';
const _templatesContainer = 'templates-container';

const pathFileTxt = path.join(__dirname, 'data', 'file.txt');

const workData = path.join(__dirname, '_workdata');

const urlBlobStorage = 'https://whateverAccountName.blob.core.windows.net';

describe('Storage', () => {
    let storage = null;

    before(function (done) {

        if (!fs.existsSync(workData)) {
            fs.mkdirSync(workData, { recursive: true });
        }

        config.setConfig({
            storageCredentials: {
                accountName: 'whateverAccountName',
                accountKey: 'whateverAccountKey'
            },
            rendersContainer: _rendersContainer,
            templatesContainer: _templatesContainer,
            templatePath: workData,
            renderPath: workData
        });

        nock(urlBlobStorage)
            .intercept(`/${_templatesContainer}`, "HEAD")
            .reply(200);

        nock(urlBlobStorage)
            .intercept(`/${_rendersContainer}`, "HEAD")
            .reply(200);

        storage = require('../storage');
        setTimeout(done, 500);
    });

    beforeEach((done) => {
        cleanWorkDataDirectory(done);
    });

    afterEach((done) => {
        cleanWorkDataDirectory(done);
    });

    after((done) => {
        fs.rmdir(workData, { recursive: true }, (err) => {
            if (err) throw err;
            done();
        });
    });

    describe('writeTemplate', (done) => {

        it('should write template on blob storage', () => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_templatesContainer}/templateId`))
                .reply(201);

            storage.writeTemplate({}, {}, 'templateId', pathFileTxt, (err, templateName) => {
                try {
                    assert.strictEqual(err, null);
                    assert.strictEqual(templateName, 'templateId');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        it('should return an error if file cannot be written on blob storage', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_templatesContainer}/templateId`))
                .reply(403);

            storage.writeTemplate({}, {}, 'templateId', pathFileTxt, (err) => {
                try {
                    assert.strictEqual(err?.statusCode, 403);
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    })

    describe('readTemplate', () => {

        it('should read the template from blob storage', (done) => {
            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_templatesContainer}/template.odt`))
                .reply(200, () => {
                    return fs.readFileSync(pathFileTxt, 'binary');
                }, {
                    'Content-Length': (req, res, body) => body.length,
                    Etag: '123456'
                });

            storage.readTemplate({}, {}, 'template.odt', (err, templatePath) => {
                try {
                    assert.strictEqual(err, null);
                    assert.strictEqual(path.basename(templatePath), 'template.odt');
                    assert.strictEqual(fs.existsSync(templatePath), true);
                    assert.strictEqual(fs.readFileSync(templatePath, 'binary'), 'Some content.');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        it('should return an error if file cannot be read from blob', (done) => {
            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_templatesContainer}/template.odt`))
                .reply(404);

            storage.readTemplate({}, {}, 'template.odt', (err) => {
                try {
                    assert.strictEqual(err?.statusCode, 404);
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        it('should not call the blob storage if file already exists in local folder', (done) => {
            const expectedPath = path.join(workData, 'file.txt');
            fs.copyFileSync(pathFileTxt, expectedPath)

            let downloadToFileCalled = false;
            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_templatesContainer}/template.odt`))
                .reply(200, () => {
                    downloadToFileCalled = true;
                    return "Unexpected";
                }, {
                    'Content-Length': (req, res, body) => body.length,
                    Etag: '123456'
                });

            storage.readTemplate({}, {}, 'file.txt', (err, templatePath) => {
                try {
                    assert.strictEqual(err, null);
                    assert.strictEqual(templatePath.endsWith(expectedPath), true);
                    assert.strictEqual(downloadToFileCalled, false, 'Expected downloadToFile to not be called');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    })

    describe('deletetemplate', () => {

        let templatePath = path.join(workData, 'template.docx');

        beforeEach(() => {
            fs.writeFileSync(templatePath, 'File content');
        });

        it('should delete the template from blob storage', (done) => {
            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_templatesContainer}/template.docx`))
                .reply(202);

            const res = {
                send(result) {
                    try {
                        assert.deepStrictEqual(result, {
                            success: true,
                            message: 'Template deleted'
                        });
                    } catch (err) {
                        done(err);
                    }
                }
            };

            storage.deleteTemplate({}, res, 'template.docx', (err, templatePath) => {
                try {
                    assert.strictEqual(err, null);
                    assert.strictEqual(templatePath.endsWith('template.docx'), true);
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
        it("should return an error if file cannot be deleted from blob storage", (done) => {
            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_templatesContainer}`))
                .reply(404);

            const res = {};

            storage.deleteTemplate({}, res, path.join(workData, 'template.docx'), (err) => {
                try {
                    assert.strictEqual(err?.statusCode, 404);
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    describe('afterRender', () => {

        const _renderName = "whatever.pdf";
        const _expectedFilename = path.basename(pathFileTxt);

        it('should save the generated doccument into the renders container', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(201);

            storage.afterRender({}, {}, null, pathFileTxt, _renderName, {}, (err) => {
                try {
                    assert.strictEqual(err, undefined);
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        it('should save a generated doccument into the renders containers even if the filename is not provided', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_rendersContainer}/${_expectedFilename}`))
                .reply(201);

            storage.afterRender({}, {}, null, pathFileTxt, '', {}, (err) => {
                try {
                    assert.strictEqual(err, undefined);
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        it('should return an error if the rendering fails', (done) => {
            storage.afterRender({}, {}, new Error('Something went wrong'), pathFileTxt, _renderName, {}, (err) => {
                try {
                    assert.strictEqual(err?.toString(), 'Error: Something went wrong');
                    done();
                } catch (assertErr) {
                    done(assertErr);
                }
            });
        });

        it('should return an error if the blob storage is not available', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(404);

            storage.afterRender({}, {}, null, pathFileTxt, _renderName, {}, (err) => {
                try {
                    assert.strictEqual(err?.statusCode, 404);
                    done();
                } catch (assertErr) {
                    done(assertErr);
                }
            });
        });
    });

    describe('readRender', () => {

        it('should download the generated document from the cache folder and delete the file from blob storage', (done) => {

            const _renderName = 'whatever.pdf'

            fs.copyFileSync(pathFileTxt, path.join(workData, _renderName))

            let downloadToFileCalled = false;
            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(200, () => {
                    downloadToFileCalled = true;
                    return 'Unexpected';
                }, {
                    'Content-Length': (req, res, body) => body.length,
                    Etag: '123456'
                });

            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(202);

            storage.readRender({}, {}, _renderName, (err, renderPath) => {
                try {
                    assert.strictEqual(null, err);
                    assert.strictEqual(renderPath.includes(_renderName), true);
                    assert.strictEqual(downloadToFileCalled, false, 'Expected downloadToFile to not be called');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        it('should download the generated document and delete it from blob storage', (done) => {

            const _renderName = 'whatever.pdf';

            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(200, () => {
                    return fs.readFileSync(pathFileTxt, 'binary');
                }, {
                    'Content-Length': (req, res, body) => body.length,
                    Etag: '123456'
                });

            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(200, () => {
                    return [];
                }, {
                    'Content-Length': (req, res, body) => 0,
                    Etag: '123456'
                });

            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(202);

            storage.readRender({}, {}, _renderName, (err, renderPath) => {
                try {
                    assert.strictEqual(null, err);
                    assert.strictEqual(renderPath.includes(_renderName), true);
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        it('should return an error if the file does not exist', (done) => {

            const _renderName = 'some.pdf';

            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(404);

            storage.readRender({}, {}, _renderName, (err, renderPath) => {
                try {
                    assert.strictEqual(err?.statusCode, 404);
                    done();
                } catch (assertErr) {
                    done(assertErr);
                }
            });
        });
    })
})


function cleanWorkDataDirectory(done) {
    fs.readdir(workData, (err, files) => {
        if (err) throw err;

        for (const file of files) {
            fs.unlink(path.join(workData, file), (err) => {
                if (err) throw err;
            });
        }
        done();
    });
}