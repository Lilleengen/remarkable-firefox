import EPub from '../epub/epub';
import readabilityWrapper from './readability';

export default async () => {
    const contents = await readabilityWrapper({styles: false});
    if (!contents) {
        return null;
    }
    if (!contents.language) {
        contents.language = 'nb';
    }

    const book = new EPub(Object.assign(contents, {markNav: true}));
    (await book.loadResources({allowErrors: true,}));
    const blob = await book.toBlob();

    browser.runtime.sendMessage({
        name: contents.title,
        blob: blob,
        type: 'upload'
    });


    return book.name;
};