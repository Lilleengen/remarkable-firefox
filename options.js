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

    browser.storage.local.set({
        deviceToken: await deviceToken.text()
    });

    location.reload();
}

function reset(e) {
    e.preventDefault();

    document.querySelector("#submit").disabled = true;

    browser.storage.local.set({
        deviceToken: undefined,
        userToken: undefined
    });

    location.reload();
}

async function restoreOptions() {
    const permissions = await browser.permissions.getAll();
    const hasRemarkablePermission = permissions.origins.includes('https://webapp-prod.cloud.remarkable.engineering/*');

    if (!hasRemarkablePermission) {
        document.querySelector("#permissions").style.display = 'block'
    }

    const storage = await browser.storage.local.get();

    const setup = !hasRemarkablePermission || !!storage.deviceToken;
    document.querySelector("#code").disabled = setup;
    document.querySelector("#agree").disabled = setup;
    document.querySelector("#agree").checked = setup;
    document.querySelector("#submit").disabled = setup;
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
document.querySelector("#reset").addEventListener("click", reset);