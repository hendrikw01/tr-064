var parseString = require('xml2js').parseString;
var request = require('request');
var http = require('http');
var inspect = require('eyes').inspector({maxLength: false, hideFunctions:false});
var URL =  require('url');

var TR064_DESC_URL = "/tr64desc.xml";
var IGD_DESC_URL = "/igddesc.xml";
var PMR_DESC_URL = "/pmr/PersonalMessageReceiver.xml";


function TR064(){

}
TR064.prototype.discoverDevice = function(){};
TR064.prototype.initTR064Device = function(host, port, callback){
	this._parseDesc(host, port, TR064_DESC_URL, callback);
};
TR064.prototype.initIGDDevice = function(host, port, callback){
	this._parseDesc(host, port, IGD_DESC_URL, callback);
};
TR064.prototype.initPMRDevice = function(host, port, callback){
        this._parseDesc(host, port, PMR_DESC_URL, callback);
};


TR064.prototype.startEventServer = function(port){
	this.eventServer = http.createServer(function(req, res){
		inspect(req);
		res.writeHead(200);
		res.end();
	});
	this.eventServer.listen(port);
	
}

TR064.prototype.stopEventServer = function(){
	this.removeAllEvents();
	this.server.close();
}

TR064.prototype.removeAllEvents = function(){
	
}




TR064.prototype._parseDesc = function(host, port,url, callback){
	var nurl = "http://"+host+":"+port+url;
	request(nurl, function (error, response, body) {
  		if (!error && response.statusCode == 200) {
    		parseString(body, {explicitArray : false},function (err, result) {
    			if(!err){
    				//this.deviceInfo.push(result);
    				var devInfo = result.root.device;
    				devInfo.host = host;
    				devInfo.port = port;
                    var path = URL.parse(nurl).pathname;
                    devInfo.urlPart= path.substring(0,path.lastIndexOf("/"));
                    console.log(devInfo.urlPart);
    				var d =  require('./Device');
    				new d.Device(devInfo, callback);
    			}else{
    				console.log(err);
    				console.log(result);
    				callback(err,null);
    			}
    		});
		}else{
			console.log(error);
			console.log(body);
			callback(error,null);
		}
	})
};

exports.TR064 = TR064;
