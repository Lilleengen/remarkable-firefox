import {Readability} from "@mozilla/readability";
import aboutReader from './aboutReader';

export default async () => {
    const srcDoc = document.cloneNode(true);
    const url = srcDoc.URL;

    const parsed = new Readability(srcDoc, {}).parse();
    if (!parsed) {
        const error = new Error('Unable to parse this article.');
        error.title = 'Page could not be parsed';
        throw error;
    }

    // build the reader mode DOM content
    const virtDocument = new DOMParser().parseFromString(`<!DOCTYPE html>
<html><head><meta http-equiv="Content-Security-Policy" content="default-src chrome:; img-src data: *; media-src *"></head><body>
<div class="container">
	<div class="header reader-header">
		<a class="domain reader-domain" href="${url}">${(new URL(url).host || '').replace(/^www\./, '')}</a>
		<span class="reader-date"> (${new Date().toISOString().replace(/T.*/, '')})</span>
		<h1 class="reader-title">${parsed.title}</h1>
		<div class="credits reader-credits">${parsed.byline}</div>
	</div>
	<hr><div class="content">${parsed.content}</div>
</div></body></html>`, 'text/html');

    const content = await aboutReader({virtDocument});
    return content && {
        ...content,
        language: virtDocument.documentElement.lang || virtDocument.body.lang || content.language,
    };
}