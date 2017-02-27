tr-064
======

TR-064 - UPnP/IGD for node.js

## Description

A library to interact with routers and other network devices.
Tested and designd for Fritz.Box routers.

This library is capable of:
* Supports the UPnP, IGD and PMR (Samsung TV) Protocol
* Read and configure Services
* Authentication with username/password or password only
* SSL encryption
* Transactions
* Subscribe to Events with included EventServer

More info about TR-064: http://www.avm.de/de/Extern/files/tr-064/AVM_TR-064_first_steps.pdf

## Install

<pre>
  npm install tr-064
</pre>

## It`s simple

Connect to the device and read a Service.

```javascript
var tr = require("tr-064");
var tr064 = new tr.TR064();
tr064.initTR064Device("fritz.box", 49000, function (err, device) {
    if (!err) {
       var wanip = device.services["urn:dslforum-org:service:WANIPConnection:1"];
       wanip.actions.GetInfo(function(err, result){
       		console.log(result);
       });
    }
});

```

## Save communication (SSL Encryption, Authentication)

```javascript
var tr = require("tr-064");
var tr064 = new tr.TR064();
tr064.initTR064Device("fritz.box", 49000, function (err, device) {
    if (!err) {
        device.startEncryptedCommunication(function (err, sslDev) {
            if (!err) {
                sslDev.login([USER], [PASSWORD]);
                var wanip = sslDev.services["urn:dslforum-org:service:WANIPConnection:1"];
                wanip.actions.GetInfo(function (err, result) {
                    console.log(result);
                });
            }
        });
    }
});

```

## List All Services and Variables

Get the info from both protocols.

```javascript
var tr = require("tr-064");
var tr064 = new tr.TR064();
tr064.initTR064Device("fritz.box", 49000, function (err, device) {
    if (!err) {
        console.log("Found device! - TR-064");
        showDevice(device);
    }
});

tr064.initIGDDevice("fritz.box", 49000, function (err, device) {
    if (!err) {
        console.log("Found device! - IGD");
        showDevice(device);
    }
});

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
```

## Methods

### initTR064Device(host, port, callback)

Initialize the TR - 064 UPnP controller

* `host` - hostname of the device 
* `port` - port of the device(standard: 49000) 
* `callback` - (err, device)

### initIGDDevice(host, port, callback)

Initialize the TR - 064 IGD controller

* `host` - hostname of the device 
* `port` - port of the device(standard: 49000) 
* `callback` - (err, device)

### device.startEncryptedCommunication([caFile],callback)

Starts SSL encrypted Communication

* `caFile` - Filename of custom .pem file (Optional)
* `callback` - (err, device)

### device.stopEncryptedCommunication()

Stops SSL encrypted Communication

### device.login([user],password)

Configure device to use authentication for every request

* `user` - Username (Optional, default device user is used instead)
* `password` - Device password

### device.logout()

Configure device to not use authentication

### device.startTransaction(callback)

Starts a 'device-side' transaction

* `callback` - (err, device)

### device.stopTransaction()

Ends the current transaction

### device.meta

Array with all info about services and actions

### device.services[`Service Identifier`]

Gets the specified service form the device

* `Service Identifier` - usually in the form of: urn:dslforum-org:service:XXX:1

### service.actions.XXX([{name: 'xx', value: 'xx'}], callback)
* `name` - Argumentname for Action
* `value` - Argumentvalue for Action
* `callback` - (err, result)

```javascript
service.actions.SetEnable([{name: 'NewEnable', value: '1'}], function (err, result) {
    console.log(result);
});
```