const b64EncodeUnicode = (str) =>
    btoa(encodeURIComponent(str)
        .replace(/%([0-9A-F]{2})/g,
            (match, p1) => String.fromCharCode(`0x${p1}`)
        ));

browser.action.onClicked.addListener(async (tab) => {
    browser.action.setPopup({
        popup: browser.runtime.getURL('popup.html')
    });
    browser.action.openPopup();
    browser.storage.local.clear();

    const hadRemarkablePermissionPromise = browser.permissions.contains({origins: ['https://webapp-prod.cloud.remarkable.engineering/*']});
    const hasRemarkablePermission = await browser.permissions.request({origins: ['https://webapp-prod.cloud.remarkable.engineering/*']});

    const {deviceToken} = await browser.storage.sync.get();

    if (!deviceToken) {
        browser.tabs.create({
            url: browser.runtime.getURL('options.html')
        });
    }


    const hadRemarkablePermission = await hadRemarkablePermissionPromise;

    if (!hasRemarkablePermission || !deviceToken || !hadRemarkablePermission) {
        await browser.runtime.sendMessage({type: 'close-popup'}).catch(async () => {
            await browser.action.setPopup({
                popup: null
            });
        });
    }

    if (hasRemarkablePermission && deviceToken && hadRemarkablePermission) {
        browser.action.setIcon({
            path: {
                16: 'icons/16-loading.png',
                48: 'icons/48-loading.png',
                128: 'icons/128-loading.png'
            }
        });
        browser.action.setTitle({
            title: 'Sending site to reMarkable'
        });

        await browser.scripting.executeScript({
            func: async () => await import(browser.runtime.getURL('build/bundle.js')).then((module) => {
                module.default()
            }),
            target: {tabId: tab.id},
        });
    }
});

browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'cors-help') {
        return new Promise(async (resolve, reject) => {
            const hasPermission = await browser.permissions.contains({origins: [message.url]});
            if (!hasPermission) {
                let status = 'INIT';
                await browser.storage.local.set({
                    [message.url]: status
                });

                while (status === 'INIT') {
                    await new Promise(resolve =>
                        setTimeout(resolve, 100)
                    ).then(async () => {
                        const statusObj = await browser.storage.local.get(message.url);
                        status = statusObj[message.url];
                    });
                }

                if (status !== 'GRANTED') {
                    reject('Granting cors permission failed');
                    return 'Granting cors permission failed';
                }
            }
            fetch(message.url).then(async (response) => {
                const content = await response.arrayBuffer();
                const mimeHeader = response.headers.get('Content-Type');

                resolve({
                    content,
                    mimeHeader
                });
            }).catch(reject);
        });
    }
    if (message.type === 'upload') {
        return new Promise(async (resolve) => {
            const upload = async (userToken, name, body) => await fetch("https://internal.cloud.remarkable.com/doc/v2/files", {
                "headers": {
                    "accept": "*/*",
                    "accept-language": "en-CA,en;q=0.9,no;q=0.8,sv;q=0.7,da;q=0.6",
                    "authorization": `Bearer ${userToken}`,
                    "content-type": "application/epub+zip",
                    "rm-meta": name,
                    "rm-source": "RoR-Browser"
                },
                "body": body,
                "method": "POST"
            }).then(response => response.status).catch(error => error.status);

            const getUserToken = async (deviceToken) => {
                const userTokenReq = await fetch("https://webapp-prod.cloud.remarkable.engineering/token/json/2/user/new", {
                    "headers": {
                        "accept": "*/*",
                        "authorization": `Bearer ${deviceToken}`,
                    },
                    "method": "POST",
                });

                userToken = await userTokenReq.text();

                await browser.storage.sync.set({
                    deviceToken,
                    userToken
                });

                return userToken;
            }

            let {userToken, deviceToken} = await browser.storage.sync.get();

            if (!userToken) {
              userToken = await getUserToken(deviceToken);
            }

            const name = b64EncodeUnicode(JSON.stringify({
              file_name: message.name
            }));

            let status = await upload(userToken, name, message.blob);

            if (status === 401) {
              userToken = await getUserToken(deviceToken);
              status = await upload(userToken, name, message.blob);
            }

            browser.action.setIcon({
                path: {
                    16: 'icons/16-saved.png',
                    48: 'icons/48-saved.png',
                    128: 'icons/128-saved.png'
                }
            });

            browser.action.setTitle({
                title: 'Site sent to reMarkable'
            });

            setTimeout(() => {
                browser.action.setIcon({});
                browser.action.setTitle({title: null});
            }, 10000);

            resolve(status);
        });
    }
    if (message.type === 'clean-up') {
        return new Promise(async (resolve) => {
            await Promise.all([
                browser.runtime.sendMessage({type: 'close-popup'}).catch(() => {
                    browser.action.setPopup({
                        popup: null
                    });
                }),
                browser.storage.local.clear()
            ]);

            resolve();
        })
    }
    if (!['cors-help', 'upload', 'clean-up'].includes(message.type)) {
        throw new Error(`Unknown message type ${message.type}`);
    }
});
