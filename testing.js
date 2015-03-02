var inspect = require('eyes').inspector({
    maxLength: false,
    hideFunctions: false,
    styles: {
        all: "black"
    }
})
var util = require("util");
var tr = require("./lib/TR064");

var showCallback = function (err, result) {
    if (!err) {
        inspect(result);
    }
}

var speedCB = function (err, result) {
    util.print(result.NewByteReceiveRate + "  ");

}

var showDevice = function (device) {

    console.log("=== " + device.meta.friendlyName + " ===");
    device.meta.servicesInfo.forEach(function (serviceType) {
        var service = device.services[serviceType];
        console.log("  ---> " + service.meta.serviceType + " <---");
        service.meta.actionsInfo.forEach(function (action) {
            console.log("   # " + action.name + "()");
            action.inArgs.forEach(function (arg) {
                console.log("     IN : " + arg);
            });
            action.outArgs.forEach(function (arg) {
                console.log("     OUT: " + arg);
            });
        });
    });

}

var tr064 = new tr.TR064();

//tr064.startEventServer(44880);

tr064.initIGDDevice("fritz.box", 49000, function (err, device) {
    if (!err) {
        console.log("Found device! - IGD");
        showDevice(device);

        var wandic = device.services["urn:schemas-upnp-org:service:WANIPConnection:1"];

        wandic.actions.GetExternalIPAddress(showCallback);

        var wan = device.services["urn:schemas-upnp-org:service:WANCommonInterfaceConfig:1"];
        wan.actions.GetCommonLinkProperties(showCallback);
        wan.actions.GetTotalBytesReceived(showCallback);
        wan.actions.GetAddonInfos(showCallback);
        setInterval(wan.actions.GetAddonInfos, 1000, speedCB);
    }
});


/*
Example: Get the url from the first phonebook.
*/
var user = "user";
var password = "password";
tr064.initTR064Device("fritz.box", 49000, function (err, device) {
    if (!err) {
        console.log("Found device! - TR-064");
        device.startEncryptedCommunication(function (err, sslDev) {
            if (!err) {
                sslDev.login(user, password);
                var wanppp = sslDev.services["urn:dslforum-org:service:X_AVM-DE_OnTel:1"];
                wanppp.actions.GetPhonebook({
                    NewPhonebookID: '0'
                }, function (err, ret) {
                    if (err) {
                        console.log(err);
                        return;
                    }
                    if (ret.NewPhonebookURL && ret.NewPhonebookURL.length > 0) {
                        // GOT URL
                        var url = ret.NewPhonebookURL;
                        console.log(url);
                    }
                });
            } else {
                console.log(err);
            }
        });
    }
});