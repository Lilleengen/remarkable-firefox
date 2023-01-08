const b64EncodeUnicode = (str) =>
    btoa(encodeURIComponent(str)
        .replace(/%([0-9A-F]{2})/g,
            (match, p1) => String.fromCharCode(`0x${p1}`)
        ));

browser.action.onClicked.addListener(async (tab) => {
    const hasRemarkablePermission = await browser.permissions.request({origins: ['https://webapp-prod.cloud.remarkable.engineering/*']});

    const {deviceToken} = await browser.storage.local.get();

    if (!deviceToken) {
        browser.tabs.create({
            url: browser.runtime.getURL('options.html')
        });
    }

    if (hasRemarkablePermission && deviceToken) {
        browser.scripting.executeScript({
            func: () => import(browser.runtime.getURL('build/bundle.js')).then((module) => {
                module.default()
            }),
            target: {tabId: tab.id},
        });
    }
});

browser.runtime.onMessage.addListener((message) => new Promise(async (resolve, reject) => {
    if (message.type === 'upload') {
        let {userToken, deviceToken} = await browser.storage.local.get();

        if (!userToken) {
            const userTokenReq = await fetch("https://webapp-prod.cloud.remarkable.engineering/token/json/2/user/new", {
                "headers": {
                    "accept": "*/*",
                    "authorization": `Bearer ${deviceToken}`,
                },
                "method": "POST",
            });

            userToken = await userTokenReq.text();

            await browser.storage.local.set({
                deviceToken,
                userToken
            });
        }

        fetch("https://internal.cloud.remarkable.com/doc/v2/files", {
            "headers": {
                "accept": "*/*",
                "accept-language": "en-CA,en;q=0.9,no;q=0.8,sv;q=0.7,da;q=0.6",
                "authorization": `Bearer ${userToken}`,
                "content-type": "application/epub+zip",
                "rm-meta": b64EncodeUnicode(JSON.stringify({
                    file_name: message.name
                })),
                "rm-source": "RoR-Browser"
            },
            "body": message.blob,
            "method": "POST"
        }).then(resolve).catch(reject);
    }
    reject();
}));
