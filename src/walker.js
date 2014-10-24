module.exports = function(adaptor, rootnode, callback) {

  function walker(node) {
    callback(node);
    node = adaptor.child(node);
    while (node) {
      walker(node);
      node = adaptor.sibling(node);
    }
  }

  walker(rootnode);

};