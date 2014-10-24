function DomAdaptor() {};
DomAdaptor.prototype = {
	constructor: DomAdaptor,
	child: function(node) {
		return node.firstChild;
	},
	sibling: function(node) {
		return node.nextSibling;
	}
};
module.exports = DomAdaptor;