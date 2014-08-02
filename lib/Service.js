var parseString = require('xml2js').parseString;
var inspect = require('eyes').inspector({maxLength: false, hideFunctions:false})
var request = require('request');
var www_authenticate = require('www-authenticate');
var md5= require(__dirname+'/../node_modules/www-authenticate/lib/md5.js');
var digest = require('digest-header');

function Service(deviceInfo,serviceInfo,callback){
	this.host = deviceInfo.host;
	this.port = deviceInfo.port;
  this.user = deviceInfo.user;
  this.password = deviceInfo.password;
	this.meta = serviceInfo;
	this.meta.actionsInfo = [];
	this.readyCallback = callback;
	this.actions ={};
	this.stateVariables ={};
	//console.log("Service: "+this.host);
	_parseSCPD(this);
	
}
Service.prototype.listActions = function(){};
Service.prototype.listStateVariables = function(){};


var _pushArg = function(argument,inArgs,outArgs){
	if(argument.direction == "in"){
    	inArgs.push(argument.name);
    }else if(argument.direction == "out"){
    	outArgs.push(argument.name);
    }
}


var _parseActions = function(actionData){
	if(!Array.isArray(actionData)){
		return;
	}
	var insA = bind(this, _insertAction);
	actionData.forEach(insA)
   // inspect(actions);
    //
};

var _parseSCPD = function(obj){
	var url = "http://"+obj.host+":"+obj.port+obj.meta.SCPDURL;
	request(url, function (error, response, body) {
  		if (!error && response.statusCode == 200) {
    		parseString(body, {explicitArray : false},function (err, result) {	
    			var pA = bind(obj,_parseActions);
    			var pV = bind(obj,_parseStateVariables);
    			pA(result.scpd.actionList.action);
    			pV(result.scpd.serviceStateTable.stateVariable);  	
    			//inspect(obj.stateVariables);		
    			obj.readyCallback(null,obj);
  			});
		}else{
			console.log(url);
		}
	})
};

var _insertAction = function(el){
    	var outArgs = [];
    	var inArgs =[];
    	if(el.argumentList && Array.isArray(el.argumentList.argument) ) {
    		el.argumentList.argument.forEach(function(argument){
    			_pushArg(argument,inArgs,outArgs);
    		});
    	}else if(el.argumentList){
    		_pushArg(el.argumentList.argument,inArgs,outArgs);
    	}
    	this.actions[el.name] = bind(this,function(vars, callback){this._callAction(el.name, inArgs, outArgs, vars, callback)})
    	this.meta.actionsInfo.push({name: el.name, inArgs: inArgs, outArgs: outArgs});
}

Service.prototype._callAction = function(name, inArguments, outArguments, vars, callback){
	
	if(typeof vars === 'function'){
		callback = vars;
		vars = [];
	}

	this._sendSOAPActionRequest(this.host,this.port,this.meta.controlURL,this.meta.serviceType,name,inArguments, outArguments,vars,callback,this.user,this.password)
}

Service.prototype._subscribeStateVariableChangeEvent = function(sv, callback){
	inspect(arguments);
}

function bind(scope, fn){
	return function(){
		return fn.apply(scope,arguments);
	}
}

var _insertStateVariables = function(sv){
			if(sv.$.sendEvents == "yes"){
				this.stateVariables[sv.name] = bind(this,function(callback){this._subscribeStateVariableChangeEvent(sv, callback)})
			}
		}

var _parseStateVariables = function(stateVariableData){
	var insSV = bind(this, _insertStateVariables);
	if(Array.isArray(stateVariableData)) {
		stateVariableData.forEach(insSV);
	}else if(typeof stateVariableData === 'object'){
		insSV(stateVariableData);
	}
};


Service.prototype._sendSOAPActionRequest = function(host,port,url,serviceType,action,inArguments, outArguments,vars,callback,user,password){
	var body = "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
"<s:Envelope s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\" xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\">" +
"<s:Body>"+
"<u:"+action+" xmlns:u=\""+serviceType+"\">";

// Args..

body = body + "</u:"+action+">"+
"</s:Body>"+
"</s:Envelope>";

var method = 'POST';
var uri = "http://"+host+":"+port+url;
var headers = {
  "SoapAction": serviceType+"#"+action
  ,"Content-Type" : "text/xml; charset=\"utf-8\""
};

console.log(body);

request({
    method: method
    , uri: uri
    , headers: headers
    , body: body
    }
  , function (error, response, body) {
      if(response.statusCode == 200){
        
        parseString(body, {explicitArray : false},function (err, result) {	
        	
        	
        	var res = {};
        	if(outArguments) {
        		var responseVars = result['s:Envelope']['s:Body']['u:'+action+'Response'];
        		outArguments.forEach(function(arg){
        			res[arg] = responseVars[arg];
        		})
        	}
        	callback(error,res)
        });
      } else if (response.statusCode == 401) {
        console.log(response.headers);

        var parsed = new www_authenticate.parsers.WWW_Authenticate(response.headers['www-authenticate']);
        console.log(parsed);
        // parsed.parms.realm = 'F!Box SOAP-Auth' // WORKAROUND
        var secret = md5(user+':'+parsed.parms.realm+':'+password);
        console.log(user+':'+parsed.parms.realm+':'+password);
        var responseAuth = md5(secret+':'+parsed.parms.nonce);
        console.log(secret+':'+parsed.parms.nonce);
        console.log(responseAuth);

        var body = "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
        "<s:Envelope s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\" xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\">" +
        '<s:Header>'+
          '<h:ClientAuth xmlns:h="http://soap-authentication.org/digest/2001/10/" s:mustUnderstand="1">'+
            '<Nonce>'+parsed.parms.nonce+'</Nonce>'+
            '<Auth>'+responseAuth+'</Auth>'+
            '<UserID>'+user+'</UserID>'+
            '<Realm>'+parsed.parms.realm+'</Realm>'+
          '</h:ClientAuth>'+
        '</s:Header>'+
        "<s:Body>"+
        "<u:"+action+" xmlns:u=\""+serviceType+"\">";
        // Args..

        body = body + "</u:"+action+">"+
        "</s:Body>"+
        "</s:Envelope>";

        console.log(body);

        var wwwAuthenticate = response.headers['www-authenticate'];
        var userpass = user+':'+password;
        var auth = digest(method, url, wwwAuthenticate, userpass);

        headers['Authorization'] = auth;

        console.log(headers);

        request({
          method: method
          , uri: uri
          , headers: headers
          , body: body
          }
        , function (error, response, body) {
          if(response.statusCode == 200){
            parseString(body, {explicitArray : false},function (err, result) {
              console.log(result['s:Envelope']['s:Body']['s:Fault'].detail);
              var res = {};
              if(outArguments) {
                var responseVars = result['s:Envelope']['s:Body']['u:'+action+'Response'];
                outArguments.forEach(function(arg){
                  res[arg] = responseVars[arg];
                })
              }
              callback(error,res)
            });
          } else {
            error = new Error("second try sendSOAPActionRequest Error: "+response.statusCode);
            callback(error,body)
          }
        });
      } else {
      	error = new Error("sendSOAPActionRequest Error: "+response.statusCode);
        callback(error,body)
      //  console.log('error: '+ response.statusCode)
       // console.log(body)
      }
    }
  )
	
}


Service.prototype.sendSOAPEventSubscribeRequest = function(callback){
console.log("Send EventSubscribe...");
request(
    { method: 'SUBSCRIBE'
    , uri: "http://"+this.host+":"+this.port+this.meta.eventSubURL
    ,headers: {
      "CALLBACK": "<http://192.168.178.28:44880/>"
        ,"NT" : "upnp:event"
        ,"TIMEOUT" : "Second-infinite"
      }
    }
  , function (error, response, body) {
      console.log("END");
      if(response.statusCode == 200){
        console.log("EventSubscribeRequest OK");
      } else {
        error = new Error("EventSubscribeRequest Error: "+response.statusCode);
        console.log('error: '+ response.statusCode)
        console.log(body)
      }
    }
  )
}




exports.Service = Service;