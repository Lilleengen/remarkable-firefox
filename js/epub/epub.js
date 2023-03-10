import JsZip from 'jszip/dist/jszip';
import * as Templates from './templates';
import {containerXml} from "./templates";

const mimeTypes = {
    png: 'image/png',
    gif: 'image/gif',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    html: 'text/html',
    xhtml: 'application/xhtml+xml',
    epub: 'application/epub+zip',
};

const mimeType = mimeTypes.epub;

export default class EPub {
    /**
     * Creates an ePub file from (x)html-documents
     * @param {object}  options  Object describing the book
     *     @property {string}  title     The books title.
     *     @property {string}  language  Two letter language description. Default: 'en'.
     *     @property {string}  guid      Guid of the book. Default: new rfc4122 v4 compliant GUID.
     *     @property {array}   creators  Array of { name, role, as, } describing the books creators. One should have .role === 'author'.
     *     @property {array}   chapters  Array of objects describing the (x)html pages of the book:
     *         @property {string}  name      The (relative) path this document will be / is referenced by.
     *         @property {string}  title     The documents title, used e.g. for the table of contents.
     *         @property {string}  content   The (text representation of) the document itself.
     *         @property {string}  mimeType  The chapters mine-type (or file extension which can be mapped to the mime-type). Default: dirived from file extension (name).
     *         @property {object}  options   Passed to JSZip. Necessary if content is not an utf8-string (e.g. base64, binary).
     *     @property {array} resources   Array of objects describing (external) resources to include. Same parameters as chapters, plus:
     *         @property {Blob}    content   Optional resource file content, will be downloaded from `.src` if not set.
     *         @property {string}  src       URL to download `.content` and infer `.name` from. Ignored if both are set.
     *         @property {string}  name      Path the resource is internally referred by.
     *     @property {string}  cover     Name of the cover page. Optional.
     *     @property {string}  nav       Name of the table of contents. Optional. If set but not ePub 3 compliant, it will be replaced a generated toc.
     *     @property {object}  ncx       Object { name, content, mimeType, } describing the ePub's .ncx file. Default: auto-generated.
     *     @property {object}  opf       Object { name, content, mimeType, } describing the ePub's .opf file. Default: auto-generated.
     *     @property {string}  name      The books (file) name. Default: `${ creator with role 'author' } - ${ title }.epub`.
     * Notes:
     *     If an chapters mimeType is 'text/(x)html-body', its content will be wrapped in a matching document.
     *     To load external resources, .loadRecources() must be called before .zip()'ing or .save()'ing.
     * @return {EPub}  EPub instance that can be .zip()'ed .save()'d.
     */
    constructor(options) {
        Object.entries(options).forEach(([key, val]) => {
            this[key] = val;
        });
        this.language = this.language || 'en';
        this.guid = this.guid || ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
        this.creators = [].concat(this.creators, this.creator, this.author, this.authors).filter(x => x);
        let author = this.creators.find(it => it.role === 'author');
        !author && this.creators.push((author = {name: '<unknown>', role: 'author'}));

        this.resources.forEach(entry => {
            if (!entry.mimeType && entry.name) {
                entry.mimeType = (entry.name.match(/\.\w+$/) || [0, ''])[1];
            }
            entry.mimeType = mimeTypes[entry.mimeType] || entry.mimeType;
        });

        this.chapters = this.chapters.map(chapter => ({
            ...chapter,
            content: Templates.xhtmlFrame({
                content: chapter.content,
                title: chapter.title
            })
        }));

        if (this.ncx !== false && typeof this.ncx !== 'object') {
            this.ncx = {
                name: 'content.ncx',
                mimeType: 'application/x-dtbncx+xml',
                content: Templates.contentNcx(this),
            };
        }

        if (this.opf !== false && typeof this.opf !== 'object') {
            this.opf = {
                name: 'content.opf',
                mimeType: 'application/oebps-package+xml',
                content: Templates.contentOpf(this),
            };
        }

        this.name = this.name || (author.name ? author.name + ' - ' : '') + this.title + '.epub';
    }

    /**
     * Loads all resources specified in the constructor, that have a .src or .url set, but empty content.
     * @async
     * @return {Promise}  Promise that resolves to this.
     */
    async loadResources({allowErrors = false, timeout = 0,} = {}) {
        if (!this.resources) {
            return this;
        }
        const resources = Array.from(new Map(
            this.resources.filter(({src, content}) => src && !content) // only unloaded
                .map(it => [it.src, it]) // unique .src
        ).values());

        let loaded;
        const loading = Promise.all(resources.map(async resource => {
            let error;
            let content
            let mimeHeader;
            try {
                const response = await fetch(resource.src);
                if (response && response.ok) {
                    content = await response.arrayBuffer();
                    mimeHeader = response.headers.get('Content-Type');
                }
            } catch (e) {
                error = e;
            }
            if (!content) {
                try {
                    const response = await browser.runtime.sendMessage({
                        url: resource.src,
                        type: 'cors-help'
                    });
                    content = response.content;
                    mimeHeader = response.mimeHeader;
                } catch (e) {
                    error = e;
                }

                if (!content) {
                    if (!allowErrors) {
                        throw error;
                    }
                }
            }

            resource.content = btoa(String.fromCharCode(...new Uint8Array(content)));
            resource.mimeType = mimeHeader || resource.mimeType;
            resource.name = resource.name || resource.src.match(/\/\/.*?\/(.*)$/)[1]; //.replace(/^oebps[\/\\]/i, '');
            resource.options = {base64: true};
        })).then(() => (loaded = true));

        (await Promise.race([loading, new Promise(wake => setTimeout(wake, timeout || 120e3)),]));
        if (!loaded) {
            const message = `Loading of some resources timed out after ${(timeout || 120e3) / 1e3} seconds.`;
            if (allowErrors) {
                console.error(message);
            } else {
                throw new Error(message);
            }
        }

        typeof this.opf === 'object' && (this.opf.content = Templates.contentOpf(this));

        return this;
    }

    /**
     * Used JSZip to pack all specified and processed files.
     * @return {JSZip} The resulting JSZip instance.
     */
    zip() {
        const zip = new JsZip();
        zip.file('mimetype', 'application/epub+zip');
        zip.folder('META-INF').file('container.xml', Templates.containerXml(this));

        const oebps = zip.folder('OEBPS');
        [this.opf, this.ncx, ...(this.chapters || []), ...(this.resources.filter(_ => _.content) || [])]
            .forEach(({name, content, options}) => {
                oebps.file(name, content, options);
            });
        return zip;
    }

    /**
     * Saves the book into a Blob object.
     * @return {Promise<Blob>}  A promise to the book as a Blob.
     */
    toBlob() {
        const zip = this.zip();
        return zip.generateAsync({mimeType, type: 'blob'});
    }

}