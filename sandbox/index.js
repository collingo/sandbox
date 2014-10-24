var walker = require('../src/walker');
var DomAdaptor = require('./walker-dom-adaptor');
var ObjectAdaptor = require('./walker-object-adaptor');

var child11 = {
	value: 3
}
var child2 = {
	value: 2
}
var child1 = {
	value: 1,
	firstChild: child11,
	nextSibling: child2
}
var root = {
	value: 0,
	firstChild: child1
}

console.log('==========');
console.log('===DOM====');
console.log('==========');

walker(new DomAdaptor(), root, function(node) {
	console.log(node.value);
});


var test = {
  a: {
    a: [1,2,['a','b','c',{
      a:11,b:22
    }]],
    b: {a:4,b:5,c:6},
    c: [{
      a: 7
    }, {
      a: 8
    }, {
      a: 9
    }]
  },
  b:2,
  c: {
    a:1,
    b:2
  }
}

console.log('==========');
console.log('==OBJECT==');
console.log('==========');

walker(new ObjectAdaptor(), test, function(node) {
  if(typeof node !== 'object') {
    console.log(node);
  }
});
