var inspect = require('eyes').inspector({
    maxLength: false,
    hideFunctions: false
})
var async = require('async');
var request = require('request');
var crypto = require('crypto');
var s = require('./Service');

function Device(deviceInfo, callback) {
    this.meta = deviceInfo;
    this.meta.servicesInfo = [];
    this.readyCallback = callback;
    this.services = {};
    this._isTransaction = false;
    this._parseServices();
    this._sslPort = null;
    this._auth = {
        uid: null,
        realm: "F!Box SOAP-Auth",
        chCount : 0
    };

}
Device.prototype.listServices = function () {};
Device.prototype.listStateVariables = function () {};
Device.prototype.login = function (user, password) {
    if(password === undefined) {
        this._auth.uid = "DefaultUser";
        this._auth.pwd = user;
    }else{
        this._auth.uid = user;
        this._auth.pwd = password;
    }
};
Device.prototype.logout = function () {
    this._auth.uid = null;
    this._auth.pwd = null;
    this._auth.chCount = 0;
};
Device.prototype.startTransaction = function (cb) {
    var that = this;
    var sessionID = uuid();
    this._startTransaction(sessionID,function (err) {
        if (!err) {
            that._isTransaction = true;
            cb(null, that);
        } else {
            cb(err, null);
        }
    });
};
Device.prototype.stopTransaction = function (cb) {
    var that = this;
    this._stopTransaction(function (err) {
        if (!err) {
            that._isTransaction = false;
            cb(null, that);
        } else {
            cb(err, null);
        }
    });
};
Device.prototype.startEncryptedCommunication = function (caFile, cb) {
    if (typeof caFile === 'function') {
        cb = caFile;
        caFile = null;
    } else {
        this._ca = fs.readFileSync(caFile); // .pem File
    }
    var that = this;
    this._getSSLPort(function (err, port) {
        if (!err) {
            that._sslPort = port;
            cb(null, that);
        } else {
            cb(err, null);
        }
    });
};
Device.prototype.stopEncryptedCommunication = function () {
    this._sslPort = null;
};

var getServicesFromDevice = function (serviceArray, device) {
    serviceArray = serviceArray.concat(device.serviceList.service);
    //console.log(serviceArray);
    if (device.deviceList && Array.isArray(device.deviceList.device)) {
        device.deviceList.device.forEach(function (dev) {
            serviceArray = getServicesFromDevice(serviceArray, dev)
        });
    } else if (device.deviceList && device.deviceList.device) {
        serviceArray = getServicesFromDevice(serviceArray, device.deviceList.device)
    }
    return serviceArray;
}

Device.prototype._parseServices = function () {
    var serviceArray = getServicesFromDevice([], this.meta);
    var asyncAddService = bind(this, this._addService)
    var asyncAddResultToServiceList = bind(this, this._addResultToServiceList)
    async.concat(serviceArray, asyncAddService, asyncAddResultToServiceList)
};

Device.prototype._addService = function (serviceData, callback) {
    new s.Service(this, serviceData, callback);
}

Device.prototype._addResultToServiceList = function (err, services) {

    if (!err) {
        for (var i in services) {
            var service = services[i];
            this.services[service.meta.serviceType] = service;
            this.meta.servicesInfo.push(service.meta.serviceType);
        }
        delete this.meta.deviceList;
        delete this.meta.serviceList;
        this.readyCallback(null, this)
    } else {
        console.log(err)
        this.readyCallback(err, null)
    }
}

// SSL Encription
Device.prototype._getSSLPort = function (cb) {
    var devInfo = this.services["urn:dslforum-org:service:DeviceInfo:1"];
    devInfo.actions.GetSecurityPort(function (err, result) {
        if (!err) {
            var sslPort = parseInt(result.NewSecurityPort);
            if (typeof sslPort === 'number' && isFinite(sslPort)) {
                cb(null, sslPort);
            } else {
                cb(new Error('Got bad port from Device. Port:' + result.NewSecurityPort));
            }
        } else {
            console.log(err);
            cb(new Error('Encription is not supported for this device.'));
        }
    });
};

// Login
Device.prototype._calcAuthDigest = function (uid, pwd, realm, sn) {
    var MD5 = crypto.createHash('md5');
    MD5.update(uid + ":" + realm + ":" + pwd);
    var secret = MD5.digest('hex');
    MD5 = crypto.createHash('md5');
    MD5.update(secret + ":" + sn);
    return MD5.digest('hex');
};

// Transaction
Device.prototype._startTransaction = function (sessionID,cb) {
    var devConfig = this.services["urn:dslforum-org:service:DeviceConfig:1"];
    devConfig.actions.ConfigurationStarted({NewSessionID : sessionID},function (err) {
        if (!err) {
            cb(null);
        } else {
            cb(new Error('Transactions are not supported for this device.'));
        }
    });
};
Device.prototype._stopTransaction = function (cb) {
    var devConfig = this.services["urn:dslforum-org:service:DeviceConfig:1"];
    devConfig.actions.ConfigurationFinished(function (err) {
        if (!err) {
            cb(null);
        } else {
            cb(new Error('Transactions are not supported for this device.'));
        }
    });
};


function uuid(
  a                  // placeholder
){
  return a           // if the placeholder was passed, return
    ? (              // a random number from 0 to 15
      a ^            // unless b is 8,
      Math.random()  // in which case
      * 16           // a random number from
      >> a/4         // 8 to 11
      ).toString(16) // in hexadecimal
    : (              // or otherwise a concatenated string:
      [1e7] +        // 10000000 +
      -1e3 +         // -1000 +
      -4e3 +         // -4000 +
      -8e3 +         // -80000000 +
      -1e11          // -100000000000,
      ).replace(     // replacing
        /[018]/g,    // zeroes, ones, and eights with
        uuid            // random hex digits
      )
}

function bind(scope, fn) {
    return function () {
        return fn.apply(scope, arguments);
    };
}

exports.Device = Device;