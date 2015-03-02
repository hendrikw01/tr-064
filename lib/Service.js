var parseString = require('xml2js').parseString;
var inspect = require('eyes').inspector({
    maxLength: false,
    hideFunctions: false
});
var request = require('request');

function Service(device, serviceInfo, callback) {
    this.host = device.meta.host;
    this.port = device.meta.port;
    this.device = device;
    this.meta = serviceInfo;
    this.meta.actionsInfo = [];
    this.readyCallback = callback;
    this.actions = {};
    this.stateVariables = {};
    //console.log("Service: "+this.host);
    _parseSCPD(this);

}
Service.prototype.listActions = function () {};
Service.prototype.listStateVariables = function () {};


var _pushArg = function (argument, inArgs, outArgs) {
    if (argument.direction == "in") {
        inArgs.push(argument.name);
    } else if (argument.direction == "out") {
        outArgs.push(argument.name);
    }
};


var _parseActions = function (actionData) {
    if (!Array.isArray(actionData)) {
        return;
    }
    var insA = bind(this, _insertAction);
    actionData.forEach(insA);
    // inspect(actions);
    //
};

var _parseSCPD = function (obj) {
    if(obj.device.meta.urlPart && obj.device.meta.urlPart.length > 0){
        obj.meta.SCPDURL = obj.device.meta.urlPart+"/"+obj.meta.SCPDURL;
    }
    var url = "http://" + obj.host + ":" + obj.port + obj.meta.SCPDURL;
    //console.log(url);
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
           // console.log(body);
            parseString(body, {
                explicitArray: false
            }, function (err, result) {
                var pA = bind(obj, _parseActions);
                var pV = bind(obj, _parseStateVariables);
                pA(result.scpd.actionList.action);
                pV(result.scpd.serviceStateTable.stateVariable);
                //inspect(obj.stateVariables);		
                obj.readyCallback(null, obj);
            });
        } else {
            console.log(url);
        }
    });
};

var _insertAction = function (el) {
    var outArgs = [];
    var inArgs = [];
    if (el.argumentList && Array.isArray(el.argumentList.argument)) {
        el.argumentList.argument.forEach(function (argument) {
            _pushArg(argument, inArgs, outArgs);
        });
    } else if (el.argumentList) {
        _pushArg(el.argumentList.argument, inArgs, outArgs);
    }

    this.actions[el.name] = bind(this, function (vars, callback) {
        this._callAction(el.name, inArgs, outArgs, vars, callback);
    });
    this.meta.actionsInfo.push({
        name: el.name,
        inArgs: inArgs,
        outArgs: outArgs
    });
};

Service.prototype._callAction = function (name, inArguments, outArguments, vars, callback) {

    if (typeof vars === 'function') {
        callback = vars;
        vars = [];
    }

    bind(this, this._sendSOAPActionRequest(this.device, this.meta.controlURL, this.meta.serviceType, name, inArguments, outArguments, vars, callback));
};

Service.prototype._subscribeStateVariableChangeEvent = function (sv, callback) {
    inspect(arguments);
};

function bind(scope, fn) {
    return function () {
        return fn.apply(scope, arguments);
    };
}

var _insertStateVariables = function (sv) {
    if (sv.$.sendEvents == "yes") {
        this.stateVariables[sv.name] = bind(this, function (callback) {
            this._subscribeStateVariableChangeEvent(sv, callback)
        });
    }
};

var _parseStateVariables = function (stateVariableData) {
    var insSV = bind(this, _insertStateVariables);
    if (Array.isArray(stateVariableData)) {
        stateVariableData.forEach(insSV);
    } else if (typeof stateVariableData === 'object') {
        insSV(stateVariableData);
    }
};


Service.prototype._sendSOAPActionRequest = function (device, url, serviceType, action, inArguments, outArguments, vars, callback) {
    var head = "";
    if (device._auth.uid) { // Content Level Authentication 
        if (device._auth.auth) {
            head = "<s:Header>" +
                "<h:ClientAuth xmlns:h=\"http://soap-authentication.org/digest/2001/10/\"" +
                "s:mustUnderstand=\"1\">" +
                "<Nonce>" + device._auth.sn + "</Nonce>" +
                "<Auth>" + device._auth.auth + "</Auth>" +
                "<UserID>" + device._auth.uid + "</UserID>" +
                "<Realm>" + device._auth.realm + "</Realm>" +
                "</h:ClientAuth>" +
                "</s:Header>";
        } else { // First Auth
            head = " <s:Header>" +
                "<h:InitChallenge xmlns:h=\"http://soap-authentication.org/digest/2001/10/\"" +
                "s:mustUnderstand=\"1\">" +
                "<UserID>" + device._auth.uid + "</UserID>" +
                "<Realm>" + device._auth.realm + "</Realm>" +
                "</h:InitChallenge>" +
                "</s:Header>";
        }
    }


    var body = "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
        "<s:Envelope s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\" xmlns:s=\" http://schemas.xmlsoap.org/soap/envelope/\">" +
        head +
        "<s:Body>" +
        "<u:" + action + " xmlns:u=\"" + serviceType + "\">";

    var keys = Object.keys(vars);
    keys.forEach(function (key) {
        body += "<" + key + ">";
        body += vars[key];
        body += "</" + key + ">";
    });

    body = body + "</u:" + action + ">" +
        "</s:Body>" +
        "</s:Envelope>";

    var port = 0,
        proto = "",
        agentOptions = null;
    if (device._sslPort) {
        port = device._sslPort;
        proto = "https://";
        if (device._ca) {
            agentOptions = {
                ca: device._ca
            };
        } else {
            agentOptions = {
                rejectUnauthorized: false
            }; // Allow selfsignd Certs
        }

    } else {
        proto = "http://";
        port = device.meta.port;
    }
    var uri = proto + device.meta.host + ":" + port + url;
    var that = this;
    request({
        method: 'POST',
        uri: uri,
        agentOptions: agentOptions,
        headers: {
            "SoapAction": serviceType + "#" + action,
            "Content-Type": "text/xml; charset=\"utf-8\""
        },
        body: body
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            parseString(body, {
                explicitArray: false
            }, function (err, result) {
                var challange = false;
                var res = {};
                var env = result['s:Envelope'];
                if (env['s:Header']) {
                    var header = env['s:Header'];
                    if (header['h:Challenge']) {
                        var ch = header['h:Challenge'];
                        challange = true;
                        if (device._auth.chCount > 2) {
                            error = new Error("Credentials incorrect");
                        } else {
                            device._auth.sn = ch.Nonce;
                            device._auth.realm = ch.Realm;
                            device._auth.auth = device._calcAuthDigest(device._auth.uid,
                                device._auth.pwd,
                                device._auth.realm,
                                device._auth.sn);
                            device._auth.chCount++;
                            // Repeat request.
                            that._sendSOAPActionRequest(device, url, serviceType, action, inArguments, outArguments, vars, callback);
                            return;
                        }
                    } else if (header['h:NextChallenge']) {
                        var nx = header['h:NextChallenge'];
                        device._auth.auth = nx.Nonce;
                        device._auth.chCount = 0;
                    }
                }

                if (env['s:Body']) {
                    var body = env['s:Body'];
                    if (body['u:' + action + 'Response']) {
                        var responseVars = body['u:' + action + 'Response'];
                        if (outArguments) {
                            outArguments.forEach(function (arg) {
                                res[arg] = responseVars[arg];
                            });
                        }
                    } else if (body["s:Fault"]) {
                        var fault = body["s:Fault"];
                        error = new Error("Device responded with fault " + error);
                        res = fault;
                    }
                }
                callback(error, res);
            });
        } else {
            error = new Error("sendSOAPActionRequest Error: " + response.statusCode);
            // console.log(error);
            callback(error, null);
            //  console.log('error: '+ response.statusCode)
             console.log(body)
        }
    });

};


Service.prototype.sendSOAPEventSubscribeRequest = function (callback) {
    console.log("Send EventSubscribe...");
    request({
        method: 'SUBSCRIBE',
        uri: "http://" + this.host + ":" + this.port + this.meta.eventSubURL,
        headers: {
            "CALLBACK": "<http://192.168.178.28:44880/>",
            "NT": "upnp:event",
            "TIMEOUT": "Second-infinite"
        }
    }, function (error, response, body) {
        console.log("END");
        if (response.statusCode == 200) {
            console.log("EventSubscribeRequest OK");
        } else {
            error = new Error("EventSubscribeRequest Error: " + response.statusCode);
            console.log('error: ' + response.statusCode)
            console.log(body)
        }
    })

}




exports.Service = Service;
