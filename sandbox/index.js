var FBStore = require('mapper-firebase');
var Mapper = require('mapper');
var observer = require('observer');

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
var store = new FBStore("https://blinding-fire-3623.firebaseio.com/");
var mapper = new Mapper(store, map, true);
mapper.getViewModel().then(function(viewModel) {
	observer(viewModel, function() {
		console.log(arguments);
	});
});