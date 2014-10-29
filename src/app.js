var express = require('express');
var path = require('path');
var app = express();
var port = process.env.PORT || 8080;

app.use(express.static(path.resolve('www')));

app.listen(port);
console.log('App listening on port '+port);