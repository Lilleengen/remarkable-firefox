const getPathPrefix = async string => {
    const hash = crypto.subtle
        ? new Uint8Array((await crypto.subtle.digest('SHA-1', new TextEncoder('utf-8').encode(string))))
        : crypto.getRandomValues(new Uint8Array(16)); // but random also works
    return Array.from(hash).map((b => b.toString(16).padStart(2, '0'))).join('');
}

const toXML = element => (new XMLSerializer).serializeToString(element);

export default async ({virtDocument}) => {

    const doc = virtDocument.querySelector('.container').cloneNode(true);

    const resources = (await Promise.all(Array.from(doc.querySelectorAll('img'), async img => {
        const {src} = img;
        const pathPrefix = src && await getPathPrefix(src);
        const name = pathPrefix && pathPrefix + '/' + new URL(src).pathname.split('/').pop();
        return {src, name};
    }))).filter(({src, name}) => src || name);
    const title = doc.querySelector('.reader-title').textContent;
    const url = doc.querySelector('.reader-domain').href;
    const author = prompt('Please enter/confirm the authors name', (
        doc.querySelector('.vcard .author.fn') || doc.querySelector('.vcard .author') || doc.querySelector('.author')
        || doc.querySelector('.reader-credits') || {textContent: '<unknown>',}
    ).textContent.replace(/\s+/g, ' ') || '<unknown>');

    if (author == null) {
        return null;
    }

    doc.querySelectorAll('style, link, menu').forEach(element => element.remove());
    doc.querySelectorAll('*').forEach(element => {
        for (let i = element.attributes.length; i-- > 0;) {
            const attr = element.attributes[i];
            if (['class', 'src', 'href', 'title', 'alt',].includes(attr.name)) {
                continue;
            }
            element.removeAttributeNode(attr);
        }
    });

    return ({
        chapters: [{
            name: 'content.xhtml',
            title,
            content: toXML(doc),
            mimeType: 'application/xhtml+xml',
            linear: true,
        },],
        title,
        description: `Offline reader version of ${url}`,
        language: (new URL(url).hostname.match(/[.](.{2})$/) || [null, null,])[1],
        creator: [{name: author, role: 'author'}],
        resources,
        cover: false,
        nav: true,
    });
}