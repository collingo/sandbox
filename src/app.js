var express = require('express');
var path = require('path');
var app = express();

app.use(express.static(path.resolve('www')));

app.listen(process.env.PORT || 8080);