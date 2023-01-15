const getNode = (urls, statuses) => {
    const div = document.createElement('div');
    const ul = document.createElement('ul');
    ul.append(...urls.map(url => {
        const li = document.createElement('li');
        li.innerText = url;
        if (statuses[url] === 'REJECTED') {
            li.style.textDecoration = 'line-through';
        }
        if (statuses[url] === 'GRANTED') {
            li.style.listStyleType = '✔️';
        }
        return li;
    }))
    const buttonRequestPerm = document.createElement('button');
    const buttonIgnore = document.createElement('button');
    buttonRequestPerm.innerText = 'Request access'
    buttonRequestPerm.id = 'request-perm';
    buttonRequestPerm.style.marginRight = '20px'
    buttonIgnore.innerText = 'Ignore';
    buttonIgnore.id = 'ignore';
    [buttonRequestPerm, buttonIgnore].forEach(button => button.disabled = Object.values(statuses).every(status => status !== 'INIT'));
    div.id = 'permission-box';
    div.dataset.urls = JSON.stringify(urls);
    div.append(
        ul,
        document.createElement('br'),
        buttonRequestPerm,
        buttonIgnore,
        document.createElement('br'),
        document.createElement('br')
    );

    return div;
};

const requestPerm = async ({target}) => {
    const urls = JSON.parse(target.parentElement.dataset['urls']);

    const permission = await browser.permissions.request({origins: [...urls]});
    if (permission) {
        await browser.storage.local.set(urls.reduce((acc, url) => ({...acc, [url]: 'GRANTED'}), {}));
    } else {
        await browser.storage.local.set(urls.reduce((acc, url) => ({...acc, [url]: 'REJECTED'}), {}));
    }
};

const ignore = async ({target}) => {
    const urls = JSON.parse(target.parentElement.dataset['urls']);
    await browser.storage.local.set(urls.reduce((acc, url) => ({...acc, [url]: 'REJECTED'}), {}));
};

const listen = async (updated) => {
    await addToDocumentIfEmptyAndWeHaveCors();
    const [created, changed] = Object.entries(updated).reduce(([created, changed], [key, {oldValue}]) => [
        (oldValue ? created : [...created, key]),
        (oldValue ? [...changed] : changed)
    ], [[], []]);


    const storage = await browser.storage.local.get();
    const urls = Object.keys(storage);

    if (urls.length > 0) {
        document.querySelector("#request-perm").removeEventListener("click", requestPerm);
        document.querySelector("#ignore").removeEventListener("click", ignore);
        document.querySelector('#permission-box').replaceWith(getNode(urls, storage));
        document.querySelector("#request-perm").addEventListener("click", requestPerm);
        document.querySelector("#ignore").addEventListener("click", ignore);
    }


    if (created.length === 0 && changed.every(url => updated[url].newValue !== 'INIT')) {
        statuses = Object.values(storage);

        if (statuses.every(status => status !== 'INIT')) {
            await browser.action.setPopup({
                popup: null
            });
            window.close();
        }
    }
};

const addToDocumentIfEmptyAndWeHaveCors = async () => {
    if (!document.querySelector('#root')) {
        const storage = await browser.storage.local.get();
        const urls = Object.keys(storage);

        if (urls.length > 0) {
            document.querySelector('body').style.display = 'block';
            const h4 = document.createElement('h4');
            h4.innerText = 'Possible CORS error';
            const p1 = document.createElement('p');
            p1.innerText = 'This site might not allow fetching the images due to CORS. If you want to send the page with images press <Request access> below. If you are fine without images press <Ignore>'
            const p2 = document.createElement('p');
            p2.innerText = 'If you do not want to see this dialog again you can grant permission to all sites on the options-page, although i would not recommend it.'
            const root = document.createElement('div');
            root.id = 'root';
            if (!document.querySelector('#root')) {
                document.querySelector('body').replaceChildren(h4, p1, root, p2);
                document.querySelector('#root').append(getNode(urls, storage));
                document.querySelector("#request-perm").addEventListener("click", requestPerm);
                document.querySelector("#ignore").addEventListener("click", ignore);
            }
        }
    }
};

const init = () => {
    browser.storage.local.onChanged.addListener(listen);
    addToDocumentIfEmptyAndWeHaveCors();
}

document.addEventListener("DOMContentLoaded", init);
document.addEventListener('beforeunload', () => document.querySelector('body').innerHTML = null);
browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'close-popup') {
        return new Promise(async (resolve) => {
            await browser.action.setPopup({
                popup: null
            });
            window.close();
            resolve();
        });
    }
})