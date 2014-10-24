function ObjectAdaptor() {
	this.stack = [];
};
ObjectAdaptor.prototype = {
	constructor: ObjectAdaptor,
	child: function(node) {
		var next;
		if(typeof node === 'object') {
			if(Array.isArray(node)) {
				this.stack.unshift([].concat(node));
			} else {
				this.stack.unshift(Object.keys(node).map(function(key) {
					return node[key];
				}));
			}
			next = this.stack[0].shift();
		}
		return next;
	},
	sibling: function(node) {
    var next;
    if(this.stack.length) {
      var level = this.stack[0];
      if(level.length) {
        next = level.shift();
      } else {
        this.stack.shift();
      }
    }
    return next;
	}
};
module.exports = ObjectAdaptor;