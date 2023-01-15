async function saveOptions(e) {
    e.preventDefault();

    const code = document.querySelector("#code").value;

    if (!code || !document.querySelector("#agree").checked) {
        throw Error('Enter code');
    }

    document.querySelector("#submit").disabled = true;

    const deviceToken = await fetch("https://webapp-prod.cloud.remarkable.engineering/token/json/2/device/new", {
        "headers": {
            "accept": "*/*",
            "content-type": "text/plain;charset=UTF-8",
        },
        "body": `{"code":"${code.trim()}","deviceID":"${([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        )}","deviceDesc":"browser-chrome"}`,
        "method": "POST"
    });

    await browser.storage.sync.set({
        deviceToken: await deviceToken.text()
    });

    location.reload();
}

async function reset(e) {
    e.preventDefault();

    document.querySelector("#submit").disabled = true;

    await browser.storage.sync.clear();

    location.reload();
}

async function requestPermissionAll(e) {
    e.preventDefault();

    await browser.permissions.request({origins: ['<all_urls>']});

    location.reload();
}


async function restoreOptions() {
    const permissions = await browser.permissions.getAll();
    const hasGrantedAll = permissions.origins.includes('<all_urls>');
    const hasRemarkablePermission = hasGrantedAll || permissions.origins.includes('https://webapp-prod.cloud.remarkable.engineering/*');

    if (!hasRemarkablePermission) {
        document.querySelector("#permissions").style.display = 'block'
    }


    const storage = await browser.storage.sync.get();

    const setup = !hasRemarkablePermission || !!storage.deviceToken;
    document.querySelector("#code").disabled = setup;
    document.querySelector("#code").value = 'Authenticated against reMarkable';
    document.querySelector("#agree").disabled = setup;
    document.querySelector("#agree").checked = setup;
    document.querySelector("#submit").disabled = setup;
    document.querySelector("#request-perm-all").disabled = hasGrantedAll;

    if (setup) {
        document.querySelector("#submit").innerText = 'Press reset below to change';
    }
    if (hasGrantedAll) {
        document.querySelector("#request-perm-all").innerText = 'Permission provided';
    }
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
document.querySelector("#reset").addEventListener("click", reset);
document.querySelector("#request-perm-all").addEventListener("click", requestPermissionAll);