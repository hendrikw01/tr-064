var inspect = require('eyes').inspector({maxLength: false, hideFunctions:false})
var async = require('async');
var request = require('request');
var s = require('./Service');

function Device(deviceInfo, callback){
	this.meta = deviceInfo;
	this.meta.servicesInfo = [];
	this.readyCallback = callback;
	this.services = {};
	this._parseServices();
}
Device.prototype.listServices = function(){};
Device.prototype.listStateVariables = function(){};


var getServicesFromDevice = function(serviceArray, device){
	serviceArray = serviceArray.concat(device.serviceList.service);
	//console.log(serviceArray);
	if(device.deviceList && Array.isArray(device.deviceList.device)){
		device.deviceList.device.forEach(function(dev){
			serviceArray = getServicesFromDevice(serviceArray, dev)
		});
	}else if(device.deviceList && device.deviceList.device){
		serviceArray = getServicesFromDevice(serviceArray, device.deviceList.device)
	}
	return serviceArray;
}

Device.prototype._parseServices = function(){
	var serviceArray = getServicesFromDevice([], this.meta);
	var asyncAddService = bind(this, this._addService)
	var asyncAddResultToServiceList = bind(this, this._addResultToServiceList)
	async.concat(serviceArray, asyncAddService, asyncAddResultToServiceList)
};

Device.prototype._addService = function(serviceData,callback){
	new s.Service(this.meta, serviceData, callback);
}

Device.prototype._addResultToServiceList = function(err,services){
	
	if(!err){
			for (var i in services) {
				var service = services[i];
				this.services[service.meta.serviceType] = service;
				this.meta.servicesInfo.push(service.meta.serviceType);
			}
			delete this.meta.deviceList;
			delete this.meta.serviceList;
			this.readyCallback(null,this)
		}else{
			console.log(err)
			this.readyCallback(err,null)
		}
}

function bind(scope, fn){
	return function(){
		return fn.apply(scope,arguments);
	}
}

exports.Device = Device;