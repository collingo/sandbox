var FBStore = require('mapper-firebase');
var Mapper = require('mapper');
var builder = require('builder');
var stitcher = require('stitcher');

var map = {
	username: 'user',
	firstname: 'firstname',
	lastname: 'lastname',
	town: 'town',
	userMsg: ['firstname', 'lastname', 'town', function(firstname, lastname, town) {
		return 'Welcome ' + firstname + ' ' + lastname + ' from ' + town;
	}],
	dob: 'dob',
	age: ['dob', function(dob) {
		var dobSplit = dob.split('/');
		var year = parseInt(dobSplit[dobSplit.length - 1], 10);
		var fullyear = (year < 15 ? 2000 : 1900) + year
		return 'Roughly ' + (2014 - fullyear);
	}],
	starSign: ['dob', function(dob) {
		var dobSplit = dob.split('/');
		var month = parseInt(dobSplit[1], 10);
		return month < 7 ? 'early' : 'late';
	}]
};
var tpl = '<dl>' + Object.keys(map).map(function(key) {
	return '<dt>'+key+'</dt><dd>{{'+key+'}}</dd>';
}).join('') + '</dl>';
var store = new FBStore("https://blinding-fire-3623.firebaseio.com/");
var mapper = new Mapper(store, map, true);
mapper.getViewModel().then(function(viewModel) {
	document.body.innerHTML = builder(viewModel, tpl);
	stitcher(viewModel, tpl, document.querySelector('dl'));
});