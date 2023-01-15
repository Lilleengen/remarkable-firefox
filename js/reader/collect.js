import EPub from '../epub/epub';
import readabilityWrapper from './readability';

export default async () => {
    const contents = await readabilityWrapper({styles: false});
    if (!contents) {
        return null;
    }
    if (!contents.language) {
        contents.language = 'en';
    }

    const book = new EPub(Object.assign(contents));
    await book.loadResources({allowErrors: true,});

    browser.runtime.sendMessage({type: 'clean-up'});

    const blob = await book.toBlob();

    return await browser.runtime.sendMessage({
        name: contents.title,
        blob: blob,
        type: 'upload'
    });
};