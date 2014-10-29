(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canMutationObserver = typeof window !== 'undefined'
    && window.MutationObserver;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    var queue = [];

    if (canMutationObserver) {
        var hiddenDiv = document.createElement("div");
        var observer = new MutationObserver(function () {
            var queueList = queue.slice();
            queue.length = 0;
            queueList.forEach(function (fn) {
                fn();
            });
        });

        observer.observe(hiddenDiv, { attributes: true });

        return function nextTick(fn) {
            if (!queue.length) {
                hiddenDiv.setAttribute('yes', 'no');
            }
            queue.push(fn);
        };
    }

    if (canPost) {
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],2:[function(require,module,exports){
module.exports = function templateToArray(tpl) {
	if(!tpl) return [];

	var match = tpl.match(/<\/?[a-z]+[^>]*>|\{\{[a-zA-Z\.]+\}\}|[a-zA-Z]+/g);
	var i, tag, tags = [];
	for (i = 0; i < match.length; i++) {
		tag = getTag(match[i]);
		if(tag) {
			tag.attributes = getAttributesHash(match[i]);
			tags.push(tag);
		}
	}

	function getTag(tagString) {
		var tag = {};
		if(tagString.charAt(0) === "<") {
			var match = tagString.match(/^<(\/?)([a-z0-9]+)/);
			if(!match[1].length) {
				// opening tag
				tag.type = match[2];
				if(tagString.charAt(tagString.length-2) === '/') {
					tag.self = true;
				}
			} else {
				// closing tag
				tag.type = match[2];
				tag.close = true;
			}
		} else {
			var placeholder = tagString.match(/^\{\{([a-zA-Z\.]+)\}\}/);
			if(placeholder) {
				tag.type = '>';
				tag.bind = placeholder[1];
			} else {
				tag.type = "#text";
				tag.value = tagString;
			}
		}
		return tag;
	}

	function getAttributesHash(tagString) {
		var hash = {};
		var match = tagString.match(/([a-z]+\=\"[^\"]*\")/g);
		var attr;
		if(match) {
			for(var i = 0; i < match.length; i++) {
				attr = match[i].split('=');
				var placeholder = attr[1].match(/\{\{([a-zA-Z\.]+)\}\}/);
				if(placeholder) {
					hash[attr[0]] = {
						type: '>',
						bind: placeholder[1]
					};
				} else {
					hash[attr[0]] = attr[1].match(/^[\"]*([\{\}a-zA-Z1-9\. ]+)/)[1];
				}
			}
		}
		return hash;
	}

	return tags;
};
},{}],3:[function(require,module,exports){
var abstractor = require('abstractor');

module.exports = function(mod, tpl) {
	if(!arguments.length) throw new Error("Missing model and template");
	if(typeof mod !== 'object') throw new Error("Model must be plain object"); 
	if(!tpl) throw new Error("Missing template");
	if(typeof tpl !== 'string') throw new Error("Template must be a string");

	var getNested = function(model, location) {
		var locationArr = location.split('.');
		var result = model;
		for (var i = 0; i < locationArr.length; i++) {
			result = result[locationArr[i]];
		}
		return result;
	};
	var loopRepeats = function(items, domPartialModel) {
		var html = '';
		for(var i = 0; i < items.length; i++) {
			var model = items[i];
			if(typeof items[i] !== "object") {
				model = {
					value: items[i]
				};
			}
			html += buildHtml(domPartialModel.slice(0), model);
		}
		return html;
	};
	var buildAttrString = function(attributes, model) {
		var html = '';
		for(var key in attributes) {
			if(attributes[key].bind) {
				html += ' ' + key + '="' + getNested(model, attributes[key].bind) +'"';
			} else {
				html += ' ' + key + '="' + attributes[key] +'"';
			}
		}
		return html;
	};
	var buildTagString = function(tag, model) {
		var html = '<';
		if(tag.close) html += '/';
		html += tag.type;
		html += buildAttrString(tag.attributes, model);
		if(tag.type === 'input') html += ' /';
		html += '>';
		return html;
	};
	var getPartial = function(domModel) {
		var dom = [];
		var stack = [];
		if(!domModel[0].close) {
			var domItem = domModel.shift();
			dom.push(domItem);
			stack.push(domItem.type);
			while(stack.length) {
				domItem = domModel.shift();
				if(domItem.type !== '>') {
					if(domItem.close) {
						stack.pop();
					} else {
						if(!domItem.self) {
							stack.push(domItem.type);
						}
					}
				}
				dom.push(domItem);
			}
		}
		return dom;
	};
	var buildHtml = function(domModel, model) {
		var html = '';
		while(domModel.length) {
			var domItem = domModel.shift();
			switch(domItem.type) {
				case '>':
					// placeholder
					var value = getNested(model, domItem.bind);
					html += (value === undefined) ? '{{'+domItem.bind+'}}' : value;
				break;
				case '#text':
					html += domItem.value;
				break;
				default:
					html += buildTagString(domItem, model);
					if(domItem.attributes.repeat) {
						var items = getNested(model, domItem.attributes.repeat);
						var partial = getPartial(domModel);
						html += loopRepeats(items, partial);
					}
				break;
			}
		}
		return html;
	};

	return buildHtml(abstractor(tpl), mod);
};
},{"abstractor":2}],4:[function(require,module,exports){
(function() {var h,aa=this;function n(a){return void 0!==a}function ba(){}function ca(a){a.rb=function(){return a.ld?a.ld:a.ld=new a}}
function da(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return"array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("call"))return"function"}else return"null";
else if("function"==b&&"undefined"==typeof a.call)return"object";return b}function ea(a){var b=da(a);return"array"==b||"object"==b&&"number"==typeof a.length}function q(a){return"string"==typeof a}function fa(a){return"number"==typeof a}function ga(a){var b=typeof a;return"object"==b&&null!=a||"function"==b}function ha(a,b,c){return a.call.apply(a.bind,arguments)}
function ia(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var c=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(c,d);return a.apply(b,c)}}return function(){return a.apply(b,arguments)}}function r(a,b,c){r=Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?ha:ia;return r.apply(null,arguments)}
function ja(a,b){function c(){}c.prototype=b.prototype;a.ke=b.prototype;a.prototype=new c;a.ie=function(a,c,f){return b.prototype[c].apply(a,Array.prototype.slice.call(arguments,2))}};function ka(a){a=String(a);if(/^\s*$/.test(a)?0:/^[\],:{}\s\u2028\u2029]*$/.test(a.replace(/\\["\\\/bfnrtu]/g,"@").replace(/"[^"\\\n\r\u2028\u2029\x00-\x08\x0a-\x1f]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,"]").replace(/(?:^|:|,)(?:[\s\u2028\u2029]*\[)+/g,"")))try{return eval("("+a+")")}catch(b){}throw Error("Invalid JSON string: "+a);}function la(){this.mc=void 0}
function ma(a,b,c){switch(typeof b){case "string":na(b,c);break;case "number":c.push(isFinite(b)&&!isNaN(b)?b:"null");break;case "boolean":c.push(b);break;case "undefined":c.push("null");break;case "object":if(null==b){c.push("null");break}if("array"==da(b)){var d=b.length;c.push("[");for(var e="",f=0;f<d;f++)c.push(e),e=b[f],ma(a,a.mc?a.mc.call(b,String(f),e):e,c),e=",";c.push("]");break}c.push("{");d="";for(f in b)Object.prototype.hasOwnProperty.call(b,f)&&(e=b[f],"function"!=typeof e&&(c.push(d),
na(f,c),c.push(":"),ma(a,a.mc?a.mc.call(b,f,e):e,c),d=","));c.push("}");break;case "function":break;default:throw Error("Unknown type: "+typeof b);}}var oa={'"':'\\"',"\\":"\\\\","/":"\\/","\b":"\\b","\f":"\\f","\n":"\\n","\r":"\\r","\t":"\\t","\x0B":"\\u000b"},pa=/\uffff/.test("\uffff")?/[\\\"\x00-\x1f\x7f-\uffff]/g:/[\\\"\x00-\x1f\x7f-\xff]/g;
function na(a,b){b.push('"',a.replace(pa,function(a){if(a in oa)return oa[a];var b=a.charCodeAt(0),e="\\u";16>b?e+="000":256>b?e+="00":4096>b&&(e+="0");return oa[a]=e+b.toString(16)}),'"')};function qa(a){return"undefined"!==typeof JSON&&n(JSON.parse)?JSON.parse(a):ka(a)}function u(a){if("undefined"!==typeof JSON&&n(JSON.stringify))a=JSON.stringify(a);else{var b=[];ma(new la,a,b);a=b.join("")}return a};function ra(a){for(var b=[],c=0,d=0;d<a.length;d++){var e=a.charCodeAt(d);55296<=e&&56319>=e&&(e-=55296,d++,v(d<a.length,"Surrogate pair missing trail surrogate."),e=65536+(e<<10)+(a.charCodeAt(d)-56320));128>e?b[c++]=e:(2048>e?b[c++]=e>>6|192:(65536>e?b[c++]=e>>12|224:(b[c++]=e>>18|240,b[c++]=e>>12&63|128),b[c++]=e>>6&63|128),b[c++]=e&63|128)}return b};var sa={};function x(a,b,c,d){var e;d<b?e="at least "+b:d>c&&(e=0===c?"none":"no more than "+c);if(e)throw Error(a+" failed: Was called with "+d+(1===d?" argument.":" arguments.")+" Expects "+e+".");}
function y(a,b,c){var d="";switch(b){case 1:d=c?"first":"First";break;case 2:d=c?"second":"Second";break;case 3:d=c?"third":"Third";break;case 4:d=c?"fourth":"Fourth";break;default:ta.assert(!1,"errorPrefix_ called with argumentNumber > 4.  Need to update it?")}return a=a+" failed: "+(d+" argument ")}function z(a,b,c,d){if((!d||n(c))&&"function"!=da(c))throw Error(y(a,b,d)+"must be a valid function.");}
function ua(a,b,c){if(n(c)&&(!ga(c)||null===c))throw Error(y(a,b,!0)+"must be a valid context object.");};function A(a,b){return Object.prototype.hasOwnProperty.call(a,b)}function va(a,b){if(Object.prototype.hasOwnProperty.call(a,b))return a[b]};var ta={},wa=/[\[\].#$\/]/,xa=/[\[\].#$]/;function ya(a){return q(a)&&0!==a.length&&!wa.test(a)}function za(a,b,c){c&&!n(b)||Aa(y(a,1,c),b)}
function Aa(a,b,c,d){c||(c=0);d=d||[];if(!n(b))throw Error(a+"contains undefined"+Ba(d));if("function"==da(b))throw Error(a+"contains a function"+Ba(d)+" with contents: "+b.toString());if(Ca(b))throw Error(a+"contains "+b.toString()+Ba(d));if(1E3<c)throw new TypeError(a+"contains a cyclic object value ("+d.slice(0,100).join(".")+"...)");if(q(b)&&b.length>10485760/3&&10485760<ra(b).length)throw Error(a+"contains a string greater than 10485760 utf8 bytes"+Ba(d)+" ('"+b.substring(0,50)+"...')");if(ga(b))for(var e in b)if(A(b,
e)){var f=b[e];if(".priority"!==e&&".value"!==e&&".sv"!==e&&!ya(e))throw Error(a+" contains an invalid key ("+e+")"+Ba(d)+'.  Keys must be non-empty strings and can\'t contain ".", "#", "$", "/", "[", or "]"');d.push(e);Aa(a,f,c+1,d);d.pop()}}function Ba(a){return 0==a.length?"":" in property '"+a.join(".")+"'"}function Da(a,b){if(!ga(b))throw Error(y(a,1,!1)+" must be an object containing the children to replace.");za(a,b,!1)}
function Ea(a,b,c,d){if(!(d&&!n(c)||null===c||fa(c)||q(c)||ga(c)&&A(c,".sv")))throw Error(y(a,b,d)+"must be a valid firebase priority (a string, number, or null).");}function Fa(a,b,c){if(!c||n(b))switch(b){case "value":case "child_added":case "child_removed":case "child_changed":case "child_moved":break;default:throw Error(y(a,1,c)+'must be a valid event type: "value", "child_added", "child_removed", "child_changed", or "child_moved".');}}
function Ga(a,b){if(n(b)&&!ya(b))throw Error(y(a,2,!0)+'was an invalid key: "'+b+'".  Firebase keys must be non-empty strings and can\'t contain ".", "#", "$", "/", "[", or "]").');}function Ha(a,b){if(!q(b)||0===b.length||xa.test(b))throw Error(y(a,1,!1)+'was an invalid path: "'+b+'". Paths must be non-empty strings and can\'t contain ".", "#", "$", "[", or "]"');}function B(a,b){if(".info"===C(b))throw Error(a+" failed: Can't modify data under /.info/");};function D(a,b,c,d,e,f,g){this.m=a;this.path=b;this.Ea=c;this.fa=d;this.ya=e;this.Ca=f;this.Wa=g;if(n(this.fa)&&n(this.Ca)&&n(this.Ea))throw"Query: Can't combine startAt(), endAt(), and limit().";}D.prototype.Uc=function(){x("Query.ref",0,0,arguments.length);return new E(this.m,this.path)};D.prototype.ref=D.prototype.Uc;
D.prototype.fb=function(a,b){x("Query.on",2,4,arguments.length);Fa("Query.on",a,!1);z("Query.on",2,b,!1);var c=Ia("Query.on",arguments[2],arguments[3]);this.m.Rb(this,a,b,c.cancel,c.Y);return b};D.prototype.on=D.prototype.fb;D.prototype.yb=function(a,b,c){x("Query.off",0,3,arguments.length);Fa("Query.off",a,!0);z("Query.off",2,b,!0);ua("Query.off",3,c);this.m.lc(this,a,b,c)};D.prototype.off=D.prototype.yb;
D.prototype.Wd=function(a,b){function c(g){f&&(f=!1,e.yb(a,c),b.call(d.Y,g))}x("Query.once",2,4,arguments.length);Fa("Query.once",a,!1);z("Query.once",2,b,!1);var d=Ia("Query.once",arguments[2],arguments[3]),e=this,f=!0;this.fb(a,c,function(b){e.yb(a,c);d.cancel&&d.cancel.call(d.Y,b)})};D.prototype.once=D.prototype.Wd;
D.prototype.Pd=function(a){x("Query.limit",1,1,arguments.length);if(!fa(a)||Math.floor(a)!==a||0>=a)throw"Query.limit: First argument must be a positive integer.";return new D(this.m,this.path,a,this.fa,this.ya,this.Ca,this.Wa)};D.prototype.limit=D.prototype.Pd;D.prototype.ee=function(a,b){x("Query.startAt",0,2,arguments.length);Ea("Query.startAt",1,a,!0);Ga("Query.startAt",b);n(a)||(b=a=null);return new D(this.m,this.path,this.Ea,a,b,this.Ca,this.Wa)};D.prototype.startAt=D.prototype.ee;
D.prototype.Jd=function(a,b){x("Query.endAt",0,2,arguments.length);Ea("Query.endAt",1,a,!0);Ga("Query.endAt",b);return new D(this.m,this.path,this.Ea,this.fa,this.ya,a,b)};D.prototype.endAt=D.prototype.Jd;function Ja(a){var b={};n(a.fa)&&(b.sp=a.fa);n(a.ya)&&(b.sn=a.ya);n(a.Ca)&&(b.ep=a.Ca);n(a.Wa)&&(b.en=a.Wa);n(a.Ea)&&(b.l=a.Ea);n(a.fa)&&n(a.ya)&&null===a.fa&&null===a.ya&&(b.vf="l");return b}D.prototype.Pa=function(){var a=Ka(Ja(this));return"{}"===a?"default":a};
function Ia(a,b,c){var d={};if(b&&c)d.cancel=b,z(a,3,d.cancel,!0),d.Y=c,ua(a,4,d.Y);else if(b)if("object"===typeof b&&null!==b)d.Y=b;else if("function"===typeof b)d.cancel=b;else throw Error(sa.je(a,3,!0)+"must either be a cancel callback or a context object.");return d};function F(a,b){if(1==arguments.length){this.n=a.split("/");for(var c=0,d=0;d<this.n.length;d++)0<this.n[d].length&&(this.n[c]=this.n[d],c++);this.n.length=c;this.da=0}else this.n=a,this.da=b}function C(a){return a.da>=a.n.length?null:a.n[a.da]}function La(a){var b=a.da;b<a.n.length&&b++;return new F(a.n,b)}function Ma(a){return a.da<a.n.length?a.n[a.n.length-1]:null}h=F.prototype;h.toString=function(){for(var a="",b=this.da;b<this.n.length;b++)""!==this.n[b]&&(a+="/"+this.n[b]);return a||"/"};
h.parent=function(){if(this.da>=this.n.length)return null;for(var a=[],b=this.da;b<this.n.length-1;b++)a.push(this.n[b]);return new F(a,0)};h.G=function(a){for(var b=[],c=this.da;c<this.n.length;c++)b.push(this.n[c]);if(a instanceof F)for(c=a.da;c<a.n.length;c++)b.push(a.n[c]);else for(a=a.split("/"),c=0;c<a.length;c++)0<a[c].length&&b.push(a[c]);return new F(b,0)};h.f=function(){return this.da>=this.n.length};
function Na(a,b){var c=C(a);if(null===c)return b;if(c===C(b))return Na(La(a),La(b));throw"INTERNAL ERROR: innerPath ("+b+") is not within outerPath ("+a+")";}h.contains=function(a){var b=0;if(this.n.length>a.n.length)return!1;for(;b<this.n.length;){if(this.n[b]!==a.n[b])return!1;++b}return!0};function Oa(){this.children={};this.yc=0;this.value=null}function Pa(a,b,c){this.Fa=a?a:"";this.Eb=b?b:null;this.B=c?c:new Oa}function I(a,b){for(var c=b instanceof F?b:new F(b),d=a,e;null!==(e=C(c));)d=new Pa(e,d,va(d.B.children,e)||new Oa),c=La(c);return d}h=Pa.prototype;h.j=function(){return this.B.value};function J(a,b){v("undefined"!==typeof b,"Cannot set value to undefined");a.B.value=b;Qa(a)}h.sb=function(){return 0<this.B.yc};h.f=function(){return null===this.j()&&!this.sb()};
h.A=function(a){for(var b in this.B.children)a(new Pa(b,this,this.B.children[b]))};function Ra(a,b,c,d){c&&!d&&b(a);a.A(function(a){Ra(a,b,!0,d)});c&&d&&b(a)}function Sa(a,b,c){for(a=c?a:a.parent();null!==a;){if(b(a))return!0;a=a.parent()}return!1}h.path=function(){return new F(null===this.Eb?this.Fa:this.Eb.path()+"/"+this.Fa)};h.name=function(){return this.Fa};h.parent=function(){return this.Eb};
function Qa(a){if(null!==a.Eb){var b=a.Eb,c=a.Fa,d=a.f(),e=A(b.B.children,c);d&&e?(delete b.B.children[c],b.B.yc--,Qa(b)):d||e||(b.B.children[c]=a.B,b.B.yc++,Qa(b))}};function Ta(a,b){this.Ta=a?a:Ua;this.ea=b?b:Va}function Ua(a,b){return a<b?-1:a>b?1:0}h=Ta.prototype;h.sa=function(a,b){return new Ta(this.Ta,this.ea.sa(a,b,this.Ta).J(null,null,!1,null,null))};h.remove=function(a){return new Ta(this.Ta,this.ea.remove(a,this.Ta).J(null,null,!1,null,null))};h.get=function(a){for(var b,c=this.ea;!c.f();){b=this.Ta(a,c.key);if(0===b)return c.value;0>b?c=c.left:0<b&&(c=c.right)}return null};
function Wa(a,b){for(var c,d=a.ea,e=null;!d.f();){c=a.Ta(b,d.key);if(0===c){if(d.left.f())return e?e.key:null;for(d=d.left;!d.right.f();)d=d.right;return d.key}0>c?d=d.left:0<c&&(e=d,d=d.right)}throw Error("Attempted to find predecessor key for a nonexistent key.  What gives?");}h.f=function(){return this.ea.f()};h.count=function(){return this.ea.count()};h.xb=function(){return this.ea.xb()};h.bb=function(){return this.ea.bb()};h.Da=function(a){return this.ea.Da(a)};h.Qa=function(a){return this.ea.Qa(a)};
h.Za=function(a){return new Xa(this.ea,a)};function Xa(a,b){this.ud=b;for(this.Zb=[];!a.f();)this.Zb.push(a),a=a.left}function Ya(a){if(0===a.Zb.length)return null;var b=a.Zb.pop(),c;c=a.ud?a.ud(b.key,b.value):{key:b.key,value:b.value};for(b=b.right;!b.f();)a.Zb.push(b),b=b.left;return c}function Za(a,b,c,d,e){this.key=a;this.value=b;this.color=null!=c?c:!0;this.left=null!=d?d:Va;this.right=null!=e?e:Va}h=Za.prototype;
h.J=function(a,b,c,d,e){return new Za(null!=a?a:this.key,null!=b?b:this.value,null!=c?c:this.color,null!=d?d:this.left,null!=e?e:this.right)};h.count=function(){return this.left.count()+1+this.right.count()};h.f=function(){return!1};h.Da=function(a){return this.left.Da(a)||a(this.key,this.value)||this.right.Da(a)};h.Qa=function(a){return this.right.Qa(a)||a(this.key,this.value)||this.left.Qa(a)};function bb(a){return a.left.f()?a:bb(a.left)}h.xb=function(){return bb(this).key};
h.bb=function(){return this.right.f()?this.key:this.right.bb()};h.sa=function(a,b,c){var d,e;e=this;d=c(a,e.key);e=0>d?e.J(null,null,null,e.left.sa(a,b,c),null):0===d?e.J(null,b,null,null,null):e.J(null,null,null,null,e.right.sa(a,b,c));return cb(e)};function db(a){if(a.left.f())return Va;a.left.Q()||a.left.left.Q()||(a=eb(a));a=a.J(null,null,null,db(a.left),null);return cb(a)}
h.remove=function(a,b){var c,d;c=this;if(0>b(a,c.key))c.left.f()||c.left.Q()||c.left.left.Q()||(c=eb(c)),c=c.J(null,null,null,c.left.remove(a,b),null);else{c.left.Q()&&(c=fb(c));c.right.f()||c.right.Q()||c.right.left.Q()||(c=gb(c),c.left.left.Q()&&(c=fb(c),c=gb(c)));if(0===b(a,c.key)){if(c.right.f())return Va;d=bb(c.right);c=c.J(d.key,d.value,null,null,db(c.right))}c=c.J(null,null,null,null,c.right.remove(a,b))}return cb(c)};h.Q=function(){return this.color};
function cb(a){a.right.Q()&&!a.left.Q()&&(a=hb(a));a.left.Q()&&a.left.left.Q()&&(a=fb(a));a.left.Q()&&a.right.Q()&&(a=gb(a));return a}function eb(a){a=gb(a);a.right.left.Q()&&(a=a.J(null,null,null,null,fb(a.right)),a=hb(a),a=gb(a));return a}function hb(a){return a.right.J(null,null,a.color,a.J(null,null,!0,null,a.right.left),null)}function fb(a){return a.left.J(null,null,a.color,null,a.J(null,null,!0,a.left.right,null))}
function gb(a){return a.J(null,null,!a.color,a.left.J(null,null,!a.left.color,null,null),a.right.J(null,null,!a.right.color,null,null))}function ib(){}h=ib.prototype;h.J=function(){return this};h.sa=function(a,b){return new Za(a,b,null)};h.remove=function(){return this};h.count=function(){return 0};h.f=function(){return!0};h.Da=function(){return!1};h.Qa=function(){return!1};h.xb=function(){return null};h.bb=function(){return null};h.Q=function(){return!1};var Va=new ib;function jb(a){this.Ub=a;this.hc="firebase:"}jb.prototype.set=function(a,b){null==b?this.Ub.removeItem(this.hc+a):this.Ub.setItem(this.hc+a,u(b))};jb.prototype.get=function(a){a=this.Ub.getItem(this.hc+a);return null==a?null:qa(a)};jb.prototype.remove=function(a){this.Ub.removeItem(this.hc+a)};jb.prototype.nd=!1;function kb(){this.nb={}}kb.prototype.set=function(a,b){null==b?delete this.nb[a]:this.nb[a]=b};kb.prototype.get=function(a){return A(this.nb,a)?this.nb[a]:null};kb.prototype.remove=function(a){delete this.nb[a]};kb.prototype.nd=!0;function lb(a){try{if("undefined"!==typeof window&&"undefined"!==typeof window[a]){var b=window[a];b.setItem("firebase:sentinel","cache");b.removeItem("firebase:sentinel");return new jb(b)}}catch(c){}return new kb}var mb=lb("localStorage"),nb=lb("sessionStorage");function ob(a,b,c,d){this.host=a.toLowerCase();this.domain=this.host.substr(this.host.indexOf(".")+1);this.nc=b;this.Yb=c;this.ge=d;this.ha=mb.get("host:"+a)||this.host}function pb(a,b){b!==a.ha&&(a.ha=b,"s-"===a.ha.substr(0,2)&&mb.set("host:"+a.host,a.ha))}ob.prototype.toString=function(){return(this.nc?"https://":"http://")+this.host};function qb(){this.qa=-1};function rb(){this.qa=-1;this.qa=64;this.C=[];this.xc=[];this.Ed=[];this.ec=[];this.ec[0]=128;for(var a=1;a<this.qa;++a)this.ec[a]=0;this.rc=this.$a=0;this.reset()}ja(rb,qb);rb.prototype.reset=function(){this.C[0]=1732584193;this.C[1]=4023233417;this.C[2]=2562383102;this.C[3]=271733878;this.C[4]=3285377520;this.rc=this.$a=0};
function sb(a,b,c){c||(c=0);var d=a.Ed;if(q(b))for(var e=0;16>e;e++)d[e]=b.charCodeAt(c)<<24|b.charCodeAt(c+1)<<16|b.charCodeAt(c+2)<<8|b.charCodeAt(c+3),c+=4;else for(e=0;16>e;e++)d[e]=b[c]<<24|b[c+1]<<16|b[c+2]<<8|b[c+3],c+=4;for(e=16;80>e;e++){var f=d[e-3]^d[e-8]^d[e-14]^d[e-16];d[e]=(f<<1|f>>>31)&4294967295}b=a.C[0];c=a.C[1];for(var g=a.C[2],k=a.C[3],l=a.C[4],m,e=0;80>e;e++)40>e?20>e?(f=k^c&(g^k),m=1518500249):(f=c^g^k,m=1859775393):60>e?(f=c&g|k&(c|g),m=2400959708):(f=c^g^k,m=3395469782),f=(b<<
5|b>>>27)+f+l+m+d[e]&4294967295,l=k,k=g,g=(c<<30|c>>>2)&4294967295,c=b,b=f;a.C[0]=a.C[0]+b&4294967295;a.C[1]=a.C[1]+c&4294967295;a.C[2]=a.C[2]+g&4294967295;a.C[3]=a.C[3]+k&4294967295;a.C[4]=a.C[4]+l&4294967295}
rb.prototype.update=function(a,b){n(b)||(b=a.length);for(var c=b-this.qa,d=0,e=this.xc,f=this.$a;d<b;){if(0==f)for(;d<=c;)sb(this,a,d),d+=this.qa;if(q(a))for(;d<b;){if(e[f]=a.charCodeAt(d),++f,++d,f==this.qa){sb(this,e);f=0;break}}else for(;d<b;)if(e[f]=a[d],++f,++d,f==this.qa){sb(this,e);f=0;break}}this.$a=f;this.rc+=b};var tb=Array.prototype,ub=tb.forEach?function(a,b,c){tb.forEach.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=q(a)?a.split(""):a,f=0;f<d;f++)f in e&&b.call(c,e[f],f,a)},vb=tb.map?function(a,b,c){return tb.map.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=Array(d),f=q(a)?a.split(""):a,g=0;g<d;g++)g in f&&(e[g]=b.call(c,f[g],g,a));return e},wb=tb.reduce?function(a,b,c,d){d&&(b=r(b,d));return tb.reduce.call(a,b,c)}:function(a,b,c,d){var e=c;ub(a,function(c,g){e=b.call(d,e,c,g,a)});return e},
xb=tb.every?function(a,b,c){return tb.every.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=q(a)?a.split(""):a,f=0;f<d;f++)if(f in e&&!b.call(c,e[f],f,a))return!1;return!0};function yb(a,b){var c;a:{c=a.length;for(var d=q(a)?a.split(""):a,e=0;e<c;e++)if(e in d&&b.call(void 0,d[e],e,a)){c=e;break a}c=-1}return 0>c?null:q(a)?a.charAt(c):a[c]};var zb;a:{var Ab=aa.navigator;if(Ab){var Bb=Ab.userAgent;if(Bb){zb=Bb;break a}}zb=""}function Cb(a){return-1!=zb.indexOf(a)};var Db=Cb("Opera")||Cb("OPR"),Eb=Cb("Trident")||Cb("MSIE"),Fb=Cb("Gecko")&&-1==zb.toLowerCase().indexOf("webkit")&&!(Cb("Trident")||Cb("MSIE")),Gb=-1!=zb.toLowerCase().indexOf("webkit");(function(){var a="",b;if(Db&&aa.opera)return a=aa.opera.version,"function"==da(a)?a():a;Fb?b=/rv\:([^\);]+)(\)|;)/:Eb?b=/\b(?:MSIE|rv)[: ]([^\);]+)(\)|;)/:Gb&&(b=/WebKit\/(\S+)/);b&&(a=(a=b.exec(zb))?a[1]:"");return Eb&&(b=(b=aa.document)?b.documentMode:void 0,b>parseFloat(a))?String(b):a})();var Hb=null,Ib=null;
function Jb(a,b){if(!ea(a))throw Error("encodeByteArray takes an array as a parameter");if(!Hb){Hb={};Ib={};for(var c=0;65>c;c++)Hb[c]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(c),Ib[c]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.".charAt(c)}for(var c=b?Ib:Hb,d=[],e=0;e<a.length;e+=3){var f=a[e],g=e+1<a.length,k=g?a[e+1]:0,l=e+2<a.length,m=l?a[e+2]:0,p=f>>2,f=(f&3)<<4|k>>4,k=(k&15)<<2|m>>6,m=m&63;l||(m=64,g||(k=64));d.push(c[p],c[f],c[k],c[m])}return d.join("")}
;var Kb=function(){var a=1;return function(){return a++}}();function v(a,b){if(!a)throw Error("Firebase INTERNAL ASSERT FAILED:"+b);}function Lb(a){var b=ra(a);a=new rb;a.update(b);var b=[],c=8*a.rc;56>a.$a?a.update(a.ec,56-a.$a):a.update(a.ec,a.qa-(a.$a-56));for(var d=a.qa-1;56<=d;d--)a.xc[d]=c&255,c/=256;sb(a,a.xc);for(d=c=0;5>d;d++)for(var e=24;0<=e;e-=8)b[c]=a.C[d]>>e&255,++c;return Jb(b)}
function Mb(a){for(var b="",c=0;c<arguments.length;c++)b=ea(arguments[c])?b+Mb.apply(null,arguments[c]):"object"===typeof arguments[c]?b+u(arguments[c]):b+arguments[c],b+=" ";return b}var Nb=null,Ob=!0;function K(a){!0===Ob&&(Ob=!1,null===Nb&&!0===nb.get("logging_enabled")&&Pb(!0));if(Nb){var b=Mb.apply(null,arguments);Nb(b)}}function Qb(a){return function(){K(a,arguments)}}
function Rb(a){if("undefined"!==typeof console){var b="FIREBASE INTERNAL ERROR: "+Mb.apply(null,arguments);"undefined"!==typeof console.error?console.error(b):console.log(b)}}function Sb(a){var b=Mb.apply(null,arguments);throw Error("FIREBASE FATAL ERROR: "+b);}function L(a){if("undefined"!==typeof console){var b="FIREBASE WARNING: "+Mb.apply(null,arguments);"undefined"!==typeof console.warn?console.warn(b):console.log(b)}}
function Ca(a){return fa(a)&&(a!=a||a==Number.POSITIVE_INFINITY||a==Number.NEGATIVE_INFINITY)}function Tb(a){if("complete"===document.readyState)a();else{var b=!1,c=function(){document.body?b||(b=!0,a()):setTimeout(c,10)};document.addEventListener?(document.addEventListener("DOMContentLoaded",c,!1),window.addEventListener("load",c,!1)):document.attachEvent&&(document.attachEvent("onreadystatechange",function(){"complete"===document.readyState&&c()}),window.attachEvent("onload",c))}}
function Ub(a,b){return a!==b?null===a?-1:null===b?1:typeof a!==typeof b?"number"===typeof a?-1:1:a>b?1:-1:0}function Vb(a,b){if(a===b)return 0;var c=Wb(a),d=Wb(b);return null!==c?null!==d?0==c-d?a.length-b.length:c-d:-1:null!==d?1:a<b?-1:1}function Xb(a,b){if(b&&a in b)return b[a];throw Error("Missing required key ("+a+") in object: "+u(b));}
function Ka(a){if("object"!==typeof a||null===a)return u(a);var b=[],c;for(c in a)b.push(c);b.sort();c="{";for(var d=0;d<b.length;d++)0!==d&&(c+=","),c+=u(b[d]),c+=":",c+=Ka(a[b[d]]);return c+"}"}function Yb(a,b){if(a.length<=b)return[a];for(var c=[],d=0;d<a.length;d+=b)d+b>a?c.push(a.substring(d,a.length)):c.push(a.substring(d,d+b));return c}function Zb(a,b){if("array"==da(a))for(var c=0;c<a.length;++c)b(c,a[c]);else $b(a,b)}function ac(a,b){return b?r(a,b):a}
function bc(a){v(!Ca(a),"Invalid JSON number");var b,c,d,e;0===a?(d=c=0,b=-Infinity===1/a?1:0):(b=0>a,a=Math.abs(a),a>=Math.pow(2,-1022)?(d=Math.min(Math.floor(Math.log(a)/Math.LN2),1023),c=d+1023,d=Math.round(a*Math.pow(2,52-d)-Math.pow(2,52))):(c=0,d=Math.round(a/Math.pow(2,-1074))));e=[];for(a=52;a;a-=1)e.push(d%2?1:0),d=Math.floor(d/2);for(a=11;a;a-=1)e.push(c%2?1:0),c=Math.floor(c/2);e.push(b?1:0);e.reverse();b=e.join("");c="";for(a=0;64>a;a+=8)d=parseInt(b.substr(a,8),2).toString(16),1===d.length&&
(d="0"+d),c+=d;return c.toLowerCase()}function cc(a){var b="Unknown Error";"too_big"===a?b="The data requested exceeds the maximum size that can be accessed with a single request.":"permission_denied"==a?b="Client doesn't have permission to access the desired data.":"unavailable"==a&&(b="The service is unavailable");b=Error(a+": "+b);b.code=a.toUpperCase();return b}var dc=/^-?\d{1,10}$/;function Wb(a){return dc.test(a)&&(a=Number(a),-2147483648<=a&&2147483647>=a)?a:null}
function ec(a){try{a()}catch(b){setTimeout(function(){throw b;},0)}};function fc(a,b){this.F=a;v(null!==this.F,"LeafNode shouldn't be created with null value.");this.gb="undefined"!==typeof b?b:null}h=fc.prototype;h.P=function(){return!0};h.k=function(){return this.gb};h.Ia=function(a){return new fc(this.F,a)};h.O=function(){return M};h.L=function(a){return null===C(a)?this:M};h.ga=function(){return null};h.H=function(a,b){return(new N).H(a,b).Ia(this.gb)};h.Aa=function(a,b){var c=C(a);return null===c?b:this.H(c,M.Aa(La(a),b))};h.f=function(){return!1};h.$b=function(){return 0};
h.V=function(a){return a&&null!==this.k()?{".value":this.j(),".priority":this.k()}:this.j()};h.hash=function(){var a="";null!==this.k()&&(a+="priority:"+gc(this.k())+":");var b=typeof this.F,a=a+(b+":"),a="number"===b?a+bc(this.F):a+this.F;return Lb(a)};h.j=function(){return this.F};h.toString=function(){return"string"===typeof this.F?this.F:'"'+this.F+'"'};function ic(a,b){return Ub(a.ka,b.ka)||Vb(a.name,b.name)}function jc(a,b){return Vb(a.name,b.name)}function kc(a,b){return Vb(a,b)};function N(a,b){this.o=a||new Ta(kc);this.gb="undefined"!==typeof b?b:null}h=N.prototype;h.P=function(){return!1};h.k=function(){return this.gb};h.Ia=function(a){return new N(this.o,a)};h.H=function(a,b){var c=this.o.remove(a);b&&b.f()&&(b=null);null!==b&&(c=c.sa(a,b));return b&&null!==b.k()?new lc(c,null,this.gb):new N(c,this.gb)};h.Aa=function(a,b){var c=C(a);if(null===c)return b;var d=this.O(c).Aa(La(a),b);return this.H(c,d)};h.f=function(){return this.o.f()};h.$b=function(){return this.o.count()};
var mc=/^\d+$/;h=N.prototype;h.V=function(a){if(this.f())return null;var b={},c=0,d=0,e=!0;this.A(function(f,g){b[f]=g.V(a);c++;e&&mc.test(f)?d=Math.max(d,Number(f)):e=!1});if(!a&&e&&d<2*c){var f=[],g;for(g in b)f[g]=b[g];return f}a&&null!==this.k()&&(b[".priority"]=this.k());return b};h.hash=function(){var a="";null!==this.k()&&(a+="priority:"+gc(this.k())+":");this.A(function(b,c){var d=c.hash();""!==d&&(a+=":"+b+":"+d)});return""===a?"":Lb(a)};
h.O=function(a){a=this.o.get(a);return null===a?M:a};h.L=function(a){var b=C(a);return null===b?this:this.O(b).L(La(a))};h.ga=function(a){return Wa(this.o,a)};h.hd=function(){return this.o.xb()};h.kd=function(){return this.o.bb()};h.A=function(a){return this.o.Da(a)};h.Ec=function(a){return this.o.Qa(a)};h.Za=function(){return this.o.Za()};h.toString=function(){var a="{",b=!0;this.A(function(c,d){b?b=!1:a+=", ";a+='"'+c+'" : '+d.toString()});return a+="}"};var M=new N;function lc(a,b,c){N.call(this,a,c);null===b&&(b=new Ta(ic),a.Da(function(a,c){b=b.sa({name:a,ka:c.k()},c)}));this.xa=b}ja(lc,N);h=lc.prototype;h.H=function(a,b){var c=this.O(a),d=this.o,e=this.xa;null!==c&&(d=d.remove(a),e=e.remove({name:a,ka:c.k()}));b&&b.f()&&(b=null);null!==b&&(d=d.sa(a,b),e=e.sa({name:a,ka:b.k()},b));return new lc(d,e,this.k())};h.ga=function(a,b){var c=Wa(this.xa,{name:a,ka:b.k()});return c?c.name:null};h.A=function(a){return this.xa.Da(function(b,c){return a(b.name,c)})};
h.Ec=function(a){return this.xa.Qa(function(b,c){return a(b.name,c)})};h.Za=function(){return this.xa.Za(function(a,b){return{key:a.name,value:b}})};h.hd=function(){return this.xa.f()?null:this.xa.xb().name};h.kd=function(){return this.xa.f()?null:this.xa.bb().name};function O(a,b){if(null===a)return M;var c=null;"object"===typeof a&&".priority"in a?c=a[".priority"]:"undefined"!==typeof b&&(c=b);v(null===c||"string"===typeof c||"number"===typeof c||"object"===typeof c&&".sv"in c,"Invalid priority type found: "+typeof c);"object"===typeof a&&".value"in a&&null!==a[".value"]&&(a=a[".value"]);if("object"!==typeof a||".sv"in a)return new fc(a,c);if(a instanceof Array){var d=M,e=a;$b(e,function(a,b){if(A(e,b)&&"."!==b.substring(0,1)){var c=O(a);if(c.P()||!c.f())d=
d.H(b,c)}});return d.Ia(c)}var f=[],g={},k=!1,l=a;Zb(l,function(a,b){if("string"!==typeof b||"."!==b.substring(0,1)){var c=O(l[b]);c.f()||(k=k||null!==c.k(),f.push({name:b,ka:c.k()}),g[b]=c)}});var m=nc(f,g,!1);if(k){var p=nc(f,g,!0);return new lc(m,p,c)}return new N(m,c)}var oc=Math.log(2);function pc(a){this.count=parseInt(Math.log(a+1)/oc,10);this.ed=this.count-1;this.Gd=a+1&parseInt(Array(this.count+1).join("1"),2)}function qc(a){var b=!(a.Gd&1<<a.ed);a.ed--;return b}
function nc(a,b,c){function d(e,f){var l=f-e;if(0==l)return null;if(1==l){var l=a[e].name,m=c?a[e]:l;return new Za(m,b[l],!1,null,null)}var m=parseInt(l/2,10)+e,p=d(e,m),t=d(m+1,f),l=a[m].name,m=c?a[m]:l;return new Za(m,b[l],!1,p,t)}var e=c?ic:jc;a.sort(e);var f=function(e){function f(e,g){var k=p-e,t=p;p-=e;var s=a[k].name,k=new Za(c?a[k]:s,b[s],g,null,d(k+1,t));l?l.left=k:m=k;l=k}for(var l=null,m=null,p=a.length,t=0;t<e.count;++t){var s=qc(e),w=Math.pow(2,e.count-(t+1));s?f(w,!1):(f(w,!1),f(w,!0))}return m}(new pc(a.length)),
e=c?ic:kc;return null!==f?new Ta(e,f):new Ta(e)}function gc(a){return"number"===typeof a?"number:"+bc(a):"string:"+a};function P(a,b){this.B=a;this.kc=b}P.prototype.V=function(){x("Firebase.DataSnapshot.val",0,0,arguments.length);return this.B.V()};P.prototype.val=P.prototype.V;P.prototype.Kd=function(){x("Firebase.DataSnapshot.exportVal",0,0,arguments.length);return this.B.V(!0)};P.prototype.exportVal=P.prototype.Kd;P.prototype.G=function(a){x("Firebase.DataSnapshot.child",0,1,arguments.length);fa(a)&&(a=String(a));Ha("Firebase.DataSnapshot.child",a);var b=new F(a),c=this.kc.G(b);return new P(this.B.L(b),c)};
P.prototype.child=P.prototype.G;P.prototype.Hc=function(a){x("Firebase.DataSnapshot.hasChild",1,1,arguments.length);Ha("Firebase.DataSnapshot.hasChild",a);var b=new F(a);return!this.B.L(b).f()};P.prototype.hasChild=P.prototype.Hc;P.prototype.k=function(){x("Firebase.DataSnapshot.getPriority",0,0,arguments.length);return this.B.k()};P.prototype.getPriority=P.prototype.k;
P.prototype.forEach=function(a){x("Firebase.DataSnapshot.forEach",1,1,arguments.length);z("Firebase.DataSnapshot.forEach",1,a,!1);if(this.B.P())return!1;var b=this;return this.B.A(function(c,d){return a(new P(d,b.kc.G(c)))})};P.prototype.forEach=P.prototype.forEach;P.prototype.sb=function(){x("Firebase.DataSnapshot.hasChildren",0,0,arguments.length);return this.B.P()?!1:!this.B.f()};P.prototype.hasChildren=P.prototype.sb;
P.prototype.name=function(){x("Firebase.DataSnapshot.name",0,0,arguments.length);return this.kc.name()};P.prototype.name=P.prototype.name;P.prototype.$b=function(){x("Firebase.DataSnapshot.numChildren",0,0,arguments.length);return this.B.$b()};P.prototype.numChildren=P.prototype.$b;P.prototype.Uc=function(){x("Firebase.DataSnapshot.ref",0,0,arguments.length);return this.kc};P.prototype.ref=P.prototype.Uc;function rc(a){v("array"==da(a)&&0<a.length,"Requires a non-empty array");this.Fd=a;this.wb={}}rc.prototype.bd=function(a,b){for(var c=this.wb[a]||[],d=0;d<c.length;d++)c[d].ba.apply(c[d].Y,Array.prototype.slice.call(arguments,1))};rc.prototype.fb=function(a,b,c){sc(this,a);this.wb[a]=this.wb[a]||[];this.wb[a].push({ba:b,Y:c});(a=this.jd(a))&&b.apply(c,a)};rc.prototype.yb=function(a,b,c){sc(this,a);a=this.wb[a]||[];for(var d=0;d<a.length;d++)if(a[d].ba===b&&(!c||c===a[d].Y)){a.splice(d,1);break}};
function sc(a,b){v(yb(a.Fd,function(a){return a===b}),"Unknown event: "+b)};function tc(){rc.call(this,["visible"]);var a,b;"undefined"!==typeof document&&"undefined"!==typeof document.addEventListener&&("undefined"!==typeof document.hidden?(b="visibilitychange",a="hidden"):"undefined"!==typeof document.mozHidden?(b="mozvisibilitychange",a="mozHidden"):"undefined"!==typeof document.msHidden?(b="msvisibilitychange",a="msHidden"):"undefined"!==typeof document.webkitHidden&&(b="webkitvisibilitychange",a="webkitHidden"));this.lb=!0;if(b){var c=this;document.addEventListener(b,
function(){var b=!document[a];b!==c.lb&&(c.lb=b,c.bd("visible",b))},!1)}}ja(tc,rc);ca(tc);tc.prototype.jd=function(a){v("visible"===a,"Unknown event type: "+a);return[this.lb]};function uc(){rc.call(this,["online"]);this.Cb=!0;if("undefined"!==typeof window&&"undefined"!==typeof window.addEventListener){var a=this;window.addEventListener("online",function(){a.Cb||a.bd("online",!0);a.Cb=!0},!1);window.addEventListener("offline",function(){a.Cb&&a.bd("online",!1);a.Cb=!1},!1)}}ja(uc,rc);ca(uc);uc.prototype.jd=function(a){v("online"===a,"Unknown event type: "+a);return[this.Cb]};function $b(a,b){for(var c in a)b.call(void 0,a[c],c,a)}function vc(a){var b=[],c=0,d;for(d in a)b[c++]=d;return b}function wc(a){var b={},c;for(c in a)b[c]=a[c];return b};function xc(){this.ob={}}function yc(a,b,c){n(c)||(c=1);A(a.ob,b)||(a.ob[b]=0);a.ob[b]+=c}xc.prototype.get=function(){return wc(this.ob)};function zc(a){this.Hd=a;this.Wb=null}zc.prototype.get=function(){var a=this.Hd.get(),b=wc(a);if(this.Wb)for(var c in this.Wb)b[c]-=this.Wb[c];this.Wb=a;return b};function Ac(a,b){this.Zc={};this.qc=new zc(a);this.u=b;setTimeout(r(this.sd,this),10+6E4*Math.random())}Ac.prototype.sd=function(){var a=this.qc.get(),b={},c=!1,d;for(d in a)0<a[d]&&A(this.Zc,d)&&(b[d]=a[d],c=!0);c&&(a=this.u,a.S&&(b={c:b},a.e("reportStats",b),a.Ga("s",b)));setTimeout(r(this.sd,this),6E5*Math.random())};var Bc={},Cc={};function Dc(a){a=a.toString();Bc[a]||(Bc[a]=new xc);return Bc[a]}function Ec(a,b){var c=a.toString();Cc[c]||(Cc[c]=b());return Cc[c]};var Fc=null;"undefined"!==typeof MozWebSocket?Fc=MozWebSocket:"undefined"!==typeof WebSocket&&(Fc=WebSocket);function Q(a,b,c){this.Ac=a;this.e=Qb(this.Ac);this.frames=this.ub=null;this.ad=0;this.aa=Dc(b);this.Ua=(b.nc?"wss://":"ws://")+b.ha+"/.ws?v=5";b.host!==b.ha&&(this.Ua=this.Ua+"&ns="+b.Yb);c&&(this.Ua=this.Ua+"&s="+c)}var Gc;
Q.prototype.open=function(a,b){this.ja=b;this.Td=a;this.e("Websocket connecting to "+this.Ua);this.W=new Fc(this.Ua);this.pb=!1;mb.set("previous_websocket_failure",!0);var c=this;this.W.onopen=function(){c.e("Websocket connected.");c.pb=!0};this.W.onclose=function(){c.e("Websocket connection was disconnected.");c.W=null;c.Oa()};this.W.onmessage=function(a){if(null!==c.W)if(a=a.data,yc(c.aa,"bytes_received",a.length),Hc(c),null!==c.frames)Ic(c,a);else{a:{v(null===c.frames,"We already have a frame buffer");
if(6>=a.length){var b=Number(a);if(!isNaN(b)){c.ad=b;c.frames=[];a=null;break a}}c.ad=1;c.frames=[]}null!==a&&Ic(c,a)}};this.W.onerror=function(a){c.e("WebSocket error.  Closing connection.");(a=a.message||a.data)&&c.e(a);c.Oa()}};Q.prototype.start=function(){};Q.isAvailable=function(){var a=!1;if("undefined"!==typeof navigator&&navigator.userAgent){var b=navigator.userAgent.match(/Android ([0-9]{0,}\.[0-9]{0,})/);b&&1<b.length&&4.4>parseFloat(b[1])&&(a=!0)}return!a&&null!==Fc&&!Gc};
Q.responsesRequiredToBeHealthy=2;Q.healthyTimeout=3E4;h=Q.prototype;h.Lc=function(){mb.remove("previous_websocket_failure")};function Ic(a,b){a.frames.push(b);if(a.frames.length==a.ad){var c=a.frames.join("");a.frames=null;c=qa(c);a.Td(c)}}h.send=function(a){Hc(this);a=u(a);yc(this.aa,"bytes_sent",a.length);a=Yb(a,16384);1<a.length&&this.W.send(String(a.length));for(var b=0;b<a.length;b++)this.W.send(a[b])};
h.Mb=function(){this.Ma=!0;this.ub&&(clearInterval(this.ub),this.ub=null);this.W&&(this.W.close(),this.W=null)};h.Oa=function(){this.Ma||(this.e("WebSocket is closing itself"),this.Mb(),this.ja&&(this.ja(this.pb),this.ja=null))};h.close=function(){this.Ma||(this.e("WebSocket is being closed"),this.Mb())};function Hc(a){clearInterval(a.ub);a.ub=setInterval(function(){a.W&&a.W.send("0");Hc(a)},45E3)};function Jc(a){this.Pc=a;this.gc=[];this.Va=0;this.zc=-1;this.Na=null}function Kc(a,b,c){a.zc=b;a.Na=c;a.zc<a.Va&&(a.Na(),a.Na=null)}function Lc(a,b,c){for(a.gc[b]=c;a.gc[a.Va];){var d=a.gc[a.Va];delete a.gc[a.Va];for(var e=0;e<d.length;++e)if(d[e]){var f=a;ec(function(){f.Pc(d[e])})}if(a.Va===a.zc){a.Na&&(clearTimeout(a.Na),a.Na(),a.Na=null);break}a.Va++}};function Mc(){this.set={}}h=Mc.prototype;h.add=function(a,b){this.set[a]=null!==b?b:!0};h.contains=function(a){return A(this.set,a)};h.get=function(a){return this.contains(a)?this.set[a]:void 0};h.remove=function(a){delete this.set[a]};h.f=function(){var a;a:{a=this.set;for(var b in a){a=!1;break a}a=!0}return a};h.count=function(){var a=this.set,b=0,c;for(c in a)b++;return b};function R(a,b){$b(a.set,function(a,d){b(d,a)})}h.keys=function(){var a=[];$b(this.set,function(b,c){a.push(c)});return a};function Nc(a,b,c){this.Ac=a;this.e=Qb(a);this.aa=Dc(b);this.pc=c;this.pb=!1;this.Qb=function(a){b.host!==b.ha&&(a.ns=b.Yb);var c=[],f;for(f in a)a.hasOwnProperty(f)&&c.push(f+"="+a[f]);return(b.nc?"https://":"http://")+b.ha+"/.lp?"+c.join("&")}}var Oc,Pc;
Nc.prototype.open=function(a,b){this.dd=0;this.T=b;this.od=new Jc(a);this.Ma=!1;var c=this;this.Ja=setTimeout(function(){c.e("Timed out trying to connect.");c.Oa();c.Ja=null},3E4);Tb(function(){if(!c.Ma){c.ma=new Qc(function(a,b,d,k,l){yc(c.aa,"bytes_received",u(arguments).length);if(c.ma)if(c.Ja&&(clearTimeout(c.Ja),c.Ja=null),c.pb=!0,"start"==a)c.id=b,c.rd=d;else if("close"===a)b?(c.ma.oc=!1,Kc(c.od,b,function(){c.Oa()})):c.Oa();else throw Error("Unrecognized command received: "+a);},function(a,
b){yc(c.aa,"bytes_received",u(arguments).length);Lc(c.od,a,b)},function(){c.Oa()},c.Qb);var a={start:"t"};a.ser=Math.floor(1E8*Math.random());c.ma.sc&&(a.cb=c.ma.sc);a.v="5";c.pc&&(a.s=c.pc);a=c.Qb(a);c.e("Connecting via long-poll to "+a);Rc(c.ma,a,function(){})}})};
Nc.prototype.start=function(){var a=this.ma,b=this.rd;a.Rd=this.id;a.Sd=b;for(a.vc=!0;Sc(a););a=this.id;b=this.rd;this.eb=document.createElement("iframe");var c={dframe:"t"};c.id=a;c.pw=b;this.eb.src=this.Qb(c);this.eb.style.display="none";document.body.appendChild(this.eb)};Nc.isAvailable=function(){return!Pc&&!("object"===typeof window&&window.chrome&&window.chrome.extension&&!/^chrome/.test(window.location.href))&&!("object"===typeof Windows&&"object"===typeof Windows.he)&&(Oc||!0)};h=Nc.prototype;
h.Lc=function(){};h.Mb=function(){this.Ma=!0;this.ma&&(this.ma.close(),this.ma=null);this.eb&&(document.body.removeChild(this.eb),this.eb=null);this.Ja&&(clearTimeout(this.Ja),this.Ja=null)};h.Oa=function(){this.Ma||(this.e("Longpoll is closing itself"),this.Mb(),this.T&&(this.T(this.pb),this.T=null))};h.close=function(){this.Ma||(this.e("Longpoll is being closed."),this.Mb())};
h.send=function(a){a=u(a);yc(this.aa,"bytes_sent",a.length);a=ra(a);a=Jb(a,!0);a=Yb(a,1840);for(var b=0;b<a.length;b++){var c=this.ma;c.Gb.push({ae:this.dd,fe:a.length,fd:a[b]});c.vc&&Sc(c);this.dd++}};
function Qc(a,b,c,d){this.Qb=d;this.ja=c;this.Rc=new Mc;this.Gb=[];this.Bc=Math.floor(1E8*Math.random());this.oc=!0;this.sc=Kb();window["pLPCommand"+this.sc]=a;window["pRTLPCB"+this.sc]=b;a=document.createElement("iframe");a.style.display="none";if(document.body){document.body.appendChild(a);try{a.contentWindow.document||K("No IE domain setting required")}catch(e){a.src="javascript:void((function(){document.open();document.domain='"+document.domain+"';document.close();})())"}}else throw"Document body has not initialized. Wait to initialize Firebase until after the document is ready.";
a.contentDocument?a.Ba=a.contentDocument:a.contentWindow?a.Ba=a.contentWindow.document:a.document&&(a.Ba=a.document);this.Z=a;a="";this.Z.src&&"javascript:"===this.Z.src.substr(0,11)&&(a='<script>document.domain="'+document.domain+'";\x3c/script>');a="<html><body>"+a+"</body></html>";try{this.Z.Ba.open(),this.Z.Ba.write(a),this.Z.Ba.close()}catch(f){K("frame writing exception"),f.stack&&K(f.stack),K(f)}}
Qc.prototype.close=function(){this.vc=!1;if(this.Z){this.Z.Ba.body.innerHTML="";var a=this;setTimeout(function(){null!==a.Z&&(document.body.removeChild(a.Z),a.Z=null)},0)}var b=this.ja;b&&(this.ja=null,b())};
function Sc(a){if(a.vc&&a.oc&&a.Rc.count()<(0<a.Gb.length?2:1)){a.Bc++;var b={};b.id=a.Rd;b.pw=a.Sd;b.ser=a.Bc;for(var b=a.Qb(b),c="",d=0;0<a.Gb.length;)if(1870>=a.Gb[0].fd.length+30+c.length){var e=a.Gb.shift(),c=c+"&seg"+d+"="+e.ae+"&ts"+d+"="+e.fe+"&d"+d+"="+e.fd;d++}else break;Vc(a,b+c,a.Bc);return!0}return!1}function Vc(a,b,c){function d(){a.Rc.remove(c);Sc(a)}a.Rc.add(c);var e=setTimeout(d,25E3);Rc(a,b,function(){clearTimeout(e);d()})}
function Rc(a,b,c){setTimeout(function(){try{if(a.oc){var d=a.Z.Ba.createElement("script");d.type="text/javascript";d.async=!0;d.src=b;d.onload=d.onreadystatechange=function(){var a=d.readyState;a&&"loaded"!==a&&"complete"!==a||(d.onload=d.onreadystatechange=null,d.parentNode&&d.parentNode.removeChild(d),c())};d.onerror=function(){K("Long-poll script failed to load: "+b);a.oc=!1;a.close()};a.Z.Ba.body.appendChild(d)}}catch(e){}},1)};function Wc(a){Xc(this,a)}var Yc=[Nc,Q];function Xc(a,b){var c=Q&&Q.isAvailable(),d=c&&!(mb.nd||!0===mb.get("previous_websocket_failure"));b.ge&&(c||L("wss:// URL used, but browser isn't known to support websockets.  Trying anyway."),d=!0);if(d)a.Nb=[Q];else{var e=a.Nb=[];Zb(Yc,function(a,b){b&&b.isAvailable()&&e.push(b)})}}function Zc(a){if(0<a.Nb.length)return a.Nb[0];throw Error("No transports available");};function $c(a,b,c,d,e,f){this.id=a;this.e=Qb("c:"+this.id+":");this.Pc=c;this.Bb=d;this.T=e;this.Oc=f;this.N=b;this.fc=[];this.cd=0;this.Ad=new Wc(b);this.na=0;this.e("Connection created");ad(this)}
function ad(a){var b=Zc(a.Ad);a.K=new b("c:"+a.id+":"+a.cd++,a.N);a.Tc=b.responsesRequiredToBeHealthy||0;var c=bd(a,a.K),d=cd(a,a.K);a.Ob=a.K;a.Lb=a.K;a.w=null;a.ab=!1;setTimeout(function(){a.K&&a.K.open(c,d)},0);b=b.healthyTimeout||0;0<b&&(a.Vb=setTimeout(function(){a.Vb=null;a.ab||(a.e("Closing unhealthy connection after timeout."),a.close())},b))}
function cd(a,b){return function(c){b===a.K?(a.K=null,c||0!==a.na?1===a.na&&a.e("Realtime connection lost."):(a.e("Realtime connection failed."),"s-"===a.N.ha.substr(0,2)&&(mb.remove("host:"+a.N.host),a.N.ha=a.N.host)),a.close()):b===a.w?(a.e("Secondary connection lost."),c=a.w,a.w=null,a.Ob!==c&&a.Lb!==c||a.close()):a.e("closing an old connection")}}
function bd(a,b){return function(c){if(2!=a.na)if(b===a.Lb){var d=Xb("t",c);c=Xb("d",c);if("c"==d){if(d=Xb("t",c),"d"in c)if(c=c.d,"h"===d){var d=c.ts,e=c.v,f=c.h;a.pc=c.s;pb(a.N,f);0==a.na&&(a.K.start(),dd(a,a.K,d),"5"!==e&&L("Protocol version mismatch detected"),c=a.Ad,(c=1<c.Nb.length?c.Nb[1]:null)&&ed(a,c))}else if("n"===d){a.e("recvd end transmission on primary");a.Lb=a.w;for(c=0;c<a.fc.length;++c)a.cc(a.fc[c]);a.fc=[];fd(a)}else"s"===d?(a.e("Connection shutdown command received. Shutting down..."),
a.Oc&&(a.Oc(c),a.Oc=null),a.T=null,a.close()):"r"===d?(a.e("Reset packet received.  New host: "+c),pb(a.N,c),1===a.na?a.close():(gd(a),ad(a))):"e"===d?Rb("Server Error: "+c):"o"===d?(a.e("got pong on primary."),hd(a),id(a)):Rb("Unknown control packet command: "+d)}else"d"==d&&a.cc(c)}else if(b===a.w)if(d=Xb("t",c),c=Xb("d",c),"c"==d)"t"in c&&(c=c.t,"a"===c?jd(a):"r"===c?(a.e("Got a reset on secondary, closing it"),a.w.close(),a.Ob!==a.w&&a.Lb!==a.w||a.close()):"o"===c&&(a.e("got pong on secondary."),
a.wd--,jd(a)));else if("d"==d)a.fc.push(c);else throw Error("Unknown protocol layer: "+d);else a.e("message on old connection")}}$c.prototype.xd=function(a){kd(this,{t:"d",d:a})};function fd(a){a.Ob===a.w&&a.Lb===a.w&&(a.e("cleaning up and promoting a connection: "+a.w.Ac),a.K=a.w,a.w=null)}
function jd(a){0>=a.wd?(a.e("Secondary connection is healthy."),a.ab=!0,a.w.Lc(),a.w.start(),a.e("sending client ack on secondary"),a.w.send({t:"c",d:{t:"a",d:{}}}),a.e("Ending transmission on primary"),a.K.send({t:"c",d:{t:"n",d:{}}}),a.Ob=a.w,fd(a)):(a.e("sending ping on secondary."),a.w.send({t:"c",d:{t:"p",d:{}}}))}$c.prototype.cc=function(a){hd(this);this.Pc(a)};function hd(a){a.ab||(a.Tc--,0>=a.Tc&&(a.e("Primary connection is healthy."),a.ab=!0,a.K.Lc()))}
function ed(a,b){a.w=new b("c:"+a.id+":"+a.cd++,a.N,a.pc);a.wd=b.responsesRequiredToBeHealthy||0;a.w.open(bd(a,a.w),cd(a,a.w));setTimeout(function(){a.w&&(a.e("Timed out trying to upgrade."),a.w.close())},6E4)}function dd(a,b,c){a.e("Realtime connection established.");a.K=b;a.na=1;a.Bb&&(a.Bb(c),a.Bb=null);0===a.Tc?(a.e("Primary connection is healthy."),a.ab=!0):setTimeout(function(){id(a)},5E3)}function id(a){a.ab||1!==a.na||(a.e("sending ping on primary."),kd(a,{t:"c",d:{t:"p",d:{}}}))}
function kd(a,b){if(1!==a.na)throw"Connection is not connected";a.Ob.send(b)}$c.prototype.close=function(){2!==this.na&&(this.e("Closing realtime connection."),this.na=2,gd(this),this.T&&(this.T(),this.T=null))};function gd(a){a.e("Shutting down all connections");a.K&&(a.K.close(),a.K=null);a.w&&(a.w.close(),a.w=null);a.Vb&&(clearTimeout(a.Vb),a.Vb=null)};function ld(a,b,c,d,e,f){this.id=md++;this.e=Qb("p:"+this.id+":");this.Ra=!0;this.ia={};this.U=[];this.Db=0;this.Ab=[];this.S=!1;this.ua=1E3;this.Xb=3E5;this.dc=b||ba;this.bc=c||ba;this.zb=d||ba;this.Qc=e||ba;this.Gc=f||ba;this.N=a;this.Vc=null;this.Kb={};this.$d=0;this.vb=this.Kc=null;nd(this,0);tc.rb().fb("visible",this.Vd,this);-1===a.host.indexOf("fblocal")&&uc.rb().fb("online",this.Ud,this)}var md=0,od=0;h=ld.prototype;
h.Ga=function(a,b,c){var d=++this.$d;a={r:d,a:a,b:b};this.e(u(a));v(this.S,"sendRequest_ call when we're not connected not allowed.");this.la.xd(a);c&&(this.Kb[d]=c)};function pd(a,b,c){var d=b.toString(),e=b.path().toString();a.ia[e]=a.ia[e]||{};v(!a.ia[e][d],"listen() called twice for same path/queryId.");a.ia[e][d]={hb:b.hb(),D:c};a.S&&qd(a,e,d,b.hb(),c)}
function qd(a,b,c,d,e){a.e("Listen on "+b+" for "+c);var f={p:b};d=vb(d,function(a){return Ja(a)});"{}"!==c&&(f.q=d);f.h=a.Gc(b);a.Ga("l",f,function(d){a.e("listen response",d);d=d.s;"ok"!==d&&rd(a,b,c);e&&e(d)})}
h.mb=function(a,b,c){this.Ka={Id:a,gd:!1,ba:b,Sb:c};this.e("Authenticating using credential: "+this.Ka);sd(this);if(!(b=40==a.length))a:{var d;try{var e=a.split(".");if(3!==e.length){b=!1;break a}var f;b:{try{if("undefined"!==typeof atob){f=atob(e[1]);break b}}catch(g){K("base64DecodeIfNativeSupport failed: ",g)}f=null}null!==f&&(d=qa(f))}catch(k){K("isAdminAuthToken_ failed",k)}b="object"===typeof d&&!0===va(d,"admin")}b&&(this.e("Admin auth credential detected.  Reducing max reconnect time."),this.Xb=
3E4)};h.Pb=function(a){delete this.Ka;this.zb(!1);this.S&&this.Ga("unauth",{},function(b){a(b.s,b.d)})};function sd(a){var b=a.Ka;a.S&&b&&a.Ga("auth",{cred:b.Id},function(c){var d=c.s;c=c.d||"error";"ok"!==d&&a.Ka===b&&delete a.Ka;a.zb("ok"===d);b.gd?"ok"!==d&&b.Sb&&b.Sb(d,c):(b.gd=!0,b.ba&&b.ba(d,c))})}function td(a,b,c,d){b=b.toString();rd(a,b,c)&&a.S&&ud(a,b,c,d)}function ud(a,b,c,d){a.e("Unlisten on "+b+" for "+c);b={p:b};d=vb(d,function(a){return Ja(a)});"{}"!==c&&(b.q=d);a.Ga("u",b)}
function vd(a,b,c,d){a.S?wd(a,"o",b,c,d):a.Ab.push({Sc:b,action:"o",data:c,D:d})}function xd(a,b,c,d){a.S?wd(a,"om",b,c,d):a.Ab.push({Sc:b,action:"om",data:c,D:d})}h.Nc=function(a,b){this.S?wd(this,"oc",a,null,b):this.Ab.push({Sc:a,action:"oc",data:null,D:b})};function wd(a,b,c,d,e){c={p:c,d:d};a.e("onDisconnect "+b,c);a.Ga(b,c,function(a){e&&setTimeout(function(){e(a.s,a.d)},0)})}h.put=function(a,b,c,d){yd(this,"p",a,b,c,d)};function zd(a,b,c,d){yd(a,"m",b,c,d,void 0)}
function yd(a,b,c,d,e,f){c={p:c,d:d};n(f)&&(c.h=f);a.U.push({action:b,td:c,D:e});a.Db++;b=a.U.length-1;a.S&&Ad(a,b)}function Ad(a,b){var c=a.U[b].action,d=a.U[b].td,e=a.U[b].D;a.U[b].Xd=a.S;a.Ga(c,d,function(d){a.e(c+" response",d);delete a.U[b];a.Db--;0===a.Db&&(a.U=[]);e&&e(d.s,d.d)})}
h.cc=function(a){if("r"in a){this.e("from server: "+u(a));var b=a.r,c=this.Kb[b];c&&(delete this.Kb[b],c(a.b))}else{if("error"in a)throw"A server-side error has occurred: "+a.error;"a"in a&&(b=a.a,c=a.b,this.e("handleServerMessage",b,c),"d"===b?this.dc(c.p,c.d,!1):"m"===b?this.dc(c.p,c.d,!0):"c"===b?Bd(this,c.p,c.q):"ac"===b?(a=c.s,b=c.d,c=this.Ka,delete this.Ka,c&&c.Sb&&c.Sb(a,b),this.zb(!1)):"sd"===b?this.Vc?this.Vc(c):"msg"in c&&"undefined"!==typeof console&&console.log("FIREBASE: "+c.msg.replace("\n",
"\nFIREBASE: ")):Rb("Unrecognized action received from server: "+u(b)+"\nAre you using the latest client?"))}};h.Bb=function(a){this.e("connection ready");this.S=!0;this.vb=(new Date).getTime();this.Qc({serverTimeOffset:a-(new Date).getTime()});sd(this);for(var b in this.ia)for(var c in this.ia[b])a=this.ia[b][c],qd(this,b,c,a.hb,a.D);for(b=0;b<this.U.length;b++)this.U[b]&&Ad(this,b);for(;this.Ab.length;)b=this.Ab.shift(),wd(this,b.action,b.Sc,b.data,b.D);this.bc(!0)};
function nd(a,b){v(!a.la,"Scheduling a connect when we're already connected/ing?");a.Xa&&clearTimeout(a.Xa);a.Xa=setTimeout(function(){a.Xa=null;Cd(a)},b)}h.Vd=function(a){a&&!this.lb&&this.ua===this.Xb&&(this.e("Window became visible.  Reducing delay."),this.ua=1E3,this.la||nd(this,0));this.lb=a};h.Ud=function(a){a?(this.e("Browser went online.  Reconnecting."),this.ua=1E3,this.Ra=!0,this.la||nd(this,0)):(this.e("Browser went offline.  Killing connection; don't reconnect."),this.Ra=!1,this.la&&this.la.close())};
h.pd=function(){this.e("data client disconnected");this.S=!1;this.la=null;for(var a=0;a<this.U.length;a++){var b=this.U[a];b&&"h"in b.td&&b.Xd&&(b.D&&b.D("disconnect"),delete this.U[a],this.Db--)}0===this.Db&&(this.U=[]);if(this.Ra)this.lb?this.vb&&(3E4<(new Date).getTime()-this.vb&&(this.ua=1E3),this.vb=null):(this.e("Window isn't visible.  Delaying reconnect."),this.ua=this.Xb,this.Kc=(new Date).getTime()),a=Math.max(0,this.ua-((new Date).getTime()-this.Kc)),a*=Math.random(),this.e("Trying to reconnect in "+
a+"ms"),nd(this,a),this.ua=Math.min(this.Xb,1.3*this.ua);else for(var c in this.Kb)delete this.Kb[c];this.bc(!1)};function Cd(a){if(a.Ra){a.e("Making a connection attempt");a.Kc=(new Date).getTime();a.vb=null;var b=r(a.cc,a),c=r(a.Bb,a),d=r(a.pd,a),e=a.id+":"+od++;a.la=new $c(e,a.N,b,c,d,function(b){L(b+" ("+a.N.toString()+")");a.Ra=!1})}}h.La=function(){this.Ra=!1;this.la?this.la.close():(this.Xa&&(clearTimeout(this.Xa),this.Xa=null),this.S&&this.pd())};
h.jb=function(){this.Ra=!0;this.ua=1E3;this.S||nd(this,0)};function Bd(a,b,c){c=c?vb(c,function(a){return Ka(a)}).join("$"):"{}";(a=rd(a,b,c))&&a.D&&a.D("permission_denied")}function rd(a,b,c){b=(new F(b)).toString();c||(c="{}");var d=a.ia[b][c];delete a.ia[b][c];return d};function Dd(){this.o=this.F=null}function Ed(a,b,c){if(b.f())a.F=c,a.o=null;else if(null!==a.F)a.F=a.F.Aa(b,c);else{null==a.o&&(a.o=new Mc);var d=C(b);a.o.contains(d)||a.o.add(d,new Dd);a=a.o.get(d);b=La(b);Ed(a,b,c)}}function Fd(a,b){if(b.f())return a.F=null,a.o=null,!0;if(null!==a.F){if(a.F.P())return!1;var c=a.F;a.F=null;c.A(function(b,c){Ed(a,new F(b),c)});return Fd(a,b)}return null!==a.o?(c=C(b),b=La(b),a.o.contains(c)&&Fd(a.o.get(c),b)&&a.o.remove(c),a.o.f()?(a.o=null,!0):!1):!0}
function Gd(a,b,c){null!==a.F?c(b,a.F):a.A(function(a,e){var f=new F(b.toString()+"/"+a);Gd(e,f,c)})}Dd.prototype.A=function(a){null!==this.o&&R(this.o,function(b,c){a(b,c)})};function Hd(){this.$=M}function S(a,b){return a.$.L(b)}function T(a,b,c){a.$=a.$.Aa(b,c)}Hd.prototype.toString=function(){return this.$.toString()};function Id(){this.va=new Hd;this.M=new Hd;this.pa=new Hd;this.Fb=new Pa}function Jd(a,b,c){T(a.va,b,c);return Kd(a,b)}function Kd(a,b){for(var c=S(a.va,b),d=S(a.M,b),e=I(a.Fb,b),f=!1,g=e;null!==g;){if(null!==g.j()){f=!0;break}g=g.parent()}if(f)return!1;c=Ld(c,d,e);return c!==d?(T(a.M,b,c),!0):!1}function Ld(a,b,c){if(c.f())return a;if(null!==c.j())return b;a=a||M;c.A(function(d){d=d.name();var e=a.O(d),f=b.O(d),g=I(c,d),e=Ld(e,f,g);a=a.H(d,e)});return a}
Id.prototype.set=function(a,b){var c=this,d=[];ub(b,function(a){var b=a.path;a=a.ta;var g=Kb();J(I(c.Fb,b),g);T(c.M,b,a);d.push({path:b,be:g})});return d};function Md(a,b){ub(b,function(b){var d=b.be;b=I(a.Fb,b.path);var e=b.j();v(null!==e,"pendingPut should not be null.");e===d&&J(b,null)})};function Nd(a,b){return a&&"object"===typeof a?(v(".sv"in a,"Unexpected leaf node or priority contents"),b[a[".sv"]]):a}function Od(a,b){var c=new Dd;Gd(a,new F(""),function(a,e){Ed(c,a,Pd(e,b))});return c}function Pd(a,b){var c=Nd(a.k(),b),d;if(a.P()){var e=Nd(a.j(),b);return e!==a.j()||c!==a.k()?new fc(e,c):a}d=a;c!==a.k()&&(d=d.Ia(c));a.A(function(a,c){var e=Pd(c,b);e!==c&&(d=d.H(a,e))});return d};function Qd(){this.Ya=[]}function Rd(a,b){if(0!==b.length)for(var c=0;c<b.length;c++)a.Ya.push(b[c])}Qd.prototype.Ib=function(){for(var a=0;a<this.Ya.length;a++)if(this.Ya[a]){var b=this.Ya[a];this.Ya[a]=null;Sd(b)}this.Ya=[]};function Sd(a){var b=a.ba,c=a.yd,d=a.Hb;ec(function(){b(c,d)})};function U(a,b,c,d){this.type=a;this.wa=b;this.ca=c;this.Hb=d};function Td(a){this.R=a;this.ra=[];this.Dc=new Qd}function Ud(a,b,c,d,e){a.ra.push({type:b,ba:c,cancel:d,Y:e});d=[];var f=Vd(a.i);a.tb&&f.push(new U("value",a.i));for(var g=0;g<f.length;g++)if(f[g].type===b){var k=new E(a.R.m,a.R.path);f[g].ca&&(k=k.G(f[g].ca));d.push({ba:ac(c,e),yd:new P(f[g].wa,k),Hb:f[g].Hb})}Rd(a.Dc,d)}Td.prototype.ic=function(a,b){b=this.jc(a,b);null!=b&&Wd(this,b)};
function Wd(a,b){for(var c=[],d=0;d<b.length;d++){var e=b[d],f=e.type,g=new E(a.R.m,a.R.path);b[d].ca&&(g=g.G(b[d].ca));g=new P(b[d].wa,g);"value"!==e.type||g.sb()?"value"!==e.type&&(f+=" "+g.name()):f+="("+g.V()+")";K(a.R.m.u.id+": event:"+a.R.path+":"+a.R.Pa()+":"+f);for(f=0;f<a.ra.length;f++){var k=a.ra[f];b[d].type===k.type&&c.push({ba:ac(k.ba,k.Y),yd:g,Hb:e.Hb})}}Rd(a.Dc,c)}Td.prototype.Ib=function(){this.Dc.Ib()};
function Vd(a){var b=[];if(!a.P()){var c=null;a.A(function(a,e){b.push(new U("child_added",e,a,c));c=a})}return b}function Xd(a){a.tb||(a.tb=!0,Wd(a,[new U("value",a.i)]))};function Yd(a,b){Td.call(this,a);this.i=b}ja(Yd,Td);Yd.prototype.jc=function(a,b){this.i=a;this.tb&&null!=b&&b.push(new U("value",this.i));return b};Yd.prototype.qb=function(){return{}};function Zd(a,b){this.Tb=a;this.Mc=b}function $d(a,b,c,d,e){var f=a.L(c),g=b.L(c);d=new Zd(d,e);e=ae(d,c,f,g);g=!f.f()&&!g.f()&&f.k()!==g.k();if(e||g)for(f=c,c=e;null!==f.parent();){var k=a.L(f);e=b.L(f);var l=f.parent();if(!d.Tb||I(d.Tb,l).j()){var m=b.L(l),p=[],f=Ma(f);k.f()?(k=m.ga(f,e),p.push(new U("child_added",e,f,k))):e.f()?p.push(new U("child_removed",k,f)):(k=m.ga(f,e),g&&p.push(new U("child_moved",e,f,k)),c&&p.push(new U("child_changed",e,f,k)));d.Mc(l,m,p)}g&&(g=!1,c=!0);f=l}}
function ae(a,b,c,d){var e,f=[];c===d?e=!1:c.P()&&d.P()?e=c.j()!==d.j():c.P()?(be(a,b,M,d,f),e=!0):d.P()?(be(a,b,c,M,f),e=!0):e=be(a,b,c,d,f);e?a.Mc(b,d,f):c.k()!==d.k()&&a.Mc(b,d,null);return e}
function be(a,b,c,d,e){var f=!1,g=!a.Tb||!I(a.Tb,b).f(),k=[],l=[],m=[],p=[],t={},s={},w,V,G,H;w=c.Za();G=Ya(w);V=d.Za();for(H=Ya(V);null!==G||null!==H;){c=H;c=null===G?1:null===c?-1:G.key===c.key?0:ic({name:G.key,ka:G.value.k()},{name:c.key,ka:c.value.k()});if(0>c)f=va(t,G.key),n(f)?(m.push({Fc:G,$c:k[f]}),k[f]=null):(s[G.key]=l.length,l.push(G)),f=!0,G=Ya(w);else{if(0<c)f=va(s,H.key),n(f)?(m.push({Fc:l[f],$c:H}),l[f]=null):(t[H.key]=k.length,k.push(H)),f=!0;else{c=b.G(H.key);if(c=ae(a,c,G.value,
H.value))p.push(H),f=!0;G.value.k()!==H.value.k()&&(m.push({Fc:G,$c:H}),f=!0);G=Ya(w)}H=Ya(V)}if(!g&&f)return!0}for(g=0;g<l.length;g++)if(t=l[g])c=b.G(t.key),ae(a,c,t.value,M),e.push(new U("child_removed",t.value,t.key));for(g=0;g<k.length;g++)if(t=k[g])c=b.G(t.key),l=d.ga(t.key,t.value),ae(a,c,M,t.value),e.push(new U("child_added",t.value,t.key,l));for(g=0;g<m.length;g++)t=m[g].Fc,k=m[g].$c,c=b.G(k.key),l=d.ga(k.key,k.value),e.push(new U("child_moved",k.value,k.key,l)),(c=ae(a,c,t.value,k.value))&&
p.push(k);for(g=0;g<p.length;g++)a=p[g],l=d.ga(a.key,a.value),e.push(new U("child_changed",a.value,a.key,l));return f};function ce(){this.X=this.za=null;this.set={}}ja(ce,Mc);h=ce.prototype;h.setActive=function(a){this.za=a};function de(a,b,c){a.add(b,c);a.X||(a.X=c.R.path)}function ee(a){var b=a.za;a.za=null;return b}function fe(a){return a.contains("default")}function ge(a){return null!=a.za&&fe(a)}h.defaultView=function(){return fe(this)?this.get("default"):null};h.path=function(){return this.X};h.toString=function(){return vb(this.keys(),function(a){return"default"===a?"{}":a}).join("$")};
h.hb=function(){var a=[];R(this,function(b,c){a.push(c.R)});return a};function he(a,b){Td.call(this,a);this.i=M;this.jc(b,Vd(b))}ja(he,Td);
he.prototype.jc=function(a,b){if(null===b)return b;var c=[],d=this.R;n(d.fa)&&(n(d.ya)&&null!=d.ya?c.push(function(a,b){var c=Ub(b,d.fa);return 0<c||0===c&&0<=Vb(a,d.ya)}):c.push(function(a,b){return 0<=Ub(b,d.fa)}));n(d.Ca)&&(n(d.Wa)?c.push(function(a,b){var c=Ub(b,d.Ca);return 0>c||0===c&&0>=Vb(a,d.Wa)}):c.push(function(a,b){return 0>=Ub(b,d.Ca)}));var e=null,f=null;if(n(this.R.Ea))if(n(this.R.fa)){if(e=ie(a,c,this.R.Ea,!1)){var g=a.O(e).k();c.push(function(a,b){var c=Ub(b,g);return 0>c||0===c&&
0>=Vb(a,e)})}}else if(f=ie(a,c,this.R.Ea,!0)){var k=a.O(f).k();c.push(function(a,b){var c=Ub(b,k);return 0<c||0===c&&0<=Vb(a,f)})}for(var l=[],m=[],p=[],t=[],s=0;s<b.length;s++){var w=b[s].ca,V=b[s].wa;switch(b[s].type){case "child_added":je(c,w,V)&&(this.i=this.i.H(w,V),m.push(b[s]));break;case "child_removed":this.i.O(w).f()||(this.i=this.i.H(w,null),l.push(b[s]));break;case "child_changed":!this.i.O(w).f()&&je(c,w,V)&&(this.i=this.i.H(w,V),t.push(b[s]));break;case "child_moved":var G=!this.i.O(w).f(),
H=je(c,w,V);G?H?(this.i=this.i.H(w,V),p.push(b[s])):(l.push(new U("child_removed",this.i.O(w),w)),this.i=this.i.H(w,null)):H&&(this.i=this.i.H(w,V),m.push(b[s]))}}var Tc=e||f;if(Tc){var Uc=(s=null!==f)?this.i.hd():this.i.kd(),hc=!1,$a=!1,ab=this;(s?a.Ec:a.A).call(a,function(a,b){$a||null!==Uc||($a=!0);if($a&&hc)return!0;hc?(l.push(new U("child_removed",ab.i.O(a),a)),ab.i=ab.i.H(a,null)):$a&&(m.push(new U("child_added",b,a)),ab.i=ab.i.H(a,b));Uc===a&&($a=!0);a===Tc&&(hc=!0)})}for(s=0;s<m.length;s++)c=
m[s],w=this.i.ga(c.ca,c.wa),l.push(new U("child_added",c.wa,c.ca,w));for(s=0;s<p.length;s++)c=p[s],w=this.i.ga(c.ca,c.wa),l.push(new U("child_moved",c.wa,c.ca,w));for(s=0;s<t.length;s++)c=t[s],w=this.i.ga(c.ca,c.wa),l.push(new U("child_changed",c.wa,c.ca,w));this.tb&&0<l.length&&l.push(new U("value",this.i));return l};function ie(a,b,c,d){if(a.P())return null;var e=null;(d?a.Ec:a.A).call(a,function(a,d){if(je(b,a,d)&&(e=a,c--,0===c))return!0});return e}
function je(a,b,c){for(var d=0;d<a.length;d++)if(!a[d](b,c.k()))return!1;return!0}he.prototype.Hc=function(a){return this.i.O(a)!==M};
he.prototype.qb=function(a,b,c){var d={};this.i.P()||this.i.A(function(a){d[a]=3});var e=this.i;c=S(c,new F(""));var f=new Pa;J(I(f,this.R.path),!0);b=M.Aa(a,b);var g=this;$d(c,b,a,f,function(a,b,c){null!==c&&a.toString()===g.R.path.toString()&&g.jc(b,c)});this.i.P()?$b(d,function(a,b){d[b]=2}):(this.i.A(function(a){A(d,a)||(d[a]=1)}),$b(d,function(a,b){g.i.O(b).f()&&(d[b]=2)}));this.i=e;return d};function ke(a,b){this.u=a;this.g=b;this.ac=b.$;this.oa=new Pa}ke.prototype.Rb=function(a,b,c,d,e){var f=a.path,g=I(this.oa,f),k=g.j();null===k?(k=new ce,J(g,k)):v(!k.f(),"We shouldn't be storing empty QueryMaps");var l=a.Pa();if(k.contains(l))a=k.get(l),Ud(a,b,c,d,e);else{var m=this.g.$.L(f);a=le(a,m);me(this,g,k,l,a);Ud(a,b,c,d,e);(b=(b=Sa(I(this.oa,f),function(a){var b;if(b=a.j()&&a.j().defaultView())b=a.j().defaultView().tb;if(b)return!0},!0))||null===this.u&&!S(this.g,f).f())&&Xd(a)}a.Ib()};
function ne(a,b,c,d,e){var f=a.get(b),g;if(g=f){g=!1;for(var k=f.ra.length-1;0<=k;k--){var l=f.ra[k];if(!(c&&l.type!==c||d&&l.ba!==d||e&&l.Y!==e)&&(f.ra.splice(k,1),g=!0,c&&d))break}}(c=g&&!(0<f.ra.length))&&a.remove(b);return c}function oe(a,b,c,d,e){b=b?b.Pa():null;var f=[];b&&"default"!==b?ne(a,b,c,d,e)&&f.push(b):ub(a.keys(),function(b){ne(a,b,c,d,e)&&f.push(b)});return f}ke.prototype.lc=function(a,b,c,d){var e=I(this.oa,a.path).j();return null===e?null:pe(this,e,a,b,c,d)};
function pe(a,b,c,d,e,f){var g=b.path(),g=I(a.oa,g);c=oe(b,c,d,e,f);b.f()&&J(g,null);d=qe(g);if(0<c.length&&!d){d=g;e=g.parent();for(c=!1;!c&&e;){if(f=e.j()){v(!ge(f));var k=d.name(),l=!1;R(f,function(a,b){l=b.Hc(k)||l});l&&(c=!0)}d=e;e=e.parent()}d=null;ge(b)||(b=ee(b),d=re(a,g),b&&b());return c?null:d}return null}function se(a,b,c){Ra(I(a.oa,b),function(a){(a=a.j())&&R(a,function(a,b){Xd(b)})},c,!0)}
function W(a,b,c){function d(a){do{if(g[a.toString()])return!0;a=a.parent()}while(null!==a);return!1}var e=a.ac,f=a.g.$;a.ac=f;for(var g={},k=0;k<c.length;k++)g[c[k].toString()]=!0;$d(e,f,b,a.oa,function(c,e,f){if(b.contains(c)){var g=d(c);g&&se(a,c,!1);a.ic(c,e,f);g&&se(a,c,!0)}else a.ic(c,e,f)});d(b)&&se(a,b,!0);te(a,b)}function te(a,b){var c=I(a.oa,b);Ra(c,function(a){(a=a.j())&&R(a,function(a,b){b.Ib()})},!0,!0);Sa(c,function(a){(a=a.j())&&R(a,function(a,b){b.Ib()})},!1)}
ke.prototype.ic=function(a,b,c){a=I(this.oa,a).j();null!==a&&R(a,function(a,e){e.ic(b,c)})};function qe(a){return Sa(a,function(a){return a.j()&&ge(a.j())})}function me(a,b,c,d,e){if(ge(c)||qe(b))de(c,d,e);else{var f,g;c.f()||(f=c.toString(),g=c.hb());de(c,d,e);c.setActive(ue(a,c));f&&g&&td(a.u,c.path(),f,g)}ge(c)&&Ra(b,function(a){if(a=a.j())a.za&&a.za(),a.za=null})}
function re(a,b){function c(b){var f=b.j();if(f&&fe(f))d.push(f.path()),null==f.za&&f.setActive(ue(a,f));else{if(f){null!=f.za||f.setActive(ue(a,f));var g={};R(f,function(a,b){b.i.A(function(a){A(g,a)||(g[a]=!0,a=f.path().G(a),d.push(a))})})}b.A(c)}}var d=[];c(b);return d}
function ue(a,b){if(a.u){var c=a.u,d=b.path(),e=b.toString(),f=b.hb(),g,k=b.keys(),l=fe(b);pd(a.u,b,function(c){"ok"!==c?(c=cc(c),L("on() or once() for "+b.path().toString()+" failed: "+c.toString()),ve(a,b,c)):g||(l?se(a,b.path(),!0):ub(k,function(a){(a=b.get(a))&&Xd(a)}),te(a,b.path()))});return function(){g=!0;td(c,d,e,f)}}return ba}function ve(a,b,c){b&&(R(b,function(a,b){for(var f=0;f<b.ra.length;f++){var g=b.ra[f];g.cancel&&ac(g.cancel,g.Y)(c)}}),pe(a,b))}
function le(a,b){return"default"===a.Pa()?new Yd(a,b):new he(a,b)}ke.prototype.qb=function(a,b,c,d){function e(a){$b(a,function(a,b){f[b]=3===a?3:(va(f,b)||a)===a?a:3})}var f={};R(b,function(b,f){e(f.qb(a,c,d))});c.P()||c.A(function(a){A(f,a)||(f[a]=4)});return f};function we(a,b,c,d,e){var f=b.path();b=a.qb(f,b,d,e);var g=M,k=[];$b(b,function(b,m){var p=new F(m);3===b||1===b?g=g.H(m,d.L(p)):(2===b&&k.push({path:f.G(m),ta:M}),k=k.concat(xe(a,d.L(p),I(c,p),e)))});return[{path:f,ta:g}].concat(k)}
function ye(a,b,c,d){var e;a:{var f=I(a.oa,b);e=f.parent();for(var g=[];null!==e;){var k=e.j();if(null!==k){if(fe(k)){e=[{path:b,ta:c}];break a}k=a.qb(b,k,c,d);f=va(k,f.name());if(3===f||1===f){e=[{path:b,ta:c}];break a}2===f&&g.push({path:b,ta:M})}f=e;e=e.parent()}e=g}if(1==e.length&&(!e[0].ta.f()||c.f()))return e;g=I(a.oa,b);f=g.j();null!==f?fe(f)?e.push({path:b,ta:c}):e=e.concat(we(a,f,g,c,d)):e=e.concat(xe(a,c,g,d));return e}
function xe(a,b,c,d){var e=c.j();if(null!==e)return fe(e)?[{path:c.path(),ta:b}]:we(a,e,c,b,d);var f=[];c.A(function(c){var e=b.P()?M:b.O(c.name());c=xe(a,e,c,d);f=f.concat(c)});return f};function ze(a){this.N=a;this.aa=Dc(a);this.u=new ld(this.N,r(this.dc,this),r(this.bc,this),r(this.zb,this),r(this.Qc,this),r(this.Gc,this));this.zd=Ec(a,r(function(){return new Ac(this.aa,this.u)},this));this.Sa=new Pa;this.Ha=new Hd;this.g=new Id;this.I=new ke(this.u,this.g.pa);this.Ic=new Hd;this.Jc=new ke(null,this.Ic);Ae(this,"connected",!1);Ae(this,"authenticated",!1);this.T=new Dd;this.Cc=0}h=ze.prototype;h.toString=function(){return(this.N.nc?"https://":"http://")+this.N.host};h.name=function(){return this.N.Yb};
function Be(a){a=S(a.Ic,new F(".info/serverTimeOffset")).V()||0;return(new Date).getTime()+a}function Ce(a){a=a={timestamp:Be(a)};a.timestamp=a.timestamp||(new Date).getTime();return a}
h.dc=function(a,b,c){this.Cc++;this.md&&(b=this.md(a,b));var d,e,f=[];9<=a.length&&a.lastIndexOf(".priority")===a.length-9?(d=new F(a.substring(0,a.length-9)),e=S(this.g.va,d).Ia(b),f.push(d)):c?(d=new F(a),e=S(this.g.va,d),$b(b,function(a,b){var c=new F(b);".priority"===b?e=e.Ia(a):(e=e.Aa(c,O(a)),f.push(d.G(b)))})):(d=new F(a),e=O(b),f.push(d));a=ye(this.I,d,e,this.g.M);b=!1;for(c=0;c<a.length;++c){var g=a[c];b=Jd(this.g,g.path,g.ta)||b}b&&(d=De(this,d));W(this.I,d,f)};
h.bc=function(a){Ae(this,"connected",a);!1===a&&Ee(this)};h.Qc=function(a){var b=this;Zb(a,function(a,d){Ae(b,d,a)})};h.Gc=function(a){a=new F(a);return S(this.g.va,a).hash()};h.zb=function(a){Ae(this,"authenticated",a)};function Ae(a,b,c){b=new F("/.info/"+b);T(a.Ic,b,O(c));W(a.Jc,b,[b])}
h.mb=function(a,b,c){"firebaseio-demo.com"===this.N.domain&&L("FirebaseRef.auth() not supported on demo (*.firebaseio-demo.com) Firebases. Please use on production (*.firebaseio.com) Firebases only.");this.u.mb(a,function(a,c){X(b,a,c)},function(a,b){L("auth() was canceled: "+b);if(c){var f=Error(b);f.code=a.toUpperCase();c(f)}})};h.Pb=function(a){this.u.Pb(function(b,c){X(a,b,c)})};
h.kb=function(a,b,c,d){this.e("set",{path:a.toString(),value:b,ka:c});var e=Ce(this);b=O(b,c);var e=Pd(b,e),e=ye(this.I,a,e,this.g.M),f=this.g.set(a,e),g=this;this.u.put(a.toString(),b.V(!0),function(b,c){"ok"!==b&&L("set at "+a+" failed: "+b);Md(g.g,f);Kd(g.g,a);var e=De(g,a);W(g.I,e,[]);X(d,b,c)});e=Fe(this,a);De(this,e);W(this.I,e,[a])};
h.update=function(a,b,c){this.e("update",{path:a.toString(),value:b});var d=S(this.g.pa,a),e=!0,f=[],g=Ce(this),k=[],l;for(l in b){var e=!1,m=O(b[l]),m=Pd(m,g),d=d.H(l,m),p=a.G(l);f.push(p);m=ye(this.I,p,m,this.g.M);k=k.concat(this.g.set(a,m))}if(e)K("update() called with empty data.  Don't do anything."),X(c,"ok");else{var t=this;zd(this.u,a.toString(),b,function(b,d){v("ok"===b||"permission_denied"===b,"merge at "+a+" failed.");"ok"!==b&&L("update at "+a+" failed: "+b);Md(t.g,k);Kd(t.g,a);var e=
De(t,a);W(t.I,e,[]);X(c,b,d)});b=Fe(this,a);De(this,b);W(t.I,b,f)}};h.Wc=function(a,b,c){this.e("setPriority",{path:a.toString(),ka:b});var d=Ce(this),d=Nd(b,d),d=S(this.g.M,a).Ia(d),d=ye(this.I,a,d,this.g.M),e=this.g.set(a,d),f=this;this.u.put(a.toString()+"/.priority",b,function(b,d){"permission_denied"===b&&L("setPriority at "+a+" failed: "+b);Md(f.g,e);Kd(f.g,a);var l=De(f,a);W(f.I,l,[]);X(c,b,d)});b=De(this,a);W(f.I,b,[])};
function Ee(a){a.e("onDisconnectEvents");var b=[],c=Ce(a);Gd(Od(a.T,c),new F(""),function(c,e){var f=ye(a.I,c,e,a.g.M);b.push.apply(b,a.g.set(c,f));f=Fe(a,c);De(a,f);W(a.I,f,[c])});Md(a.g,b);a.T=new Dd}h.Nc=function(a,b){var c=this;this.u.Nc(a.toString(),function(d,e){"ok"===d&&Fd(c.T,a);X(b,d,e)})};function Ge(a,b,c,d){var e=O(c);vd(a.u,b.toString(),e.V(!0),function(c,g){"ok"===c&&Ed(a.T,b,e);X(d,c,g)})}
function He(a,b,c,d,e){var f=O(c,d);vd(a.u,b.toString(),f.V(!0),function(c,d){"ok"===c&&Ed(a.T,b,f);X(e,c,d)})}function Ie(a,b,c,d){var e=!0,f;for(f in c)e=!1;e?(K("onDisconnect().update() called with empty data.  Don't do anything."),X(d,"ok")):xd(a.u,b.toString(),c,function(e,f){if("ok"===e)for(var l in c){var m=O(c[l]);Ed(a.T,b.G(l),m)}X(d,e,f)})}function Je(a){yc(a.aa,"deprecated_on_disconnect");a.zd.Zc.deprecated_on_disconnect=!0}
h.Rb=function(a,b,c,d,e){".info"===C(a.path)?this.Jc.Rb(a,b,c,d,e):this.I.Rb(a,b,c,d,e)};h.lc=function(a,b,c,d){if(".info"===C(a.path))this.Jc.lc(a,b,c,d);else{b=this.I.lc(a,b,c,d);if(c=null!==b){c=this.g;d=a.path;for(var e=[],f=0;f<b.length;++f)e[f]=S(c.va,b[f]);T(c.va,d,M);for(f=0;f<b.length;++f)T(c.va,b[f],e[f]);c=Kd(c,d)}c&&(v(this.g.pa.$===this.I.ac,"We should have raised any outstanding events by now.  Else, we'll blow them away."),T(this.g.pa,a.path,S(this.g.M,a.path)),this.I.ac=this.g.pa.$)}};
h.La=function(){this.u.La()};h.jb=function(){this.u.jb()};h.Xc=function(a){if("undefined"!==typeof console){a?(this.qc||(this.qc=new zc(this.aa)),a=this.qc.get()):a=this.aa.get();var b=wb(vc(a),function(a,b){return Math.max(b.length,a)},0),c;for(c in a){for(var d=a[c],e=c.length;e<b+2;e++)c+=" ";console.log(c+d)}}};h.Yc=function(a){yc(this.aa,a);this.zd.Zc[a]=!0};h.e=function(){K("r:"+this.u.id+":",arguments)};
function X(a,b,c){a&&ec(function(){if("ok"==b)a(null,c);else{var d=(b||"error").toUpperCase(),e=d;c&&(e+=": "+c);e=Error(e);e.code=d;a(e)}})};function Ke(a,b,c,d,e){function f(){}a.e("transaction on "+b);var g=new E(a,b);g.fb("value",f);c={path:b,update:c,D:d,status:null,qd:Kb(),wc:e,vd:0,tc:function(){g.yb("value",f)},uc:null};a.Ha.$=Le(a,a.Ha.$,a.g.M.$,a.Sa);d=c.update(S(a.Ha,b).V());if(n(d)){Aa("transaction failed: Data returned ",d);c.status=1;e=I(a.Sa,b);var k=e.j()||[];k.push(c);J(e,k);k="object"===typeof d&&null!==d&&A(d,".priority")?d[".priority"]:S(a.g.M,b).k();e=Ce(a);d=O(d,k);d=Pd(d,e);T(a.Ha,b,d);c.wc&&(T(a.g.pa,b,d),W(a.I,
b,[b]));Me(a)}else c.tc(),c.D&&(a=Ne(a,b),c.D(null,!1,a))}function Me(a,b){var c=b||a.Sa;b||Oe(a,c);if(null!==c.j()){var d=Pe(a,c);v(0<d.length);xb(d,function(a){return 1===a.status})&&Qe(a,c.path(),d)}else c.sb()&&c.A(function(b){Me(a,b)})}
function Qe(a,b,c){for(var d=0;d<c.length;d++)v(1===c[d].status,"tryToSendTransactionQueue_: items in queue should all be run."),c[d].status=2,c[d].vd++;var e=S(a.g.M,b).hash();T(a.g.M,b,S(a.g.pa,b));for(var f=S(a.Ha,b).V(!0),g=Kb(),k=Re(c),d=0;d<k.length;d++)J(I(a.g.Fb,k[d]),g);a.u.put(b.toString(),f,function(e){a.e("transaction put response",{path:b.toString(),status:e});for(d=0;d<k.length;d++){var f=I(a.g.Fb,k[d]),p=f.j();v(null!==p,"sendTransactionQueue_: pendingPut should not be null.");p===
g&&(J(f,null),T(a.g.M,k[d],S(a.g.va,k[d])))}if("ok"===e){e=[];for(d=0;d<c.length;d++)c[d].status=3,c[d].D&&(f=Ne(a,c[d].path),e.push(r(c[d].D,null,null,!0,f))),c[d].tc();Oe(a,I(a.Sa,b));Me(a);for(d=0;d<e.length;d++)ec(e[d])}else{if("datastale"===e)for(d=0;d<c.length;d++)c[d].status=4===c[d].status?5:1;else for(L("transaction at "+b+" failed: "+e),d=0;d<c.length;d++)c[d].status=5,c[d].uc=e;e=De(a,b);W(a.I,e,[b])}},e)}
function Re(a){for(var b={},c=0;c<a.length;c++)a[c].wc&&(b[a[c].path.toString()]=a[c].path);a=[];for(var d in b)a.push(b[d]);return a}
function De(a,b){var c=Se(a,b),d=c.path(),c=Pe(a,c);T(a.g.pa,d,S(a.g.M,d));T(a.Ha,d,S(a.g.M,d));if(0!==c.length){for(var e=S(a.g.pa,d),f=e,g=[],k=0;k<c.length;k++){var l=Na(d,c[k].path),m=!1,p;v(null!==l,"rerunTransactionsUnderNode_: relativePath should not be null.");if(5===c[k].status)m=!0,p=c[k].uc;else if(1===c[k].status)if(25<=c[k].vd)m=!0,p="maxretry";else{var t=e.L(l),s=c[k].update(t.V());if(n(s)){Aa("transaction failed: Data returned ",s);var w=O(s);"object"===typeof s&&null!=s&&A(s,".priority")||
(w=w.Ia(t.k()));e=e.Aa(l,w);c[k].wc&&(f=f.Aa(l,w))}else m=!0,p="nodata"}m&&(c[k].status=3,setTimeout(c[k].tc,0),c[k].D&&(m=new E(a,c[k].path),l=new P(e.L(l),m),"nodata"===p?g.push(r(c[k].D,null,null,!1,l)):g.push(r(c[k].D,null,Error(p),!1,l))))}T(a.Ha,d,e);T(a.g.pa,d,f);Oe(a,a.Sa);for(k=0;k<g.length;k++)ec(g[k]);Me(a)}return d}function Se(a,b){for(var c,d=a.Sa;null!==(c=C(b))&&null===d.j();)d=I(d,c),b=La(b);return d}
function Pe(a,b){var c=[];Te(a,b,c);c.sort(function(a,b){return a.qd-b.qd});return c}function Te(a,b,c){var d=b.j();if(null!==d)for(var e=0;e<d.length;e++)c.push(d[e]);b.A(function(b){Te(a,b,c)})}function Oe(a,b){var c=b.j();if(c){for(var d=0,e=0;e<c.length;e++)3!==c[e].status&&(c[d]=c[e],d++);c.length=d;J(b,0<c.length?c:null)}b.A(function(b){Oe(a,b)})}function Fe(a,b){var c=Se(a,b).path(),d=I(a.Sa,b);Sa(d,function(a){Ue(a)});Ue(d);Ra(d,function(a){Ue(a)});return c}
function Ue(a){var b=a.j();if(null!==b){for(var c=[],d=-1,e=0;e<b.length;e++)4!==b[e].status&&(2===b[e].status?(v(d===e-1,"All SENT items should be at beginning of queue."),d=e,b[e].status=4,b[e].uc="set"):(v(1===b[e].status),b[e].tc(),b[e].D&&c.push(r(b[e].D,null,Error("set"),!1,null))));-1===d?J(a,null):b.length=d+1;for(e=0;e<c.length;e++)ec(c[e])}}function Ne(a,b){var c=new E(a,b);return new P(S(a.Ha,b),c)}
function Le(a,b,c,d){if(d.f())return c;if(null!=d.j())return b;var e=c;d.A(function(d){var g=d.name(),k=new F(g);d=Le(a,b.L(k),c.L(k),d);e=e.H(g,d)});return e};function Y(){this.ib={}}ca(Y);Y.prototype.La=function(){for(var a in this.ib)this.ib[a].La()};Y.prototype.interrupt=Y.prototype.La;Y.prototype.jb=function(){for(var a in this.ib)this.ib[a].jb()};Y.prototype.resume=Y.prototype.jb;var Z={Nd:function(a){var b=N.prototype.hash;N.prototype.hash=a;var c=fc.prototype.hash;fc.prototype.hash=a;return function(){N.prototype.hash=b;fc.prototype.hash=c}}};Z.hijackHash=Z.Nd;Z.Pa=function(a){return a.Pa()};Z.queryIdentifier=Z.Pa;Z.Qd=function(a){return a.m.u.ia};Z.listens=Z.Qd;Z.Yd=function(a){return a.m.u.la};Z.refConnection=Z.Yd;Z.Cd=ld;Z.DataConnection=Z.Cd;ld.prototype.sendRequest=ld.prototype.Ga;ld.prototype.interrupt=ld.prototype.La;Z.Dd=$c;Z.RealTimeConnection=Z.Dd;
$c.prototype.sendRequest=$c.prototype.xd;$c.prototype.close=$c.prototype.close;Z.Bd=ob;Z.ConnectionTarget=Z.Bd;Z.Ld=function(){Oc=Gc=!0};Z.forceLongPolling=Z.Ld;Z.Md=function(){Pc=!0};Z.forceWebSockets=Z.Md;Z.de=function(a,b){a.m.u.Vc=b};Z.setSecurityDebugCallback=Z.de;Z.Xc=function(a,b){a.m.Xc(b)};Z.stats=Z.Xc;Z.Yc=function(a,b){a.m.Yc(b)};Z.statsIncrementCounter=Z.Yc;Z.Cc=function(a){return a.m.Cc};Z.Od=function(a,b){a.m.md=b};Z.interceptServerData=Z.Od;function $(a,b,c){this.Jb=a;this.X=b;this.Fa=c}$.prototype.cancel=function(a){x("Firebase.onDisconnect().cancel",0,1,arguments.length);z("Firebase.onDisconnect().cancel",1,a,!0);this.Jb.Nc(this.X,a)};$.prototype.cancel=$.prototype.cancel;$.prototype.remove=function(a){x("Firebase.onDisconnect().remove",0,1,arguments.length);B("Firebase.onDisconnect().remove",this.X);z("Firebase.onDisconnect().remove",1,a,!0);Ge(this.Jb,this.X,null,a)};$.prototype.remove=$.prototype.remove;
$.prototype.set=function(a,b){x("Firebase.onDisconnect().set",1,2,arguments.length);B("Firebase.onDisconnect().set",this.X);za("Firebase.onDisconnect().set",a,!1);z("Firebase.onDisconnect().set",2,b,!0);Ge(this.Jb,this.X,a,b)};$.prototype.set=$.prototype.set;
$.prototype.kb=function(a,b,c){x("Firebase.onDisconnect().setWithPriority",2,3,arguments.length);B("Firebase.onDisconnect().setWithPriority",this.X);za("Firebase.onDisconnect().setWithPriority",a,!1);Ea("Firebase.onDisconnect().setWithPriority",2,b,!1);z("Firebase.onDisconnect().setWithPriority",3,c,!0);if(".length"===this.Fa||".keys"===this.Fa)throw"Firebase.onDisconnect().setWithPriority failed: "+this.Fa+" is a read-only object.";He(this.Jb,this.X,a,b,c)};$.prototype.setWithPriority=$.prototype.kb;
$.prototype.update=function(a,b){x("Firebase.onDisconnect().update",1,2,arguments.length);B("Firebase.onDisconnect().update",this.X);Da("Firebase.onDisconnect().update",a);z("Firebase.onDisconnect().update",2,b,!0);Ie(this.Jb,this.X,a,b)};$.prototype.update=$.prototype.update;var Ve=function(){var a=0,b=[];return function(c){var d=c===a;a=c;for(var e=Array(8),f=7;0<=f;f--)e[f]="-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(c%64),c=Math.floor(c/64);v(0===c,"Cannot push at time == 0");c=e.join("");if(d){for(f=11;0<=f&&63===b[f];f--)b[f]=0;b[f]++}else for(f=0;12>f;f++)b[f]=Math.floor(64*Math.random());for(f=0;12>f;f++)c+="-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(b[f]);v(20===c.length,"NextPushId: Length should be 20.");
return c}}();function E(a,b){var c,d;if(a instanceof ze)c=a,d=b;else{x("new Firebase",1,2,arguments.length);var e=arguments[0];d=c="";var f=!0,g="";if(q(e)){var k=e.indexOf("//");if(0<=k)var l=e.substring(0,k-1),e=e.substring(k+2);k=e.indexOf("/");-1===k&&(k=e.length);c=e.substring(0,k);var e=e.substring(k+1),m=c.split(".");if(3==m.length){k=m[2].indexOf(":");f=0<=k?"https"===l||"wss"===l:!0;if("firebase"===m[1])Sb(c+" is no longer supported. Please use <YOUR FIREBASE>.firebaseio.com instead");else for(d=m[0],
g="",e=("/"+e).split("/"),k=0;k<e.length;k++)if(0<e[k].length){m=e[k];try{m=decodeURIComponent(m.replace(/\+/g," "))}catch(p){}g+="/"+m}d=d.toLowerCase()}else Sb("Cannot parse Firebase url. Please use https:<YOUR FIREBASE>.firebaseio.com")}f||"undefined"!==typeof window&&window.location&&window.location.protocol&&-1!==window.location.protocol.indexOf("https:")&&L("Insecure Firebase access from a secure page. Please use https in calls to new Firebase().");c=new ob(c,f,d,"ws"===l||"wss"===l);d=new F(g);
f=d.toString();!(l=!q(c.host)||0===c.host.length||!ya(c.Yb))&&(l=0!==f.length)&&(f&&(f=f.replace(/^\/*\.info(\/|$)/,"/")),l=!(q(f)&&0!==f.length&&!xa.test(f)));if(l)throw Error(y("new Firebase",1,!1)+'must be a valid firebase URL and the path can\'t contain ".", "#", "$", "[", or "]".');if(b)if(b instanceof Y)f=b;else throw Error("Expected a valid Firebase.Context for second argument to new Firebase()");else f=Y.rb();l=c.toString();e=va(f.ib,l);e||(e=new ze(c),f.ib[l]=e);c=e}D.call(this,c,d)}
ja(E,D);var We=E,Xe=["Firebase"],Ye=aa;Xe[0]in Ye||!Ye.execScript||Ye.execScript("var "+Xe[0]);for(var Ze;Xe.length&&(Ze=Xe.shift());)!Xe.length&&n(We)?Ye[Ze]=We:Ye=Ye[Ze]?Ye[Ze]:Ye[Ze]={};E.prototype.name=function(){x("Firebase.name",0,0,arguments.length);return this.path.f()?null:Ma(this.path)};E.prototype.name=E.prototype.name;
E.prototype.G=function(a){x("Firebase.child",1,1,arguments.length);if(fa(a))a=String(a);else if(!(a instanceof F))if(null===C(this.path)){var b=a;b&&(b=b.replace(/^\/*\.info(\/|$)/,"/"));Ha("Firebase.child",b)}else Ha("Firebase.child",a);return new E(this.m,this.path.G(a))};E.prototype.child=E.prototype.G;E.prototype.parent=function(){x("Firebase.parent",0,0,arguments.length);var a=this.path.parent();return null===a?null:new E(this.m,a)};E.prototype.parent=E.prototype.parent;
E.prototype.root=function(){x("Firebase.ref",0,0,arguments.length);for(var a=this;null!==a.parent();)a=a.parent();return a};E.prototype.root=E.prototype.root;E.prototype.toString=function(){x("Firebase.toString",0,0,arguments.length);var a;if(null===this.parent())a=this.m.toString();else{a=this.parent().toString()+"/";var b=this.name();a+=encodeURIComponent(String(b))}return a};E.prototype.toString=E.prototype.toString;
E.prototype.set=function(a,b){x("Firebase.set",1,2,arguments.length);B("Firebase.set",this.path);za("Firebase.set",a,!1);z("Firebase.set",2,b,!0);this.m.kb(this.path,a,null,b)};E.prototype.set=E.prototype.set;E.prototype.update=function(a,b){x("Firebase.update",1,2,arguments.length);B("Firebase.update",this.path);Da("Firebase.update",a);z("Firebase.update",2,b,!0);if(A(a,".priority"))throw Error("update() does not currently support updating .priority.");this.m.update(this.path,a,b)};
E.prototype.update=E.prototype.update;E.prototype.kb=function(a,b,c){x("Firebase.setWithPriority",2,3,arguments.length);B("Firebase.setWithPriority",this.path);za("Firebase.setWithPriority",a,!1);Ea("Firebase.setWithPriority",2,b,!1);z("Firebase.setWithPriority",3,c,!0);if(".length"===this.name()||".keys"===this.name())throw"Firebase.setWithPriority failed: "+this.name()+" is a read-only object.";this.m.kb(this.path,a,b,c)};E.prototype.setWithPriority=E.prototype.kb;
E.prototype.remove=function(a){x("Firebase.remove",0,1,arguments.length);B("Firebase.remove",this.path);z("Firebase.remove",1,a,!0);this.set(null,a)};E.prototype.remove=E.prototype.remove;
E.prototype.transaction=function(a,b,c){x("Firebase.transaction",1,3,arguments.length);B("Firebase.transaction",this.path);z("Firebase.transaction",1,a,!1);z("Firebase.transaction",2,b,!0);if(n(c)&&"boolean"!=typeof c)throw Error(y("Firebase.transaction",3,!0)+"must be a boolean.");if(".length"===this.name()||".keys"===this.name())throw"Firebase.transaction failed: "+this.name()+" is a read-only object.";"undefined"===typeof c&&(c=!0);Ke(this.m,this.path,a,b,c)};E.prototype.transaction=E.prototype.transaction;
E.prototype.Wc=function(a,b){x("Firebase.setPriority",1,2,arguments.length);B("Firebase.setPriority",this.path);Ea("Firebase.setPriority",1,a,!1);z("Firebase.setPriority",2,b,!0);this.m.Wc(this.path,a,b)};E.prototype.setPriority=E.prototype.Wc;E.prototype.push=function(a,b){x("Firebase.push",0,2,arguments.length);B("Firebase.push",this.path);za("Firebase.push",a,!0);z("Firebase.push",2,b,!0);var c=Be(this.m),c=Ve(c),c=this.G(c);"undefined"!==typeof a&&null!==a&&c.set(a,b);return c};
E.prototype.push=E.prototype.push;E.prototype.ja=function(){return new $(this.m,this.path,this.name())};E.prototype.onDisconnect=E.prototype.ja;E.prototype.Zd=function(){L("FirebaseRef.removeOnDisconnect() being deprecated. Please use FirebaseRef.onDisconnect().remove() instead.");this.ja().remove();Je(this.m)};E.prototype.removeOnDisconnect=E.prototype.Zd;
E.prototype.ce=function(a){L("FirebaseRef.setOnDisconnect(value) being deprecated. Please use FirebaseRef.onDisconnect().set(value) instead.");this.ja().set(a);Je(this.m)};E.prototype.setOnDisconnect=E.prototype.ce;E.prototype.mb=function(a,b,c){x("Firebase.auth",1,3,arguments.length);if(!q(a))throw Error(y("Firebase.auth",1,!1)+"must be a valid credential (a string).");z("Firebase.auth",2,b,!0);z("Firebase.auth",3,b,!0);this.m.mb(a,b,c)};E.prototype.auth=E.prototype.mb;
E.prototype.Pb=function(a){x("Firebase.unauth",0,1,arguments.length);z("Firebase.unauth",1,a,!0);this.m.Pb(a)};E.prototype.unauth=E.prototype.Pb;E.goOffline=function(){x("Firebase.goOffline",0,0,arguments.length);Y.rb().La()};E.goOnline=function(){x("Firebase.goOnline",0,0,arguments.length);Y.rb().jb()};
function Pb(a,b){v(!b||!0===a||!1===a,"Can't turn on custom loggers persistently.");!0===a?("undefined"!==typeof console&&("function"===typeof console.log?Nb=r(console.log,console):"object"===typeof console.log&&(Nb=function(a){console.log(a)})),b&&nb.set("logging_enabled",!0)):a?Nb=a:(Nb=null,nb.remove("logging_enabled"))}E.enableLogging=Pb;E.ServerValue={TIMESTAMP:{".sv":"timestamp"}};E.INTERNAL=Z;E.Context=Y;})();
module.exports = Firebase;

},{}],5:[function(require,module,exports){
(function (process){
// vim:ts=4:sts=4:sw=4:
/*!
 *
 * Copyright 2009-2012 Kris Kowal under the terms of the MIT
 * license found at http://github.com/kriskowal/q/raw/master/LICENSE
 *
 * With parts by Tyler Close
 * Copyright 2007-2009 Tyler Close under the terms of the MIT X license found
 * at http://www.opensource.org/licenses/mit-license.html
 * Forked at ref_send.js version: 2009-05-11
 *
 * With parts by Mark Miller
 * Copyright (C) 2011 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

(function (definition) {
    // Turn off strict mode for this function so we can assign to global.Q
    /* jshint strict: false */

    // This file will function properly as a <script> tag, or a module
    // using CommonJS and NodeJS or RequireJS module formats.  In
    // Common/Node/RequireJS, the module exports the Q API and when
    // executed as a simple <script>, it creates a Q global instead.

    // Montage Require
    if (typeof bootstrap === "function") {
        bootstrap("promise", definition);

    // CommonJS
    } else if (typeof exports === "object") {
        module.exports = definition();

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
        define(definition);

    // SES (Secure EcmaScript)
    } else if (typeof ses !== "undefined") {
        if (!ses.ok()) {
            return;
        } else {
            ses.makeQ = definition;
        }

    // <script>
    } else {
        Q = definition();
    }

})(function () {
"use strict";

var hasStacks = false;
try {
    throw new Error();
} catch (e) {
    hasStacks = !!e.stack;
}

// All code after this point will be filtered from stack traces reported
// by Q.
var qStartingLine = captureLine();
var qFileName;

// shims

// used for fallback in "allResolved"
var noop = function () {};

// Use the fastest possible means to execute a task in a future turn
// of the event loop.
var nextTick =(function () {
    // linked list of tasks (single, with head node)
    var head = {task: void 0, next: null};
    var tail = head;
    var flushing = false;
    var requestTick = void 0;
    var isNodeJS = false;

    function flush() {
        /* jshint loopfunc: true */

        while (head.next) {
            head = head.next;
            var task = head.task;
            head.task = void 0;
            var domain = head.domain;

            if (domain) {
                head.domain = void 0;
                domain.enter();
            }

            try {
                task();

            } catch (e) {
                if (isNodeJS) {
                    // In node, uncaught exceptions are considered fatal errors.
                    // Re-throw them synchronously to interrupt flushing!

                    // Ensure continuation if the uncaught exception is suppressed
                    // listening "uncaughtException" events (as domains does).
                    // Continue in next event to avoid tick recursion.
                    if (domain) {
                        domain.exit();
                    }
                    setTimeout(flush, 0);
                    if (domain) {
                        domain.enter();
                    }

                    throw e;

                } else {
                    // In browsers, uncaught exceptions are not fatal.
                    // Re-throw them asynchronously to avoid slow-downs.
                    setTimeout(function() {
                       throw e;
                    }, 0);
                }
            }

            if (domain) {
                domain.exit();
            }
        }

        flushing = false;
    }

    nextTick = function (task) {
        tail = tail.next = {
            task: task,
            domain: isNodeJS && process.domain,
            next: null
        };

        if (!flushing) {
            flushing = true;
            requestTick();
        }
    };

    if (typeof process !== "undefined" && process.nextTick) {
        // Node.js before 0.9. Note that some fake-Node environments, like the
        // Mocha test runner, introduce a `process` global without a `nextTick`.
        isNodeJS = true;

        requestTick = function () {
            process.nextTick(flush);
        };

    } else if (typeof setImmediate === "function") {
        // In IE10, Node.js 0.9+, or https://github.com/NobleJS/setImmediate
        if (typeof window !== "undefined") {
            requestTick = setImmediate.bind(window, flush);
        } else {
            requestTick = function () {
                setImmediate(flush);
            };
        }

    } else if (typeof MessageChannel !== "undefined") {
        // modern browsers
        // http://www.nonblocking.io/2011/06/windownexttick.html
        var channel = new MessageChannel();
        // At least Safari Version 6.0.5 (8536.30.1) intermittently cannot create
        // working message ports the first time a page loads.
        channel.port1.onmessage = function () {
            requestTick = requestPortTick;
            channel.port1.onmessage = flush;
            flush();
        };
        var requestPortTick = function () {
            // Opera requires us to provide a message payload, regardless of
            // whether we use it.
            channel.port2.postMessage(0);
        };
        requestTick = function () {
            setTimeout(flush, 0);
            requestPortTick();
        };

    } else {
        // old browsers
        requestTick = function () {
            setTimeout(flush, 0);
        };
    }

    return nextTick;
})();

// Attempt to make generics safe in the face of downstream
// modifications.
// There is no situation where this is necessary.
// If you need a security guarantee, these primordials need to be
// deeply frozen anyway, and if you don’t need a security guarantee,
// this is just plain paranoid.
// However, this **might** have the nice side-effect of reducing the size of
// the minified code by reducing x.call() to merely x()
// See Mark Miller’s explanation of what this does.
// http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
var call = Function.call;
function uncurryThis(f) {
    return function () {
        return call.apply(f, arguments);
    };
}
// This is equivalent, but slower:
// uncurryThis = Function_bind.bind(Function_bind.call);
// http://jsperf.com/uncurrythis

var array_slice = uncurryThis(Array.prototype.slice);

var array_reduce = uncurryThis(
    Array.prototype.reduce || function (callback, basis) {
        var index = 0,
            length = this.length;
        // concerning the initial value, if one is not provided
        if (arguments.length === 1) {
            // seek to the first value in the array, accounting
            // for the possibility that is is a sparse array
            do {
                if (index in this) {
                    basis = this[index++];
                    break;
                }
                if (++index >= length) {
                    throw new TypeError();
                }
            } while (1);
        }
        // reduce
        for (; index < length; index++) {
            // account for the possibility that the array is sparse
            if (index in this) {
                basis = callback(basis, this[index], index);
            }
        }
        return basis;
    }
);

var array_indexOf = uncurryThis(
    Array.prototype.indexOf || function (value) {
        // not a very good shim, but good enough for our one use of it
        for (var i = 0; i < this.length; i++) {
            if (this[i] === value) {
                return i;
            }
        }
        return -1;
    }
);

var array_map = uncurryThis(
    Array.prototype.map || function (callback, thisp) {
        var self = this;
        var collect = [];
        array_reduce(self, function (undefined, value, index) {
            collect.push(callback.call(thisp, value, index, self));
        }, void 0);
        return collect;
    }
);

var object_create = Object.create || function (prototype) {
    function Type() { }
    Type.prototype = prototype;
    return new Type();
};

var object_hasOwnProperty = uncurryThis(Object.prototype.hasOwnProperty);

var object_keys = Object.keys || function (object) {
    var keys = [];
    for (var key in object) {
        if (object_hasOwnProperty(object, key)) {
            keys.push(key);
        }
    }
    return keys;
};

var object_toString = uncurryThis(Object.prototype.toString);

function isObject(value) {
    return value === Object(value);
}

// generator related shims

// FIXME: Remove this function once ES6 generators are in SpiderMonkey.
function isStopIteration(exception) {
    return (
        object_toString(exception) === "[object StopIteration]" ||
        exception instanceof QReturnValue
    );
}

// FIXME: Remove this helper and Q.return once ES6 generators are in
// SpiderMonkey.
var QReturnValue;
if (typeof ReturnValue !== "undefined") {
    QReturnValue = ReturnValue;
} else {
    QReturnValue = function (value) {
        this.value = value;
    };
}

// long stack traces

var STACK_JUMP_SEPARATOR = "From previous event:";

function makeStackTraceLong(error, promise) {
    // If possible, transform the error stack trace by removing Node and Q
    // cruft, then concatenating with the stack trace of `promise`. See #57.
    if (hasStacks &&
        promise.stack &&
        typeof error === "object" &&
        error !== null &&
        error.stack &&
        error.stack.indexOf(STACK_JUMP_SEPARATOR) === -1
    ) {
        var stacks = [];
        for (var p = promise; !!p; p = p.source) {
            if (p.stack) {
                stacks.unshift(p.stack);
            }
        }
        stacks.unshift(error.stack);

        var concatedStacks = stacks.join("\n" + STACK_JUMP_SEPARATOR + "\n");
        error.stack = filterStackString(concatedStacks);
    }
}

function filterStackString(stackString) {
    var lines = stackString.split("\n");
    var desiredLines = [];
    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];

        if (!isInternalFrame(line) && !isNodeFrame(line) && line) {
            desiredLines.push(line);
        }
    }
    return desiredLines.join("\n");
}

function isNodeFrame(stackLine) {
    return stackLine.indexOf("(module.js:") !== -1 ||
           stackLine.indexOf("(node.js:") !== -1;
}

function getFileNameAndLineNumber(stackLine) {
    // Named functions: "at functionName (filename:lineNumber:columnNumber)"
    // In IE10 function name can have spaces ("Anonymous function") O_o
    var attempt1 = /at .+ \((.+):(\d+):(?:\d+)\)$/.exec(stackLine);
    if (attempt1) {
        return [attempt1[1], Number(attempt1[2])];
    }

    // Anonymous functions: "at filename:lineNumber:columnNumber"
    var attempt2 = /at ([^ ]+):(\d+):(?:\d+)$/.exec(stackLine);
    if (attempt2) {
        return [attempt2[1], Number(attempt2[2])];
    }

    // Firefox style: "function@filename:lineNumber or @filename:lineNumber"
    var attempt3 = /.*@(.+):(\d+)$/.exec(stackLine);
    if (attempt3) {
        return [attempt3[1], Number(attempt3[2])];
    }
}

function isInternalFrame(stackLine) {
    var fileNameAndLineNumber = getFileNameAndLineNumber(stackLine);

    if (!fileNameAndLineNumber) {
        return false;
    }

    var fileName = fileNameAndLineNumber[0];
    var lineNumber = fileNameAndLineNumber[1];

    return fileName === qFileName &&
        lineNumber >= qStartingLine &&
        lineNumber <= qEndingLine;
}

// discover own file name and line number range for filtering stack
// traces
function captureLine() {
    if (!hasStacks) {
        return;
    }

    try {
        throw new Error();
    } catch (e) {
        var lines = e.stack.split("\n");
        var firstLine = lines[0].indexOf("@") > 0 ? lines[1] : lines[2];
        var fileNameAndLineNumber = getFileNameAndLineNumber(firstLine);
        if (!fileNameAndLineNumber) {
            return;
        }

        qFileName = fileNameAndLineNumber[0];
        return fileNameAndLineNumber[1];
    }
}

function deprecate(callback, name, alternative) {
    return function () {
        if (typeof console !== "undefined" &&
            typeof console.warn === "function") {
            console.warn(name + " is deprecated, use " + alternative +
                         " instead.", new Error("").stack);
        }
        return callback.apply(callback, arguments);
    };
}

// end of shims
// beginning of real work

/**
 * Constructs a promise for an immediate reference, passes promises through, or
 * coerces promises from different systems.
 * @param value immediate reference or promise
 */
function Q(value) {
    // If the object is already a Promise, return it directly.  This enables
    // the resolve function to both be used to created references from objects,
    // but to tolerably coerce non-promises to promises.
    if (isPromise(value)) {
        return value;
    }

    // assimilate thenables
    if (isPromiseAlike(value)) {
        return coerce(value);
    } else {
        return fulfill(value);
    }
}
Q.resolve = Q;

/**
 * Performs a task in a future turn of the event loop.
 * @param {Function} task
 */
Q.nextTick = nextTick;

/**
 * Controls whether or not long stack traces will be on
 */
Q.longStackSupport = false;

/**
 * Constructs a {promise, resolve, reject} object.
 *
 * `resolve` is a callback to invoke with a more resolved value for the
 * promise. To fulfill the promise, invoke `resolve` with any value that is
 * not a thenable. To reject the promise, invoke `resolve` with a rejected
 * thenable, or invoke `reject` with the reason directly. To resolve the
 * promise to another thenable, thus putting it in the same state, invoke
 * `resolve` with that other thenable.
 */
Q.defer = defer;
function defer() {
    // if "messages" is an "Array", that indicates that the promise has not yet
    // been resolved.  If it is "undefined", it has been resolved.  Each
    // element of the messages array is itself an array of complete arguments to
    // forward to the resolved promise.  We coerce the resolution value to a
    // promise using the `resolve` function because it handles both fully
    // non-thenable values and other thenables gracefully.
    var messages = [], progressListeners = [], resolvedPromise;

    var deferred = object_create(defer.prototype);
    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, operands) {
        var args = array_slice(arguments);
        if (messages) {
            messages.push(args);
            if (op === "when" && operands[1]) { // progress operand
                progressListeners.push(operands[1]);
            }
        } else {
            nextTick(function () {
                resolvedPromise.promiseDispatch.apply(resolvedPromise, args);
            });
        }
    };

    // XXX deprecated
    promise.valueOf = function () {
        if (messages) {
            return promise;
        }
        var nearerValue = nearer(resolvedPromise);
        if (isPromise(nearerValue)) {
            resolvedPromise = nearerValue; // shorten chain
        }
        return nearerValue;
    };

    promise.inspect = function () {
        if (!resolvedPromise) {
            return { state: "pending" };
        }
        return resolvedPromise.inspect();
    };

    if (Q.longStackSupport && hasStacks) {
        try {
            throw new Error();
        } catch (e) {
            // NOTE: don't try to use `Error.captureStackTrace` or transfer the
            // accessor around; that causes memory leaks as per GH-111. Just
            // reify the stack trace as a string ASAP.
            //
            // At the same time, cut off the first line; it's always just
            // "[object Promise]\n", as per the `toString`.
            promise.stack = e.stack.substring(e.stack.indexOf("\n") + 1);
        }
    }

    // NOTE: we do the checks for `resolvedPromise` in each method, instead of
    // consolidating them into `become`, since otherwise we'd create new
    // promises with the lines `become(whatever(value))`. See e.g. GH-252.

    function become(newPromise) {
        resolvedPromise = newPromise;
        promise.source = newPromise;

        array_reduce(messages, function (undefined, message) {
            nextTick(function () {
                newPromise.promiseDispatch.apply(newPromise, message);
            });
        }, void 0);

        messages = void 0;
        progressListeners = void 0;
    }

    deferred.promise = promise;
    deferred.resolve = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(Q(value));
    };

    deferred.fulfill = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(fulfill(value));
    };
    deferred.reject = function (reason) {
        if (resolvedPromise) {
            return;
        }

        become(reject(reason));
    };
    deferred.notify = function (progress) {
        if (resolvedPromise) {
            return;
        }

        array_reduce(progressListeners, function (undefined, progressListener) {
            nextTick(function () {
                progressListener(progress);
            });
        }, void 0);
    };

    return deferred;
}

/**
 * Creates a Node-style callback that will resolve or reject the deferred
 * promise.
 * @returns a nodeback
 */
defer.prototype.makeNodeResolver = function () {
    var self = this;
    return function (error, value) {
        if (error) {
            self.reject(error);
        } else if (arguments.length > 2) {
            self.resolve(array_slice(arguments, 1));
        } else {
            self.resolve(value);
        }
    };
};

/**
 * @param resolver {Function} a function that returns nothing and accepts
 * the resolve, reject, and notify functions for a deferred.
 * @returns a promise that may be resolved with the given resolve and reject
 * functions, or rejected by a thrown exception in resolver
 */
Q.Promise = promise; // ES6
Q.promise = promise;
function promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("resolver must be a function.");
    }
    var deferred = defer();
    try {
        resolver(deferred.resolve, deferred.reject, deferred.notify);
    } catch (reason) {
        deferred.reject(reason);
    }
    return deferred.promise;
}

promise.race = race; // ES6
promise.all = all; // ES6
promise.reject = reject; // ES6
promise.resolve = Q; // ES6

// XXX experimental.  This method is a way to denote that a local value is
// serializable and should be immediately dispatched to a remote upon request,
// instead of passing a reference.
Q.passByCopy = function (object) {
    //freeze(object);
    //passByCopies.set(object, true);
    return object;
};

Promise.prototype.passByCopy = function () {
    //freeze(object);
    //passByCopies.set(object, true);
    return this;
};

/**
 * If two promises eventually fulfill to the same value, promises that value,
 * but otherwise rejects.
 * @param x {Any*}
 * @param y {Any*}
 * @returns {Any*} a promise for x and y if they are the same, but a rejection
 * otherwise.
 *
 */
Q.join = function (x, y) {
    return Q(x).join(y);
};

Promise.prototype.join = function (that) {
    return Q([this, that]).spread(function (x, y) {
        if (x === y) {
            // TODO: "===" should be Object.is or equiv
            return x;
        } else {
            throw new Error("Can't join: not the same: " + x + " " + y);
        }
    });
};

/**
 * Returns a promise for the first of an array of promises to become fulfilled.
 * @param answers {Array[Any*]} promises to race
 * @returns {Any*} the first promise to be fulfilled
 */
Q.race = race;
function race(answerPs) {
    return promise(function(resolve, reject) {
        // Switch to this once we can assume at least ES5
        // answerPs.forEach(function(answerP) {
        //     Q(answerP).then(resolve, reject);
        // });
        // Use this in the meantime
        for (var i = 0, len = answerPs.length; i < len; i++) {
            Q(answerPs[i]).then(resolve, reject);
        }
    });
}

Promise.prototype.race = function () {
    return this.then(Q.race);
};

/**
 * Constructs a Promise with a promise descriptor object and optional fallback
 * function.  The descriptor contains methods like when(rejected), get(name),
 * set(name, value), post(name, args), and delete(name), which all
 * return either a value, a promise for a value, or a rejection.  The fallback
 * accepts the operation name, a resolver, and any further arguments that would
 * have been forwarded to the appropriate method above had a method been
 * provided with the proper name.  The API makes no guarantees about the nature
 * of the returned object, apart from that it is usable whereever promises are
 * bought and sold.
 */
Q.makePromise = Promise;
function Promise(descriptor, fallback, inspect) {
    if (fallback === void 0) {
        fallback = function (op) {
            return reject(new Error(
                "Promise does not support operation: " + op
            ));
        };
    }
    if (inspect === void 0) {
        inspect = function () {
            return {state: "unknown"};
        };
    }

    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, args) {
        var result;
        try {
            if (descriptor[op]) {
                result = descriptor[op].apply(promise, args);
            } else {
                result = fallback.call(promise, op, args);
            }
        } catch (exception) {
            result = reject(exception);
        }
        if (resolve) {
            resolve(result);
        }
    };

    promise.inspect = inspect;

    // XXX deprecated `valueOf` and `exception` support
    if (inspect) {
        var inspected = inspect();
        if (inspected.state === "rejected") {
            promise.exception = inspected.reason;
        }

        promise.valueOf = function () {
            var inspected = inspect();
            if (inspected.state === "pending" ||
                inspected.state === "rejected") {
                return promise;
            }
            return inspected.value;
        };
    }

    return promise;
}

Promise.prototype.toString = function () {
    return "[object Promise]";
};

Promise.prototype.then = function (fulfilled, rejected, progressed) {
    var self = this;
    var deferred = defer();
    var done = false;   // ensure the untrusted promise makes at most a
                        // single call to one of the callbacks

    function _fulfilled(value) {
        try {
            return typeof fulfilled === "function" ? fulfilled(value) : value;
        } catch (exception) {
            return reject(exception);
        }
    }

    function _rejected(exception) {
        if (typeof rejected === "function") {
            makeStackTraceLong(exception, self);
            try {
                return rejected(exception);
            } catch (newException) {
                return reject(newException);
            }
        }
        return reject(exception);
    }

    function _progressed(value) {
        return typeof progressed === "function" ? progressed(value) : value;
    }

    nextTick(function () {
        self.promiseDispatch(function (value) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_fulfilled(value));
        }, "when", [function (exception) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_rejected(exception));
        }]);
    });

    // Progress propagator need to be attached in the current tick.
    self.promiseDispatch(void 0, "when", [void 0, function (value) {
        var newValue;
        var threw = false;
        try {
            newValue = _progressed(value);
        } catch (e) {
            threw = true;
            if (Q.onerror) {
                Q.onerror(e);
            } else {
                throw e;
            }
        }

        if (!threw) {
            deferred.notify(newValue);
        }
    }]);

    return deferred.promise;
};

/**
 * Registers an observer on a promise.
 *
 * Guarantees:
 *
 * 1. that fulfilled and rejected will be called only once.
 * 2. that either the fulfilled callback or the rejected callback will be
 *    called, but not both.
 * 3. that fulfilled and rejected will not be called in this turn.
 *
 * @param value      promise or immediate reference to observe
 * @param fulfilled  function to be called with the fulfilled value
 * @param rejected   function to be called with the rejection exception
 * @param progressed function to be called on any progress notifications
 * @return promise for the return value from the invoked callback
 */
Q.when = when;
function when(value, fulfilled, rejected, progressed) {
    return Q(value).then(fulfilled, rejected, progressed);
}

Promise.prototype.thenResolve = function (value) {
    return this.then(function () { return value; });
};

Q.thenResolve = function (promise, value) {
    return Q(promise).thenResolve(value);
};

Promise.prototype.thenReject = function (reason) {
    return this.then(function () { throw reason; });
};

Q.thenReject = function (promise, reason) {
    return Q(promise).thenReject(reason);
};

/**
 * If an object is not a promise, it is as "near" as possible.
 * If a promise is rejected, it is as "near" as possible too.
 * If it’s a fulfilled promise, the fulfillment value is nearer.
 * If it’s a deferred promise and the deferred has been resolved, the
 * resolution is "nearer".
 * @param object
 * @returns most resolved (nearest) form of the object
 */

// XXX should we re-do this?
Q.nearer = nearer;
function nearer(value) {
    if (isPromise(value)) {
        var inspected = value.inspect();
        if (inspected.state === "fulfilled") {
            return inspected.value;
        }
    }
    return value;
}

/**
 * @returns whether the given object is a promise.
 * Otherwise it is a fulfilled value.
 */
Q.isPromise = isPromise;
function isPromise(object) {
    return isObject(object) &&
        typeof object.promiseDispatch === "function" &&
        typeof object.inspect === "function";
}

Q.isPromiseAlike = isPromiseAlike;
function isPromiseAlike(object) {
    return isObject(object) && typeof object.then === "function";
}

/**
 * @returns whether the given object is a pending promise, meaning not
 * fulfilled or rejected.
 */
Q.isPending = isPending;
function isPending(object) {
    return isPromise(object) && object.inspect().state === "pending";
}

Promise.prototype.isPending = function () {
    return this.inspect().state === "pending";
};

/**
 * @returns whether the given object is a value or fulfilled
 * promise.
 */
Q.isFulfilled = isFulfilled;
function isFulfilled(object) {
    return !isPromise(object) || object.inspect().state === "fulfilled";
}

Promise.prototype.isFulfilled = function () {
    return this.inspect().state === "fulfilled";
};

/**
 * @returns whether the given object is a rejected promise.
 */
Q.isRejected = isRejected;
function isRejected(object) {
    return isPromise(object) && object.inspect().state === "rejected";
}

Promise.prototype.isRejected = function () {
    return this.inspect().state === "rejected";
};

//// BEGIN UNHANDLED REJECTION TRACKING

// This promise library consumes exceptions thrown in handlers so they can be
// handled by a subsequent promise.  The exceptions get added to this array when
// they are created, and removed when they are handled.  Note that in ES6 or
// shimmed environments, this would naturally be a `Set`.
var unhandledReasons = [];
var unhandledRejections = [];
var trackUnhandledRejections = true;

function resetUnhandledRejections() {
    unhandledReasons.length = 0;
    unhandledRejections.length = 0;

    if (!trackUnhandledRejections) {
        trackUnhandledRejections = true;
    }
}

function trackRejection(promise, reason) {
    if (!trackUnhandledRejections) {
        return;
    }

    unhandledRejections.push(promise);
    if (reason && typeof reason.stack !== "undefined") {
        unhandledReasons.push(reason.stack);
    } else {
        unhandledReasons.push("(no stack) " + reason);
    }
}

function untrackRejection(promise) {
    if (!trackUnhandledRejections) {
        return;
    }

    var at = array_indexOf(unhandledRejections, promise);
    if (at !== -1) {
        unhandledRejections.splice(at, 1);
        unhandledReasons.splice(at, 1);
    }
}

Q.resetUnhandledRejections = resetUnhandledRejections;

Q.getUnhandledReasons = function () {
    // Make a copy so that consumers can't interfere with our internal state.
    return unhandledReasons.slice();
};

Q.stopUnhandledRejectionTracking = function () {
    resetUnhandledRejections();
    trackUnhandledRejections = false;
};

resetUnhandledRejections();

//// END UNHANDLED REJECTION TRACKING

/**
 * Constructs a rejected promise.
 * @param reason value describing the failure
 */
Q.reject = reject;
function reject(reason) {
    var rejection = Promise({
        "when": function (rejected) {
            // note that the error has been handled
            if (rejected) {
                untrackRejection(this);
            }
            return rejected ? rejected(reason) : this;
        }
    }, function fallback() {
        return this;
    }, function inspect() {
        return { state: "rejected", reason: reason };
    });

    // Note that the reason has not been handled.
    trackRejection(rejection, reason);

    return rejection;
}

/**
 * Constructs a fulfilled promise for an immediate reference.
 * @param value immediate reference
 */
Q.fulfill = fulfill;
function fulfill(value) {
    return Promise({
        "when": function () {
            return value;
        },
        "get": function (name) {
            return value[name];
        },
        "set": function (name, rhs) {
            value[name] = rhs;
        },
        "delete": function (name) {
            delete value[name];
        },
        "post": function (name, args) {
            // Mark Miller proposes that post with no name should apply a
            // promised function.
            if (name === null || name === void 0) {
                return value.apply(void 0, args);
            } else {
                return value[name].apply(value, args);
            }
        },
        "apply": function (thisp, args) {
            return value.apply(thisp, args);
        },
        "keys": function () {
            return object_keys(value);
        }
    }, void 0, function inspect() {
        return { state: "fulfilled", value: value };
    });
}

/**
 * Converts thenables to Q promises.
 * @param promise thenable promise
 * @returns a Q promise
 */
function coerce(promise) {
    var deferred = defer();
    nextTick(function () {
        try {
            promise.then(deferred.resolve, deferred.reject, deferred.notify);
        } catch (exception) {
            deferred.reject(exception);
        }
    });
    return deferred.promise;
}

/**
 * Annotates an object such that it will never be
 * transferred away from this process over any promise
 * communication channel.
 * @param object
 * @returns promise a wrapping of that object that
 * additionally responds to the "isDef" message
 * without a rejection.
 */
Q.master = master;
function master(object) {
    return Promise({
        "isDef": function () {}
    }, function fallback(op, args) {
        return dispatch(object, op, args);
    }, function () {
        return Q(object).inspect();
    });
}

/**
 * Spreads the values of a promised array of arguments into the
 * fulfillment callback.
 * @param fulfilled callback that receives variadic arguments from the
 * promised array
 * @param rejected callback that receives the exception if the promise
 * is rejected.
 * @returns a promise for the return value or thrown exception of
 * either callback.
 */
Q.spread = spread;
function spread(value, fulfilled, rejected) {
    return Q(value).spread(fulfilled, rejected);
}

Promise.prototype.spread = function (fulfilled, rejected) {
    return this.all().then(function (array) {
        return fulfilled.apply(void 0, array);
    }, rejected);
};

/**
 * The async function is a decorator for generator functions, turning
 * them into asynchronous generators.  Although generators are only part
 * of the newest ECMAScript 6 drafts, this code does not cause syntax
 * errors in older engines.  This code should continue to work and will
 * in fact improve over time as the language improves.
 *
 * ES6 generators are currently part of V8 version 3.19 with the
 * --harmony-generators runtime flag enabled.  SpiderMonkey has had them
 * for longer, but under an older Python-inspired form.  This function
 * works on both kinds of generators.
 *
 * Decorates a generator function such that:
 *  - it may yield promises
 *  - execution will continue when that promise is fulfilled
 *  - the value of the yield expression will be the fulfilled value
 *  - it returns a promise for the return value (when the generator
 *    stops iterating)
 *  - the decorated function returns a promise for the return value
 *    of the generator or the first rejected promise among those
 *    yielded.
 *  - if an error is thrown in the generator, it propagates through
 *    every following yield until it is caught, or until it escapes
 *    the generator function altogether, and is translated into a
 *    rejection for the promise returned by the decorated generator.
 */
Q.async = async;
function async(makeGenerator) {
    return function () {
        // when verb is "send", arg is a value
        // when verb is "throw", arg is an exception
        function continuer(verb, arg) {
            var result;

            // Until V8 3.19 / Chromium 29 is released, SpiderMonkey is the only
            // engine that has a deployed base of browsers that support generators.
            // However, SM's generators use the Python-inspired semantics of
            // outdated ES6 drafts.  We would like to support ES6, but we'd also
            // like to make it possible to use generators in deployed browsers, so
            // we also support Python-style generators.  At some point we can remove
            // this block.

            if (typeof StopIteration === "undefined") {
                // ES6 Generators
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    return reject(exception);
                }
                if (result.done) {
                    return result.value;
                } else {
                    return when(result.value, callback, errback);
                }
            } else {
                // SpiderMonkey Generators
                // FIXME: Remove this case when SM does ES6 generators.
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    if (isStopIteration(exception)) {
                        return exception.value;
                    } else {
                        return reject(exception);
                    }
                }
                return when(result, callback, errback);
            }
        }
        var generator = makeGenerator.apply(this, arguments);
        var callback = continuer.bind(continuer, "next");
        var errback = continuer.bind(continuer, "throw");
        return callback();
    };
}

/**
 * The spawn function is a small wrapper around async that immediately
 * calls the generator and also ends the promise chain, so that any
 * unhandled errors are thrown instead of forwarded to the error
 * handler. This is useful because it's extremely common to run
 * generators at the top-level to work with libraries.
 */
Q.spawn = spawn;
function spawn(makeGenerator) {
    Q.done(Q.async(makeGenerator)());
}

// FIXME: Remove this interface once ES6 generators are in SpiderMonkey.
/**
 * Throws a ReturnValue exception to stop an asynchronous generator.
 *
 * This interface is a stop-gap measure to support generator return
 * values in older Firefox/SpiderMonkey.  In browsers that support ES6
 * generators like Chromium 29, just use "return" in your generator
 * functions.
 *
 * @param value the return value for the surrounding generator
 * @throws ReturnValue exception with the value.
 * @example
 * // ES6 style
 * Q.async(function* () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      return foo + bar;
 * })
 * // Older SpiderMonkey style
 * Q.async(function () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      Q.return(foo + bar);
 * })
 */
Q["return"] = _return;
function _return(value) {
    throw new QReturnValue(value);
}

/**
 * The promised function decorator ensures that any promise arguments
 * are settled and passed as values (`this` is also settled and passed
 * as a value).  It will also ensure that the result of a function is
 * always a promise.
 *
 * @example
 * var add = Q.promised(function (a, b) {
 *     return a + b;
 * });
 * add(Q(a), Q(B));
 *
 * @param {function} callback The function to decorate
 * @returns {function} a function that has been decorated.
 */
Q.promised = promised;
function promised(callback) {
    return function () {
        return spread([this, all(arguments)], function (self, args) {
            return callback.apply(self, args);
        });
    };
}

/**
 * sends a message to a value in a future turn
 * @param object* the recipient
 * @param op the name of the message operation, e.g., "when",
 * @param args further arguments to be forwarded to the operation
 * @returns result {Promise} a promise for the result of the operation
 */
Q.dispatch = dispatch;
function dispatch(object, op, args) {
    return Q(object).dispatch(op, args);
}

Promise.prototype.dispatch = function (op, args) {
    var self = this;
    var deferred = defer();
    nextTick(function () {
        self.promiseDispatch(deferred.resolve, op, args);
    });
    return deferred.promise;
};

/**
 * Gets the value of a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to get
 * @return promise for the property value
 */
Q.get = function (object, key) {
    return Q(object).dispatch("get", [key]);
};

Promise.prototype.get = function (key) {
    return this.dispatch("get", [key]);
};

/**
 * Sets the value of a property in a future turn.
 * @param object    promise or immediate reference for object object
 * @param name      name of property to set
 * @param value     new value of property
 * @return promise for the return value
 */
Q.set = function (object, key, value) {
    return Q(object).dispatch("set", [key, value]);
};

Promise.prototype.set = function (key, value) {
    return this.dispatch("set", [key, value]);
};

/**
 * Deletes a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to delete
 * @return promise for the return value
 */
Q.del = // XXX legacy
Q["delete"] = function (object, key) {
    return Q(object).dispatch("delete", [key]);
};

Promise.prototype.del = // XXX legacy
Promise.prototype["delete"] = function (key) {
    return this.dispatch("delete", [key]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param value     a value to post, typically an array of
 *                  invocation arguments for promises that
 *                  are ultimately backed with `resolve` values,
 *                  as opposed to those backed with URLs
 *                  wherein the posted value can be any
 *                  JSON serializable object.
 * @return promise for the return value
 */
// bound locally because it is used by other methods
Q.mapply = // XXX As proposed by "Redsandro"
Q.post = function (object, name, args) {
    return Q(object).dispatch("post", [name, args]);
};

Promise.prototype.mapply = // XXX As proposed by "Redsandro"
Promise.prototype.post = function (name, args) {
    return this.dispatch("post", [name, args]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param ...args   array of invocation arguments
 * @return promise for the return value
 */
Q.send = // XXX Mark Miller's proposed parlance
Q.mcall = // XXX As proposed by "Redsandro"
Q.invoke = function (object, name /*...args*/) {
    return Q(object).dispatch("post", [name, array_slice(arguments, 2)]);
};

Promise.prototype.send = // XXX Mark Miller's proposed parlance
Promise.prototype.mcall = // XXX As proposed by "Redsandro"
Promise.prototype.invoke = function (name /*...args*/) {
    return this.dispatch("post", [name, array_slice(arguments, 1)]);
};

/**
 * Applies the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param args      array of application arguments
 */
Q.fapply = function (object, args) {
    return Q(object).dispatch("apply", [void 0, args]);
};

Promise.prototype.fapply = function (args) {
    return this.dispatch("apply", [void 0, args]);
};

/**
 * Calls the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q["try"] =
Q.fcall = function (object /* ...args*/) {
    return Q(object).dispatch("apply", [void 0, array_slice(arguments, 1)]);
};

Promise.prototype.fcall = function (/*...args*/) {
    return this.dispatch("apply", [void 0, array_slice(arguments)]);
};

/**
 * Binds the promised function, transforming return values into a fulfilled
 * promise and thrown errors into a rejected one.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q.fbind = function (object /*...args*/) {
    var promise = Q(object);
    var args = array_slice(arguments, 1);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};
Promise.prototype.fbind = function (/*...args*/) {
    var promise = this;
    var args = array_slice(arguments);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};

/**
 * Requests the names of the owned properties of a promised
 * object in a future turn.
 * @param object    promise or immediate reference for target object
 * @return promise for the keys of the eventually settled object
 */
Q.keys = function (object) {
    return Q(object).dispatch("keys", []);
};

Promise.prototype.keys = function () {
    return this.dispatch("keys", []);
};

/**
 * Turns an array of promises into a promise for an array.  If any of
 * the promises gets rejected, the whole array is rejected immediately.
 * @param {Array*} an array (or promise for an array) of values (or
 * promises for values)
 * @returns a promise for an array of the corresponding values
 */
// By Mark Miller
// http://wiki.ecmascript.org/doku.php?id=strawman:concurrency&rev=1308776521#allfulfilled
Q.all = all;
function all(promises) {
    return when(promises, function (promises) {
        var countDown = 0;
        var deferred = defer();
        array_reduce(promises, function (undefined, promise, index) {
            var snapshot;
            if (
                isPromise(promise) &&
                (snapshot = promise.inspect()).state === "fulfilled"
            ) {
                promises[index] = snapshot.value;
            } else {
                ++countDown;
                when(
                    promise,
                    function (value) {
                        promises[index] = value;
                        if (--countDown === 0) {
                            deferred.resolve(promises);
                        }
                    },
                    deferred.reject,
                    function (progress) {
                        deferred.notify({ index: index, value: progress });
                    }
                );
            }
        }, void 0);
        if (countDown === 0) {
            deferred.resolve(promises);
        }
        return deferred.promise;
    });
}

Promise.prototype.all = function () {
    return all(this);
};

/**
 * Waits for all promises to be settled, either fulfilled or
 * rejected.  This is distinct from `all` since that would stop
 * waiting at the first rejection.  The promise returned by
 * `allResolved` will never be rejected.
 * @param promises a promise for an array (or an array) of promises
 * (or values)
 * @return a promise for an array of promises
 */
Q.allResolved = deprecate(allResolved, "allResolved", "allSettled");
function allResolved(promises) {
    return when(promises, function (promises) {
        promises = array_map(promises, Q);
        return when(all(array_map(promises, function (promise) {
            return when(promise, noop, noop);
        })), function () {
            return promises;
        });
    });
}

Promise.prototype.allResolved = function () {
    return allResolved(this);
};

/**
 * @see Promise#allSettled
 */
Q.allSettled = allSettled;
function allSettled(promises) {
    return Q(promises).allSettled();
}

/**
 * Turns an array of promises into a promise for an array of their states (as
 * returned by `inspect`) when they have all settled.
 * @param {Array[Any*]} values an array (or promise for an array) of values (or
 * promises for values)
 * @returns {Array[State]} an array of states for the respective values.
 */
Promise.prototype.allSettled = function () {
    return this.then(function (promises) {
        return all(array_map(promises, function (promise) {
            promise = Q(promise);
            function regardless() {
                return promise.inspect();
            }
            return promise.then(regardless, regardless);
        }));
    });
};

/**
 * Captures the failure of a promise, giving an oportunity to recover
 * with a callback.  If the given promise is fulfilled, the returned
 * promise is fulfilled.
 * @param {Any*} promise for something
 * @param {Function} callback to fulfill the returned promise if the
 * given promise is rejected
 * @returns a promise for the return value of the callback
 */
Q.fail = // XXX legacy
Q["catch"] = function (object, rejected) {
    return Q(object).then(void 0, rejected);
};

Promise.prototype.fail = // XXX legacy
Promise.prototype["catch"] = function (rejected) {
    return this.then(void 0, rejected);
};

/**
 * Attaches a listener that can respond to progress notifications from a
 * promise's originating deferred. This listener receives the exact arguments
 * passed to ``deferred.notify``.
 * @param {Any*} promise for something
 * @param {Function} callback to receive any progress notifications
 * @returns the given promise, unchanged
 */
Q.progress = progress;
function progress(object, progressed) {
    return Q(object).then(void 0, void 0, progressed);
}

Promise.prototype.progress = function (progressed) {
    return this.then(void 0, void 0, progressed);
};

/**
 * Provides an opportunity to observe the settling of a promise,
 * regardless of whether the promise is fulfilled or rejected.  Forwards
 * the resolution to the returned promise when the callback is done.
 * The callback can return a promise to defer completion.
 * @param {Any*} promise
 * @param {Function} callback to observe the resolution of the given
 * promise, takes no arguments.
 * @returns a promise for the resolution of the given promise when
 * ``fin`` is done.
 */
Q.fin = // XXX legacy
Q["finally"] = function (object, callback) {
    return Q(object)["finally"](callback);
};

Promise.prototype.fin = // XXX legacy
Promise.prototype["finally"] = function (callback) {
    callback = Q(callback);
    return this.then(function (value) {
        return callback.fcall().then(function () {
            return value;
        });
    }, function (reason) {
        // TODO attempt to recycle the rejection with "this".
        return callback.fcall().then(function () {
            throw reason;
        });
    });
};

/**
 * Terminates a chain of promises, forcing rejections to be
 * thrown as exceptions.
 * @param {Any*} promise at the end of a chain of promises
 * @returns nothing
 */
Q.done = function (object, fulfilled, rejected, progress) {
    return Q(object).done(fulfilled, rejected, progress);
};

Promise.prototype.done = function (fulfilled, rejected, progress) {
    var onUnhandledError = function (error) {
        // forward to a future turn so that ``when``
        // does not catch it and turn it into a rejection.
        nextTick(function () {
            makeStackTraceLong(error, promise);
            if (Q.onerror) {
                Q.onerror(error);
            } else {
                throw error;
            }
        });
    };

    // Avoid unnecessary `nextTick`ing via an unnecessary `when`.
    var promise = fulfilled || rejected || progress ?
        this.then(fulfilled, rejected, progress) :
        this;

    if (typeof process === "object" && process && process.domain) {
        onUnhandledError = process.domain.bind(onUnhandledError);
    }

    promise.then(void 0, onUnhandledError);
};

/**
 * Causes a promise to be rejected if it does not get fulfilled before
 * some milliseconds time out.
 * @param {Any*} promise
 * @param {Number} milliseconds timeout
 * @param {String} custom error message (optional)
 * @returns a promise for the resolution of the given promise if it is
 * fulfilled before the timeout, otherwise rejected.
 */
Q.timeout = function (object, ms, message) {
    return Q(object).timeout(ms, message);
};

Promise.prototype.timeout = function (ms, message) {
    var deferred = defer();
    var timeoutId = setTimeout(function () {
        deferred.reject(new Error(message || "Timed out after " + ms + " ms"));
    }, ms);

    this.then(function (value) {
        clearTimeout(timeoutId);
        deferred.resolve(value);
    }, function (exception) {
        clearTimeout(timeoutId);
        deferred.reject(exception);
    }, deferred.notify);

    return deferred.promise;
};

/**
 * Returns a promise for the given value (or promised value), some
 * milliseconds after it resolved. Passes rejections immediately.
 * @param {Any*} promise
 * @param {Number} milliseconds
 * @returns a promise for the resolution of the given promise after milliseconds
 * time has elapsed since the resolution of the given promise.
 * If the given promise rejects, that is passed immediately.
 */
Q.delay = function (object, timeout) {
    if (timeout === void 0) {
        timeout = object;
        object = void 0;
    }
    return Q(object).delay(timeout);
};

Promise.prototype.delay = function (timeout) {
    return this.then(function (value) {
        var deferred = defer();
        setTimeout(function () {
            deferred.resolve(value);
        }, timeout);
        return deferred.promise;
    });
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided as an array, and returns a promise.
 *
 *      Q.nfapply(FS.readFile, [__filename])
 *      .then(function (content) {
 *      })
 *
 */
Q.nfapply = function (callback, args) {
    return Q(callback).nfapply(args);
};

Promise.prototype.nfapply = function (args) {
    var deferred = defer();
    var nodeArgs = array_slice(args);
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided individually, and returns a promise.
 * @example
 * Q.nfcall(FS.readFile, __filename)
 * .then(function (content) {
 * })
 *
 */
Q.nfcall = function (callback /*...args*/) {
    var args = array_slice(arguments, 1);
    return Q(callback).nfapply(args);
};

Promise.prototype.nfcall = function (/*...args*/) {
    var nodeArgs = array_slice(arguments);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Wraps a NodeJS continuation passing function and returns an equivalent
 * version that returns a promise.
 * @example
 * Q.nfbind(FS.readFile, __filename)("utf-8")
 * .then(console.log)
 * .done()
 */
Q.nfbind =
Q.denodeify = function (callback /*...args*/) {
    var baseArgs = array_slice(arguments, 1);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        Q(callback).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nfbind =
Promise.prototype.denodeify = function (/*...args*/) {
    var args = array_slice(arguments);
    args.unshift(this);
    return Q.denodeify.apply(void 0, args);
};

Q.nbind = function (callback, thisp /*...args*/) {
    var baseArgs = array_slice(arguments, 2);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        function bound() {
            return callback.apply(thisp, arguments);
        }
        Q(bound).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nbind = function (/*thisp, ...args*/) {
    var args = array_slice(arguments, 0);
    args.unshift(this);
    return Q.nbind.apply(void 0, args);
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback with a given array of arguments, plus a provided callback.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param {Array} args arguments to pass to the method; the callback
 * will be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nmapply = // XXX As proposed by "Redsandro"
Q.npost = function (object, name, args) {
    return Q(object).npost(name, args);
};

Promise.prototype.nmapply = // XXX As proposed by "Redsandro"
Promise.prototype.npost = function (name, args) {
    var nodeArgs = array_slice(args || []);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback, forwarding the given variadic arguments, plus a provided
 * callback argument.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param ...args arguments to pass to the method; the callback will
 * be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nsend = // XXX Based on Mark Miller's proposed "send"
Q.nmcall = // XXX Based on "Redsandro's" proposal
Q.ninvoke = function (object, name /*...args*/) {
    var nodeArgs = array_slice(arguments, 2);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    Q(object).dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

Promise.prototype.nsend = // XXX Based on Mark Miller's proposed "send"
Promise.prototype.nmcall = // XXX Based on "Redsandro's" proposal
Promise.prototype.ninvoke = function (name /*...args*/) {
    var nodeArgs = array_slice(arguments, 1);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * If a function would like to support both Node continuation-passing-style and
 * promise-returning-style, it can end its internal promise chain with
 * `nodeify(nodeback)`, forwarding the optional nodeback argument.  If the user
 * elects to use a nodeback, the result will be sent there.  If they do not
 * pass a nodeback, they will receive the result promise.
 * @param object a result (or a promise for a result)
 * @param {Function} nodeback a Node.js-style callback
 * @returns either the promise or nothing
 */
Q.nodeify = nodeify;
function nodeify(object, nodeback) {
    return Q(object).nodeify(nodeback);
}

Promise.prototype.nodeify = function (nodeback) {
    if (nodeback) {
        this.then(function (value) {
            nextTick(function () {
                nodeback(null, value);
            });
        }, function (error) {
            nextTick(function () {
                nodeback(error);
            });
        });
    } else {
        return this;
    }
};

// All code before this point will be filtered from stack traces.
var qEndingLine = captureLine();

return Q;

});

}).call(this,require('_process'))
},{"_process":1}],6:[function(require,module,exports){
var Q = require('q');
var Firebase = require('client-firebase');

function FirebaseAdaptor(url) {
  this.baseref = new Firebase(url);
}
FirebaseAdaptor.prototype = {
  constructor: FirebaseAdaptor,
  once: function(property) {
    var deferred = Q.defer();
    this.baseref.child(property).once('value', this._resolvePromiseWithSnapshotValue.bind(this, deferred));
    return deferred.promise;
  },
  onChange: function(callback) {
    this.baseref.on('child_changed', this._callCallbackWithSnapshotValue.bind(this, callback));
  },
  _resolvePromiseWithSnapshotValue: function(deferred, snapshot) {
    deferred.resolve(snapshot.val());
  },
  _callCallbackWithSnapshotValue: function(callback, snapshot) {
    callback(snapshot.name(), snapshot.val());
  }
};

module.exports = FirebaseAdaptor;
},{"client-firebase":4,"q":5}],7:[function(require,module,exports){
module.exports=require(5)
},{"/Users/nick/dev/sandbox/node_modules/mapper-firebase/node_modules/q/q.js":5,"_process":1}],8:[function(require,module,exports){
var Q = require('q');

function Mapper(store, map, updateable) {
  this.store = store;
  this.map = map;
  this.viewModel = {};
  this.dependencyMap = {};
  if(updateable) {
    this.bind();
  }
}
Mapper.prototype = {
  constructor: Mapper,
  getViewModel: function() {
    return this.initMap()
            .then(this.initDependants.bind(this))
            .then(function() {
              return this.viewModel;
            }.bind(this));
  },
  initMap: function() {
    return Q.all(Object.keys(this.map).map(this.initMapping.bind(this)));
  },
  initMapping: function(path) {
    var mapping = this.map[path];
    if(typeof mapping === 'string') {
      return this.store.once(path).then(this.setOnViewModel.bind(this, path));
    } else {
      this.registerDependencies(path, mapping);
      return Q();
    }
  },
  getFromViewModel: function(path) {
    return this.viewModel[path];
  },
  setOnViewModel: function(path, value) {
    this.viewModel[path] = value;
    this.updateDependantsFor(path);
  },
  updateDependantsFor: function(path) {
    if(this.dependencyMap[path]) {
      this.dependencyMap[path].forEach(this.setDependent.bind(this));
    }
  },
  registerDependencies: function(path, mapping) {
    var callback = mapping.pop();
    mapping.forEach(this.registerDependency.bind(this, {
      prop: path,
      cb: callback,
      deps: mapping
    }));
  },
  registerDependency: function(relationship, dependency) {
    if(!this.dependencyMap[dependency]) {
      this.dependencyMap[dependency] = [];
    }
    this.dependencyMap[dependency].push(relationship);
  },
  initDependants: function() {
    Object.keys(this.dependencyMap).forEach(this.setDependents.bind(this));
  },
  setDependents: function(dep) {
    this.dependencyMap[dep].forEach(this.setDependent.bind(this));
  },
  setDependent: function(relationship) {
    this.setOnViewModel(relationship.prop, relationship.cb.apply(this, relationship.deps.map(this.getFromViewModel.bind(this))));
  },
  bind: function() {
    this.store.onChange(this.onStoreChange.bind(this));
  },
  onStoreChange: function(path, value) {
    this.setOnViewModel(path, value);
  }
};

module.exports = Mapper;
},{"q":7}],9:[function(require,module,exports){
module.exports=require(2)
},{"/Users/nick/dev/sandbox/node_modules/builder/node_modules/abstractor/src/abstractor.js":2}],10:[function(require,module,exports){
function WalkerObject(path) {
  this.initialParams = [path || []];
  this._stack = [];
};
WalkerObject.prototype = {
  constructor: WalkerObject,
  child: function(cb, node, path) {
    var next;
    if(typeof node === 'object') {
      if(Array.isArray(node)) {
        this._stack.unshift(node.map(function(val, key) {
          return {
            key: key,
            val: val
          };
        }));
      } else {
        this._stack.unshift(Object.keys(node).map(function(key) {
          return {
            key: key,
            val: node[key]
          };
        }));
      }
      next = this._stack[0].shift();
    }
    if(next) {
      cb(next.val, path.concat(next.key));
    }
  },
  sibling: function(cb, node, path) {
    var next;
    if(this._stack.length) {
      var level = this._stack[0];
      if(level.length) {
        next = level.shift();
      } else {
        this._stack.shift();
      }
    }
    if(next) {
      path.pop();
      cb(next.val, path.concat(next.key));
    }
  }
};
module.exports = WalkerObject;
},{}],11:[function(require,module,exports){
module.exports = function(adaptor, rootnode, callback) {

  function walker(node) {
    var args = Array.prototype.slice.call(arguments, 0);
    callback.apply(this, args);
    adaptor.child.bind(adaptor, walker).apply(adaptor, args);
    adaptor.sibling.bind(adaptor, walker).apply(adaptor, args);
  }

  walker.bind(this, rootnode).apply(this, adaptor.initialParams || []);

};
},{}],12:[function(require,module,exports){
var walker = require('walker');
var WalkerObject = require('walker-object');

function getFullPath(path, key) {
  return path.concat(key);
}

function onChange(obj, path, cb, changes) {
  var change, cPath, cType, cOld, cNew;
  while(changes.length) {
    change = changes.shift();
    cPath = getFullPath(path, change.name);
    cType = change.type;
    cOld = change.oldValue;
    switch(change.type) {
      case 'add':
      case 'update':
        cNew = obj[change.name];
      break;
      case 'splice':
        cPath = getFullPath(path, change.index);
        if(change.removed.length) {
          cType = 'remove';
          cOld = change.removed[0];
          if(change.removed.length > 1) {
            changes.push({
              addedCount: change.addedCount,
              index: change.index + 1,
              object: change.object,
              removed: change.removed.slice(1),
              type: change.type
            });
          }
        } else if(change.addedCount) {
          cType = 'add';
          cNew = obj[change.index];
          if(change.addedCount > 1) {
            changes.push({
              addedCount: change.addedCount - 1,
              index: change.index + 1,
              object: change.object,
              removed: change.removed,
              type: change.type
            });
          }
        } else {
          cType = 'update';
          cOld = change.removed[0];
          cNew = obj[change.index];
        }
      break;
    }
    if(typeof cNew === "object") {
      pathObserver(cNew, cb, [].concat(cPath));
    }
    cb(cPath, cType, cNew, cOld);
  }
}

function pathObserver(obj, cb, path) {
  walker(new WalkerObject(path), obj, function(node, path) {
    if(typeof node === "object") {
      var type = Object;
      if(Array.isArray(node)) {
        type = Array;
      }
      type.observe(node, onChange.bind(this, node, [].concat(path), cb));
    }
  });
}
if(module && module.exports) {
  module.exports = pathObserver;
}
},{"walker":11,"walker-object":10}],13:[function(require,module,exports){
function WalkerDom() {};
WalkerDom.prototype = {
	constructor: WalkerDom,
	child: function(cb, node) {
    var next = node.firstChild;
    if(next) {
      cb(next);
    }
	},
	sibling: function(cb, node) {
    var next = node.nextSibling;
    if(next) {
      cb(next);
    }
	}
};
module.exports = WalkerDom;
},{}],14:[function(require,module,exports){
module.exports=require(11)
},{"/Users/nick/dev/sandbox/node_modules/stitcher/node_modules/observer/node_modules/walker/src/walker.js":11}],15:[function(require,module,exports){
var abstractor = require('abstractor');
var observer = require('observer');
var walker = require('walker');
var WalkerDom = require('walker-dom');

module.exports = function(mod, tpl, dom) {
  if(!mod) throw new Error("Missing model, template and dom");
  if(typeof tpl !== 'string') throw new Error("Missing template and dom");
  if(!dom) throw new Error("Missing dom");

  var nodeWalkCount = 0;
  var bindings = {};
  var tplArray = abstractor(tpl);

  function bindData(prop, node) {
    bindings[prop] = function(value) {
      node.data = value;
    };
  }

  function bindAttr(prop, node, attr) {
    bindings[prop] = function(value) {
      node.setAttribute(attr, !!value);
    };
  }

  function onModelChange(path, type, newVal, oldVal) {
    bindings[path](newVal);
  }

  walker(new WalkerDom(), dom, function(node) {
    if(!(node.nodeName === "#text" && node.data.charAt(0) === "\n")) {
      var expected = tplArray[nodeWalkCount];
      while(expected.close) {
        expected = tplArray[++nodeWalkCount];
      }
      if(expected.type === ">") {
        bindData(expected.bind, node);
      } else {
        if(node.nodeName.toLowerCase() !== expected.type) {
          throw new Error('Node does not match template, got <' + node.nodeName.toLowerCase() + '> expecting <' + expected.type + '>', node.nodeName.toLowerCase(), expected);
        }
        var attrHash = expected.attributes;
        for(var attr in attrHash) {
          if(attrHash.hasOwnProperty(attr)) {
            var expression = attrHash[attr].match(/^\{\{([a-zA-Z]+)\}\}/)[1];
            if(expression) {
              bindAttr(expression, node, attr);
            }
          }
        }
      }
      nodeWalkCount++;
    }
  });

  observer(mod, onModelChange);

  return dom;
};
},{"abstractor":9,"observer":12,"walker":14,"walker-dom":13}],16:[function(require,module,exports){
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
},{"builder":3,"mapper":8,"mapper-firebase":6,"stitcher":15}]},{},[16])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2J1aWxkZXIvbm9kZV9tb2R1bGVzL2Fic3RyYWN0b3Ivc3JjL2Fic3RyYWN0b3IuanMiLCJub2RlX21vZHVsZXMvYnVpbGRlci9zcmMvYnVpbGRlci5qcyIsIm5vZGVfbW9kdWxlcy9tYXBwZXItZmlyZWJhc2Uvbm9kZV9tb2R1bGVzL2NsaWVudC1maXJlYmFzZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9tYXBwZXItZmlyZWJhc2Uvbm9kZV9tb2R1bGVzL3EvcS5qcyIsIm5vZGVfbW9kdWxlcy9tYXBwZXItZmlyZWJhc2Uvc3JjL21hcHBlci1maXJlYmFzZS5qcyIsIm5vZGVfbW9kdWxlcy9tYXBwZXIvc3JjL21hcHBlci5qcyIsIm5vZGVfbW9kdWxlcy9zdGl0Y2hlci9ub2RlX21vZHVsZXMvb2JzZXJ2ZXIvbm9kZV9tb2R1bGVzL3dhbGtlci1vYmplY3Qvc3JjL3dhbGtlci1vYmplY3QuanMiLCJub2RlX21vZHVsZXMvc3RpdGNoZXIvbm9kZV9tb2R1bGVzL29ic2VydmVyL25vZGVfbW9kdWxlcy93YWxrZXIvc3JjL3dhbGtlci5qcyIsIm5vZGVfbW9kdWxlcy9zdGl0Y2hlci9ub2RlX21vZHVsZXMvb2JzZXJ2ZXIvc3JjL29ic2VydmVyLmpzIiwibm9kZV9tb2R1bGVzL3N0aXRjaGVyL25vZGVfbW9kdWxlcy93YWxrZXItZG9tL3NyYy93YWxrZXItZG9tLmpzIiwibm9kZV9tb2R1bGVzL3N0aXRjaGVyL3NyYy9zdGl0Y2hlci5qcyIsInNyYy9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25HQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbDNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbnByb2Nlc3MubmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYW5TZXRJbW1lZGlhdGUgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5zZXRJbW1lZGlhdGU7XG4gICAgdmFyIGNhbk11dGF0aW9uT2JzZXJ2ZXIgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5NdXRhdGlvbk9ic2VydmVyO1xuICAgIHZhciBjYW5Qb3N0ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cucG9zdE1lc3NhZ2UgJiYgd2luZG93LmFkZEV2ZW50TGlzdGVuZXJcbiAgICA7XG5cbiAgICBpZiAoY2FuU2V0SW1tZWRpYXRlKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZikgeyByZXR1cm4gd2luZG93LnNldEltbWVkaWF0ZShmKSB9O1xuICAgIH1cblxuICAgIHZhciBxdWV1ZSA9IFtdO1xuXG4gICAgaWYgKGNhbk11dGF0aW9uT2JzZXJ2ZXIpIHtcbiAgICAgICAgdmFyIGhpZGRlbkRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICAgIHZhciBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBxdWV1ZUxpc3QgPSBxdWV1ZS5zbGljZSgpO1xuICAgICAgICAgICAgcXVldWUubGVuZ3RoID0gMDtcbiAgICAgICAgICAgIHF1ZXVlTGlzdC5mb3JFYWNoKGZ1bmN0aW9uIChmbikge1xuICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZShoaWRkZW5EaXYsIHsgYXR0cmlidXRlczogdHJ1ZSB9KTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIGlmICghcXVldWUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgaGlkZGVuRGl2LnNldEF0dHJpYnV0ZSgneWVzJywgJ25vJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBxdWV1ZS5wdXNoKGZuKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoY2FuUG9zdCkge1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgICAgICAgICAgdmFyIHNvdXJjZSA9IGV2LnNvdXJjZTtcbiAgICAgICAgICAgIGlmICgoc291cmNlID09PSB3aW5kb3cgfHwgc291cmNlID09PSBudWxsKSAmJiBldi5kYXRhID09PSAncHJvY2Vzcy10aWNrJykge1xuICAgICAgICAgICAgICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIGlmIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmbiA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIHF1ZXVlLnB1c2goZm4pO1xuICAgICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKCdwcm9jZXNzLXRpY2snLCAnKicpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICBzZXRUaW1lb3V0KGZuLCAwKTtcbiAgICB9O1xufSkoKTtcblxucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHRlbXBsYXRlVG9BcnJheSh0cGwpIHtcblx0aWYoIXRwbCkgcmV0dXJuIFtdO1xuXG5cdHZhciBtYXRjaCA9IHRwbC5tYXRjaCgvPFxcLz9bYS16XStbXj5dKj58XFx7XFx7W2EtekEtWlxcLl0rXFx9XFx9fFthLXpBLVpdKy9nKTtcblx0dmFyIGksIHRhZywgdGFncyA9IFtdO1xuXHRmb3IgKGkgPSAwOyBpIDwgbWF0Y2gubGVuZ3RoOyBpKyspIHtcblx0XHR0YWcgPSBnZXRUYWcobWF0Y2hbaV0pO1xuXHRcdGlmKHRhZykge1xuXHRcdFx0dGFnLmF0dHJpYnV0ZXMgPSBnZXRBdHRyaWJ1dGVzSGFzaChtYXRjaFtpXSk7XG5cdFx0XHR0YWdzLnB1c2godGFnKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRUYWcodGFnU3RyaW5nKSB7XG5cdFx0dmFyIHRhZyA9IHt9O1xuXHRcdGlmKHRhZ1N0cmluZy5jaGFyQXQoMCkgPT09IFwiPFwiKSB7XG5cdFx0XHR2YXIgbWF0Y2ggPSB0YWdTdHJpbmcubWF0Y2goL148KFxcLz8pKFthLXowLTldKykvKTtcblx0XHRcdGlmKCFtYXRjaFsxXS5sZW5ndGgpIHtcblx0XHRcdFx0Ly8gb3BlbmluZyB0YWdcblx0XHRcdFx0dGFnLnR5cGUgPSBtYXRjaFsyXTtcblx0XHRcdFx0aWYodGFnU3RyaW5nLmNoYXJBdCh0YWdTdHJpbmcubGVuZ3RoLTIpID09PSAnLycpIHtcblx0XHRcdFx0XHR0YWcuc2VsZiA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIGNsb3NpbmcgdGFnXG5cdFx0XHRcdHRhZy50eXBlID0gbWF0Y2hbMl07XG5cdFx0XHRcdHRhZy5jbG9zZSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhciBwbGFjZWhvbGRlciA9IHRhZ1N0cmluZy5tYXRjaCgvXlxce1xceyhbYS16QS1aXFwuXSspXFx9XFx9Lyk7XG5cdFx0XHRpZihwbGFjZWhvbGRlcikge1xuXHRcdFx0XHR0YWcudHlwZSA9ICc+Jztcblx0XHRcdFx0dGFnLmJpbmQgPSBwbGFjZWhvbGRlclsxXTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRhZy50eXBlID0gXCIjdGV4dFwiO1xuXHRcdFx0XHR0YWcudmFsdWUgPSB0YWdTdHJpbmc7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0YWc7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRBdHRyaWJ1dGVzSGFzaCh0YWdTdHJpbmcpIHtcblx0XHR2YXIgaGFzaCA9IHt9O1xuXHRcdHZhciBtYXRjaCA9IHRhZ1N0cmluZy5tYXRjaCgvKFthLXpdK1xcPVxcXCJbXlxcXCJdKlxcXCIpL2cpO1xuXHRcdHZhciBhdHRyO1xuXHRcdGlmKG1hdGNoKSB7XG5cdFx0XHRmb3IodmFyIGkgPSAwOyBpIDwgbWF0Y2gubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0YXR0ciA9IG1hdGNoW2ldLnNwbGl0KCc9Jyk7XG5cdFx0XHRcdHZhciBwbGFjZWhvbGRlciA9IGF0dHJbMV0ubWF0Y2goL1xce1xceyhbYS16QS1aXFwuXSspXFx9XFx9Lyk7XG5cdFx0XHRcdGlmKHBsYWNlaG9sZGVyKSB7XG5cdFx0XHRcdFx0aGFzaFthdHRyWzBdXSA9IHtcblx0XHRcdFx0XHRcdHR5cGU6ICc+Jyxcblx0XHRcdFx0XHRcdGJpbmQ6IHBsYWNlaG9sZGVyWzFdXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRoYXNoW2F0dHJbMF1dID0gYXR0clsxXS5tYXRjaCgvXltcXFwiXSooW1xce1xcfWEtekEtWjEtOVxcLiBdKykvKVsxXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gaGFzaDtcblx0fVxuXG5cdHJldHVybiB0YWdzO1xufTsiLCJ2YXIgYWJzdHJhY3RvciA9IHJlcXVpcmUoJ2Fic3RyYWN0b3InKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihtb2QsIHRwbCkge1xuXHRpZighYXJndW1lbnRzLmxlbmd0aCkgdGhyb3cgbmV3IEVycm9yKFwiTWlzc2luZyBtb2RlbCBhbmQgdGVtcGxhdGVcIik7XG5cdGlmKHR5cGVvZiBtb2QgIT09ICdvYmplY3QnKSB0aHJvdyBuZXcgRXJyb3IoXCJNb2RlbCBtdXN0IGJlIHBsYWluIG9iamVjdFwiKTsgXG5cdGlmKCF0cGwpIHRocm93IG5ldyBFcnJvcihcIk1pc3NpbmcgdGVtcGxhdGVcIik7XG5cdGlmKHR5cGVvZiB0cGwgIT09ICdzdHJpbmcnKSB0aHJvdyBuZXcgRXJyb3IoXCJUZW1wbGF0ZSBtdXN0IGJlIGEgc3RyaW5nXCIpO1xuXG5cdHZhciBnZXROZXN0ZWQgPSBmdW5jdGlvbihtb2RlbCwgbG9jYXRpb24pIHtcblx0XHR2YXIgbG9jYXRpb25BcnIgPSBsb2NhdGlvbi5zcGxpdCgnLicpO1xuXHRcdHZhciByZXN1bHQgPSBtb2RlbDtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGxvY2F0aW9uQXJyLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRyZXN1bHQgPSByZXN1bHRbbG9jYXRpb25BcnJbaV1dO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9O1xuXHR2YXIgbG9vcFJlcGVhdHMgPSBmdW5jdGlvbihpdGVtcywgZG9tUGFydGlhbE1vZGVsKSB7XG5cdFx0dmFyIGh0bWwgPSAnJztcblx0XHRmb3IodmFyIGkgPSAwOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdHZhciBtb2RlbCA9IGl0ZW1zW2ldO1xuXHRcdFx0aWYodHlwZW9mIGl0ZW1zW2ldICE9PSBcIm9iamVjdFwiKSB7XG5cdFx0XHRcdG1vZGVsID0ge1xuXHRcdFx0XHRcdHZhbHVlOiBpdGVtc1tpXVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0aHRtbCArPSBidWlsZEh0bWwoZG9tUGFydGlhbE1vZGVsLnNsaWNlKDApLCBtb2RlbCk7XG5cdFx0fVxuXHRcdHJldHVybiBodG1sO1xuXHR9O1xuXHR2YXIgYnVpbGRBdHRyU3RyaW5nID0gZnVuY3Rpb24oYXR0cmlidXRlcywgbW9kZWwpIHtcblx0XHR2YXIgaHRtbCA9ICcnO1xuXHRcdGZvcih2YXIga2V5IGluIGF0dHJpYnV0ZXMpIHtcblx0XHRcdGlmKGF0dHJpYnV0ZXNba2V5XS5iaW5kKSB7XG5cdFx0XHRcdGh0bWwgKz0gJyAnICsga2V5ICsgJz1cIicgKyBnZXROZXN0ZWQobW9kZWwsIGF0dHJpYnV0ZXNba2V5XS5iaW5kKSArJ1wiJztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGh0bWwgKz0gJyAnICsga2V5ICsgJz1cIicgKyBhdHRyaWJ1dGVzW2tleV0gKydcIic7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBodG1sO1xuXHR9O1xuXHR2YXIgYnVpbGRUYWdTdHJpbmcgPSBmdW5jdGlvbih0YWcsIG1vZGVsKSB7XG5cdFx0dmFyIGh0bWwgPSAnPCc7XG5cdFx0aWYodGFnLmNsb3NlKSBodG1sICs9ICcvJztcblx0XHRodG1sICs9IHRhZy50eXBlO1xuXHRcdGh0bWwgKz0gYnVpbGRBdHRyU3RyaW5nKHRhZy5hdHRyaWJ1dGVzLCBtb2RlbCk7XG5cdFx0aWYodGFnLnR5cGUgPT09ICdpbnB1dCcpIGh0bWwgKz0gJyAvJztcblx0XHRodG1sICs9ICc+Jztcblx0XHRyZXR1cm4gaHRtbDtcblx0fTtcblx0dmFyIGdldFBhcnRpYWwgPSBmdW5jdGlvbihkb21Nb2RlbCkge1xuXHRcdHZhciBkb20gPSBbXTtcblx0XHR2YXIgc3RhY2sgPSBbXTtcblx0XHRpZighZG9tTW9kZWxbMF0uY2xvc2UpIHtcblx0XHRcdHZhciBkb21JdGVtID0gZG9tTW9kZWwuc2hpZnQoKTtcblx0XHRcdGRvbS5wdXNoKGRvbUl0ZW0pO1xuXHRcdFx0c3RhY2sucHVzaChkb21JdGVtLnR5cGUpO1xuXHRcdFx0d2hpbGUoc3RhY2subGVuZ3RoKSB7XG5cdFx0XHRcdGRvbUl0ZW0gPSBkb21Nb2RlbC5zaGlmdCgpO1xuXHRcdFx0XHRpZihkb21JdGVtLnR5cGUgIT09ICc+Jykge1xuXHRcdFx0XHRcdGlmKGRvbUl0ZW0uY2xvc2UpIHtcblx0XHRcdFx0XHRcdHN0YWNrLnBvcCgpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRpZighZG9tSXRlbS5zZWxmKSB7XG5cdFx0XHRcdFx0XHRcdHN0YWNrLnB1c2goZG9tSXRlbS50eXBlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0ZG9tLnB1c2goZG9tSXRlbSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBkb207XG5cdH07XG5cdHZhciBidWlsZEh0bWwgPSBmdW5jdGlvbihkb21Nb2RlbCwgbW9kZWwpIHtcblx0XHR2YXIgaHRtbCA9ICcnO1xuXHRcdHdoaWxlKGRvbU1vZGVsLmxlbmd0aCkge1xuXHRcdFx0dmFyIGRvbUl0ZW0gPSBkb21Nb2RlbC5zaGlmdCgpO1xuXHRcdFx0c3dpdGNoKGRvbUl0ZW0udHlwZSkge1xuXHRcdFx0XHRjYXNlICc+Jzpcblx0XHRcdFx0XHQvLyBwbGFjZWhvbGRlclxuXHRcdFx0XHRcdHZhciB2YWx1ZSA9IGdldE5lc3RlZChtb2RlbCwgZG9tSXRlbS5iaW5kKTtcblx0XHRcdFx0XHRodG1sICs9ICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSA/ICd7eycrZG9tSXRlbS5iaW5kKyd9fScgOiB2YWx1ZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJyN0ZXh0Jzpcblx0XHRcdFx0XHRodG1sICs9IGRvbUl0ZW0udmFsdWU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdGh0bWwgKz0gYnVpbGRUYWdTdHJpbmcoZG9tSXRlbSwgbW9kZWwpO1xuXHRcdFx0XHRcdGlmKGRvbUl0ZW0uYXR0cmlidXRlcy5yZXBlYXQpIHtcblx0XHRcdFx0XHRcdHZhciBpdGVtcyA9IGdldE5lc3RlZChtb2RlbCwgZG9tSXRlbS5hdHRyaWJ1dGVzLnJlcGVhdCk7XG5cdFx0XHRcdFx0XHR2YXIgcGFydGlhbCA9IGdldFBhcnRpYWwoZG9tTW9kZWwpO1xuXHRcdFx0XHRcdFx0aHRtbCArPSBsb29wUmVwZWF0cyhpdGVtcywgcGFydGlhbCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGh0bWw7XG5cdH07XG5cblx0cmV0dXJuIGJ1aWxkSHRtbChhYnN0cmFjdG9yKHRwbCksIG1vZCk7XG59OyIsIihmdW5jdGlvbigpIHt2YXIgaCxhYT10aGlzO2Z1bmN0aW9uIG4oYSl7cmV0dXJuIHZvaWQgMCE9PWF9ZnVuY3Rpb24gYmEoKXt9ZnVuY3Rpb24gY2EoYSl7YS5yYj1mdW5jdGlvbigpe3JldHVybiBhLmxkP2EubGQ6YS5sZD1uZXcgYX19XHJcbmZ1bmN0aW9uIGRhKGEpe3ZhciBiPXR5cGVvZiBhO2lmKFwib2JqZWN0XCI9PWIpaWYoYSl7aWYoYSBpbnN0YW5jZW9mIEFycmF5KXJldHVyblwiYXJyYXlcIjtpZihhIGluc3RhbmNlb2YgT2JqZWN0KXJldHVybiBiO3ZhciBjPU9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhKTtpZihcIltvYmplY3QgV2luZG93XVwiPT1jKXJldHVyblwib2JqZWN0XCI7aWYoXCJbb2JqZWN0IEFycmF5XVwiPT1jfHxcIm51bWJlclwiPT10eXBlb2YgYS5sZW5ndGgmJlwidW5kZWZpbmVkXCIhPXR5cGVvZiBhLnNwbGljZSYmXCJ1bmRlZmluZWRcIiE9dHlwZW9mIGEucHJvcGVydHlJc0VudW1lcmFibGUmJiFhLnByb3BlcnR5SXNFbnVtZXJhYmxlKFwic3BsaWNlXCIpKXJldHVyblwiYXJyYXlcIjtpZihcIltvYmplY3QgRnVuY3Rpb25dXCI9PWN8fFwidW5kZWZpbmVkXCIhPXR5cGVvZiBhLmNhbGwmJlwidW5kZWZpbmVkXCIhPXR5cGVvZiBhLnByb3BlcnR5SXNFbnVtZXJhYmxlJiYhYS5wcm9wZXJ0eUlzRW51bWVyYWJsZShcImNhbGxcIikpcmV0dXJuXCJmdW5jdGlvblwifWVsc2UgcmV0dXJuXCJudWxsXCI7XHJcbmVsc2UgaWYoXCJmdW5jdGlvblwiPT1iJiZcInVuZGVmaW5lZFwiPT10eXBlb2YgYS5jYWxsKXJldHVyblwib2JqZWN0XCI7cmV0dXJuIGJ9ZnVuY3Rpb24gZWEoYSl7dmFyIGI9ZGEoYSk7cmV0dXJuXCJhcnJheVwiPT1ifHxcIm9iamVjdFwiPT1iJiZcIm51bWJlclwiPT10eXBlb2YgYS5sZW5ndGh9ZnVuY3Rpb24gcShhKXtyZXR1cm5cInN0cmluZ1wiPT10eXBlb2YgYX1mdW5jdGlvbiBmYShhKXtyZXR1cm5cIm51bWJlclwiPT10eXBlb2YgYX1mdW5jdGlvbiBnYShhKXt2YXIgYj10eXBlb2YgYTtyZXR1cm5cIm9iamVjdFwiPT1iJiZudWxsIT1hfHxcImZ1bmN0aW9uXCI9PWJ9ZnVuY3Rpb24gaGEoYSxiLGMpe3JldHVybiBhLmNhbGwuYXBwbHkoYS5iaW5kLGFyZ3VtZW50cyl9XHJcbmZ1bmN0aW9uIGlhKGEsYixjKXtpZighYSl0aHJvdyBFcnJvcigpO2lmKDI8YXJndW1lbnRzLmxlbmd0aCl7dmFyIGQ9QXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLDIpO3JldHVybiBmdW5jdGlvbigpe3ZhciBjPUFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7QXJyYXkucHJvdG90eXBlLnVuc2hpZnQuYXBwbHkoYyxkKTtyZXR1cm4gYS5hcHBseShiLGMpfX1yZXR1cm4gZnVuY3Rpb24oKXtyZXR1cm4gYS5hcHBseShiLGFyZ3VtZW50cyl9fWZ1bmN0aW9uIHIoYSxiLGMpe3I9RnVuY3Rpb24ucHJvdG90eXBlLmJpbmQmJi0xIT1GdW5jdGlvbi5wcm90b3R5cGUuYmluZC50b1N0cmluZygpLmluZGV4T2YoXCJuYXRpdmUgY29kZVwiKT9oYTppYTtyZXR1cm4gci5hcHBseShudWxsLGFyZ3VtZW50cyl9XHJcbmZ1bmN0aW9uIGphKGEsYil7ZnVuY3Rpb24gYygpe31jLnByb3RvdHlwZT1iLnByb3RvdHlwZTthLmtlPWIucHJvdG90eXBlO2EucHJvdG90eXBlPW5ldyBjO2EuaWU9ZnVuY3Rpb24oYSxjLGYpe3JldHVybiBiLnByb3RvdHlwZVtjXS5hcHBseShhLEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywyKSl9fTtmdW5jdGlvbiBrYShhKXthPVN0cmluZyhhKTtpZigvXlxccyokLy50ZXN0KGEpPzA6L15bXFxdLDp7fVxcc1xcdTIwMjhcXHUyMDI5XSokLy50ZXN0KGEucmVwbGFjZSgvXFxcXFtcIlxcXFxcXC9iZm5ydHVdL2csXCJAXCIpLnJlcGxhY2UoL1wiW15cIlxcXFxcXG5cXHJcXHUyMDI4XFx1MjAyOVxceDAwLVxceDA4XFx4MGEtXFx4MWZdKlwifHRydWV8ZmFsc2V8bnVsbHwtP1xcZCsoPzpcXC5cXGQqKT8oPzpbZUVdWytcXC1dP1xcZCspPy9nLFwiXVwiKS5yZXBsYWNlKC8oPzpefDp8LCkoPzpbXFxzXFx1MjAyOFxcdTIwMjldKlxcWykrL2csXCJcIikpKXRyeXtyZXR1cm4gZXZhbChcIihcIithK1wiKVwiKX1jYXRjaChiKXt9dGhyb3cgRXJyb3IoXCJJbnZhbGlkIEpTT04gc3RyaW5nOiBcIithKTt9ZnVuY3Rpb24gbGEoKXt0aGlzLm1jPXZvaWQgMH1cclxuZnVuY3Rpb24gbWEoYSxiLGMpe3N3aXRjaCh0eXBlb2YgYil7Y2FzZSBcInN0cmluZ1wiOm5hKGIsYyk7YnJlYWs7Y2FzZSBcIm51bWJlclwiOmMucHVzaChpc0Zpbml0ZShiKSYmIWlzTmFOKGIpP2I6XCJudWxsXCIpO2JyZWFrO2Nhc2UgXCJib29sZWFuXCI6Yy5wdXNoKGIpO2JyZWFrO2Nhc2UgXCJ1bmRlZmluZWRcIjpjLnB1c2goXCJudWxsXCIpO2JyZWFrO2Nhc2UgXCJvYmplY3RcIjppZihudWxsPT1iKXtjLnB1c2goXCJudWxsXCIpO2JyZWFrfWlmKFwiYXJyYXlcIj09ZGEoYikpe3ZhciBkPWIubGVuZ3RoO2MucHVzaChcIltcIik7Zm9yKHZhciBlPVwiXCIsZj0wO2Y8ZDtmKyspYy5wdXNoKGUpLGU9YltmXSxtYShhLGEubWM/YS5tYy5jYWxsKGIsU3RyaW5nKGYpLGUpOmUsYyksZT1cIixcIjtjLnB1c2goXCJdXCIpO2JyZWFrfWMucHVzaChcIntcIik7ZD1cIlwiO2ZvcihmIGluIGIpT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGIsZikmJihlPWJbZl0sXCJmdW5jdGlvblwiIT10eXBlb2YgZSYmKGMucHVzaChkKSxcclxubmEoZixjKSxjLnB1c2goXCI6XCIpLG1hKGEsYS5tYz9hLm1jLmNhbGwoYixmLGUpOmUsYyksZD1cIixcIikpO2MucHVzaChcIn1cIik7YnJlYWs7Y2FzZSBcImZ1bmN0aW9uXCI6YnJlYWs7ZGVmYXVsdDp0aHJvdyBFcnJvcihcIlVua25vd24gdHlwZTogXCIrdHlwZW9mIGIpO319dmFyIG9hPXsnXCInOidcXFxcXCInLFwiXFxcXFwiOlwiXFxcXFxcXFxcIixcIi9cIjpcIlxcXFwvXCIsXCJcXGJcIjpcIlxcXFxiXCIsXCJcXGZcIjpcIlxcXFxmXCIsXCJcXG5cIjpcIlxcXFxuXCIsXCJcXHJcIjpcIlxcXFxyXCIsXCJcXHRcIjpcIlxcXFx0XCIsXCJcXHgwQlwiOlwiXFxcXHUwMDBiXCJ9LHBhPS9cXHVmZmZmLy50ZXN0KFwiXFx1ZmZmZlwiKT8vW1xcXFxcXFwiXFx4MDAtXFx4MWZcXHg3Zi1cXHVmZmZmXS9nOi9bXFxcXFxcXCJcXHgwMC1cXHgxZlxceDdmLVxceGZmXS9nO1xyXG5mdW5jdGlvbiBuYShhLGIpe2IucHVzaCgnXCInLGEucmVwbGFjZShwYSxmdW5jdGlvbihhKXtpZihhIGluIG9hKXJldHVybiBvYVthXTt2YXIgYj1hLmNoYXJDb2RlQXQoMCksZT1cIlxcXFx1XCI7MTY+Yj9lKz1cIjAwMFwiOjI1Nj5iP2UrPVwiMDBcIjo0MDk2PmImJihlKz1cIjBcIik7cmV0dXJuIG9hW2FdPWUrYi50b1N0cmluZygxNil9KSwnXCInKX07ZnVuY3Rpb24gcWEoYSl7cmV0dXJuXCJ1bmRlZmluZWRcIiE9PXR5cGVvZiBKU09OJiZuKEpTT04ucGFyc2UpP0pTT04ucGFyc2UoYSk6a2EoYSl9ZnVuY3Rpb24gdShhKXtpZihcInVuZGVmaW5lZFwiIT09dHlwZW9mIEpTT04mJm4oSlNPTi5zdHJpbmdpZnkpKWE9SlNPTi5zdHJpbmdpZnkoYSk7ZWxzZXt2YXIgYj1bXTttYShuZXcgbGEsYSxiKTthPWIuam9pbihcIlwiKX1yZXR1cm4gYX07ZnVuY3Rpb24gcmEoYSl7Zm9yKHZhciBiPVtdLGM9MCxkPTA7ZDxhLmxlbmd0aDtkKyspe3ZhciBlPWEuY2hhckNvZGVBdChkKTs1NTI5Njw9ZSYmNTYzMTk+PWUmJihlLT01NTI5NixkKyssdihkPGEubGVuZ3RoLFwiU3Vycm9nYXRlIHBhaXIgbWlzc2luZyB0cmFpbCBzdXJyb2dhdGUuXCIpLGU9NjU1MzYrKGU8PDEwKSsoYS5jaGFyQ29kZUF0KGQpLTU2MzIwKSk7MTI4PmU/YltjKytdPWU6KDIwNDg+ZT9iW2MrK109ZT4+NnwxOTI6KDY1NTM2PmU/YltjKytdPWU+PjEyfDIyNDooYltjKytdPWU+PjE4fDI0MCxiW2MrK109ZT4+MTImNjN8MTI4KSxiW2MrK109ZT4+NiY2M3wxMjgpLGJbYysrXT1lJjYzfDEyOCl9cmV0dXJuIGJ9O3ZhciBzYT17fTtmdW5jdGlvbiB4KGEsYixjLGQpe3ZhciBlO2Q8Yj9lPVwiYXQgbGVhc3QgXCIrYjpkPmMmJihlPTA9PT1jP1wibm9uZVwiOlwibm8gbW9yZSB0aGFuIFwiK2MpO2lmKGUpdGhyb3cgRXJyb3IoYStcIiBmYWlsZWQ6IFdhcyBjYWxsZWQgd2l0aCBcIitkKygxPT09ZD9cIiBhcmd1bWVudC5cIjpcIiBhcmd1bWVudHMuXCIpK1wiIEV4cGVjdHMgXCIrZStcIi5cIik7fVxyXG5mdW5jdGlvbiB5KGEsYixjKXt2YXIgZD1cIlwiO3N3aXRjaChiKXtjYXNlIDE6ZD1jP1wiZmlyc3RcIjpcIkZpcnN0XCI7YnJlYWs7Y2FzZSAyOmQ9Yz9cInNlY29uZFwiOlwiU2Vjb25kXCI7YnJlYWs7Y2FzZSAzOmQ9Yz9cInRoaXJkXCI6XCJUaGlyZFwiO2JyZWFrO2Nhc2UgNDpkPWM/XCJmb3VydGhcIjpcIkZvdXJ0aFwiO2JyZWFrO2RlZmF1bHQ6dGEuYXNzZXJ0KCExLFwiZXJyb3JQcmVmaXhfIGNhbGxlZCB3aXRoIGFyZ3VtZW50TnVtYmVyID4gNC4gIE5lZWQgdG8gdXBkYXRlIGl0P1wiKX1yZXR1cm4gYT1hK1wiIGZhaWxlZDogXCIrKGQrXCIgYXJndW1lbnQgXCIpfWZ1bmN0aW9uIHooYSxiLGMsZCl7aWYoKCFkfHxuKGMpKSYmXCJmdW5jdGlvblwiIT1kYShjKSl0aHJvdyBFcnJvcih5KGEsYixkKStcIm11c3QgYmUgYSB2YWxpZCBmdW5jdGlvbi5cIik7fVxyXG5mdW5jdGlvbiB1YShhLGIsYyl7aWYobihjKSYmKCFnYShjKXx8bnVsbD09PWMpKXRocm93IEVycm9yKHkoYSxiLCEwKStcIm11c3QgYmUgYSB2YWxpZCBjb250ZXh0IG9iamVjdC5cIik7fTtmdW5jdGlvbiBBKGEsYil7cmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChhLGIpfWZ1bmN0aW9uIHZhKGEsYil7aWYoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGEsYikpcmV0dXJuIGFbYl19O3ZhciB0YT17fSx3YT0vW1xcW1xcXS4jJFxcL10vLHhhPS9bXFxbXFxdLiMkXS87ZnVuY3Rpb24geWEoYSl7cmV0dXJuIHEoYSkmJjAhPT1hLmxlbmd0aCYmIXdhLnRlc3QoYSl9ZnVuY3Rpb24gemEoYSxiLGMpe2MmJiFuKGIpfHxBYSh5KGEsMSxjKSxiKX1cclxuZnVuY3Rpb24gQWEoYSxiLGMsZCl7Y3x8KGM9MCk7ZD1kfHxbXTtpZighbihiKSl0aHJvdyBFcnJvcihhK1wiY29udGFpbnMgdW5kZWZpbmVkXCIrQmEoZCkpO2lmKFwiZnVuY3Rpb25cIj09ZGEoYikpdGhyb3cgRXJyb3IoYStcImNvbnRhaW5zIGEgZnVuY3Rpb25cIitCYShkKStcIiB3aXRoIGNvbnRlbnRzOiBcIitiLnRvU3RyaW5nKCkpO2lmKENhKGIpKXRocm93IEVycm9yKGErXCJjb250YWlucyBcIitiLnRvU3RyaW5nKCkrQmEoZCkpO2lmKDFFMzxjKXRocm93IG5ldyBUeXBlRXJyb3IoYStcImNvbnRhaW5zIGEgY3ljbGljIG9iamVjdCB2YWx1ZSAoXCIrZC5zbGljZSgwLDEwMCkuam9pbihcIi5cIikrXCIuLi4pXCIpO2lmKHEoYikmJmIubGVuZ3RoPjEwNDg1NzYwLzMmJjEwNDg1NzYwPHJhKGIpLmxlbmd0aCl0aHJvdyBFcnJvcihhK1wiY29udGFpbnMgYSBzdHJpbmcgZ3JlYXRlciB0aGFuIDEwNDg1NzYwIHV0ZjggYnl0ZXNcIitCYShkKStcIiAoJ1wiK2Iuc3Vic3RyaW5nKDAsNTApK1wiLi4uJylcIik7aWYoZ2EoYikpZm9yKHZhciBlIGluIGIpaWYoQShiLFxyXG5lKSl7dmFyIGY9YltlXTtpZihcIi5wcmlvcml0eVwiIT09ZSYmXCIudmFsdWVcIiE9PWUmJlwiLnN2XCIhPT1lJiYheWEoZSkpdGhyb3cgRXJyb3IoYStcIiBjb250YWlucyBhbiBpbnZhbGlkIGtleSAoXCIrZStcIilcIitCYShkKSsnLiAgS2V5cyBtdXN0IGJlIG5vbi1lbXB0eSBzdHJpbmdzIGFuZCBjYW5cXCd0IGNvbnRhaW4gXCIuXCIsIFwiI1wiLCBcIiRcIiwgXCIvXCIsIFwiW1wiLCBvciBcIl1cIicpO2QucHVzaChlKTtBYShhLGYsYysxLGQpO2QucG9wKCl9fWZ1bmN0aW9uIEJhKGEpe3JldHVybiAwPT1hLmxlbmd0aD9cIlwiOlwiIGluIHByb3BlcnR5ICdcIithLmpvaW4oXCIuXCIpK1wiJ1wifWZ1bmN0aW9uIERhKGEsYil7aWYoIWdhKGIpKXRocm93IEVycm9yKHkoYSwxLCExKStcIiBtdXN0IGJlIGFuIG9iamVjdCBjb250YWluaW5nIHRoZSBjaGlsZHJlbiB0byByZXBsYWNlLlwiKTt6YShhLGIsITEpfVxyXG5mdW5jdGlvbiBFYShhLGIsYyxkKXtpZighKGQmJiFuKGMpfHxudWxsPT09Y3x8ZmEoYyl8fHEoYyl8fGdhKGMpJiZBKGMsXCIuc3ZcIikpKXRocm93IEVycm9yKHkoYSxiLGQpK1wibXVzdCBiZSBhIHZhbGlkIGZpcmViYXNlIHByaW9yaXR5IChhIHN0cmluZywgbnVtYmVyLCBvciBudWxsKS5cIik7fWZ1bmN0aW9uIEZhKGEsYixjKXtpZighY3x8bihiKSlzd2l0Y2goYil7Y2FzZSBcInZhbHVlXCI6Y2FzZSBcImNoaWxkX2FkZGVkXCI6Y2FzZSBcImNoaWxkX3JlbW92ZWRcIjpjYXNlIFwiY2hpbGRfY2hhbmdlZFwiOmNhc2UgXCJjaGlsZF9tb3ZlZFwiOmJyZWFrO2RlZmF1bHQ6dGhyb3cgRXJyb3IoeShhLDEsYykrJ211c3QgYmUgYSB2YWxpZCBldmVudCB0eXBlOiBcInZhbHVlXCIsIFwiY2hpbGRfYWRkZWRcIiwgXCJjaGlsZF9yZW1vdmVkXCIsIFwiY2hpbGRfY2hhbmdlZFwiLCBvciBcImNoaWxkX21vdmVkXCIuJyk7fX1cclxuZnVuY3Rpb24gR2EoYSxiKXtpZihuKGIpJiYheWEoYikpdGhyb3cgRXJyb3IoeShhLDIsITApKyd3YXMgYW4gaW52YWxpZCBrZXk6IFwiJytiKydcIi4gIEZpcmViYXNlIGtleXMgbXVzdCBiZSBub24tZW1wdHkgc3RyaW5ncyBhbmQgY2FuXFwndCBjb250YWluIFwiLlwiLCBcIiNcIiwgXCIkXCIsIFwiL1wiLCBcIltcIiwgb3IgXCJdXCIpLicpO31mdW5jdGlvbiBIYShhLGIpe2lmKCFxKGIpfHwwPT09Yi5sZW5ndGh8fHhhLnRlc3QoYikpdGhyb3cgRXJyb3IoeShhLDEsITEpKyd3YXMgYW4gaW52YWxpZCBwYXRoOiBcIicrYisnXCIuIFBhdGhzIG11c3QgYmUgbm9uLWVtcHR5IHN0cmluZ3MgYW5kIGNhblxcJ3QgY29udGFpbiBcIi5cIiwgXCIjXCIsIFwiJFwiLCBcIltcIiwgb3IgXCJdXCInKTt9ZnVuY3Rpb24gQihhLGIpe2lmKFwiLmluZm9cIj09PUMoYikpdGhyb3cgRXJyb3IoYStcIiBmYWlsZWQ6IENhbid0IG1vZGlmeSBkYXRhIHVuZGVyIC8uaW5mby9cIik7fTtmdW5jdGlvbiBEKGEsYixjLGQsZSxmLGcpe3RoaXMubT1hO3RoaXMucGF0aD1iO3RoaXMuRWE9Yzt0aGlzLmZhPWQ7dGhpcy55YT1lO3RoaXMuQ2E9Zjt0aGlzLldhPWc7aWYobih0aGlzLmZhKSYmbih0aGlzLkNhKSYmbih0aGlzLkVhKSl0aHJvd1wiUXVlcnk6IENhbid0IGNvbWJpbmUgc3RhcnRBdCgpLCBlbmRBdCgpLCBhbmQgbGltaXQoKS5cIjt9RC5wcm90b3R5cGUuVWM9ZnVuY3Rpb24oKXt4KFwiUXVlcnkucmVmXCIsMCwwLGFyZ3VtZW50cy5sZW5ndGgpO3JldHVybiBuZXcgRSh0aGlzLm0sdGhpcy5wYXRoKX07RC5wcm90b3R5cGUucmVmPUQucHJvdG90eXBlLlVjO1xyXG5ELnByb3RvdHlwZS5mYj1mdW5jdGlvbihhLGIpe3goXCJRdWVyeS5vblwiLDIsNCxhcmd1bWVudHMubGVuZ3RoKTtGYShcIlF1ZXJ5Lm9uXCIsYSwhMSk7eihcIlF1ZXJ5Lm9uXCIsMixiLCExKTt2YXIgYz1JYShcIlF1ZXJ5Lm9uXCIsYXJndW1lbnRzWzJdLGFyZ3VtZW50c1szXSk7dGhpcy5tLlJiKHRoaXMsYSxiLGMuY2FuY2VsLGMuWSk7cmV0dXJuIGJ9O0QucHJvdG90eXBlLm9uPUQucHJvdG90eXBlLmZiO0QucHJvdG90eXBlLnliPWZ1bmN0aW9uKGEsYixjKXt4KFwiUXVlcnkub2ZmXCIsMCwzLGFyZ3VtZW50cy5sZW5ndGgpO0ZhKFwiUXVlcnkub2ZmXCIsYSwhMCk7eihcIlF1ZXJ5Lm9mZlwiLDIsYiwhMCk7dWEoXCJRdWVyeS5vZmZcIiwzLGMpO3RoaXMubS5sYyh0aGlzLGEsYixjKX07RC5wcm90b3R5cGUub2ZmPUQucHJvdG90eXBlLnliO1xyXG5ELnByb3RvdHlwZS5XZD1mdW5jdGlvbihhLGIpe2Z1bmN0aW9uIGMoZyl7ZiYmKGY9ITEsZS55YihhLGMpLGIuY2FsbChkLlksZykpfXgoXCJRdWVyeS5vbmNlXCIsMiw0LGFyZ3VtZW50cy5sZW5ndGgpO0ZhKFwiUXVlcnkub25jZVwiLGEsITEpO3ooXCJRdWVyeS5vbmNlXCIsMixiLCExKTt2YXIgZD1JYShcIlF1ZXJ5Lm9uY2VcIixhcmd1bWVudHNbMl0sYXJndW1lbnRzWzNdKSxlPXRoaXMsZj0hMDt0aGlzLmZiKGEsYyxmdW5jdGlvbihiKXtlLnliKGEsYyk7ZC5jYW5jZWwmJmQuY2FuY2VsLmNhbGwoZC5ZLGIpfSl9O0QucHJvdG90eXBlLm9uY2U9RC5wcm90b3R5cGUuV2Q7XHJcbkQucHJvdG90eXBlLlBkPWZ1bmN0aW9uKGEpe3goXCJRdWVyeS5saW1pdFwiLDEsMSxhcmd1bWVudHMubGVuZ3RoKTtpZighZmEoYSl8fE1hdGguZmxvb3IoYSkhPT1hfHwwPj1hKXRocm93XCJRdWVyeS5saW1pdDogRmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhIHBvc2l0aXZlIGludGVnZXIuXCI7cmV0dXJuIG5ldyBEKHRoaXMubSx0aGlzLnBhdGgsYSx0aGlzLmZhLHRoaXMueWEsdGhpcy5DYSx0aGlzLldhKX07RC5wcm90b3R5cGUubGltaXQ9RC5wcm90b3R5cGUuUGQ7RC5wcm90b3R5cGUuZWU9ZnVuY3Rpb24oYSxiKXt4KFwiUXVlcnkuc3RhcnRBdFwiLDAsMixhcmd1bWVudHMubGVuZ3RoKTtFYShcIlF1ZXJ5LnN0YXJ0QXRcIiwxLGEsITApO0dhKFwiUXVlcnkuc3RhcnRBdFwiLGIpO24oYSl8fChiPWE9bnVsbCk7cmV0dXJuIG5ldyBEKHRoaXMubSx0aGlzLnBhdGgsdGhpcy5FYSxhLGIsdGhpcy5DYSx0aGlzLldhKX07RC5wcm90b3R5cGUuc3RhcnRBdD1ELnByb3RvdHlwZS5lZTtcclxuRC5wcm90b3R5cGUuSmQ9ZnVuY3Rpb24oYSxiKXt4KFwiUXVlcnkuZW5kQXRcIiwwLDIsYXJndW1lbnRzLmxlbmd0aCk7RWEoXCJRdWVyeS5lbmRBdFwiLDEsYSwhMCk7R2EoXCJRdWVyeS5lbmRBdFwiLGIpO3JldHVybiBuZXcgRCh0aGlzLm0sdGhpcy5wYXRoLHRoaXMuRWEsdGhpcy5mYSx0aGlzLnlhLGEsYil9O0QucHJvdG90eXBlLmVuZEF0PUQucHJvdG90eXBlLkpkO2Z1bmN0aW9uIEphKGEpe3ZhciBiPXt9O24oYS5mYSkmJihiLnNwPWEuZmEpO24oYS55YSkmJihiLnNuPWEueWEpO24oYS5DYSkmJihiLmVwPWEuQ2EpO24oYS5XYSkmJihiLmVuPWEuV2EpO24oYS5FYSkmJihiLmw9YS5FYSk7bihhLmZhKSYmbihhLnlhKSYmbnVsbD09PWEuZmEmJm51bGw9PT1hLnlhJiYoYi52Zj1cImxcIik7cmV0dXJuIGJ9RC5wcm90b3R5cGUuUGE9ZnVuY3Rpb24oKXt2YXIgYT1LYShKYSh0aGlzKSk7cmV0dXJuXCJ7fVwiPT09YT9cImRlZmF1bHRcIjphfTtcclxuZnVuY3Rpb24gSWEoYSxiLGMpe3ZhciBkPXt9O2lmKGImJmMpZC5jYW5jZWw9Yix6KGEsMyxkLmNhbmNlbCwhMCksZC5ZPWMsdWEoYSw0LGQuWSk7ZWxzZSBpZihiKWlmKFwib2JqZWN0XCI9PT10eXBlb2YgYiYmbnVsbCE9PWIpZC5ZPWI7ZWxzZSBpZihcImZ1bmN0aW9uXCI9PT10eXBlb2YgYilkLmNhbmNlbD1iO2Vsc2UgdGhyb3cgRXJyb3Ioc2EuamUoYSwzLCEwKStcIm11c3QgZWl0aGVyIGJlIGEgY2FuY2VsIGNhbGxiYWNrIG9yIGEgY29udGV4dCBvYmplY3QuXCIpO3JldHVybiBkfTtmdW5jdGlvbiBGKGEsYil7aWYoMT09YXJndW1lbnRzLmxlbmd0aCl7dGhpcy5uPWEuc3BsaXQoXCIvXCIpO2Zvcih2YXIgYz0wLGQ9MDtkPHRoaXMubi5sZW5ndGg7ZCsrKTA8dGhpcy5uW2RdLmxlbmd0aCYmKHRoaXMubltjXT10aGlzLm5bZF0sYysrKTt0aGlzLm4ubGVuZ3RoPWM7dGhpcy5kYT0wfWVsc2UgdGhpcy5uPWEsdGhpcy5kYT1ifWZ1bmN0aW9uIEMoYSl7cmV0dXJuIGEuZGE+PWEubi5sZW5ndGg/bnVsbDphLm5bYS5kYV19ZnVuY3Rpb24gTGEoYSl7dmFyIGI9YS5kYTtiPGEubi5sZW5ndGgmJmIrKztyZXR1cm4gbmV3IEYoYS5uLGIpfWZ1bmN0aW9uIE1hKGEpe3JldHVybiBhLmRhPGEubi5sZW5ndGg/YS5uW2Eubi5sZW5ndGgtMV06bnVsbH1oPUYucHJvdG90eXBlO2gudG9TdHJpbmc9ZnVuY3Rpb24oKXtmb3IodmFyIGE9XCJcIixiPXRoaXMuZGE7Yjx0aGlzLm4ubGVuZ3RoO2IrKylcIlwiIT09dGhpcy5uW2JdJiYoYSs9XCIvXCIrdGhpcy5uW2JdKTtyZXR1cm4gYXx8XCIvXCJ9O1xyXG5oLnBhcmVudD1mdW5jdGlvbigpe2lmKHRoaXMuZGE+PXRoaXMubi5sZW5ndGgpcmV0dXJuIG51bGw7Zm9yKHZhciBhPVtdLGI9dGhpcy5kYTtiPHRoaXMubi5sZW5ndGgtMTtiKyspYS5wdXNoKHRoaXMubltiXSk7cmV0dXJuIG5ldyBGKGEsMCl9O2guRz1mdW5jdGlvbihhKXtmb3IodmFyIGI9W10sYz10aGlzLmRhO2M8dGhpcy5uLmxlbmd0aDtjKyspYi5wdXNoKHRoaXMubltjXSk7aWYoYSBpbnN0YW5jZW9mIEYpZm9yKGM9YS5kYTtjPGEubi5sZW5ndGg7YysrKWIucHVzaChhLm5bY10pO2Vsc2UgZm9yKGE9YS5zcGxpdChcIi9cIiksYz0wO2M8YS5sZW5ndGg7YysrKTA8YVtjXS5sZW5ndGgmJmIucHVzaChhW2NdKTtyZXR1cm4gbmV3IEYoYiwwKX07aC5mPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZGE+PXRoaXMubi5sZW5ndGh9O1xyXG5mdW5jdGlvbiBOYShhLGIpe3ZhciBjPUMoYSk7aWYobnVsbD09PWMpcmV0dXJuIGI7aWYoYz09PUMoYikpcmV0dXJuIE5hKExhKGEpLExhKGIpKTt0aHJvd1wiSU5URVJOQUwgRVJST1I6IGlubmVyUGF0aCAoXCIrYitcIikgaXMgbm90IHdpdGhpbiBvdXRlclBhdGggKFwiK2ErXCIpXCI7fWguY29udGFpbnM9ZnVuY3Rpb24oYSl7dmFyIGI9MDtpZih0aGlzLm4ubGVuZ3RoPmEubi5sZW5ndGgpcmV0dXJuITE7Zm9yKDtiPHRoaXMubi5sZW5ndGg7KXtpZih0aGlzLm5bYl0hPT1hLm5bYl0pcmV0dXJuITE7KytifXJldHVybiEwfTtmdW5jdGlvbiBPYSgpe3RoaXMuY2hpbGRyZW49e307dGhpcy55Yz0wO3RoaXMudmFsdWU9bnVsbH1mdW5jdGlvbiBQYShhLGIsYyl7dGhpcy5GYT1hP2E6XCJcIjt0aGlzLkViPWI/YjpudWxsO3RoaXMuQj1jP2M6bmV3IE9hfWZ1bmN0aW9uIEkoYSxiKXtmb3IodmFyIGM9YiBpbnN0YW5jZW9mIEY/YjpuZXcgRihiKSxkPWEsZTtudWxsIT09KGU9QyhjKSk7KWQ9bmV3IFBhKGUsZCx2YShkLkIuY2hpbGRyZW4sZSl8fG5ldyBPYSksYz1MYShjKTtyZXR1cm4gZH1oPVBhLnByb3RvdHlwZTtoLmo9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5CLnZhbHVlfTtmdW5jdGlvbiBKKGEsYil7dihcInVuZGVmaW5lZFwiIT09dHlwZW9mIGIsXCJDYW5ub3Qgc2V0IHZhbHVlIHRvIHVuZGVmaW5lZFwiKTthLkIudmFsdWU9YjtRYShhKX1oLnNiPWZ1bmN0aW9uKCl7cmV0dXJuIDA8dGhpcy5CLnljfTtoLmY9ZnVuY3Rpb24oKXtyZXR1cm4gbnVsbD09PXRoaXMuaigpJiYhdGhpcy5zYigpfTtcclxuaC5BPWZ1bmN0aW9uKGEpe2Zvcih2YXIgYiBpbiB0aGlzLkIuY2hpbGRyZW4pYShuZXcgUGEoYix0aGlzLHRoaXMuQi5jaGlsZHJlbltiXSkpfTtmdW5jdGlvbiBSYShhLGIsYyxkKXtjJiYhZCYmYihhKTthLkEoZnVuY3Rpb24oYSl7UmEoYSxiLCEwLGQpfSk7YyYmZCYmYihhKX1mdW5jdGlvbiBTYShhLGIsYyl7Zm9yKGE9Yz9hOmEucGFyZW50KCk7bnVsbCE9PWE7KXtpZihiKGEpKXJldHVybiEwO2E9YS5wYXJlbnQoKX1yZXR1cm4hMX1oLnBhdGg9ZnVuY3Rpb24oKXtyZXR1cm4gbmV3IEYobnVsbD09PXRoaXMuRWI/dGhpcy5GYTp0aGlzLkViLnBhdGgoKStcIi9cIit0aGlzLkZhKX07aC5uYW1lPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuRmF9O2gucGFyZW50PWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuRWJ9O1xyXG5mdW5jdGlvbiBRYShhKXtpZihudWxsIT09YS5FYil7dmFyIGI9YS5FYixjPWEuRmEsZD1hLmYoKSxlPUEoYi5CLmNoaWxkcmVuLGMpO2QmJmU/KGRlbGV0ZSBiLkIuY2hpbGRyZW5bY10sYi5CLnljLS0sUWEoYikpOmR8fGV8fChiLkIuY2hpbGRyZW5bY109YS5CLGIuQi55YysrLFFhKGIpKX19O2Z1bmN0aW9uIFRhKGEsYil7dGhpcy5UYT1hP2E6VWE7dGhpcy5lYT1iP2I6VmF9ZnVuY3Rpb24gVWEoYSxiKXtyZXR1cm4gYTxiPy0xOmE+Yj8xOjB9aD1UYS5wcm90b3R5cGU7aC5zYT1mdW5jdGlvbihhLGIpe3JldHVybiBuZXcgVGEodGhpcy5UYSx0aGlzLmVhLnNhKGEsYix0aGlzLlRhKS5KKG51bGwsbnVsbCwhMSxudWxsLG51bGwpKX07aC5yZW1vdmU9ZnVuY3Rpb24oYSl7cmV0dXJuIG5ldyBUYSh0aGlzLlRhLHRoaXMuZWEucmVtb3ZlKGEsdGhpcy5UYSkuSihudWxsLG51bGwsITEsbnVsbCxudWxsKSl9O2guZ2V0PWZ1bmN0aW9uKGEpe2Zvcih2YXIgYixjPXRoaXMuZWE7IWMuZigpOyl7Yj10aGlzLlRhKGEsYy5rZXkpO2lmKDA9PT1iKXJldHVybiBjLnZhbHVlOzA+Yj9jPWMubGVmdDowPGImJihjPWMucmlnaHQpfXJldHVybiBudWxsfTtcclxuZnVuY3Rpb24gV2EoYSxiKXtmb3IodmFyIGMsZD1hLmVhLGU9bnVsbDshZC5mKCk7KXtjPWEuVGEoYixkLmtleSk7aWYoMD09PWMpe2lmKGQubGVmdC5mKCkpcmV0dXJuIGU/ZS5rZXk6bnVsbDtmb3IoZD1kLmxlZnQ7IWQucmlnaHQuZigpOylkPWQucmlnaHQ7cmV0dXJuIGQua2V5fTA+Yz9kPWQubGVmdDowPGMmJihlPWQsZD1kLnJpZ2h0KX10aHJvdyBFcnJvcihcIkF0dGVtcHRlZCB0byBmaW5kIHByZWRlY2Vzc29yIGtleSBmb3IgYSBub25leGlzdGVudCBrZXkuICBXaGF0IGdpdmVzP1wiKTt9aC5mPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZWEuZigpfTtoLmNvdW50PWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZWEuY291bnQoKX07aC54Yj1mdW5jdGlvbigpe3JldHVybiB0aGlzLmVhLnhiKCl9O2guYmI9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5lYS5iYigpfTtoLkRhPWZ1bmN0aW9uKGEpe3JldHVybiB0aGlzLmVhLkRhKGEpfTtoLlFhPWZ1bmN0aW9uKGEpe3JldHVybiB0aGlzLmVhLlFhKGEpfTtcclxuaC5aYT1mdW5jdGlvbihhKXtyZXR1cm4gbmV3IFhhKHRoaXMuZWEsYSl9O2Z1bmN0aW9uIFhhKGEsYil7dGhpcy51ZD1iO2Zvcih0aGlzLlpiPVtdOyFhLmYoKTspdGhpcy5aYi5wdXNoKGEpLGE9YS5sZWZ0fWZ1bmN0aW9uIFlhKGEpe2lmKDA9PT1hLlpiLmxlbmd0aClyZXR1cm4gbnVsbDt2YXIgYj1hLlpiLnBvcCgpLGM7Yz1hLnVkP2EudWQoYi5rZXksYi52YWx1ZSk6e2tleTpiLmtleSx2YWx1ZTpiLnZhbHVlfTtmb3IoYj1iLnJpZ2h0OyFiLmYoKTspYS5aYi5wdXNoKGIpLGI9Yi5sZWZ0O3JldHVybiBjfWZ1bmN0aW9uIFphKGEsYixjLGQsZSl7dGhpcy5rZXk9YTt0aGlzLnZhbHVlPWI7dGhpcy5jb2xvcj1udWxsIT1jP2M6ITA7dGhpcy5sZWZ0PW51bGwhPWQ/ZDpWYTt0aGlzLnJpZ2h0PW51bGwhPWU/ZTpWYX1oPVphLnByb3RvdHlwZTtcclxuaC5KPWZ1bmN0aW9uKGEsYixjLGQsZSl7cmV0dXJuIG5ldyBaYShudWxsIT1hP2E6dGhpcy5rZXksbnVsbCE9Yj9iOnRoaXMudmFsdWUsbnVsbCE9Yz9jOnRoaXMuY29sb3IsbnVsbCE9ZD9kOnRoaXMubGVmdCxudWxsIT1lP2U6dGhpcy5yaWdodCl9O2guY291bnQ9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5sZWZ0LmNvdW50KCkrMSt0aGlzLnJpZ2h0LmNvdW50KCl9O2guZj1mdW5jdGlvbigpe3JldHVybiExfTtoLkRhPWZ1bmN0aW9uKGEpe3JldHVybiB0aGlzLmxlZnQuRGEoYSl8fGEodGhpcy5rZXksdGhpcy52YWx1ZSl8fHRoaXMucmlnaHQuRGEoYSl9O2guUWE9ZnVuY3Rpb24oYSl7cmV0dXJuIHRoaXMucmlnaHQuUWEoYSl8fGEodGhpcy5rZXksdGhpcy52YWx1ZSl8fHRoaXMubGVmdC5RYShhKX07ZnVuY3Rpb24gYmIoYSl7cmV0dXJuIGEubGVmdC5mKCk/YTpiYihhLmxlZnQpfWgueGI9ZnVuY3Rpb24oKXtyZXR1cm4gYmIodGhpcykua2V5fTtcclxuaC5iYj1mdW5jdGlvbigpe3JldHVybiB0aGlzLnJpZ2h0LmYoKT90aGlzLmtleTp0aGlzLnJpZ2h0LmJiKCl9O2guc2E9ZnVuY3Rpb24oYSxiLGMpe3ZhciBkLGU7ZT10aGlzO2Q9YyhhLGUua2V5KTtlPTA+ZD9lLkoobnVsbCxudWxsLG51bGwsZS5sZWZ0LnNhKGEsYixjKSxudWxsKTowPT09ZD9lLkoobnVsbCxiLG51bGwsbnVsbCxudWxsKTplLkoobnVsbCxudWxsLG51bGwsbnVsbCxlLnJpZ2h0LnNhKGEsYixjKSk7cmV0dXJuIGNiKGUpfTtmdW5jdGlvbiBkYihhKXtpZihhLmxlZnQuZigpKXJldHVybiBWYTthLmxlZnQuUSgpfHxhLmxlZnQubGVmdC5RKCl8fChhPWViKGEpKTthPWEuSihudWxsLG51bGwsbnVsbCxkYihhLmxlZnQpLG51bGwpO3JldHVybiBjYihhKX1cclxuaC5yZW1vdmU9ZnVuY3Rpb24oYSxiKXt2YXIgYyxkO2M9dGhpcztpZigwPmIoYSxjLmtleSkpYy5sZWZ0LmYoKXx8Yy5sZWZ0LlEoKXx8Yy5sZWZ0LmxlZnQuUSgpfHwoYz1lYihjKSksYz1jLkoobnVsbCxudWxsLG51bGwsYy5sZWZ0LnJlbW92ZShhLGIpLG51bGwpO2Vsc2V7Yy5sZWZ0LlEoKSYmKGM9ZmIoYykpO2MucmlnaHQuZigpfHxjLnJpZ2h0LlEoKXx8Yy5yaWdodC5sZWZ0LlEoKXx8KGM9Z2IoYyksYy5sZWZ0LmxlZnQuUSgpJiYoYz1mYihjKSxjPWdiKGMpKSk7aWYoMD09PWIoYSxjLmtleSkpe2lmKGMucmlnaHQuZigpKXJldHVybiBWYTtkPWJiKGMucmlnaHQpO2M9Yy5KKGQua2V5LGQudmFsdWUsbnVsbCxudWxsLGRiKGMucmlnaHQpKX1jPWMuSihudWxsLG51bGwsbnVsbCxudWxsLGMucmlnaHQucmVtb3ZlKGEsYikpfXJldHVybiBjYihjKX07aC5RPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuY29sb3J9O1xyXG5mdW5jdGlvbiBjYihhKXthLnJpZ2h0LlEoKSYmIWEubGVmdC5RKCkmJihhPWhiKGEpKTthLmxlZnQuUSgpJiZhLmxlZnQubGVmdC5RKCkmJihhPWZiKGEpKTthLmxlZnQuUSgpJiZhLnJpZ2h0LlEoKSYmKGE9Z2IoYSkpO3JldHVybiBhfWZ1bmN0aW9uIGViKGEpe2E9Z2IoYSk7YS5yaWdodC5sZWZ0LlEoKSYmKGE9YS5KKG51bGwsbnVsbCxudWxsLG51bGwsZmIoYS5yaWdodCkpLGE9aGIoYSksYT1nYihhKSk7cmV0dXJuIGF9ZnVuY3Rpb24gaGIoYSl7cmV0dXJuIGEucmlnaHQuSihudWxsLG51bGwsYS5jb2xvcixhLkoobnVsbCxudWxsLCEwLG51bGwsYS5yaWdodC5sZWZ0KSxudWxsKX1mdW5jdGlvbiBmYihhKXtyZXR1cm4gYS5sZWZ0LkoobnVsbCxudWxsLGEuY29sb3IsbnVsbCxhLkoobnVsbCxudWxsLCEwLGEubGVmdC5yaWdodCxudWxsKSl9XHJcbmZ1bmN0aW9uIGdiKGEpe3JldHVybiBhLkoobnVsbCxudWxsLCFhLmNvbG9yLGEubGVmdC5KKG51bGwsbnVsbCwhYS5sZWZ0LmNvbG9yLG51bGwsbnVsbCksYS5yaWdodC5KKG51bGwsbnVsbCwhYS5yaWdodC5jb2xvcixudWxsLG51bGwpKX1mdW5jdGlvbiBpYigpe31oPWliLnByb3RvdHlwZTtoLko9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpc307aC5zYT1mdW5jdGlvbihhLGIpe3JldHVybiBuZXcgWmEoYSxiLG51bGwpfTtoLnJlbW92ZT1mdW5jdGlvbigpe3JldHVybiB0aGlzfTtoLmNvdW50PWZ1bmN0aW9uKCl7cmV0dXJuIDB9O2guZj1mdW5jdGlvbigpe3JldHVybiEwfTtoLkRhPWZ1bmN0aW9uKCl7cmV0dXJuITF9O2guUWE9ZnVuY3Rpb24oKXtyZXR1cm4hMX07aC54Yj1mdW5jdGlvbigpe3JldHVybiBudWxsfTtoLmJiPWZ1bmN0aW9uKCl7cmV0dXJuIG51bGx9O2guUT1mdW5jdGlvbigpe3JldHVybiExfTt2YXIgVmE9bmV3IGliO2Z1bmN0aW9uIGpiKGEpe3RoaXMuVWI9YTt0aGlzLmhjPVwiZmlyZWJhc2U6XCJ9amIucHJvdG90eXBlLnNldD1mdW5jdGlvbihhLGIpe251bGw9PWI/dGhpcy5VYi5yZW1vdmVJdGVtKHRoaXMuaGMrYSk6dGhpcy5VYi5zZXRJdGVtKHRoaXMuaGMrYSx1KGIpKX07amIucHJvdG90eXBlLmdldD1mdW5jdGlvbihhKXthPXRoaXMuVWIuZ2V0SXRlbSh0aGlzLmhjK2EpO3JldHVybiBudWxsPT1hP251bGw6cWEoYSl9O2piLnByb3RvdHlwZS5yZW1vdmU9ZnVuY3Rpb24oYSl7dGhpcy5VYi5yZW1vdmVJdGVtKHRoaXMuaGMrYSl9O2piLnByb3RvdHlwZS5uZD0hMTtmdW5jdGlvbiBrYigpe3RoaXMubmI9e319a2IucHJvdG90eXBlLnNldD1mdW5jdGlvbihhLGIpe251bGw9PWI/ZGVsZXRlIHRoaXMubmJbYV06dGhpcy5uYlthXT1ifTtrYi5wcm90b3R5cGUuZ2V0PWZ1bmN0aW9uKGEpe3JldHVybiBBKHRoaXMubmIsYSk/dGhpcy5uYlthXTpudWxsfTtrYi5wcm90b3R5cGUucmVtb3ZlPWZ1bmN0aW9uKGEpe2RlbGV0ZSB0aGlzLm5iW2FdfTtrYi5wcm90b3R5cGUubmQ9ITA7ZnVuY3Rpb24gbGIoYSl7dHJ5e2lmKFwidW5kZWZpbmVkXCIhPT10eXBlb2Ygd2luZG93JiZcInVuZGVmaW5lZFwiIT09dHlwZW9mIHdpbmRvd1thXSl7dmFyIGI9d2luZG93W2FdO2Iuc2V0SXRlbShcImZpcmViYXNlOnNlbnRpbmVsXCIsXCJjYWNoZVwiKTtiLnJlbW92ZUl0ZW0oXCJmaXJlYmFzZTpzZW50aW5lbFwiKTtyZXR1cm4gbmV3IGpiKGIpfX1jYXRjaChjKXt9cmV0dXJuIG5ldyBrYn12YXIgbWI9bGIoXCJsb2NhbFN0b3JhZ2VcIiksbmI9bGIoXCJzZXNzaW9uU3RvcmFnZVwiKTtmdW5jdGlvbiBvYihhLGIsYyxkKXt0aGlzLmhvc3Q9YS50b0xvd2VyQ2FzZSgpO3RoaXMuZG9tYWluPXRoaXMuaG9zdC5zdWJzdHIodGhpcy5ob3N0LmluZGV4T2YoXCIuXCIpKzEpO3RoaXMubmM9Yjt0aGlzLlliPWM7dGhpcy5nZT1kO3RoaXMuaGE9bWIuZ2V0KFwiaG9zdDpcIithKXx8dGhpcy5ob3N0fWZ1bmN0aW9uIHBiKGEsYil7YiE9PWEuaGEmJihhLmhhPWIsXCJzLVwiPT09YS5oYS5zdWJzdHIoMCwyKSYmbWIuc2V0KFwiaG9zdDpcIithLmhvc3QsYS5oYSkpfW9iLnByb3RvdHlwZS50b1N0cmluZz1mdW5jdGlvbigpe3JldHVybih0aGlzLm5jP1wiaHR0cHM6Ly9cIjpcImh0dHA6Ly9cIikrdGhpcy5ob3N0fTtmdW5jdGlvbiBxYigpe3RoaXMucWE9LTF9O2Z1bmN0aW9uIHJiKCl7dGhpcy5xYT0tMTt0aGlzLnFhPTY0O3RoaXMuQz1bXTt0aGlzLnhjPVtdO3RoaXMuRWQ9W107dGhpcy5lYz1bXTt0aGlzLmVjWzBdPTEyODtmb3IodmFyIGE9MTthPHRoaXMucWE7KythKXRoaXMuZWNbYV09MDt0aGlzLnJjPXRoaXMuJGE9MDt0aGlzLnJlc2V0KCl9amEocmIscWIpO3JiLnByb3RvdHlwZS5yZXNldD1mdW5jdGlvbigpe3RoaXMuQ1swXT0xNzMyNTg0MTkzO3RoaXMuQ1sxXT00MDIzMjMzNDE3O3RoaXMuQ1syXT0yNTYyMzgzMTAyO3RoaXMuQ1szXT0yNzE3MzM4Nzg7dGhpcy5DWzRdPTMyODUzNzc1MjA7dGhpcy5yYz10aGlzLiRhPTB9O1xyXG5mdW5jdGlvbiBzYihhLGIsYyl7Y3x8KGM9MCk7dmFyIGQ9YS5FZDtpZihxKGIpKWZvcih2YXIgZT0wOzE2PmU7ZSsrKWRbZV09Yi5jaGFyQ29kZUF0KGMpPDwyNHxiLmNoYXJDb2RlQXQoYysxKTw8MTZ8Yi5jaGFyQ29kZUF0KGMrMik8PDh8Yi5jaGFyQ29kZUF0KGMrMyksYys9NDtlbHNlIGZvcihlPTA7MTY+ZTtlKyspZFtlXT1iW2NdPDwyNHxiW2MrMV08PDE2fGJbYysyXTw8OHxiW2MrM10sYys9NDtmb3IoZT0xNjs4MD5lO2UrKyl7dmFyIGY9ZFtlLTNdXmRbZS04XV5kW2UtMTRdXmRbZS0xNl07ZFtlXT0oZjw8MXxmPj4+MzEpJjQyOTQ5NjcyOTV9Yj1hLkNbMF07Yz1hLkNbMV07Zm9yKHZhciBnPWEuQ1syXSxrPWEuQ1szXSxsPWEuQ1s0XSxtLGU9MDs4MD5lO2UrKyk0MD5lPzIwPmU/KGY9a15jJihnXmspLG09MTUxODUwMDI0OSk6KGY9Y15nXmssbT0xODU5Nzc1MzkzKTo2MD5lPyhmPWMmZ3xrJihjfGcpLG09MjQwMDk1OTcwOCk6KGY9Y15nXmssbT0zMzk1NDY5NzgyKSxmPShiPDxcclxuNXxiPj4+MjcpK2YrbCttK2RbZV0mNDI5NDk2NzI5NSxsPWssaz1nLGc9KGM8PDMwfGM+Pj4yKSY0Mjk0OTY3Mjk1LGM9YixiPWY7YS5DWzBdPWEuQ1swXStiJjQyOTQ5NjcyOTU7YS5DWzFdPWEuQ1sxXStjJjQyOTQ5NjcyOTU7YS5DWzJdPWEuQ1syXStnJjQyOTQ5NjcyOTU7YS5DWzNdPWEuQ1szXStrJjQyOTQ5NjcyOTU7YS5DWzRdPWEuQ1s0XStsJjQyOTQ5NjcyOTV9XHJcbnJiLnByb3RvdHlwZS51cGRhdGU9ZnVuY3Rpb24oYSxiKXtuKGIpfHwoYj1hLmxlbmd0aCk7Zm9yKHZhciBjPWItdGhpcy5xYSxkPTAsZT10aGlzLnhjLGY9dGhpcy4kYTtkPGI7KXtpZigwPT1mKWZvcig7ZDw9Yzspc2IodGhpcyxhLGQpLGQrPXRoaXMucWE7aWYocShhKSlmb3IoO2Q8Yjspe2lmKGVbZl09YS5jaGFyQ29kZUF0KGQpLCsrZiwrK2QsZj09dGhpcy5xYSl7c2IodGhpcyxlKTtmPTA7YnJlYWt9fWVsc2UgZm9yKDtkPGI7KWlmKGVbZl09YVtkXSwrK2YsKytkLGY9PXRoaXMucWEpe3NiKHRoaXMsZSk7Zj0wO2JyZWFrfX10aGlzLiRhPWY7dGhpcy5yYys9Yn07dmFyIHRiPUFycmF5LnByb3RvdHlwZSx1Yj10Yi5mb3JFYWNoP2Z1bmN0aW9uKGEsYixjKXt0Yi5mb3JFYWNoLmNhbGwoYSxiLGMpfTpmdW5jdGlvbihhLGIsYyl7Zm9yKHZhciBkPWEubGVuZ3RoLGU9cShhKT9hLnNwbGl0KFwiXCIpOmEsZj0wO2Y8ZDtmKyspZiBpbiBlJiZiLmNhbGwoYyxlW2ZdLGYsYSl9LHZiPXRiLm1hcD9mdW5jdGlvbihhLGIsYyl7cmV0dXJuIHRiLm1hcC5jYWxsKGEsYixjKX06ZnVuY3Rpb24oYSxiLGMpe2Zvcih2YXIgZD1hLmxlbmd0aCxlPUFycmF5KGQpLGY9cShhKT9hLnNwbGl0KFwiXCIpOmEsZz0wO2c8ZDtnKyspZyBpbiBmJiYoZVtnXT1iLmNhbGwoYyxmW2ddLGcsYSkpO3JldHVybiBlfSx3Yj10Yi5yZWR1Y2U/ZnVuY3Rpb24oYSxiLGMsZCl7ZCYmKGI9cihiLGQpKTtyZXR1cm4gdGIucmVkdWNlLmNhbGwoYSxiLGMpfTpmdW5jdGlvbihhLGIsYyxkKXt2YXIgZT1jO3ViKGEsZnVuY3Rpb24oYyxnKXtlPWIuY2FsbChkLGUsYyxnLGEpfSk7cmV0dXJuIGV9LFxyXG54Yj10Yi5ldmVyeT9mdW5jdGlvbihhLGIsYyl7cmV0dXJuIHRiLmV2ZXJ5LmNhbGwoYSxiLGMpfTpmdW5jdGlvbihhLGIsYyl7Zm9yKHZhciBkPWEubGVuZ3RoLGU9cShhKT9hLnNwbGl0KFwiXCIpOmEsZj0wO2Y8ZDtmKyspaWYoZiBpbiBlJiYhYi5jYWxsKGMsZVtmXSxmLGEpKXJldHVybiExO3JldHVybiEwfTtmdW5jdGlvbiB5YihhLGIpe3ZhciBjO2E6e2M9YS5sZW5ndGg7Zm9yKHZhciBkPXEoYSk/YS5zcGxpdChcIlwiKTphLGU9MDtlPGM7ZSsrKWlmKGUgaW4gZCYmYi5jYWxsKHZvaWQgMCxkW2VdLGUsYSkpe2M9ZTticmVhayBhfWM9LTF9cmV0dXJuIDA+Yz9udWxsOnEoYSk/YS5jaGFyQXQoYyk6YVtjXX07dmFyIHpiO2E6e3ZhciBBYj1hYS5uYXZpZ2F0b3I7aWYoQWIpe3ZhciBCYj1BYi51c2VyQWdlbnQ7aWYoQmIpe3piPUJiO2JyZWFrIGF9fXpiPVwiXCJ9ZnVuY3Rpb24gQ2IoYSl7cmV0dXJuLTEhPXpiLmluZGV4T2YoYSl9O3ZhciBEYj1DYihcIk9wZXJhXCIpfHxDYihcIk9QUlwiKSxFYj1DYihcIlRyaWRlbnRcIil8fENiKFwiTVNJRVwiKSxGYj1DYihcIkdlY2tvXCIpJiYtMT09emIudG9Mb3dlckNhc2UoKS5pbmRleE9mKFwid2Via2l0XCIpJiYhKENiKFwiVHJpZGVudFwiKXx8Q2IoXCJNU0lFXCIpKSxHYj0tMSE9emIudG9Mb3dlckNhc2UoKS5pbmRleE9mKFwid2Via2l0XCIpOyhmdW5jdGlvbigpe3ZhciBhPVwiXCIsYjtpZihEYiYmYWEub3BlcmEpcmV0dXJuIGE9YWEub3BlcmEudmVyc2lvbixcImZ1bmN0aW9uXCI9PWRhKGEpP2EoKTphO0ZiP2I9L3J2XFw6KFteXFwpO10rKShcXCl8OykvOkViP2I9L1xcYig/Ok1TSUV8cnYpWzogXShbXlxcKTtdKykoXFwpfDspLzpHYiYmKGI9L1dlYktpdFxcLyhcXFMrKS8pO2ImJihhPShhPWIuZXhlYyh6YikpP2FbMV06XCJcIik7cmV0dXJuIEViJiYoYj0oYj1hYS5kb2N1bWVudCk/Yi5kb2N1bWVudE1vZGU6dm9pZCAwLGI+cGFyc2VGbG9hdChhKSk/U3RyaW5nKGIpOmF9KSgpO3ZhciBIYj1udWxsLEliPW51bGw7XHJcbmZ1bmN0aW9uIEpiKGEsYil7aWYoIWVhKGEpKXRocm93IEVycm9yKFwiZW5jb2RlQnl0ZUFycmF5IHRha2VzIGFuIGFycmF5IGFzIGEgcGFyYW1ldGVyXCIpO2lmKCFIYil7SGI9e307SWI9e307Zm9yKHZhciBjPTA7NjU+YztjKyspSGJbY109XCJBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvPVwiLmNoYXJBdChjKSxJYltjXT1cIkFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5LV8uXCIuY2hhckF0KGMpfWZvcih2YXIgYz1iP0liOkhiLGQ9W10sZT0wO2U8YS5sZW5ndGg7ZSs9Myl7dmFyIGY9YVtlXSxnPWUrMTxhLmxlbmd0aCxrPWc/YVtlKzFdOjAsbD1lKzI8YS5sZW5ndGgsbT1sP2FbZSsyXTowLHA9Zj4+MixmPShmJjMpPDw0fGs+PjQsaz0oayYxNSk8PDJ8bT4+NixtPW0mNjM7bHx8KG09NjQsZ3x8KGs9NjQpKTtkLnB1c2goY1twXSxjW2ZdLGNba10sY1ttXSl9cmV0dXJuIGQuam9pbihcIlwiKX1cclxuO3ZhciBLYj1mdW5jdGlvbigpe3ZhciBhPTE7cmV0dXJuIGZ1bmN0aW9uKCl7cmV0dXJuIGErK319KCk7ZnVuY3Rpb24gdihhLGIpe2lmKCFhKXRocm93IEVycm9yKFwiRmlyZWJhc2UgSU5URVJOQUwgQVNTRVJUIEZBSUxFRDpcIitiKTt9ZnVuY3Rpb24gTGIoYSl7dmFyIGI9cmEoYSk7YT1uZXcgcmI7YS51cGRhdGUoYik7dmFyIGI9W10sYz04KmEucmM7NTY+YS4kYT9hLnVwZGF0ZShhLmVjLDU2LWEuJGEpOmEudXBkYXRlKGEuZWMsYS5xYS0oYS4kYS01NikpO2Zvcih2YXIgZD1hLnFhLTE7NTY8PWQ7ZC0tKWEueGNbZF09YyYyNTUsYy89MjU2O3NiKGEsYS54Yyk7Zm9yKGQ9Yz0wOzU+ZDtkKyspZm9yKHZhciBlPTI0OzA8PWU7ZS09OCliW2NdPWEuQ1tkXT4+ZSYyNTUsKytjO3JldHVybiBKYihiKX1cclxuZnVuY3Rpb24gTWIoYSl7Zm9yKHZhciBiPVwiXCIsYz0wO2M8YXJndW1lbnRzLmxlbmd0aDtjKyspYj1lYShhcmd1bWVudHNbY10pP2IrTWIuYXBwbHkobnVsbCxhcmd1bWVudHNbY10pOlwib2JqZWN0XCI9PT10eXBlb2YgYXJndW1lbnRzW2NdP2IrdShhcmd1bWVudHNbY10pOmIrYXJndW1lbnRzW2NdLGIrPVwiIFwiO3JldHVybiBifXZhciBOYj1udWxsLE9iPSEwO2Z1bmN0aW9uIEsoYSl7ITA9PT1PYiYmKE9iPSExLG51bGw9PT1OYiYmITA9PT1uYi5nZXQoXCJsb2dnaW5nX2VuYWJsZWRcIikmJlBiKCEwKSk7aWYoTmIpe3ZhciBiPU1iLmFwcGx5KG51bGwsYXJndW1lbnRzKTtOYihiKX19ZnVuY3Rpb24gUWIoYSl7cmV0dXJuIGZ1bmN0aW9uKCl7SyhhLGFyZ3VtZW50cyl9fVxyXG5mdW5jdGlvbiBSYihhKXtpZihcInVuZGVmaW5lZFwiIT09dHlwZW9mIGNvbnNvbGUpe3ZhciBiPVwiRklSRUJBU0UgSU5URVJOQUwgRVJST1I6IFwiK01iLmFwcGx5KG51bGwsYXJndW1lbnRzKTtcInVuZGVmaW5lZFwiIT09dHlwZW9mIGNvbnNvbGUuZXJyb3I/Y29uc29sZS5lcnJvcihiKTpjb25zb2xlLmxvZyhiKX19ZnVuY3Rpb24gU2IoYSl7dmFyIGI9TWIuYXBwbHkobnVsbCxhcmd1bWVudHMpO3Rocm93IEVycm9yKFwiRklSRUJBU0UgRkFUQUwgRVJST1I6IFwiK2IpO31mdW5jdGlvbiBMKGEpe2lmKFwidW5kZWZpbmVkXCIhPT10eXBlb2YgY29uc29sZSl7dmFyIGI9XCJGSVJFQkFTRSBXQVJOSU5HOiBcIitNYi5hcHBseShudWxsLGFyZ3VtZW50cyk7XCJ1bmRlZmluZWRcIiE9PXR5cGVvZiBjb25zb2xlLndhcm4/Y29uc29sZS53YXJuKGIpOmNvbnNvbGUubG9nKGIpfX1cclxuZnVuY3Rpb24gQ2EoYSl7cmV0dXJuIGZhKGEpJiYoYSE9YXx8YT09TnVtYmVyLlBPU0lUSVZFX0lORklOSVRZfHxhPT1OdW1iZXIuTkVHQVRJVkVfSU5GSU5JVFkpfWZ1bmN0aW9uIFRiKGEpe2lmKFwiY29tcGxldGVcIj09PWRvY3VtZW50LnJlYWR5U3RhdGUpYSgpO2Vsc2V7dmFyIGI9ITEsYz1mdW5jdGlvbigpe2RvY3VtZW50LmJvZHk/Ynx8KGI9ITAsYSgpKTpzZXRUaW1lb3V0KGMsMTApfTtkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyPyhkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLGMsITEpLHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLGMsITEpKTpkb2N1bWVudC5hdHRhY2hFdmVudCYmKGRvY3VtZW50LmF0dGFjaEV2ZW50KFwib25yZWFkeXN0YXRlY2hhbmdlXCIsZnVuY3Rpb24oKXtcImNvbXBsZXRlXCI9PT1kb2N1bWVudC5yZWFkeVN0YXRlJiZjKCl9KSx3aW5kb3cuYXR0YWNoRXZlbnQoXCJvbmxvYWRcIixjKSl9fVxyXG5mdW5jdGlvbiBVYihhLGIpe3JldHVybiBhIT09Yj9udWxsPT09YT8tMTpudWxsPT09Yj8xOnR5cGVvZiBhIT09dHlwZW9mIGI/XCJudW1iZXJcIj09PXR5cGVvZiBhPy0xOjE6YT5iPzE6LTE6MH1mdW5jdGlvbiBWYihhLGIpe2lmKGE9PT1iKXJldHVybiAwO3ZhciBjPVdiKGEpLGQ9V2IoYik7cmV0dXJuIG51bGwhPT1jP251bGwhPT1kPzA9PWMtZD9hLmxlbmd0aC1iLmxlbmd0aDpjLWQ6LTE6bnVsbCE9PWQ/MTphPGI/LTE6MX1mdW5jdGlvbiBYYihhLGIpe2lmKGImJmEgaW4gYilyZXR1cm4gYlthXTt0aHJvdyBFcnJvcihcIk1pc3NpbmcgcmVxdWlyZWQga2V5IChcIithK1wiKSBpbiBvYmplY3Q6IFwiK3UoYikpO31cclxuZnVuY3Rpb24gS2EoYSl7aWYoXCJvYmplY3RcIiE9PXR5cGVvZiBhfHxudWxsPT09YSlyZXR1cm4gdShhKTt2YXIgYj1bXSxjO2ZvcihjIGluIGEpYi5wdXNoKGMpO2Iuc29ydCgpO2M9XCJ7XCI7Zm9yKHZhciBkPTA7ZDxiLmxlbmd0aDtkKyspMCE9PWQmJihjKz1cIixcIiksYys9dShiW2RdKSxjKz1cIjpcIixjKz1LYShhW2JbZF1dKTtyZXR1cm4gYytcIn1cIn1mdW5jdGlvbiBZYihhLGIpe2lmKGEubGVuZ3RoPD1iKXJldHVyblthXTtmb3IodmFyIGM9W10sZD0wO2Q8YS5sZW5ndGg7ZCs9YilkK2I+YT9jLnB1c2goYS5zdWJzdHJpbmcoZCxhLmxlbmd0aCkpOmMucHVzaChhLnN1YnN0cmluZyhkLGQrYikpO3JldHVybiBjfWZ1bmN0aW9uIFpiKGEsYil7aWYoXCJhcnJheVwiPT1kYShhKSlmb3IodmFyIGM9MDtjPGEubGVuZ3RoOysrYyliKGMsYVtjXSk7ZWxzZSAkYihhLGIpfWZ1bmN0aW9uIGFjKGEsYil7cmV0dXJuIGI/cihhLGIpOmF9XHJcbmZ1bmN0aW9uIGJjKGEpe3YoIUNhKGEpLFwiSW52YWxpZCBKU09OIG51bWJlclwiKTt2YXIgYixjLGQsZTswPT09YT8oZD1jPTAsYj0tSW5maW5pdHk9PT0xL2E/MTowKTooYj0wPmEsYT1NYXRoLmFicyhhKSxhPj1NYXRoLnBvdygyLC0xMDIyKT8oZD1NYXRoLm1pbihNYXRoLmZsb29yKE1hdGgubG9nKGEpL01hdGguTE4yKSwxMDIzKSxjPWQrMTAyMyxkPU1hdGgucm91bmQoYSpNYXRoLnBvdygyLDUyLWQpLU1hdGgucG93KDIsNTIpKSk6KGM9MCxkPU1hdGgucm91bmQoYS9NYXRoLnBvdygyLC0xMDc0KSkpKTtlPVtdO2ZvcihhPTUyO2E7YS09MSllLnB1c2goZCUyPzE6MCksZD1NYXRoLmZsb29yKGQvMik7Zm9yKGE9MTE7YTthLT0xKWUucHVzaChjJTI/MTowKSxjPU1hdGguZmxvb3IoYy8yKTtlLnB1c2goYj8xOjApO2UucmV2ZXJzZSgpO2I9ZS5qb2luKFwiXCIpO2M9XCJcIjtmb3IoYT0wOzY0PmE7YSs9OClkPXBhcnNlSW50KGIuc3Vic3RyKGEsOCksMikudG9TdHJpbmcoMTYpLDE9PT1kLmxlbmd0aCYmXHJcbihkPVwiMFwiK2QpLGMrPWQ7cmV0dXJuIGMudG9Mb3dlckNhc2UoKX1mdW5jdGlvbiBjYyhhKXt2YXIgYj1cIlVua25vd24gRXJyb3JcIjtcInRvb19iaWdcIj09PWE/Yj1cIlRoZSBkYXRhIHJlcXVlc3RlZCBleGNlZWRzIHRoZSBtYXhpbXVtIHNpemUgdGhhdCBjYW4gYmUgYWNjZXNzZWQgd2l0aCBhIHNpbmdsZSByZXF1ZXN0LlwiOlwicGVybWlzc2lvbl9kZW5pZWRcIj09YT9iPVwiQ2xpZW50IGRvZXNuJ3QgaGF2ZSBwZXJtaXNzaW9uIHRvIGFjY2VzcyB0aGUgZGVzaXJlZCBkYXRhLlwiOlwidW5hdmFpbGFibGVcIj09YSYmKGI9XCJUaGUgc2VydmljZSBpcyB1bmF2YWlsYWJsZVwiKTtiPUVycm9yKGErXCI6IFwiK2IpO2IuY29kZT1hLnRvVXBwZXJDYXNlKCk7cmV0dXJuIGJ9dmFyIGRjPS9eLT9cXGR7MSwxMH0kLztmdW5jdGlvbiBXYihhKXtyZXR1cm4gZGMudGVzdChhKSYmKGE9TnVtYmVyKGEpLC0yMTQ3NDgzNjQ4PD1hJiYyMTQ3NDgzNjQ3Pj1hKT9hOm51bGx9XHJcbmZ1bmN0aW9uIGVjKGEpe3RyeXthKCl9Y2F0Y2goYil7c2V0VGltZW91dChmdW5jdGlvbigpe3Rocm93IGI7fSwwKX19O2Z1bmN0aW9uIGZjKGEsYil7dGhpcy5GPWE7dihudWxsIT09dGhpcy5GLFwiTGVhZk5vZGUgc2hvdWxkbid0IGJlIGNyZWF0ZWQgd2l0aCBudWxsIHZhbHVlLlwiKTt0aGlzLmdiPVwidW5kZWZpbmVkXCIhPT10eXBlb2YgYj9iOm51bGx9aD1mYy5wcm90b3R5cGU7aC5QPWZ1bmN0aW9uKCl7cmV0dXJuITB9O2guaz1mdW5jdGlvbigpe3JldHVybiB0aGlzLmdifTtoLklhPWZ1bmN0aW9uKGEpe3JldHVybiBuZXcgZmModGhpcy5GLGEpfTtoLk89ZnVuY3Rpb24oKXtyZXR1cm4gTX07aC5MPWZ1bmN0aW9uKGEpe3JldHVybiBudWxsPT09QyhhKT90aGlzOk19O2guZ2E9ZnVuY3Rpb24oKXtyZXR1cm4gbnVsbH07aC5IPWZ1bmN0aW9uKGEsYil7cmV0dXJuKG5ldyBOKS5IKGEsYikuSWEodGhpcy5nYil9O2guQWE9ZnVuY3Rpb24oYSxiKXt2YXIgYz1DKGEpO3JldHVybiBudWxsPT09Yz9iOnRoaXMuSChjLE0uQWEoTGEoYSksYikpfTtoLmY9ZnVuY3Rpb24oKXtyZXR1cm4hMX07aC4kYj1mdW5jdGlvbigpe3JldHVybiAwfTtcclxuaC5WPWZ1bmN0aW9uKGEpe3JldHVybiBhJiZudWxsIT09dGhpcy5rKCk/e1wiLnZhbHVlXCI6dGhpcy5qKCksXCIucHJpb3JpdHlcIjp0aGlzLmsoKX06dGhpcy5qKCl9O2guaGFzaD1mdW5jdGlvbigpe3ZhciBhPVwiXCI7bnVsbCE9PXRoaXMuaygpJiYoYSs9XCJwcmlvcml0eTpcIitnYyh0aGlzLmsoKSkrXCI6XCIpO3ZhciBiPXR5cGVvZiB0aGlzLkYsYT1hKyhiK1wiOlwiKSxhPVwibnVtYmVyXCI9PT1iP2ErYmModGhpcy5GKTphK3RoaXMuRjtyZXR1cm4gTGIoYSl9O2guaj1mdW5jdGlvbigpe3JldHVybiB0aGlzLkZ9O2gudG9TdHJpbmc9ZnVuY3Rpb24oKXtyZXR1cm5cInN0cmluZ1wiPT09dHlwZW9mIHRoaXMuRj90aGlzLkY6J1wiJyt0aGlzLkYrJ1wiJ307ZnVuY3Rpb24gaWMoYSxiKXtyZXR1cm4gVWIoYS5rYSxiLmthKXx8VmIoYS5uYW1lLGIubmFtZSl9ZnVuY3Rpb24gamMoYSxiKXtyZXR1cm4gVmIoYS5uYW1lLGIubmFtZSl9ZnVuY3Rpb24ga2MoYSxiKXtyZXR1cm4gVmIoYSxiKX07ZnVuY3Rpb24gTihhLGIpe3RoaXMubz1hfHxuZXcgVGEoa2MpO3RoaXMuZ2I9XCJ1bmRlZmluZWRcIiE9PXR5cGVvZiBiP2I6bnVsbH1oPU4ucHJvdG90eXBlO2guUD1mdW5jdGlvbigpe3JldHVybiExfTtoLms9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5nYn07aC5JYT1mdW5jdGlvbihhKXtyZXR1cm4gbmV3IE4odGhpcy5vLGEpfTtoLkg9ZnVuY3Rpb24oYSxiKXt2YXIgYz10aGlzLm8ucmVtb3ZlKGEpO2ImJmIuZigpJiYoYj1udWxsKTtudWxsIT09YiYmKGM9Yy5zYShhLGIpKTtyZXR1cm4gYiYmbnVsbCE9PWIuaygpP25ldyBsYyhjLG51bGwsdGhpcy5nYik6bmV3IE4oYyx0aGlzLmdiKX07aC5BYT1mdW5jdGlvbihhLGIpe3ZhciBjPUMoYSk7aWYobnVsbD09PWMpcmV0dXJuIGI7dmFyIGQ9dGhpcy5PKGMpLkFhKExhKGEpLGIpO3JldHVybiB0aGlzLkgoYyxkKX07aC5mPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuby5mKCl9O2guJGI9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5vLmNvdW50KCl9O1xyXG52YXIgbWM9L15cXGQrJC87aD1OLnByb3RvdHlwZTtoLlY9ZnVuY3Rpb24oYSl7aWYodGhpcy5mKCkpcmV0dXJuIG51bGw7dmFyIGI9e30sYz0wLGQ9MCxlPSEwO3RoaXMuQShmdW5jdGlvbihmLGcpe2JbZl09Zy5WKGEpO2MrKztlJiZtYy50ZXN0KGYpP2Q9TWF0aC5tYXgoZCxOdW1iZXIoZikpOmU9ITF9KTtpZighYSYmZSYmZDwyKmMpe3ZhciBmPVtdLGc7Zm9yKGcgaW4gYilmW2ddPWJbZ107cmV0dXJuIGZ9YSYmbnVsbCE9PXRoaXMuaygpJiYoYltcIi5wcmlvcml0eVwiXT10aGlzLmsoKSk7cmV0dXJuIGJ9O2guaGFzaD1mdW5jdGlvbigpe3ZhciBhPVwiXCI7bnVsbCE9PXRoaXMuaygpJiYoYSs9XCJwcmlvcml0eTpcIitnYyh0aGlzLmsoKSkrXCI6XCIpO3RoaXMuQShmdW5jdGlvbihiLGMpe3ZhciBkPWMuaGFzaCgpO1wiXCIhPT1kJiYoYSs9XCI6XCIrYitcIjpcIitkKX0pO3JldHVyblwiXCI9PT1hP1wiXCI6TGIoYSl9O1xyXG5oLk89ZnVuY3Rpb24oYSl7YT10aGlzLm8uZ2V0KGEpO3JldHVybiBudWxsPT09YT9NOmF9O2guTD1mdW5jdGlvbihhKXt2YXIgYj1DKGEpO3JldHVybiBudWxsPT09Yj90aGlzOnRoaXMuTyhiKS5MKExhKGEpKX07aC5nYT1mdW5jdGlvbihhKXtyZXR1cm4gV2EodGhpcy5vLGEpfTtoLmhkPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuby54YigpfTtoLmtkPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuby5iYigpfTtoLkE9ZnVuY3Rpb24oYSl7cmV0dXJuIHRoaXMuby5EYShhKX07aC5FYz1mdW5jdGlvbihhKXtyZXR1cm4gdGhpcy5vLlFhKGEpfTtoLlphPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuby5aYSgpfTtoLnRvU3RyaW5nPWZ1bmN0aW9uKCl7dmFyIGE9XCJ7XCIsYj0hMDt0aGlzLkEoZnVuY3Rpb24oYyxkKXtiP2I9ITE6YSs9XCIsIFwiO2ErPSdcIicrYysnXCIgOiAnK2QudG9TdHJpbmcoKX0pO3JldHVybiBhKz1cIn1cIn07dmFyIE09bmV3IE47ZnVuY3Rpb24gbGMoYSxiLGMpe04uY2FsbCh0aGlzLGEsYyk7bnVsbD09PWImJihiPW5ldyBUYShpYyksYS5EYShmdW5jdGlvbihhLGMpe2I9Yi5zYSh7bmFtZTphLGthOmMuaygpfSxjKX0pKTt0aGlzLnhhPWJ9amEobGMsTik7aD1sYy5wcm90b3R5cGU7aC5IPWZ1bmN0aW9uKGEsYil7dmFyIGM9dGhpcy5PKGEpLGQ9dGhpcy5vLGU9dGhpcy54YTtudWxsIT09YyYmKGQ9ZC5yZW1vdmUoYSksZT1lLnJlbW92ZSh7bmFtZTphLGthOmMuaygpfSkpO2ImJmIuZigpJiYoYj1udWxsKTtudWxsIT09YiYmKGQ9ZC5zYShhLGIpLGU9ZS5zYSh7bmFtZTphLGthOmIuaygpfSxiKSk7cmV0dXJuIG5ldyBsYyhkLGUsdGhpcy5rKCkpfTtoLmdhPWZ1bmN0aW9uKGEsYil7dmFyIGM9V2EodGhpcy54YSx7bmFtZTphLGthOmIuaygpfSk7cmV0dXJuIGM/Yy5uYW1lOm51bGx9O2guQT1mdW5jdGlvbihhKXtyZXR1cm4gdGhpcy54YS5EYShmdW5jdGlvbihiLGMpe3JldHVybiBhKGIubmFtZSxjKX0pfTtcclxuaC5FYz1mdW5jdGlvbihhKXtyZXR1cm4gdGhpcy54YS5RYShmdW5jdGlvbihiLGMpe3JldHVybiBhKGIubmFtZSxjKX0pfTtoLlphPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMueGEuWmEoZnVuY3Rpb24oYSxiKXtyZXR1cm57a2V5OmEubmFtZSx2YWx1ZTpifX0pfTtoLmhkPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMueGEuZigpP251bGw6dGhpcy54YS54YigpLm5hbWV9O2gua2Q9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy54YS5mKCk/bnVsbDp0aGlzLnhhLmJiKCkubmFtZX07ZnVuY3Rpb24gTyhhLGIpe2lmKG51bGw9PT1hKXJldHVybiBNO3ZhciBjPW51bGw7XCJvYmplY3RcIj09PXR5cGVvZiBhJiZcIi5wcmlvcml0eVwiaW4gYT9jPWFbXCIucHJpb3JpdHlcIl06XCJ1bmRlZmluZWRcIiE9PXR5cGVvZiBiJiYoYz1iKTt2KG51bGw9PT1jfHxcInN0cmluZ1wiPT09dHlwZW9mIGN8fFwibnVtYmVyXCI9PT10eXBlb2YgY3x8XCJvYmplY3RcIj09PXR5cGVvZiBjJiZcIi5zdlwiaW4gYyxcIkludmFsaWQgcHJpb3JpdHkgdHlwZSBmb3VuZDogXCIrdHlwZW9mIGMpO1wib2JqZWN0XCI9PT10eXBlb2YgYSYmXCIudmFsdWVcImluIGEmJm51bGwhPT1hW1wiLnZhbHVlXCJdJiYoYT1hW1wiLnZhbHVlXCJdKTtpZihcIm9iamVjdFwiIT09dHlwZW9mIGF8fFwiLnN2XCJpbiBhKXJldHVybiBuZXcgZmMoYSxjKTtpZihhIGluc3RhbmNlb2YgQXJyYXkpe3ZhciBkPU0sZT1hOyRiKGUsZnVuY3Rpb24oYSxiKXtpZihBKGUsYikmJlwiLlwiIT09Yi5zdWJzdHJpbmcoMCwxKSl7dmFyIGM9TyhhKTtpZihjLlAoKXx8IWMuZigpKWQ9XHJcbmQuSChiLGMpfX0pO3JldHVybiBkLklhKGMpfXZhciBmPVtdLGc9e30saz0hMSxsPWE7WmIobCxmdW5jdGlvbihhLGIpe2lmKFwic3RyaW5nXCIhPT10eXBlb2YgYnx8XCIuXCIhPT1iLnN1YnN0cmluZygwLDEpKXt2YXIgYz1PKGxbYl0pO2MuZigpfHwoaz1rfHxudWxsIT09Yy5rKCksZi5wdXNoKHtuYW1lOmIsa2E6Yy5rKCl9KSxnW2JdPWMpfX0pO3ZhciBtPW5jKGYsZywhMSk7aWYoayl7dmFyIHA9bmMoZixnLCEwKTtyZXR1cm4gbmV3IGxjKG0scCxjKX1yZXR1cm4gbmV3IE4obSxjKX12YXIgb2M9TWF0aC5sb2coMik7ZnVuY3Rpb24gcGMoYSl7dGhpcy5jb3VudD1wYXJzZUludChNYXRoLmxvZyhhKzEpL29jLDEwKTt0aGlzLmVkPXRoaXMuY291bnQtMTt0aGlzLkdkPWErMSZwYXJzZUludChBcnJheSh0aGlzLmNvdW50KzEpLmpvaW4oXCIxXCIpLDIpfWZ1bmN0aW9uIHFjKGEpe3ZhciBiPSEoYS5HZCYxPDxhLmVkKTthLmVkLS07cmV0dXJuIGJ9XHJcbmZ1bmN0aW9uIG5jKGEsYixjKXtmdW5jdGlvbiBkKGUsZil7dmFyIGw9Zi1lO2lmKDA9PWwpcmV0dXJuIG51bGw7aWYoMT09bCl7dmFyIGw9YVtlXS5uYW1lLG09Yz9hW2VdOmw7cmV0dXJuIG5ldyBaYShtLGJbbF0sITEsbnVsbCxudWxsKX12YXIgbT1wYXJzZUludChsLzIsMTApK2UscD1kKGUsbSksdD1kKG0rMSxmKSxsPWFbbV0ubmFtZSxtPWM/YVttXTpsO3JldHVybiBuZXcgWmEobSxiW2xdLCExLHAsdCl9dmFyIGU9Yz9pYzpqYzthLnNvcnQoZSk7dmFyIGY9ZnVuY3Rpb24oZSl7ZnVuY3Rpb24gZihlLGcpe3ZhciBrPXAtZSx0PXA7cC09ZTt2YXIgcz1hW2tdLm5hbWUsaz1uZXcgWmEoYz9hW2tdOnMsYltzXSxnLG51bGwsZChrKzEsdCkpO2w/bC5sZWZ0PWs6bT1rO2w9a31mb3IodmFyIGw9bnVsbCxtPW51bGwscD1hLmxlbmd0aCx0PTA7dDxlLmNvdW50OysrdCl7dmFyIHM9cWMoZSksdz1NYXRoLnBvdygyLGUuY291bnQtKHQrMSkpO3M/Zih3LCExKTooZih3LCExKSxmKHcsITApKX1yZXR1cm4gbX0obmV3IHBjKGEubGVuZ3RoKSksXHJcbmU9Yz9pYzprYztyZXR1cm4gbnVsbCE9PWY/bmV3IFRhKGUsZik6bmV3IFRhKGUpfWZ1bmN0aW9uIGdjKGEpe3JldHVyblwibnVtYmVyXCI9PT10eXBlb2YgYT9cIm51bWJlcjpcIitiYyhhKTpcInN0cmluZzpcIithfTtmdW5jdGlvbiBQKGEsYil7dGhpcy5CPWE7dGhpcy5rYz1ifVAucHJvdG90eXBlLlY9ZnVuY3Rpb24oKXt4KFwiRmlyZWJhc2UuRGF0YVNuYXBzaG90LnZhbFwiLDAsMCxhcmd1bWVudHMubGVuZ3RoKTtyZXR1cm4gdGhpcy5CLlYoKX07UC5wcm90b3R5cGUudmFsPVAucHJvdG90eXBlLlY7UC5wcm90b3R5cGUuS2Q9ZnVuY3Rpb24oKXt4KFwiRmlyZWJhc2UuRGF0YVNuYXBzaG90LmV4cG9ydFZhbFwiLDAsMCxhcmd1bWVudHMubGVuZ3RoKTtyZXR1cm4gdGhpcy5CLlYoITApfTtQLnByb3RvdHlwZS5leHBvcnRWYWw9UC5wcm90b3R5cGUuS2Q7UC5wcm90b3R5cGUuRz1mdW5jdGlvbihhKXt4KFwiRmlyZWJhc2UuRGF0YVNuYXBzaG90LmNoaWxkXCIsMCwxLGFyZ3VtZW50cy5sZW5ndGgpO2ZhKGEpJiYoYT1TdHJpbmcoYSkpO0hhKFwiRmlyZWJhc2UuRGF0YVNuYXBzaG90LmNoaWxkXCIsYSk7dmFyIGI9bmV3IEYoYSksYz10aGlzLmtjLkcoYik7cmV0dXJuIG5ldyBQKHRoaXMuQi5MKGIpLGMpfTtcclxuUC5wcm90b3R5cGUuY2hpbGQ9UC5wcm90b3R5cGUuRztQLnByb3RvdHlwZS5IYz1mdW5jdGlvbihhKXt4KFwiRmlyZWJhc2UuRGF0YVNuYXBzaG90Lmhhc0NoaWxkXCIsMSwxLGFyZ3VtZW50cy5sZW5ndGgpO0hhKFwiRmlyZWJhc2UuRGF0YVNuYXBzaG90Lmhhc0NoaWxkXCIsYSk7dmFyIGI9bmV3IEYoYSk7cmV0dXJuIXRoaXMuQi5MKGIpLmYoKX07UC5wcm90b3R5cGUuaGFzQ2hpbGQ9UC5wcm90b3R5cGUuSGM7UC5wcm90b3R5cGUuaz1mdW5jdGlvbigpe3goXCJGaXJlYmFzZS5EYXRhU25hcHNob3QuZ2V0UHJpb3JpdHlcIiwwLDAsYXJndW1lbnRzLmxlbmd0aCk7cmV0dXJuIHRoaXMuQi5rKCl9O1AucHJvdG90eXBlLmdldFByaW9yaXR5PVAucHJvdG90eXBlLms7XHJcblAucHJvdG90eXBlLmZvckVhY2g9ZnVuY3Rpb24oYSl7eChcIkZpcmViYXNlLkRhdGFTbmFwc2hvdC5mb3JFYWNoXCIsMSwxLGFyZ3VtZW50cy5sZW5ndGgpO3ooXCJGaXJlYmFzZS5EYXRhU25hcHNob3QuZm9yRWFjaFwiLDEsYSwhMSk7aWYodGhpcy5CLlAoKSlyZXR1cm4hMTt2YXIgYj10aGlzO3JldHVybiB0aGlzLkIuQShmdW5jdGlvbihjLGQpe3JldHVybiBhKG5ldyBQKGQsYi5rYy5HKGMpKSl9KX07UC5wcm90b3R5cGUuZm9yRWFjaD1QLnByb3RvdHlwZS5mb3JFYWNoO1AucHJvdG90eXBlLnNiPWZ1bmN0aW9uKCl7eChcIkZpcmViYXNlLkRhdGFTbmFwc2hvdC5oYXNDaGlsZHJlblwiLDAsMCxhcmd1bWVudHMubGVuZ3RoKTtyZXR1cm4gdGhpcy5CLlAoKT8hMTohdGhpcy5CLmYoKX07UC5wcm90b3R5cGUuaGFzQ2hpbGRyZW49UC5wcm90b3R5cGUuc2I7XHJcblAucHJvdG90eXBlLm5hbWU9ZnVuY3Rpb24oKXt4KFwiRmlyZWJhc2UuRGF0YVNuYXBzaG90Lm5hbWVcIiwwLDAsYXJndW1lbnRzLmxlbmd0aCk7cmV0dXJuIHRoaXMua2MubmFtZSgpfTtQLnByb3RvdHlwZS5uYW1lPVAucHJvdG90eXBlLm5hbWU7UC5wcm90b3R5cGUuJGI9ZnVuY3Rpb24oKXt4KFwiRmlyZWJhc2UuRGF0YVNuYXBzaG90Lm51bUNoaWxkcmVuXCIsMCwwLGFyZ3VtZW50cy5sZW5ndGgpO3JldHVybiB0aGlzLkIuJGIoKX07UC5wcm90b3R5cGUubnVtQ2hpbGRyZW49UC5wcm90b3R5cGUuJGI7UC5wcm90b3R5cGUuVWM9ZnVuY3Rpb24oKXt4KFwiRmlyZWJhc2UuRGF0YVNuYXBzaG90LnJlZlwiLDAsMCxhcmd1bWVudHMubGVuZ3RoKTtyZXR1cm4gdGhpcy5rY307UC5wcm90b3R5cGUucmVmPVAucHJvdG90eXBlLlVjO2Z1bmN0aW9uIHJjKGEpe3YoXCJhcnJheVwiPT1kYShhKSYmMDxhLmxlbmd0aCxcIlJlcXVpcmVzIGEgbm9uLWVtcHR5IGFycmF5XCIpO3RoaXMuRmQ9YTt0aGlzLndiPXt9fXJjLnByb3RvdHlwZS5iZD1mdW5jdGlvbihhLGIpe2Zvcih2YXIgYz10aGlzLndiW2FdfHxbXSxkPTA7ZDxjLmxlbmd0aDtkKyspY1tkXS5iYS5hcHBseShjW2RdLlksQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLDEpKX07cmMucHJvdG90eXBlLmZiPWZ1bmN0aW9uKGEsYixjKXtzYyh0aGlzLGEpO3RoaXMud2JbYV09dGhpcy53YlthXXx8W107dGhpcy53YlthXS5wdXNoKHtiYTpiLFk6Y30pOyhhPXRoaXMuamQoYSkpJiZiLmFwcGx5KGMsYSl9O3JjLnByb3RvdHlwZS55Yj1mdW5jdGlvbihhLGIsYyl7c2ModGhpcyxhKTthPXRoaXMud2JbYV18fFtdO2Zvcih2YXIgZD0wO2Q8YS5sZW5ndGg7ZCsrKWlmKGFbZF0uYmE9PT1iJiYoIWN8fGM9PT1hW2RdLlkpKXthLnNwbGljZShkLDEpO2JyZWFrfX07XHJcbmZ1bmN0aW9uIHNjKGEsYil7dih5YihhLkZkLGZ1bmN0aW9uKGEpe3JldHVybiBhPT09Yn0pLFwiVW5rbm93biBldmVudDogXCIrYil9O2Z1bmN0aW9uIHRjKCl7cmMuY2FsbCh0aGlzLFtcInZpc2libGVcIl0pO3ZhciBhLGI7XCJ1bmRlZmluZWRcIiE9PXR5cGVvZiBkb2N1bWVudCYmXCJ1bmRlZmluZWRcIiE9PXR5cGVvZiBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyJiYoXCJ1bmRlZmluZWRcIiE9PXR5cGVvZiBkb2N1bWVudC5oaWRkZW4/KGI9XCJ2aXNpYmlsaXR5Y2hhbmdlXCIsYT1cImhpZGRlblwiKTpcInVuZGVmaW5lZFwiIT09dHlwZW9mIGRvY3VtZW50Lm1vekhpZGRlbj8oYj1cIm1venZpc2liaWxpdHljaGFuZ2VcIixhPVwibW96SGlkZGVuXCIpOlwidW5kZWZpbmVkXCIhPT10eXBlb2YgZG9jdW1lbnQubXNIaWRkZW4/KGI9XCJtc3Zpc2liaWxpdHljaGFuZ2VcIixhPVwibXNIaWRkZW5cIik6XCJ1bmRlZmluZWRcIiE9PXR5cGVvZiBkb2N1bWVudC53ZWJraXRIaWRkZW4mJihiPVwid2Via2l0dmlzaWJpbGl0eWNoYW5nZVwiLGE9XCJ3ZWJraXRIaWRkZW5cIikpO3RoaXMubGI9ITA7aWYoYil7dmFyIGM9dGhpcztkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKGIsXHJcbmZ1bmN0aW9uKCl7dmFyIGI9IWRvY3VtZW50W2FdO2IhPT1jLmxiJiYoYy5sYj1iLGMuYmQoXCJ2aXNpYmxlXCIsYikpfSwhMSl9fWphKHRjLHJjKTtjYSh0Yyk7dGMucHJvdG90eXBlLmpkPWZ1bmN0aW9uKGEpe3YoXCJ2aXNpYmxlXCI9PT1hLFwiVW5rbm93biBldmVudCB0eXBlOiBcIithKTtyZXR1cm5bdGhpcy5sYl19O2Z1bmN0aW9uIHVjKCl7cmMuY2FsbCh0aGlzLFtcIm9ubGluZVwiXSk7dGhpcy5DYj0hMDtpZihcInVuZGVmaW5lZFwiIT09dHlwZW9mIHdpbmRvdyYmXCJ1bmRlZmluZWRcIiE9PXR5cGVvZiB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcil7dmFyIGE9dGhpczt3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm9ubGluZVwiLGZ1bmN0aW9uKCl7YS5DYnx8YS5iZChcIm9ubGluZVwiLCEwKTthLkNiPSEwfSwhMSk7d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJvZmZsaW5lXCIsZnVuY3Rpb24oKXthLkNiJiZhLmJkKFwib25saW5lXCIsITEpO2EuQ2I9ITF9LCExKX19amEodWMscmMpO2NhKHVjKTt1Yy5wcm90b3R5cGUuamQ9ZnVuY3Rpb24oYSl7dihcIm9ubGluZVwiPT09YSxcIlVua25vd24gZXZlbnQgdHlwZTogXCIrYSk7cmV0dXJuW3RoaXMuQ2JdfTtmdW5jdGlvbiAkYihhLGIpe2Zvcih2YXIgYyBpbiBhKWIuY2FsbCh2b2lkIDAsYVtjXSxjLGEpfWZ1bmN0aW9uIHZjKGEpe3ZhciBiPVtdLGM9MCxkO2ZvcihkIGluIGEpYltjKytdPWQ7cmV0dXJuIGJ9ZnVuY3Rpb24gd2MoYSl7dmFyIGI9e30sYztmb3IoYyBpbiBhKWJbY109YVtjXTtyZXR1cm4gYn07ZnVuY3Rpb24geGMoKXt0aGlzLm9iPXt9fWZ1bmN0aW9uIHljKGEsYixjKXtuKGMpfHwoYz0xKTtBKGEub2IsYil8fChhLm9iW2JdPTApO2Eub2JbYl0rPWN9eGMucHJvdG90eXBlLmdldD1mdW5jdGlvbigpe3JldHVybiB3Yyh0aGlzLm9iKX07ZnVuY3Rpb24gemMoYSl7dGhpcy5IZD1hO3RoaXMuV2I9bnVsbH16Yy5wcm90b3R5cGUuZ2V0PWZ1bmN0aW9uKCl7dmFyIGE9dGhpcy5IZC5nZXQoKSxiPXdjKGEpO2lmKHRoaXMuV2IpZm9yKHZhciBjIGluIHRoaXMuV2IpYltjXS09dGhpcy5XYltjXTt0aGlzLldiPWE7cmV0dXJuIGJ9O2Z1bmN0aW9uIEFjKGEsYil7dGhpcy5aYz17fTt0aGlzLnFjPW5ldyB6YyhhKTt0aGlzLnU9YjtzZXRUaW1lb3V0KHIodGhpcy5zZCx0aGlzKSwxMCs2RTQqTWF0aC5yYW5kb20oKSl9QWMucHJvdG90eXBlLnNkPWZ1bmN0aW9uKCl7dmFyIGE9dGhpcy5xYy5nZXQoKSxiPXt9LGM9ITEsZDtmb3IoZCBpbiBhKTA8YVtkXSYmQSh0aGlzLlpjLGQpJiYoYltkXT1hW2RdLGM9ITApO2MmJihhPXRoaXMudSxhLlMmJihiPXtjOmJ9LGEuZShcInJlcG9ydFN0YXRzXCIsYiksYS5HYShcInNcIixiKSkpO3NldFRpbWVvdXQocih0aGlzLnNkLHRoaXMpLDZFNSpNYXRoLnJhbmRvbSgpKX07dmFyIEJjPXt9LENjPXt9O2Z1bmN0aW9uIERjKGEpe2E9YS50b1N0cmluZygpO0JjW2FdfHwoQmNbYV09bmV3IHhjKTtyZXR1cm4gQmNbYV19ZnVuY3Rpb24gRWMoYSxiKXt2YXIgYz1hLnRvU3RyaW5nKCk7Q2NbY118fChDY1tjXT1iKCkpO3JldHVybiBDY1tjXX07dmFyIEZjPW51bGw7XCJ1bmRlZmluZWRcIiE9PXR5cGVvZiBNb3pXZWJTb2NrZXQ/RmM9TW96V2ViU29ja2V0OlwidW5kZWZpbmVkXCIhPT10eXBlb2YgV2ViU29ja2V0JiYoRmM9V2ViU29ja2V0KTtmdW5jdGlvbiBRKGEsYixjKXt0aGlzLkFjPWE7dGhpcy5lPVFiKHRoaXMuQWMpO3RoaXMuZnJhbWVzPXRoaXMudWI9bnVsbDt0aGlzLmFkPTA7dGhpcy5hYT1EYyhiKTt0aGlzLlVhPShiLm5jP1wid3NzOi8vXCI6XCJ3czovL1wiKStiLmhhK1wiLy53cz92PTVcIjtiLmhvc3QhPT1iLmhhJiYodGhpcy5VYT10aGlzLlVhK1wiJm5zPVwiK2IuWWIpO2MmJih0aGlzLlVhPXRoaXMuVWErXCImcz1cIitjKX12YXIgR2M7XHJcblEucHJvdG90eXBlLm9wZW49ZnVuY3Rpb24oYSxiKXt0aGlzLmphPWI7dGhpcy5UZD1hO3RoaXMuZShcIldlYnNvY2tldCBjb25uZWN0aW5nIHRvIFwiK3RoaXMuVWEpO3RoaXMuVz1uZXcgRmModGhpcy5VYSk7dGhpcy5wYj0hMTttYi5zZXQoXCJwcmV2aW91c193ZWJzb2NrZXRfZmFpbHVyZVwiLCEwKTt2YXIgYz10aGlzO3RoaXMuVy5vbm9wZW49ZnVuY3Rpb24oKXtjLmUoXCJXZWJzb2NrZXQgY29ubmVjdGVkLlwiKTtjLnBiPSEwfTt0aGlzLlcub25jbG9zZT1mdW5jdGlvbigpe2MuZShcIldlYnNvY2tldCBjb25uZWN0aW9uIHdhcyBkaXNjb25uZWN0ZWQuXCIpO2MuVz1udWxsO2MuT2EoKX07dGhpcy5XLm9ubWVzc2FnZT1mdW5jdGlvbihhKXtpZihudWxsIT09Yy5XKWlmKGE9YS5kYXRhLHljKGMuYWEsXCJieXRlc19yZWNlaXZlZFwiLGEubGVuZ3RoKSxIYyhjKSxudWxsIT09Yy5mcmFtZXMpSWMoYyxhKTtlbHNle2E6e3YobnVsbD09PWMuZnJhbWVzLFwiV2UgYWxyZWFkeSBoYXZlIGEgZnJhbWUgYnVmZmVyXCIpO1xyXG5pZig2Pj1hLmxlbmd0aCl7dmFyIGI9TnVtYmVyKGEpO2lmKCFpc05hTihiKSl7Yy5hZD1iO2MuZnJhbWVzPVtdO2E9bnVsbDticmVhayBhfX1jLmFkPTE7Yy5mcmFtZXM9W119bnVsbCE9PWEmJkljKGMsYSl9fTt0aGlzLlcub25lcnJvcj1mdW5jdGlvbihhKXtjLmUoXCJXZWJTb2NrZXQgZXJyb3IuICBDbG9zaW5nIGNvbm5lY3Rpb24uXCIpOyhhPWEubWVzc2FnZXx8YS5kYXRhKSYmYy5lKGEpO2MuT2EoKX19O1EucHJvdG90eXBlLnN0YXJ0PWZ1bmN0aW9uKCl7fTtRLmlzQXZhaWxhYmxlPWZ1bmN0aW9uKCl7dmFyIGE9ITE7aWYoXCJ1bmRlZmluZWRcIiE9PXR5cGVvZiBuYXZpZ2F0b3ImJm5hdmlnYXRvci51c2VyQWdlbnQpe3ZhciBiPW5hdmlnYXRvci51c2VyQWdlbnQubWF0Y2goL0FuZHJvaWQgKFswLTldezAsfVxcLlswLTldezAsfSkvKTtiJiYxPGIubGVuZ3RoJiY0LjQ+cGFyc2VGbG9hdChiWzFdKSYmKGE9ITApfXJldHVybiFhJiZudWxsIT09RmMmJiFHY307XHJcblEucmVzcG9uc2VzUmVxdWlyZWRUb0JlSGVhbHRoeT0yO1EuaGVhbHRoeVRpbWVvdXQ9M0U0O2g9US5wcm90b3R5cGU7aC5MYz1mdW5jdGlvbigpe21iLnJlbW92ZShcInByZXZpb3VzX3dlYnNvY2tldF9mYWlsdXJlXCIpfTtmdW5jdGlvbiBJYyhhLGIpe2EuZnJhbWVzLnB1c2goYik7aWYoYS5mcmFtZXMubGVuZ3RoPT1hLmFkKXt2YXIgYz1hLmZyYW1lcy5qb2luKFwiXCIpO2EuZnJhbWVzPW51bGw7Yz1xYShjKTthLlRkKGMpfX1oLnNlbmQ9ZnVuY3Rpb24oYSl7SGModGhpcyk7YT11KGEpO3ljKHRoaXMuYWEsXCJieXRlc19zZW50XCIsYS5sZW5ndGgpO2E9WWIoYSwxNjM4NCk7MTxhLmxlbmd0aCYmdGhpcy5XLnNlbmQoU3RyaW5nKGEubGVuZ3RoKSk7Zm9yKHZhciBiPTA7YjxhLmxlbmd0aDtiKyspdGhpcy5XLnNlbmQoYVtiXSl9O1xyXG5oLk1iPWZ1bmN0aW9uKCl7dGhpcy5NYT0hMDt0aGlzLnViJiYoY2xlYXJJbnRlcnZhbCh0aGlzLnViKSx0aGlzLnViPW51bGwpO3RoaXMuVyYmKHRoaXMuVy5jbG9zZSgpLHRoaXMuVz1udWxsKX07aC5PYT1mdW5jdGlvbigpe3RoaXMuTWF8fCh0aGlzLmUoXCJXZWJTb2NrZXQgaXMgY2xvc2luZyBpdHNlbGZcIiksdGhpcy5NYigpLHRoaXMuamEmJih0aGlzLmphKHRoaXMucGIpLHRoaXMuamE9bnVsbCkpfTtoLmNsb3NlPWZ1bmN0aW9uKCl7dGhpcy5NYXx8KHRoaXMuZShcIldlYlNvY2tldCBpcyBiZWluZyBjbG9zZWRcIiksdGhpcy5NYigpKX07ZnVuY3Rpb24gSGMoYSl7Y2xlYXJJbnRlcnZhbChhLnViKTthLnViPXNldEludGVydmFsKGZ1bmN0aW9uKCl7YS5XJiZhLlcuc2VuZChcIjBcIik7SGMoYSl9LDQ1RTMpfTtmdW5jdGlvbiBKYyhhKXt0aGlzLlBjPWE7dGhpcy5nYz1bXTt0aGlzLlZhPTA7dGhpcy56Yz0tMTt0aGlzLk5hPW51bGx9ZnVuY3Rpb24gS2MoYSxiLGMpe2EuemM9YjthLk5hPWM7YS56YzxhLlZhJiYoYS5OYSgpLGEuTmE9bnVsbCl9ZnVuY3Rpb24gTGMoYSxiLGMpe2ZvcihhLmdjW2JdPWM7YS5nY1thLlZhXTspe3ZhciBkPWEuZ2NbYS5WYV07ZGVsZXRlIGEuZ2NbYS5WYV07Zm9yKHZhciBlPTA7ZTxkLmxlbmd0aDsrK2UpaWYoZFtlXSl7dmFyIGY9YTtlYyhmdW5jdGlvbigpe2YuUGMoZFtlXSl9KX1pZihhLlZhPT09YS56Yyl7YS5OYSYmKGNsZWFyVGltZW91dChhLk5hKSxhLk5hKCksYS5OYT1udWxsKTticmVha31hLlZhKyt9fTtmdW5jdGlvbiBNYygpe3RoaXMuc2V0PXt9fWg9TWMucHJvdG90eXBlO2guYWRkPWZ1bmN0aW9uKGEsYil7dGhpcy5zZXRbYV09bnVsbCE9PWI/YjohMH07aC5jb250YWlucz1mdW5jdGlvbihhKXtyZXR1cm4gQSh0aGlzLnNldCxhKX07aC5nZXQ9ZnVuY3Rpb24oYSl7cmV0dXJuIHRoaXMuY29udGFpbnMoYSk/dGhpcy5zZXRbYV06dm9pZCAwfTtoLnJlbW92ZT1mdW5jdGlvbihhKXtkZWxldGUgdGhpcy5zZXRbYV19O2guZj1mdW5jdGlvbigpe3ZhciBhO2E6e2E9dGhpcy5zZXQ7Zm9yKHZhciBiIGluIGEpe2E9ITE7YnJlYWsgYX1hPSEwfXJldHVybiBhfTtoLmNvdW50PWZ1bmN0aW9uKCl7dmFyIGE9dGhpcy5zZXQsYj0wLGM7Zm9yKGMgaW4gYSliKys7cmV0dXJuIGJ9O2Z1bmN0aW9uIFIoYSxiKXskYihhLnNldCxmdW5jdGlvbihhLGQpe2IoZCxhKX0pfWgua2V5cz1mdW5jdGlvbigpe3ZhciBhPVtdOyRiKHRoaXMuc2V0LGZ1bmN0aW9uKGIsYyl7YS5wdXNoKGMpfSk7cmV0dXJuIGF9O2Z1bmN0aW9uIE5jKGEsYixjKXt0aGlzLkFjPWE7dGhpcy5lPVFiKGEpO3RoaXMuYWE9RGMoYik7dGhpcy5wYz1jO3RoaXMucGI9ITE7dGhpcy5RYj1mdW5jdGlvbihhKXtiLmhvc3QhPT1iLmhhJiYoYS5ucz1iLlliKTt2YXIgYz1bXSxmO2ZvcihmIGluIGEpYS5oYXNPd25Qcm9wZXJ0eShmKSYmYy5wdXNoKGYrXCI9XCIrYVtmXSk7cmV0dXJuKGIubmM/XCJodHRwczovL1wiOlwiaHR0cDovL1wiKStiLmhhK1wiLy5scD9cIitjLmpvaW4oXCImXCIpfX12YXIgT2MsUGM7XHJcbk5jLnByb3RvdHlwZS5vcGVuPWZ1bmN0aW9uKGEsYil7dGhpcy5kZD0wO3RoaXMuVD1iO3RoaXMub2Q9bmV3IEpjKGEpO3RoaXMuTWE9ITE7dmFyIGM9dGhpczt0aGlzLkphPXNldFRpbWVvdXQoZnVuY3Rpb24oKXtjLmUoXCJUaW1lZCBvdXQgdHJ5aW5nIHRvIGNvbm5lY3QuXCIpO2MuT2EoKTtjLkphPW51bGx9LDNFNCk7VGIoZnVuY3Rpb24oKXtpZighYy5NYSl7Yy5tYT1uZXcgUWMoZnVuY3Rpb24oYSxiLGQsayxsKXt5YyhjLmFhLFwiYnl0ZXNfcmVjZWl2ZWRcIix1KGFyZ3VtZW50cykubGVuZ3RoKTtpZihjLm1hKWlmKGMuSmEmJihjbGVhclRpbWVvdXQoYy5KYSksYy5KYT1udWxsKSxjLnBiPSEwLFwic3RhcnRcIj09YSljLmlkPWIsYy5yZD1kO2Vsc2UgaWYoXCJjbG9zZVwiPT09YSliPyhjLm1hLm9jPSExLEtjKGMub2QsYixmdW5jdGlvbigpe2MuT2EoKX0pKTpjLk9hKCk7ZWxzZSB0aHJvdyBFcnJvcihcIlVucmVjb2duaXplZCBjb21tYW5kIHJlY2VpdmVkOiBcIithKTt9LGZ1bmN0aW9uKGEsXHJcbmIpe3ljKGMuYWEsXCJieXRlc19yZWNlaXZlZFwiLHUoYXJndW1lbnRzKS5sZW5ndGgpO0xjKGMub2QsYSxiKX0sZnVuY3Rpb24oKXtjLk9hKCl9LGMuUWIpO3ZhciBhPXtzdGFydDpcInRcIn07YS5zZXI9TWF0aC5mbG9vcigxRTgqTWF0aC5yYW5kb20oKSk7Yy5tYS5zYyYmKGEuY2I9Yy5tYS5zYyk7YS52PVwiNVwiO2MucGMmJihhLnM9Yy5wYyk7YT1jLlFiKGEpO2MuZShcIkNvbm5lY3RpbmcgdmlhIGxvbmctcG9sbCB0byBcIithKTtSYyhjLm1hLGEsZnVuY3Rpb24oKXt9KX19KX07XHJcbk5jLnByb3RvdHlwZS5zdGFydD1mdW5jdGlvbigpe3ZhciBhPXRoaXMubWEsYj10aGlzLnJkO2EuUmQ9dGhpcy5pZDthLlNkPWI7Zm9yKGEudmM9ITA7U2MoYSk7KTthPXRoaXMuaWQ7Yj10aGlzLnJkO3RoaXMuZWI9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImlmcmFtZVwiKTt2YXIgYz17ZGZyYW1lOlwidFwifTtjLmlkPWE7Yy5wdz1iO3RoaXMuZWIuc3JjPXRoaXMuUWIoYyk7dGhpcy5lYi5zdHlsZS5kaXNwbGF5PVwibm9uZVwiO2RvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5lYil9O05jLmlzQXZhaWxhYmxlPWZ1bmN0aW9uKCl7cmV0dXJuIVBjJiYhKFwib2JqZWN0XCI9PT10eXBlb2Ygd2luZG93JiZ3aW5kb3cuY2hyb21lJiZ3aW5kb3cuY2hyb21lLmV4dGVuc2lvbiYmIS9eY2hyb21lLy50ZXN0KHdpbmRvdy5sb2NhdGlvbi5ocmVmKSkmJiEoXCJvYmplY3RcIj09PXR5cGVvZiBXaW5kb3dzJiZcIm9iamVjdFwiPT09dHlwZW9mIFdpbmRvd3MuaGUpJiYoT2N8fCEwKX07aD1OYy5wcm90b3R5cGU7XHJcbmguTGM9ZnVuY3Rpb24oKXt9O2guTWI9ZnVuY3Rpb24oKXt0aGlzLk1hPSEwO3RoaXMubWEmJih0aGlzLm1hLmNsb3NlKCksdGhpcy5tYT1udWxsKTt0aGlzLmViJiYoZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh0aGlzLmViKSx0aGlzLmViPW51bGwpO3RoaXMuSmEmJihjbGVhclRpbWVvdXQodGhpcy5KYSksdGhpcy5KYT1udWxsKX07aC5PYT1mdW5jdGlvbigpe3RoaXMuTWF8fCh0aGlzLmUoXCJMb25ncG9sbCBpcyBjbG9zaW5nIGl0c2VsZlwiKSx0aGlzLk1iKCksdGhpcy5UJiYodGhpcy5UKHRoaXMucGIpLHRoaXMuVD1udWxsKSl9O2guY2xvc2U9ZnVuY3Rpb24oKXt0aGlzLk1hfHwodGhpcy5lKFwiTG9uZ3BvbGwgaXMgYmVpbmcgY2xvc2VkLlwiKSx0aGlzLk1iKCkpfTtcclxuaC5zZW5kPWZ1bmN0aW9uKGEpe2E9dShhKTt5Yyh0aGlzLmFhLFwiYnl0ZXNfc2VudFwiLGEubGVuZ3RoKTthPXJhKGEpO2E9SmIoYSwhMCk7YT1ZYihhLDE4NDApO2Zvcih2YXIgYj0wO2I8YS5sZW5ndGg7YisrKXt2YXIgYz10aGlzLm1hO2MuR2IucHVzaCh7YWU6dGhpcy5kZCxmZTphLmxlbmd0aCxmZDphW2JdfSk7Yy52YyYmU2MoYyk7dGhpcy5kZCsrfX07XHJcbmZ1bmN0aW9uIFFjKGEsYixjLGQpe3RoaXMuUWI9ZDt0aGlzLmphPWM7dGhpcy5SYz1uZXcgTWM7dGhpcy5HYj1bXTt0aGlzLkJjPU1hdGguZmxvb3IoMUU4Kk1hdGgucmFuZG9tKCkpO3RoaXMub2M9ITA7dGhpcy5zYz1LYigpO3dpbmRvd1tcInBMUENvbW1hbmRcIit0aGlzLnNjXT1hO3dpbmRvd1tcInBSVExQQ0JcIit0aGlzLnNjXT1iO2E9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImlmcmFtZVwiKTthLnN0eWxlLmRpc3BsYXk9XCJub25lXCI7aWYoZG9jdW1lbnQuYm9keSl7ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhKTt0cnl7YS5jb250ZW50V2luZG93LmRvY3VtZW50fHxLKFwiTm8gSUUgZG9tYWluIHNldHRpbmcgcmVxdWlyZWRcIil9Y2F0Y2goZSl7YS5zcmM9XCJqYXZhc2NyaXB0OnZvaWQoKGZ1bmN0aW9uKCl7ZG9jdW1lbnQub3BlbigpO2RvY3VtZW50LmRvbWFpbj0nXCIrZG9jdW1lbnQuZG9tYWluK1wiJztkb2N1bWVudC5jbG9zZSgpO30pKCkpXCJ9fWVsc2UgdGhyb3dcIkRvY3VtZW50IGJvZHkgaGFzIG5vdCBpbml0aWFsaXplZC4gV2FpdCB0byBpbml0aWFsaXplIEZpcmViYXNlIHVudGlsIGFmdGVyIHRoZSBkb2N1bWVudCBpcyByZWFkeS5cIjtcclxuYS5jb250ZW50RG9jdW1lbnQ/YS5CYT1hLmNvbnRlbnREb2N1bWVudDphLmNvbnRlbnRXaW5kb3c/YS5CYT1hLmNvbnRlbnRXaW5kb3cuZG9jdW1lbnQ6YS5kb2N1bWVudCYmKGEuQmE9YS5kb2N1bWVudCk7dGhpcy5aPWE7YT1cIlwiO3RoaXMuWi5zcmMmJlwiamF2YXNjcmlwdDpcIj09PXRoaXMuWi5zcmMuc3Vic3RyKDAsMTEpJiYoYT0nPHNjcmlwdD5kb2N1bWVudC5kb21haW49XCInK2RvY3VtZW50LmRvbWFpbisnXCI7XFx4M2Mvc2NyaXB0PicpO2E9XCI8aHRtbD48Ym9keT5cIithK1wiPC9ib2R5PjwvaHRtbD5cIjt0cnl7dGhpcy5aLkJhLm9wZW4oKSx0aGlzLlouQmEud3JpdGUoYSksdGhpcy5aLkJhLmNsb3NlKCl9Y2F0Y2goZil7SyhcImZyYW1lIHdyaXRpbmcgZXhjZXB0aW9uXCIpLGYuc3RhY2smJksoZi5zdGFjayksSyhmKX19XHJcblFjLnByb3RvdHlwZS5jbG9zZT1mdW5jdGlvbigpe3RoaXMudmM9ITE7aWYodGhpcy5aKXt0aGlzLlouQmEuYm9keS5pbm5lckhUTUw9XCJcIjt2YXIgYT10aGlzO3NldFRpbWVvdXQoZnVuY3Rpb24oKXtudWxsIT09YS5aJiYoZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChhLlopLGEuWj1udWxsKX0sMCl9dmFyIGI9dGhpcy5qYTtiJiYodGhpcy5qYT1udWxsLGIoKSl9O1xyXG5mdW5jdGlvbiBTYyhhKXtpZihhLnZjJiZhLm9jJiZhLlJjLmNvdW50KCk8KDA8YS5HYi5sZW5ndGg/MjoxKSl7YS5CYysrO3ZhciBiPXt9O2IuaWQ9YS5SZDtiLnB3PWEuU2Q7Yi5zZXI9YS5CYztmb3IodmFyIGI9YS5RYihiKSxjPVwiXCIsZD0wOzA8YS5HYi5sZW5ndGg7KWlmKDE4NzA+PWEuR2JbMF0uZmQubGVuZ3RoKzMwK2MubGVuZ3RoKXt2YXIgZT1hLkdiLnNoaWZ0KCksYz1jK1wiJnNlZ1wiK2QrXCI9XCIrZS5hZStcIiZ0c1wiK2QrXCI9XCIrZS5mZStcIiZkXCIrZCtcIj1cIitlLmZkO2QrK31lbHNlIGJyZWFrO1ZjKGEsYitjLGEuQmMpO3JldHVybiEwfXJldHVybiExfWZ1bmN0aW9uIFZjKGEsYixjKXtmdW5jdGlvbiBkKCl7YS5SYy5yZW1vdmUoYyk7U2MoYSl9YS5SYy5hZGQoYyk7dmFyIGU9c2V0VGltZW91dChkLDI1RTMpO1JjKGEsYixmdW5jdGlvbigpe2NsZWFyVGltZW91dChlKTtkKCl9KX1cclxuZnVuY3Rpb24gUmMoYSxiLGMpe3NldFRpbWVvdXQoZnVuY3Rpb24oKXt0cnl7aWYoYS5vYyl7dmFyIGQ9YS5aLkJhLmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik7ZC50eXBlPVwidGV4dC9qYXZhc2NyaXB0XCI7ZC5hc3luYz0hMDtkLnNyYz1iO2Qub25sb2FkPWQub25yZWFkeXN0YXRlY2hhbmdlPWZ1bmN0aW9uKCl7dmFyIGE9ZC5yZWFkeVN0YXRlO2EmJlwibG9hZGVkXCIhPT1hJiZcImNvbXBsZXRlXCIhPT1hfHwoZC5vbmxvYWQ9ZC5vbnJlYWR5c3RhdGVjaGFuZ2U9bnVsbCxkLnBhcmVudE5vZGUmJmQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChkKSxjKCkpfTtkLm9uZXJyb3I9ZnVuY3Rpb24oKXtLKFwiTG9uZy1wb2xsIHNjcmlwdCBmYWlsZWQgdG8gbG9hZDogXCIrYik7YS5vYz0hMTthLmNsb3NlKCl9O2EuWi5CYS5ib2R5LmFwcGVuZENoaWxkKGQpfX1jYXRjaChlKXt9fSwxKX07ZnVuY3Rpb24gV2MoYSl7WGModGhpcyxhKX12YXIgWWM9W05jLFFdO2Z1bmN0aW9uIFhjKGEsYil7dmFyIGM9USYmUS5pc0F2YWlsYWJsZSgpLGQ9YyYmIShtYi5uZHx8ITA9PT1tYi5nZXQoXCJwcmV2aW91c193ZWJzb2NrZXRfZmFpbHVyZVwiKSk7Yi5nZSYmKGN8fEwoXCJ3c3M6Ly8gVVJMIHVzZWQsIGJ1dCBicm93c2VyIGlzbid0IGtub3duIHRvIHN1cHBvcnQgd2Vic29ja2V0cy4gIFRyeWluZyBhbnl3YXkuXCIpLGQ9ITApO2lmKGQpYS5OYj1bUV07ZWxzZXt2YXIgZT1hLk5iPVtdO1piKFljLGZ1bmN0aW9uKGEsYil7YiYmYi5pc0F2YWlsYWJsZSgpJiZlLnB1c2goYil9KX19ZnVuY3Rpb24gWmMoYSl7aWYoMDxhLk5iLmxlbmd0aClyZXR1cm4gYS5OYlswXTt0aHJvdyBFcnJvcihcIk5vIHRyYW5zcG9ydHMgYXZhaWxhYmxlXCIpO307ZnVuY3Rpb24gJGMoYSxiLGMsZCxlLGYpe3RoaXMuaWQ9YTt0aGlzLmU9UWIoXCJjOlwiK3RoaXMuaWQrXCI6XCIpO3RoaXMuUGM9Yzt0aGlzLkJiPWQ7dGhpcy5UPWU7dGhpcy5PYz1mO3RoaXMuTj1iO3RoaXMuZmM9W107dGhpcy5jZD0wO3RoaXMuQWQ9bmV3IFdjKGIpO3RoaXMubmE9MDt0aGlzLmUoXCJDb25uZWN0aW9uIGNyZWF0ZWRcIik7YWQodGhpcyl9XHJcbmZ1bmN0aW9uIGFkKGEpe3ZhciBiPVpjKGEuQWQpO2EuSz1uZXcgYihcImM6XCIrYS5pZCtcIjpcIithLmNkKyssYS5OKTthLlRjPWIucmVzcG9uc2VzUmVxdWlyZWRUb0JlSGVhbHRoeXx8MDt2YXIgYz1iZChhLGEuSyksZD1jZChhLGEuSyk7YS5PYj1hLks7YS5MYj1hLks7YS53PW51bGw7YS5hYj0hMTtzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7YS5LJiZhLksub3BlbihjLGQpfSwwKTtiPWIuaGVhbHRoeVRpbWVvdXR8fDA7MDxiJiYoYS5WYj1zZXRUaW1lb3V0KGZ1bmN0aW9uKCl7YS5WYj1udWxsO2EuYWJ8fChhLmUoXCJDbG9zaW5nIHVuaGVhbHRoeSBjb25uZWN0aW9uIGFmdGVyIHRpbWVvdXQuXCIpLGEuY2xvc2UoKSl9LGIpKX1cclxuZnVuY3Rpb24gY2QoYSxiKXtyZXR1cm4gZnVuY3Rpb24oYyl7Yj09PWEuSz8oYS5LPW51bGwsY3x8MCE9PWEubmE/MT09PWEubmEmJmEuZShcIlJlYWx0aW1lIGNvbm5lY3Rpb24gbG9zdC5cIik6KGEuZShcIlJlYWx0aW1lIGNvbm5lY3Rpb24gZmFpbGVkLlwiKSxcInMtXCI9PT1hLk4uaGEuc3Vic3RyKDAsMikmJihtYi5yZW1vdmUoXCJob3N0OlwiK2EuTi5ob3N0KSxhLk4uaGE9YS5OLmhvc3QpKSxhLmNsb3NlKCkpOmI9PT1hLnc/KGEuZShcIlNlY29uZGFyeSBjb25uZWN0aW9uIGxvc3QuXCIpLGM9YS53LGEudz1udWxsLGEuT2IhPT1jJiZhLkxiIT09Y3x8YS5jbG9zZSgpKTphLmUoXCJjbG9zaW5nIGFuIG9sZCBjb25uZWN0aW9uXCIpfX1cclxuZnVuY3Rpb24gYmQoYSxiKXtyZXR1cm4gZnVuY3Rpb24oYyl7aWYoMiE9YS5uYSlpZihiPT09YS5MYil7dmFyIGQ9WGIoXCJ0XCIsYyk7Yz1YYihcImRcIixjKTtpZihcImNcIj09ZCl7aWYoZD1YYihcInRcIixjKSxcImRcImluIGMpaWYoYz1jLmQsXCJoXCI9PT1kKXt2YXIgZD1jLnRzLGU9Yy52LGY9Yy5oO2EucGM9Yy5zO3BiKGEuTixmKTswPT1hLm5hJiYoYS5LLnN0YXJ0KCksZGQoYSxhLkssZCksXCI1XCIhPT1lJiZMKFwiUHJvdG9jb2wgdmVyc2lvbiBtaXNtYXRjaCBkZXRlY3RlZFwiKSxjPWEuQWQsKGM9MTxjLk5iLmxlbmd0aD9jLk5iWzFdOm51bGwpJiZlZChhLGMpKX1lbHNlIGlmKFwiblwiPT09ZCl7YS5lKFwicmVjdmQgZW5kIHRyYW5zbWlzc2lvbiBvbiBwcmltYXJ5XCIpO2EuTGI9YS53O2ZvcihjPTA7YzxhLmZjLmxlbmd0aDsrK2MpYS5jYyhhLmZjW2NdKTthLmZjPVtdO2ZkKGEpfWVsc2VcInNcIj09PWQ/KGEuZShcIkNvbm5lY3Rpb24gc2h1dGRvd24gY29tbWFuZCByZWNlaXZlZC4gU2h1dHRpbmcgZG93bi4uLlwiKSxcclxuYS5PYyYmKGEuT2MoYyksYS5PYz1udWxsKSxhLlQ9bnVsbCxhLmNsb3NlKCkpOlwiclwiPT09ZD8oYS5lKFwiUmVzZXQgcGFja2V0IHJlY2VpdmVkLiAgTmV3IGhvc3Q6IFwiK2MpLHBiKGEuTixjKSwxPT09YS5uYT9hLmNsb3NlKCk6KGdkKGEpLGFkKGEpKSk6XCJlXCI9PT1kP1JiKFwiU2VydmVyIEVycm9yOiBcIitjKTpcIm9cIj09PWQ/KGEuZShcImdvdCBwb25nIG9uIHByaW1hcnkuXCIpLGhkKGEpLGlkKGEpKTpSYihcIlVua25vd24gY29udHJvbCBwYWNrZXQgY29tbWFuZDogXCIrZCl9ZWxzZVwiZFwiPT1kJiZhLmNjKGMpfWVsc2UgaWYoYj09PWEudylpZihkPVhiKFwidFwiLGMpLGM9WGIoXCJkXCIsYyksXCJjXCI9PWQpXCJ0XCJpbiBjJiYoYz1jLnQsXCJhXCI9PT1jP2pkKGEpOlwiclwiPT09Yz8oYS5lKFwiR290IGEgcmVzZXQgb24gc2Vjb25kYXJ5LCBjbG9zaW5nIGl0XCIpLGEudy5jbG9zZSgpLGEuT2IhPT1hLncmJmEuTGIhPT1hLnd8fGEuY2xvc2UoKSk6XCJvXCI9PT1jJiYoYS5lKFwiZ290IHBvbmcgb24gc2Vjb25kYXJ5LlwiKSxcclxuYS53ZC0tLGpkKGEpKSk7ZWxzZSBpZihcImRcIj09ZClhLmZjLnB1c2goYyk7ZWxzZSB0aHJvdyBFcnJvcihcIlVua25vd24gcHJvdG9jb2wgbGF5ZXI6IFwiK2QpO2Vsc2UgYS5lKFwibWVzc2FnZSBvbiBvbGQgY29ubmVjdGlvblwiKX19JGMucHJvdG90eXBlLnhkPWZ1bmN0aW9uKGEpe2tkKHRoaXMse3Q6XCJkXCIsZDphfSl9O2Z1bmN0aW9uIGZkKGEpe2EuT2I9PT1hLncmJmEuTGI9PT1hLncmJihhLmUoXCJjbGVhbmluZyB1cCBhbmQgcHJvbW90aW5nIGEgY29ubmVjdGlvbjogXCIrYS53LkFjKSxhLks9YS53LGEudz1udWxsKX1cclxuZnVuY3Rpb24gamQoYSl7MD49YS53ZD8oYS5lKFwiU2Vjb25kYXJ5IGNvbm5lY3Rpb24gaXMgaGVhbHRoeS5cIiksYS5hYj0hMCxhLncuTGMoKSxhLncuc3RhcnQoKSxhLmUoXCJzZW5kaW5nIGNsaWVudCBhY2sgb24gc2Vjb25kYXJ5XCIpLGEudy5zZW5kKHt0OlwiY1wiLGQ6e3Q6XCJhXCIsZDp7fX19KSxhLmUoXCJFbmRpbmcgdHJhbnNtaXNzaW9uIG9uIHByaW1hcnlcIiksYS5LLnNlbmQoe3Q6XCJjXCIsZDp7dDpcIm5cIixkOnt9fX0pLGEuT2I9YS53LGZkKGEpKTooYS5lKFwic2VuZGluZyBwaW5nIG9uIHNlY29uZGFyeS5cIiksYS53LnNlbmQoe3Q6XCJjXCIsZDp7dDpcInBcIixkOnt9fX0pKX0kYy5wcm90b3R5cGUuY2M9ZnVuY3Rpb24oYSl7aGQodGhpcyk7dGhpcy5QYyhhKX07ZnVuY3Rpb24gaGQoYSl7YS5hYnx8KGEuVGMtLSwwPj1hLlRjJiYoYS5lKFwiUHJpbWFyeSBjb25uZWN0aW9uIGlzIGhlYWx0aHkuXCIpLGEuYWI9ITAsYS5LLkxjKCkpKX1cclxuZnVuY3Rpb24gZWQoYSxiKXthLnc9bmV3IGIoXCJjOlwiK2EuaWQrXCI6XCIrYS5jZCsrLGEuTixhLnBjKTthLndkPWIucmVzcG9uc2VzUmVxdWlyZWRUb0JlSGVhbHRoeXx8MDthLncub3BlbihiZChhLGEudyksY2QoYSxhLncpKTtzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7YS53JiYoYS5lKFwiVGltZWQgb3V0IHRyeWluZyB0byB1cGdyYWRlLlwiKSxhLncuY2xvc2UoKSl9LDZFNCl9ZnVuY3Rpb24gZGQoYSxiLGMpe2EuZShcIlJlYWx0aW1lIGNvbm5lY3Rpb24gZXN0YWJsaXNoZWQuXCIpO2EuSz1iO2EubmE9MTthLkJiJiYoYS5CYihjKSxhLkJiPW51bGwpOzA9PT1hLlRjPyhhLmUoXCJQcmltYXJ5IGNvbm5lY3Rpb24gaXMgaGVhbHRoeS5cIiksYS5hYj0hMCk6c2V0VGltZW91dChmdW5jdGlvbigpe2lkKGEpfSw1RTMpfWZ1bmN0aW9uIGlkKGEpe2EuYWJ8fDEhPT1hLm5hfHwoYS5lKFwic2VuZGluZyBwaW5nIG9uIHByaW1hcnkuXCIpLGtkKGEse3Q6XCJjXCIsZDp7dDpcInBcIixkOnt9fX0pKX1cclxuZnVuY3Rpb24ga2QoYSxiKXtpZigxIT09YS5uYSl0aHJvd1wiQ29ubmVjdGlvbiBpcyBub3QgY29ubmVjdGVkXCI7YS5PYi5zZW5kKGIpfSRjLnByb3RvdHlwZS5jbG9zZT1mdW5jdGlvbigpezIhPT10aGlzLm5hJiYodGhpcy5lKFwiQ2xvc2luZyByZWFsdGltZSBjb25uZWN0aW9uLlwiKSx0aGlzLm5hPTIsZ2QodGhpcyksdGhpcy5UJiYodGhpcy5UKCksdGhpcy5UPW51bGwpKX07ZnVuY3Rpb24gZ2QoYSl7YS5lKFwiU2h1dHRpbmcgZG93biBhbGwgY29ubmVjdGlvbnNcIik7YS5LJiYoYS5LLmNsb3NlKCksYS5LPW51bGwpO2EudyYmKGEudy5jbG9zZSgpLGEudz1udWxsKTthLlZiJiYoY2xlYXJUaW1lb3V0KGEuVmIpLGEuVmI9bnVsbCl9O2Z1bmN0aW9uIGxkKGEsYixjLGQsZSxmKXt0aGlzLmlkPW1kKys7dGhpcy5lPVFiKFwicDpcIit0aGlzLmlkK1wiOlwiKTt0aGlzLlJhPSEwO3RoaXMuaWE9e307dGhpcy5VPVtdO3RoaXMuRGI9MDt0aGlzLkFiPVtdO3RoaXMuUz0hMTt0aGlzLnVhPTFFMzt0aGlzLlhiPTNFNTt0aGlzLmRjPWJ8fGJhO3RoaXMuYmM9Y3x8YmE7dGhpcy56Yj1kfHxiYTt0aGlzLlFjPWV8fGJhO3RoaXMuR2M9Znx8YmE7dGhpcy5OPWE7dGhpcy5WYz1udWxsO3RoaXMuS2I9e307dGhpcy4kZD0wO3RoaXMudmI9dGhpcy5LYz1udWxsO25kKHRoaXMsMCk7dGMucmIoKS5mYihcInZpc2libGVcIix0aGlzLlZkLHRoaXMpOy0xPT09YS5ob3N0LmluZGV4T2YoXCJmYmxvY2FsXCIpJiZ1Yy5yYigpLmZiKFwib25saW5lXCIsdGhpcy5VZCx0aGlzKX12YXIgbWQ9MCxvZD0wO2g9bGQucHJvdG90eXBlO1xyXG5oLkdhPWZ1bmN0aW9uKGEsYixjKXt2YXIgZD0rK3RoaXMuJGQ7YT17cjpkLGE6YSxiOmJ9O3RoaXMuZSh1KGEpKTt2KHRoaXMuUyxcInNlbmRSZXF1ZXN0XyBjYWxsIHdoZW4gd2UncmUgbm90IGNvbm5lY3RlZCBub3QgYWxsb3dlZC5cIik7dGhpcy5sYS54ZChhKTtjJiYodGhpcy5LYltkXT1jKX07ZnVuY3Rpb24gcGQoYSxiLGMpe3ZhciBkPWIudG9TdHJpbmcoKSxlPWIucGF0aCgpLnRvU3RyaW5nKCk7YS5pYVtlXT1hLmlhW2VdfHx7fTt2KCFhLmlhW2VdW2RdLFwibGlzdGVuKCkgY2FsbGVkIHR3aWNlIGZvciBzYW1lIHBhdGgvcXVlcnlJZC5cIik7YS5pYVtlXVtkXT17aGI6Yi5oYigpLEQ6Y307YS5TJiZxZChhLGUsZCxiLmhiKCksYyl9XHJcbmZ1bmN0aW9uIHFkKGEsYixjLGQsZSl7YS5lKFwiTGlzdGVuIG9uIFwiK2IrXCIgZm9yIFwiK2MpO3ZhciBmPXtwOmJ9O2Q9dmIoZCxmdW5jdGlvbihhKXtyZXR1cm4gSmEoYSl9KTtcInt9XCIhPT1jJiYoZi5xPWQpO2YuaD1hLkdjKGIpO2EuR2EoXCJsXCIsZixmdW5jdGlvbihkKXthLmUoXCJsaXN0ZW4gcmVzcG9uc2VcIixkKTtkPWQucztcIm9rXCIhPT1kJiZyZChhLGIsYyk7ZSYmZShkKX0pfVxyXG5oLm1iPWZ1bmN0aW9uKGEsYixjKXt0aGlzLkthPXtJZDphLGdkOiExLGJhOmIsU2I6Y307dGhpcy5lKFwiQXV0aGVudGljYXRpbmcgdXNpbmcgY3JlZGVudGlhbDogXCIrdGhpcy5LYSk7c2QodGhpcyk7aWYoIShiPTQwPT1hLmxlbmd0aCkpYTp7dmFyIGQ7dHJ5e3ZhciBlPWEuc3BsaXQoXCIuXCIpO2lmKDMhPT1lLmxlbmd0aCl7Yj0hMTticmVhayBhfXZhciBmO2I6e3RyeXtpZihcInVuZGVmaW5lZFwiIT09dHlwZW9mIGF0b2Ipe2Y9YXRvYihlWzFdKTticmVhayBifX1jYXRjaChnKXtLKFwiYmFzZTY0RGVjb2RlSWZOYXRpdmVTdXBwb3J0IGZhaWxlZDogXCIsZyl9Zj1udWxsfW51bGwhPT1mJiYoZD1xYShmKSl9Y2F0Y2goayl7SyhcImlzQWRtaW5BdXRoVG9rZW5fIGZhaWxlZFwiLGspfWI9XCJvYmplY3RcIj09PXR5cGVvZiBkJiYhMD09PXZhKGQsXCJhZG1pblwiKX1iJiYodGhpcy5lKFwiQWRtaW4gYXV0aCBjcmVkZW50aWFsIGRldGVjdGVkLiAgUmVkdWNpbmcgbWF4IHJlY29ubmVjdCB0aW1lLlwiKSx0aGlzLlhiPVxyXG4zRTQpfTtoLlBiPWZ1bmN0aW9uKGEpe2RlbGV0ZSB0aGlzLkthO3RoaXMuemIoITEpO3RoaXMuUyYmdGhpcy5HYShcInVuYXV0aFwiLHt9LGZ1bmN0aW9uKGIpe2EoYi5zLGIuZCl9KX07ZnVuY3Rpb24gc2QoYSl7dmFyIGI9YS5LYTthLlMmJmImJmEuR2EoXCJhdXRoXCIse2NyZWQ6Yi5JZH0sZnVuY3Rpb24oYyl7dmFyIGQ9Yy5zO2M9Yy5kfHxcImVycm9yXCI7XCJva1wiIT09ZCYmYS5LYT09PWImJmRlbGV0ZSBhLkthO2EuemIoXCJva1wiPT09ZCk7Yi5nZD9cIm9rXCIhPT1kJiZiLlNiJiZiLlNiKGQsYyk6KGIuZ2Q9ITAsYi5iYSYmYi5iYShkLGMpKX0pfWZ1bmN0aW9uIHRkKGEsYixjLGQpe2I9Yi50b1N0cmluZygpO3JkKGEsYixjKSYmYS5TJiZ1ZChhLGIsYyxkKX1mdW5jdGlvbiB1ZChhLGIsYyxkKXthLmUoXCJVbmxpc3RlbiBvbiBcIitiK1wiIGZvciBcIitjKTtiPXtwOmJ9O2Q9dmIoZCxmdW5jdGlvbihhKXtyZXR1cm4gSmEoYSl9KTtcInt9XCIhPT1jJiYoYi5xPWQpO2EuR2EoXCJ1XCIsYil9XHJcbmZ1bmN0aW9uIHZkKGEsYixjLGQpe2EuUz93ZChhLFwib1wiLGIsYyxkKTphLkFiLnB1c2goe1NjOmIsYWN0aW9uOlwib1wiLGRhdGE6YyxEOmR9KX1mdW5jdGlvbiB4ZChhLGIsYyxkKXthLlM/d2QoYSxcIm9tXCIsYixjLGQpOmEuQWIucHVzaCh7U2M6YixhY3Rpb246XCJvbVwiLGRhdGE6YyxEOmR9KX1oLk5jPWZ1bmN0aW9uKGEsYil7dGhpcy5TP3dkKHRoaXMsXCJvY1wiLGEsbnVsbCxiKTp0aGlzLkFiLnB1c2goe1NjOmEsYWN0aW9uOlwib2NcIixkYXRhOm51bGwsRDpifSl9O2Z1bmN0aW9uIHdkKGEsYixjLGQsZSl7Yz17cDpjLGQ6ZH07YS5lKFwib25EaXNjb25uZWN0IFwiK2IsYyk7YS5HYShiLGMsZnVuY3Rpb24oYSl7ZSYmc2V0VGltZW91dChmdW5jdGlvbigpe2UoYS5zLGEuZCl9LDApfSl9aC5wdXQ9ZnVuY3Rpb24oYSxiLGMsZCl7eWQodGhpcyxcInBcIixhLGIsYyxkKX07ZnVuY3Rpb24gemQoYSxiLGMsZCl7eWQoYSxcIm1cIixiLGMsZCx2b2lkIDApfVxyXG5mdW5jdGlvbiB5ZChhLGIsYyxkLGUsZil7Yz17cDpjLGQ6ZH07bihmKSYmKGMuaD1mKTthLlUucHVzaCh7YWN0aW9uOmIsdGQ6YyxEOmV9KTthLkRiKys7Yj1hLlUubGVuZ3RoLTE7YS5TJiZBZChhLGIpfWZ1bmN0aW9uIEFkKGEsYil7dmFyIGM9YS5VW2JdLmFjdGlvbixkPWEuVVtiXS50ZCxlPWEuVVtiXS5EO2EuVVtiXS5YZD1hLlM7YS5HYShjLGQsZnVuY3Rpb24oZCl7YS5lKGMrXCIgcmVzcG9uc2VcIixkKTtkZWxldGUgYS5VW2JdO2EuRGItLTswPT09YS5EYiYmKGEuVT1bXSk7ZSYmZShkLnMsZC5kKX0pfVxyXG5oLmNjPWZ1bmN0aW9uKGEpe2lmKFwiclwiaW4gYSl7dGhpcy5lKFwiZnJvbSBzZXJ2ZXI6IFwiK3UoYSkpO3ZhciBiPWEucixjPXRoaXMuS2JbYl07YyYmKGRlbGV0ZSB0aGlzLktiW2JdLGMoYS5iKSl9ZWxzZXtpZihcImVycm9yXCJpbiBhKXRocm93XCJBIHNlcnZlci1zaWRlIGVycm9yIGhhcyBvY2N1cnJlZDogXCIrYS5lcnJvcjtcImFcImluIGEmJihiPWEuYSxjPWEuYix0aGlzLmUoXCJoYW5kbGVTZXJ2ZXJNZXNzYWdlXCIsYixjKSxcImRcIj09PWI/dGhpcy5kYyhjLnAsYy5kLCExKTpcIm1cIj09PWI/dGhpcy5kYyhjLnAsYy5kLCEwKTpcImNcIj09PWI/QmQodGhpcyxjLnAsYy5xKTpcImFjXCI9PT1iPyhhPWMucyxiPWMuZCxjPXRoaXMuS2EsZGVsZXRlIHRoaXMuS2EsYyYmYy5TYiYmYy5TYihhLGIpLHRoaXMuemIoITEpKTpcInNkXCI9PT1iP3RoaXMuVmM/dGhpcy5WYyhjKTpcIm1zZ1wiaW4gYyYmXCJ1bmRlZmluZWRcIiE9PXR5cGVvZiBjb25zb2xlJiZjb25zb2xlLmxvZyhcIkZJUkVCQVNFOiBcIitjLm1zZy5yZXBsYWNlKFwiXFxuXCIsXHJcblwiXFxuRklSRUJBU0U6IFwiKSk6UmIoXCJVbnJlY29nbml6ZWQgYWN0aW9uIHJlY2VpdmVkIGZyb20gc2VydmVyOiBcIit1KGIpK1wiXFxuQXJlIHlvdSB1c2luZyB0aGUgbGF0ZXN0IGNsaWVudD9cIikpfX07aC5CYj1mdW5jdGlvbihhKXt0aGlzLmUoXCJjb25uZWN0aW9uIHJlYWR5XCIpO3RoaXMuUz0hMDt0aGlzLnZiPShuZXcgRGF0ZSkuZ2V0VGltZSgpO3RoaXMuUWMoe3NlcnZlclRpbWVPZmZzZXQ6YS0obmV3IERhdGUpLmdldFRpbWUoKX0pO3NkKHRoaXMpO2Zvcih2YXIgYiBpbiB0aGlzLmlhKWZvcih2YXIgYyBpbiB0aGlzLmlhW2JdKWE9dGhpcy5pYVtiXVtjXSxxZCh0aGlzLGIsYyxhLmhiLGEuRCk7Zm9yKGI9MDtiPHRoaXMuVS5sZW5ndGg7YisrKXRoaXMuVVtiXSYmQWQodGhpcyxiKTtmb3IoO3RoaXMuQWIubGVuZ3RoOyliPXRoaXMuQWIuc2hpZnQoKSx3ZCh0aGlzLGIuYWN0aW9uLGIuU2MsYi5kYXRhLGIuRCk7dGhpcy5iYyghMCl9O1xyXG5mdW5jdGlvbiBuZChhLGIpe3YoIWEubGEsXCJTY2hlZHVsaW5nIGEgY29ubmVjdCB3aGVuIHdlJ3JlIGFscmVhZHkgY29ubmVjdGVkL2luZz9cIik7YS5YYSYmY2xlYXJUaW1lb3V0KGEuWGEpO2EuWGE9c2V0VGltZW91dChmdW5jdGlvbigpe2EuWGE9bnVsbDtDZChhKX0sYil9aC5WZD1mdW5jdGlvbihhKXthJiYhdGhpcy5sYiYmdGhpcy51YT09PXRoaXMuWGImJih0aGlzLmUoXCJXaW5kb3cgYmVjYW1lIHZpc2libGUuICBSZWR1Y2luZyBkZWxheS5cIiksdGhpcy51YT0xRTMsdGhpcy5sYXx8bmQodGhpcywwKSk7dGhpcy5sYj1hfTtoLlVkPWZ1bmN0aW9uKGEpe2E/KHRoaXMuZShcIkJyb3dzZXIgd2VudCBvbmxpbmUuICBSZWNvbm5lY3RpbmcuXCIpLHRoaXMudWE9MUUzLHRoaXMuUmE9ITAsdGhpcy5sYXx8bmQodGhpcywwKSk6KHRoaXMuZShcIkJyb3dzZXIgd2VudCBvZmZsaW5lLiAgS2lsbGluZyBjb25uZWN0aW9uOyBkb24ndCByZWNvbm5lY3QuXCIpLHRoaXMuUmE9ITEsdGhpcy5sYSYmdGhpcy5sYS5jbG9zZSgpKX07XHJcbmgucGQ9ZnVuY3Rpb24oKXt0aGlzLmUoXCJkYXRhIGNsaWVudCBkaXNjb25uZWN0ZWRcIik7dGhpcy5TPSExO3RoaXMubGE9bnVsbDtmb3IodmFyIGE9MDthPHRoaXMuVS5sZW5ndGg7YSsrKXt2YXIgYj10aGlzLlVbYV07YiYmXCJoXCJpbiBiLnRkJiZiLlhkJiYoYi5EJiZiLkQoXCJkaXNjb25uZWN0XCIpLGRlbGV0ZSB0aGlzLlVbYV0sdGhpcy5EYi0tKX0wPT09dGhpcy5EYiYmKHRoaXMuVT1bXSk7aWYodGhpcy5SYSl0aGlzLmxiP3RoaXMudmImJigzRTQ8KG5ldyBEYXRlKS5nZXRUaW1lKCktdGhpcy52YiYmKHRoaXMudWE9MUUzKSx0aGlzLnZiPW51bGwpOih0aGlzLmUoXCJXaW5kb3cgaXNuJ3QgdmlzaWJsZS4gIERlbGF5aW5nIHJlY29ubmVjdC5cIiksdGhpcy51YT10aGlzLlhiLHRoaXMuS2M9KG5ldyBEYXRlKS5nZXRUaW1lKCkpLGE9TWF0aC5tYXgoMCx0aGlzLnVhLSgobmV3IERhdGUpLmdldFRpbWUoKS10aGlzLktjKSksYSo9TWF0aC5yYW5kb20oKSx0aGlzLmUoXCJUcnlpbmcgdG8gcmVjb25uZWN0IGluIFwiK1xyXG5hK1wibXNcIiksbmQodGhpcyxhKSx0aGlzLnVhPU1hdGgubWluKHRoaXMuWGIsMS4zKnRoaXMudWEpO2Vsc2UgZm9yKHZhciBjIGluIHRoaXMuS2IpZGVsZXRlIHRoaXMuS2JbY107dGhpcy5iYyghMSl9O2Z1bmN0aW9uIENkKGEpe2lmKGEuUmEpe2EuZShcIk1ha2luZyBhIGNvbm5lY3Rpb24gYXR0ZW1wdFwiKTthLktjPShuZXcgRGF0ZSkuZ2V0VGltZSgpO2EudmI9bnVsbDt2YXIgYj1yKGEuY2MsYSksYz1yKGEuQmIsYSksZD1yKGEucGQsYSksZT1hLmlkK1wiOlwiK29kKys7YS5sYT1uZXcgJGMoZSxhLk4sYixjLGQsZnVuY3Rpb24oYil7TChiK1wiIChcIithLk4udG9TdHJpbmcoKStcIilcIik7YS5SYT0hMX0pfX1oLkxhPWZ1bmN0aW9uKCl7dGhpcy5SYT0hMTt0aGlzLmxhP3RoaXMubGEuY2xvc2UoKToodGhpcy5YYSYmKGNsZWFyVGltZW91dCh0aGlzLlhhKSx0aGlzLlhhPW51bGwpLHRoaXMuUyYmdGhpcy5wZCgpKX07XHJcbmguamI9ZnVuY3Rpb24oKXt0aGlzLlJhPSEwO3RoaXMudWE9MUUzO3RoaXMuU3x8bmQodGhpcywwKX07ZnVuY3Rpb24gQmQoYSxiLGMpe2M9Yz92YihjLGZ1bmN0aW9uKGEpe3JldHVybiBLYShhKX0pLmpvaW4oXCIkXCIpOlwie31cIjsoYT1yZChhLGIsYykpJiZhLkQmJmEuRChcInBlcm1pc3Npb25fZGVuaWVkXCIpfWZ1bmN0aW9uIHJkKGEsYixjKXtiPShuZXcgRihiKSkudG9TdHJpbmcoKTtjfHwoYz1cInt9XCIpO3ZhciBkPWEuaWFbYl1bY107ZGVsZXRlIGEuaWFbYl1bY107cmV0dXJuIGR9O2Z1bmN0aW9uIERkKCl7dGhpcy5vPXRoaXMuRj1udWxsfWZ1bmN0aW9uIEVkKGEsYixjKXtpZihiLmYoKSlhLkY9YyxhLm89bnVsbDtlbHNlIGlmKG51bGwhPT1hLkYpYS5GPWEuRi5BYShiLGMpO2Vsc2V7bnVsbD09YS5vJiYoYS5vPW5ldyBNYyk7dmFyIGQ9QyhiKTthLm8uY29udGFpbnMoZCl8fGEuby5hZGQoZCxuZXcgRGQpO2E9YS5vLmdldChkKTtiPUxhKGIpO0VkKGEsYixjKX19ZnVuY3Rpb24gRmQoYSxiKXtpZihiLmYoKSlyZXR1cm4gYS5GPW51bGwsYS5vPW51bGwsITA7aWYobnVsbCE9PWEuRil7aWYoYS5GLlAoKSlyZXR1cm4hMTt2YXIgYz1hLkY7YS5GPW51bGw7Yy5BKGZ1bmN0aW9uKGIsYyl7RWQoYSxuZXcgRihiKSxjKX0pO3JldHVybiBGZChhLGIpfXJldHVybiBudWxsIT09YS5vPyhjPUMoYiksYj1MYShiKSxhLm8uY29udGFpbnMoYykmJkZkKGEuby5nZXQoYyksYikmJmEuby5yZW1vdmUoYyksYS5vLmYoKT8oYS5vPW51bGwsITApOiExKTohMH1cclxuZnVuY3Rpb24gR2QoYSxiLGMpe251bGwhPT1hLkY/YyhiLGEuRik6YS5BKGZ1bmN0aW9uKGEsZSl7dmFyIGY9bmV3IEYoYi50b1N0cmluZygpK1wiL1wiK2EpO0dkKGUsZixjKX0pfURkLnByb3RvdHlwZS5BPWZ1bmN0aW9uKGEpe251bGwhPT10aGlzLm8mJlIodGhpcy5vLGZ1bmN0aW9uKGIsYyl7YShiLGMpfSl9O2Z1bmN0aW9uIEhkKCl7dGhpcy4kPU19ZnVuY3Rpb24gUyhhLGIpe3JldHVybiBhLiQuTChiKX1mdW5jdGlvbiBUKGEsYixjKXthLiQ9YS4kLkFhKGIsYyl9SGQucHJvdG90eXBlLnRvU3RyaW5nPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuJC50b1N0cmluZygpfTtmdW5jdGlvbiBJZCgpe3RoaXMudmE9bmV3IEhkO3RoaXMuTT1uZXcgSGQ7dGhpcy5wYT1uZXcgSGQ7dGhpcy5GYj1uZXcgUGF9ZnVuY3Rpb24gSmQoYSxiLGMpe1QoYS52YSxiLGMpO3JldHVybiBLZChhLGIpfWZ1bmN0aW9uIEtkKGEsYil7Zm9yKHZhciBjPVMoYS52YSxiKSxkPVMoYS5NLGIpLGU9SShhLkZiLGIpLGY9ITEsZz1lO251bGwhPT1nOyl7aWYobnVsbCE9PWcuaigpKXtmPSEwO2JyZWFrfWc9Zy5wYXJlbnQoKX1pZihmKXJldHVybiExO2M9TGQoYyxkLGUpO3JldHVybiBjIT09ZD8oVChhLk0sYixjKSwhMCk6ITF9ZnVuY3Rpb24gTGQoYSxiLGMpe2lmKGMuZigpKXJldHVybiBhO2lmKG51bGwhPT1jLmooKSlyZXR1cm4gYjthPWF8fE07Yy5BKGZ1bmN0aW9uKGQpe2Q9ZC5uYW1lKCk7dmFyIGU9YS5PKGQpLGY9Yi5PKGQpLGc9SShjLGQpLGU9TGQoZSxmLGcpO2E9YS5IKGQsZSl9KTtyZXR1cm4gYX1cclxuSWQucHJvdG90eXBlLnNldD1mdW5jdGlvbihhLGIpe3ZhciBjPXRoaXMsZD1bXTt1YihiLGZ1bmN0aW9uKGEpe3ZhciBiPWEucGF0aDthPWEudGE7dmFyIGc9S2IoKTtKKEkoYy5GYixiKSxnKTtUKGMuTSxiLGEpO2QucHVzaCh7cGF0aDpiLGJlOmd9KX0pO3JldHVybiBkfTtmdW5jdGlvbiBNZChhLGIpe3ViKGIsZnVuY3Rpb24oYil7dmFyIGQ9Yi5iZTtiPUkoYS5GYixiLnBhdGgpO3ZhciBlPWIuaigpO3YobnVsbCE9PWUsXCJwZW5kaW5nUHV0IHNob3VsZCBub3QgYmUgbnVsbC5cIik7ZT09PWQmJkooYixudWxsKX0pfTtmdW5jdGlvbiBOZChhLGIpe3JldHVybiBhJiZcIm9iamVjdFwiPT09dHlwZW9mIGE/KHYoXCIuc3ZcImluIGEsXCJVbmV4cGVjdGVkIGxlYWYgbm9kZSBvciBwcmlvcml0eSBjb250ZW50c1wiKSxiW2FbXCIuc3ZcIl1dKTphfWZ1bmN0aW9uIE9kKGEsYil7dmFyIGM9bmV3IERkO0dkKGEsbmV3IEYoXCJcIiksZnVuY3Rpb24oYSxlKXtFZChjLGEsUGQoZSxiKSl9KTtyZXR1cm4gY31mdW5jdGlvbiBQZChhLGIpe3ZhciBjPU5kKGEuaygpLGIpLGQ7aWYoYS5QKCkpe3ZhciBlPU5kKGEuaigpLGIpO3JldHVybiBlIT09YS5qKCl8fGMhPT1hLmsoKT9uZXcgZmMoZSxjKTphfWQ9YTtjIT09YS5rKCkmJihkPWQuSWEoYykpO2EuQShmdW5jdGlvbihhLGMpe3ZhciBlPVBkKGMsYik7ZSE9PWMmJihkPWQuSChhLGUpKX0pO3JldHVybiBkfTtmdW5jdGlvbiBRZCgpe3RoaXMuWWE9W119ZnVuY3Rpb24gUmQoYSxiKXtpZigwIT09Yi5sZW5ndGgpZm9yKHZhciBjPTA7YzxiLmxlbmd0aDtjKyspYS5ZYS5wdXNoKGJbY10pfVFkLnByb3RvdHlwZS5JYj1mdW5jdGlvbigpe2Zvcih2YXIgYT0wO2E8dGhpcy5ZYS5sZW5ndGg7YSsrKWlmKHRoaXMuWWFbYV0pe3ZhciBiPXRoaXMuWWFbYV07dGhpcy5ZYVthXT1udWxsO1NkKGIpfXRoaXMuWWE9W119O2Z1bmN0aW9uIFNkKGEpe3ZhciBiPWEuYmEsYz1hLnlkLGQ9YS5IYjtlYyhmdW5jdGlvbigpe2IoYyxkKX0pfTtmdW5jdGlvbiBVKGEsYixjLGQpe3RoaXMudHlwZT1hO3RoaXMud2E9Yjt0aGlzLmNhPWM7dGhpcy5IYj1kfTtmdW5jdGlvbiBUZChhKXt0aGlzLlI9YTt0aGlzLnJhPVtdO3RoaXMuRGM9bmV3IFFkfWZ1bmN0aW9uIFVkKGEsYixjLGQsZSl7YS5yYS5wdXNoKHt0eXBlOmIsYmE6YyxjYW5jZWw6ZCxZOmV9KTtkPVtdO3ZhciBmPVZkKGEuaSk7YS50YiYmZi5wdXNoKG5ldyBVKFwidmFsdWVcIixhLmkpKTtmb3IodmFyIGc9MDtnPGYubGVuZ3RoO2crKylpZihmW2ddLnR5cGU9PT1iKXt2YXIgaz1uZXcgRShhLlIubSxhLlIucGF0aCk7ZltnXS5jYSYmKGs9ay5HKGZbZ10uY2EpKTtkLnB1c2goe2JhOmFjKGMsZSkseWQ6bmV3IFAoZltnXS53YSxrKSxIYjpmW2ddLkhifSl9UmQoYS5EYyxkKX1UZC5wcm90b3R5cGUuaWM9ZnVuY3Rpb24oYSxiKXtiPXRoaXMuamMoYSxiKTtudWxsIT1iJiZXZCh0aGlzLGIpfTtcclxuZnVuY3Rpb24gV2QoYSxiKXtmb3IodmFyIGM9W10sZD0wO2Q8Yi5sZW5ndGg7ZCsrKXt2YXIgZT1iW2RdLGY9ZS50eXBlLGc9bmV3IEUoYS5SLm0sYS5SLnBhdGgpO2JbZF0uY2EmJihnPWcuRyhiW2RdLmNhKSk7Zz1uZXcgUChiW2RdLndhLGcpO1widmFsdWVcIiE9PWUudHlwZXx8Zy5zYigpP1widmFsdWVcIiE9PWUudHlwZSYmKGYrPVwiIFwiK2cubmFtZSgpKTpmKz1cIihcIitnLlYoKStcIilcIjtLKGEuUi5tLnUuaWQrXCI6IGV2ZW50OlwiK2EuUi5wYXRoK1wiOlwiK2EuUi5QYSgpK1wiOlwiK2YpO2ZvcihmPTA7ZjxhLnJhLmxlbmd0aDtmKyspe3ZhciBrPWEucmFbZl07YltkXS50eXBlPT09ay50eXBlJiZjLnB1c2goe2JhOmFjKGsuYmEsay5ZKSx5ZDpnLEhiOmUuSGJ9KX19UmQoYS5EYyxjKX1UZC5wcm90b3R5cGUuSWI9ZnVuY3Rpb24oKXt0aGlzLkRjLkliKCl9O1xyXG5mdW5jdGlvbiBWZChhKXt2YXIgYj1bXTtpZighYS5QKCkpe3ZhciBjPW51bGw7YS5BKGZ1bmN0aW9uKGEsZSl7Yi5wdXNoKG5ldyBVKFwiY2hpbGRfYWRkZWRcIixlLGEsYykpO2M9YX0pfXJldHVybiBifWZ1bmN0aW9uIFhkKGEpe2EudGJ8fChhLnRiPSEwLFdkKGEsW25ldyBVKFwidmFsdWVcIixhLmkpXSkpfTtmdW5jdGlvbiBZZChhLGIpe1RkLmNhbGwodGhpcyxhKTt0aGlzLmk9Yn1qYShZZCxUZCk7WWQucHJvdG90eXBlLmpjPWZ1bmN0aW9uKGEsYil7dGhpcy5pPWE7dGhpcy50YiYmbnVsbCE9YiYmYi5wdXNoKG5ldyBVKFwidmFsdWVcIix0aGlzLmkpKTtyZXR1cm4gYn07WWQucHJvdG90eXBlLnFiPWZ1bmN0aW9uKCl7cmV0dXJue319O2Z1bmN0aW9uIFpkKGEsYil7dGhpcy5UYj1hO3RoaXMuTWM9Yn1mdW5jdGlvbiAkZChhLGIsYyxkLGUpe3ZhciBmPWEuTChjKSxnPWIuTChjKTtkPW5ldyBaZChkLGUpO2U9YWUoZCxjLGYsZyk7Zz0hZi5mKCkmJiFnLmYoKSYmZi5rKCkhPT1nLmsoKTtpZihlfHxnKWZvcihmPWMsYz1lO251bGwhPT1mLnBhcmVudCgpOyl7dmFyIGs9YS5MKGYpO2U9Yi5MKGYpO3ZhciBsPWYucGFyZW50KCk7aWYoIWQuVGJ8fEkoZC5UYixsKS5qKCkpe3ZhciBtPWIuTChsKSxwPVtdLGY9TWEoZik7ay5mKCk/KGs9bS5nYShmLGUpLHAucHVzaChuZXcgVShcImNoaWxkX2FkZGVkXCIsZSxmLGspKSk6ZS5mKCk/cC5wdXNoKG5ldyBVKFwiY2hpbGRfcmVtb3ZlZFwiLGssZikpOihrPW0uZ2EoZixlKSxnJiZwLnB1c2gobmV3IFUoXCJjaGlsZF9tb3ZlZFwiLGUsZixrKSksYyYmcC5wdXNoKG5ldyBVKFwiY2hpbGRfY2hhbmdlZFwiLGUsZixrKSkpO2QuTWMobCxtLHApfWcmJihnPSExLGM9ITApO2Y9bH19XHJcbmZ1bmN0aW9uIGFlKGEsYixjLGQpe3ZhciBlLGY9W107Yz09PWQ/ZT0hMTpjLlAoKSYmZC5QKCk/ZT1jLmooKSE9PWQuaigpOmMuUCgpPyhiZShhLGIsTSxkLGYpLGU9ITApOmQuUCgpPyhiZShhLGIsYyxNLGYpLGU9ITApOmU9YmUoYSxiLGMsZCxmKTtlP2EuTWMoYixkLGYpOmMuaygpIT09ZC5rKCkmJmEuTWMoYixkLG51bGwpO3JldHVybiBlfVxyXG5mdW5jdGlvbiBiZShhLGIsYyxkLGUpe3ZhciBmPSExLGc9IWEuVGJ8fCFJKGEuVGIsYikuZigpLGs9W10sbD1bXSxtPVtdLHA9W10sdD17fSxzPXt9LHcsVixHLEg7dz1jLlphKCk7Rz1ZYSh3KTtWPWQuWmEoKTtmb3IoSD1ZYShWKTtudWxsIT09R3x8bnVsbCE9PUg7KXtjPUg7Yz1udWxsPT09Rz8xOm51bGw9PT1jPy0xOkcua2V5PT09Yy5rZXk/MDppYyh7bmFtZTpHLmtleSxrYTpHLnZhbHVlLmsoKX0se25hbWU6Yy5rZXksa2E6Yy52YWx1ZS5rKCl9KTtpZigwPmMpZj12YSh0LEcua2V5KSxuKGYpPyhtLnB1c2goe0ZjOkcsJGM6a1tmXX0pLGtbZl09bnVsbCk6KHNbRy5rZXldPWwubGVuZ3RoLGwucHVzaChHKSksZj0hMCxHPVlhKHcpO2Vsc2V7aWYoMDxjKWY9dmEocyxILmtleSksbihmKT8obS5wdXNoKHtGYzpsW2ZdLCRjOkh9KSxsW2ZdPW51bGwpOih0W0gua2V5XT1rLmxlbmd0aCxrLnB1c2goSCkpLGY9ITA7ZWxzZXtjPWIuRyhILmtleSk7aWYoYz1hZShhLGMsRy52YWx1ZSxcclxuSC52YWx1ZSkpcC5wdXNoKEgpLGY9ITA7Ry52YWx1ZS5rKCkhPT1ILnZhbHVlLmsoKSYmKG0ucHVzaCh7RmM6RywkYzpIfSksZj0hMCk7Rz1ZYSh3KX1IPVlhKFYpfWlmKCFnJiZmKXJldHVybiEwfWZvcihnPTA7ZzxsLmxlbmd0aDtnKyspaWYodD1sW2ddKWM9Yi5HKHQua2V5KSxhZShhLGMsdC52YWx1ZSxNKSxlLnB1c2gobmV3IFUoXCJjaGlsZF9yZW1vdmVkXCIsdC52YWx1ZSx0LmtleSkpO2ZvcihnPTA7ZzxrLmxlbmd0aDtnKyspaWYodD1rW2ddKWM9Yi5HKHQua2V5KSxsPWQuZ2EodC5rZXksdC52YWx1ZSksYWUoYSxjLE0sdC52YWx1ZSksZS5wdXNoKG5ldyBVKFwiY2hpbGRfYWRkZWRcIix0LnZhbHVlLHQua2V5LGwpKTtmb3IoZz0wO2c8bS5sZW5ndGg7ZysrKXQ9bVtnXS5GYyxrPW1bZ10uJGMsYz1iLkcoay5rZXkpLGw9ZC5nYShrLmtleSxrLnZhbHVlKSxlLnB1c2gobmV3IFUoXCJjaGlsZF9tb3ZlZFwiLGsudmFsdWUsay5rZXksbCkpLChjPWFlKGEsYyx0LnZhbHVlLGsudmFsdWUpKSYmXHJcbnAucHVzaChrKTtmb3IoZz0wO2c8cC5sZW5ndGg7ZysrKWE9cFtnXSxsPWQuZ2EoYS5rZXksYS52YWx1ZSksZS5wdXNoKG5ldyBVKFwiY2hpbGRfY2hhbmdlZFwiLGEudmFsdWUsYS5rZXksbCkpO3JldHVybiBmfTtmdW5jdGlvbiBjZSgpe3RoaXMuWD10aGlzLnphPW51bGw7dGhpcy5zZXQ9e319amEoY2UsTWMpO2g9Y2UucHJvdG90eXBlO2guc2V0QWN0aXZlPWZ1bmN0aW9uKGEpe3RoaXMuemE9YX07ZnVuY3Rpb24gZGUoYSxiLGMpe2EuYWRkKGIsYyk7YS5YfHwoYS5YPWMuUi5wYXRoKX1mdW5jdGlvbiBlZShhKXt2YXIgYj1hLnphO2EuemE9bnVsbDtyZXR1cm4gYn1mdW5jdGlvbiBmZShhKXtyZXR1cm4gYS5jb250YWlucyhcImRlZmF1bHRcIil9ZnVuY3Rpb24gZ2UoYSl7cmV0dXJuIG51bGwhPWEuemEmJmZlKGEpfWguZGVmYXVsdFZpZXc9ZnVuY3Rpb24oKXtyZXR1cm4gZmUodGhpcyk/dGhpcy5nZXQoXCJkZWZhdWx0XCIpOm51bGx9O2gucGF0aD1mdW5jdGlvbigpe3JldHVybiB0aGlzLlh9O2gudG9TdHJpbmc9ZnVuY3Rpb24oKXtyZXR1cm4gdmIodGhpcy5rZXlzKCksZnVuY3Rpb24oYSl7cmV0dXJuXCJkZWZhdWx0XCI9PT1hP1wie31cIjphfSkuam9pbihcIiRcIil9O1xyXG5oLmhiPWZ1bmN0aW9uKCl7dmFyIGE9W107Uih0aGlzLGZ1bmN0aW9uKGIsYyl7YS5wdXNoKGMuUil9KTtyZXR1cm4gYX07ZnVuY3Rpb24gaGUoYSxiKXtUZC5jYWxsKHRoaXMsYSk7dGhpcy5pPU07dGhpcy5qYyhiLFZkKGIpKX1qYShoZSxUZCk7XHJcbmhlLnByb3RvdHlwZS5qYz1mdW5jdGlvbihhLGIpe2lmKG51bGw9PT1iKXJldHVybiBiO3ZhciBjPVtdLGQ9dGhpcy5SO24oZC5mYSkmJihuKGQueWEpJiZudWxsIT1kLnlhP2MucHVzaChmdW5jdGlvbihhLGIpe3ZhciBjPVViKGIsZC5mYSk7cmV0dXJuIDA8Y3x8MD09PWMmJjA8PVZiKGEsZC55YSl9KTpjLnB1c2goZnVuY3Rpb24oYSxiKXtyZXR1cm4gMDw9VWIoYixkLmZhKX0pKTtuKGQuQ2EpJiYobihkLldhKT9jLnB1c2goZnVuY3Rpb24oYSxiKXt2YXIgYz1VYihiLGQuQ2EpO3JldHVybiAwPmN8fDA9PT1jJiYwPj1WYihhLGQuV2EpfSk6Yy5wdXNoKGZ1bmN0aW9uKGEsYil7cmV0dXJuIDA+PVViKGIsZC5DYSl9KSk7dmFyIGU9bnVsbCxmPW51bGw7aWYobih0aGlzLlIuRWEpKWlmKG4odGhpcy5SLmZhKSl7aWYoZT1pZShhLGMsdGhpcy5SLkVhLCExKSl7dmFyIGc9YS5PKGUpLmsoKTtjLnB1c2goZnVuY3Rpb24oYSxiKXt2YXIgYz1VYihiLGcpO3JldHVybiAwPmN8fDA9PT1jJiZcclxuMD49VmIoYSxlKX0pfX1lbHNlIGlmKGY9aWUoYSxjLHRoaXMuUi5FYSwhMCkpe3ZhciBrPWEuTyhmKS5rKCk7Yy5wdXNoKGZ1bmN0aW9uKGEsYil7dmFyIGM9VWIoYixrKTtyZXR1cm4gMDxjfHwwPT09YyYmMDw9VmIoYSxmKX0pfWZvcih2YXIgbD1bXSxtPVtdLHA9W10sdD1bXSxzPTA7czxiLmxlbmd0aDtzKyspe3ZhciB3PWJbc10uY2EsVj1iW3NdLndhO3N3aXRjaChiW3NdLnR5cGUpe2Nhc2UgXCJjaGlsZF9hZGRlZFwiOmplKGMsdyxWKSYmKHRoaXMuaT10aGlzLmkuSCh3LFYpLG0ucHVzaChiW3NdKSk7YnJlYWs7Y2FzZSBcImNoaWxkX3JlbW92ZWRcIjp0aGlzLmkuTyh3KS5mKCl8fCh0aGlzLmk9dGhpcy5pLkgodyxudWxsKSxsLnB1c2goYltzXSkpO2JyZWFrO2Nhc2UgXCJjaGlsZF9jaGFuZ2VkXCI6IXRoaXMuaS5PKHcpLmYoKSYmamUoYyx3LFYpJiYodGhpcy5pPXRoaXMuaS5IKHcsViksdC5wdXNoKGJbc10pKTticmVhaztjYXNlIFwiY2hpbGRfbW92ZWRcIjp2YXIgRz0hdGhpcy5pLk8odykuZigpLFxyXG5IPWplKGMsdyxWKTtHP0g/KHRoaXMuaT10aGlzLmkuSCh3LFYpLHAucHVzaChiW3NdKSk6KGwucHVzaChuZXcgVShcImNoaWxkX3JlbW92ZWRcIix0aGlzLmkuTyh3KSx3KSksdGhpcy5pPXRoaXMuaS5IKHcsbnVsbCkpOkgmJih0aGlzLmk9dGhpcy5pLkgodyxWKSxtLnB1c2goYltzXSkpfX12YXIgVGM9ZXx8ZjtpZihUYyl7dmFyIFVjPShzPW51bGwhPT1mKT90aGlzLmkuaGQoKTp0aGlzLmkua2QoKSxoYz0hMSwkYT0hMSxhYj10aGlzOyhzP2EuRWM6YS5BKS5jYWxsKGEsZnVuY3Rpb24oYSxiKXskYXx8bnVsbCE9PVVjfHwoJGE9ITApO2lmKCRhJiZoYylyZXR1cm4hMDtoYz8obC5wdXNoKG5ldyBVKFwiY2hpbGRfcmVtb3ZlZFwiLGFiLmkuTyhhKSxhKSksYWIuaT1hYi5pLkgoYSxudWxsKSk6JGEmJihtLnB1c2gobmV3IFUoXCJjaGlsZF9hZGRlZFwiLGIsYSkpLGFiLmk9YWIuaS5IKGEsYikpO1VjPT09YSYmKCRhPSEwKTthPT09VGMmJihoYz0hMCl9KX1mb3Iocz0wO3M8bS5sZW5ndGg7cysrKWM9XHJcbm1bc10sdz10aGlzLmkuZ2EoYy5jYSxjLndhKSxsLnB1c2gobmV3IFUoXCJjaGlsZF9hZGRlZFwiLGMud2EsYy5jYSx3KSk7Zm9yKHM9MDtzPHAubGVuZ3RoO3MrKyljPXBbc10sdz10aGlzLmkuZ2EoYy5jYSxjLndhKSxsLnB1c2gobmV3IFUoXCJjaGlsZF9tb3ZlZFwiLGMud2EsYy5jYSx3KSk7Zm9yKHM9MDtzPHQubGVuZ3RoO3MrKyljPXRbc10sdz10aGlzLmkuZ2EoYy5jYSxjLndhKSxsLnB1c2gobmV3IFUoXCJjaGlsZF9jaGFuZ2VkXCIsYy53YSxjLmNhLHcpKTt0aGlzLnRiJiYwPGwubGVuZ3RoJiZsLnB1c2gobmV3IFUoXCJ2YWx1ZVwiLHRoaXMuaSkpO3JldHVybiBsfTtmdW5jdGlvbiBpZShhLGIsYyxkKXtpZihhLlAoKSlyZXR1cm4gbnVsbDt2YXIgZT1udWxsOyhkP2EuRWM6YS5BKS5jYWxsKGEsZnVuY3Rpb24oYSxkKXtpZihqZShiLGEsZCkmJihlPWEsYy0tLDA9PT1jKSlyZXR1cm4hMH0pO3JldHVybiBlfVxyXG5mdW5jdGlvbiBqZShhLGIsYyl7Zm9yKHZhciBkPTA7ZDxhLmxlbmd0aDtkKyspaWYoIWFbZF0oYixjLmsoKSkpcmV0dXJuITE7cmV0dXJuITB9aGUucHJvdG90eXBlLkhjPWZ1bmN0aW9uKGEpe3JldHVybiB0aGlzLmkuTyhhKSE9PU19O1xyXG5oZS5wcm90b3R5cGUucWI9ZnVuY3Rpb24oYSxiLGMpe3ZhciBkPXt9O3RoaXMuaS5QKCl8fHRoaXMuaS5BKGZ1bmN0aW9uKGEpe2RbYV09M30pO3ZhciBlPXRoaXMuaTtjPVMoYyxuZXcgRihcIlwiKSk7dmFyIGY9bmV3IFBhO0ooSShmLHRoaXMuUi5wYXRoKSwhMCk7Yj1NLkFhKGEsYik7dmFyIGc9dGhpczskZChjLGIsYSxmLGZ1bmN0aW9uKGEsYixjKXtudWxsIT09YyYmYS50b1N0cmluZygpPT09Zy5SLnBhdGgudG9TdHJpbmcoKSYmZy5qYyhiLGMpfSk7dGhpcy5pLlAoKT8kYihkLGZ1bmN0aW9uKGEsYil7ZFtiXT0yfSk6KHRoaXMuaS5BKGZ1bmN0aW9uKGEpe0EoZCxhKXx8KGRbYV09MSl9KSwkYihkLGZ1bmN0aW9uKGEsYil7Zy5pLk8oYikuZigpJiYoZFtiXT0yKX0pKTt0aGlzLmk9ZTtyZXR1cm4gZH07ZnVuY3Rpb24ga2UoYSxiKXt0aGlzLnU9YTt0aGlzLmc9Yjt0aGlzLmFjPWIuJDt0aGlzLm9hPW5ldyBQYX1rZS5wcm90b3R5cGUuUmI9ZnVuY3Rpb24oYSxiLGMsZCxlKXt2YXIgZj1hLnBhdGgsZz1JKHRoaXMub2EsZiksaz1nLmooKTtudWxsPT09az8oaz1uZXcgY2UsSihnLGspKTp2KCFrLmYoKSxcIldlIHNob3VsZG4ndCBiZSBzdG9yaW5nIGVtcHR5IFF1ZXJ5TWFwc1wiKTt2YXIgbD1hLlBhKCk7aWYoay5jb250YWlucyhsKSlhPWsuZ2V0KGwpLFVkKGEsYixjLGQsZSk7ZWxzZXt2YXIgbT10aGlzLmcuJC5MKGYpO2E9bGUoYSxtKTttZSh0aGlzLGcsayxsLGEpO1VkKGEsYixjLGQsZSk7KGI9KGI9U2EoSSh0aGlzLm9hLGYpLGZ1bmN0aW9uKGEpe3ZhciBiO2lmKGI9YS5qKCkmJmEuaigpLmRlZmF1bHRWaWV3KCkpYj1hLmooKS5kZWZhdWx0VmlldygpLnRiO2lmKGIpcmV0dXJuITB9LCEwKSl8fG51bGw9PT10aGlzLnUmJiFTKHRoaXMuZyxmKS5mKCkpJiZYZChhKX1hLkliKCl9O1xyXG5mdW5jdGlvbiBuZShhLGIsYyxkLGUpe3ZhciBmPWEuZ2V0KGIpLGc7aWYoZz1mKXtnPSExO2Zvcih2YXIgaz1mLnJhLmxlbmd0aC0xOzA8PWs7ay0tKXt2YXIgbD1mLnJhW2tdO2lmKCEoYyYmbC50eXBlIT09Y3x8ZCYmbC5iYSE9PWR8fGUmJmwuWSE9PWUpJiYoZi5yYS5zcGxpY2UoaywxKSxnPSEwLGMmJmQpKWJyZWFrfX0oYz1nJiYhKDA8Zi5yYS5sZW5ndGgpKSYmYS5yZW1vdmUoYik7cmV0dXJuIGN9ZnVuY3Rpb24gb2UoYSxiLGMsZCxlKXtiPWI/Yi5QYSgpOm51bGw7dmFyIGY9W107YiYmXCJkZWZhdWx0XCIhPT1iP25lKGEsYixjLGQsZSkmJmYucHVzaChiKTp1YihhLmtleXMoKSxmdW5jdGlvbihiKXtuZShhLGIsYyxkLGUpJiZmLnB1c2goYil9KTtyZXR1cm4gZn1rZS5wcm90b3R5cGUubGM9ZnVuY3Rpb24oYSxiLGMsZCl7dmFyIGU9SSh0aGlzLm9hLGEucGF0aCkuaigpO3JldHVybiBudWxsPT09ZT9udWxsOnBlKHRoaXMsZSxhLGIsYyxkKX07XHJcbmZ1bmN0aW9uIHBlKGEsYixjLGQsZSxmKXt2YXIgZz1iLnBhdGgoKSxnPUkoYS5vYSxnKTtjPW9lKGIsYyxkLGUsZik7Yi5mKCkmJkooZyxudWxsKTtkPXFlKGcpO2lmKDA8Yy5sZW5ndGgmJiFkKXtkPWc7ZT1nLnBhcmVudCgpO2ZvcihjPSExOyFjJiZlOyl7aWYoZj1lLmooKSl7dighZ2UoZikpO3ZhciBrPWQubmFtZSgpLGw9ITE7UihmLGZ1bmN0aW9uKGEsYil7bD1iLkhjKGspfHxsfSk7bCYmKGM9ITApfWQ9ZTtlPWUucGFyZW50KCl9ZD1udWxsO2dlKGIpfHwoYj1lZShiKSxkPXJlKGEsZyksYiYmYigpKTtyZXR1cm4gYz9udWxsOmR9cmV0dXJuIG51bGx9ZnVuY3Rpb24gc2UoYSxiLGMpe1JhKEkoYS5vYSxiKSxmdW5jdGlvbihhKXsoYT1hLmooKSkmJlIoYSxmdW5jdGlvbihhLGIpe1hkKGIpfSl9LGMsITApfVxyXG5mdW5jdGlvbiBXKGEsYixjKXtmdW5jdGlvbiBkKGEpe2Rve2lmKGdbYS50b1N0cmluZygpXSlyZXR1cm4hMDthPWEucGFyZW50KCl9d2hpbGUobnVsbCE9PWEpO3JldHVybiExfXZhciBlPWEuYWMsZj1hLmcuJDthLmFjPWY7Zm9yKHZhciBnPXt9LGs9MDtrPGMubGVuZ3RoO2srKylnW2Nba10udG9TdHJpbmcoKV09ITA7JGQoZSxmLGIsYS5vYSxmdW5jdGlvbihjLGUsZil7aWYoYi5jb250YWlucyhjKSl7dmFyIGc9ZChjKTtnJiZzZShhLGMsITEpO2EuaWMoYyxlLGYpO2cmJnNlKGEsYywhMCl9ZWxzZSBhLmljKGMsZSxmKX0pO2QoYikmJnNlKGEsYiwhMCk7dGUoYSxiKX1mdW5jdGlvbiB0ZShhLGIpe3ZhciBjPUkoYS5vYSxiKTtSYShjLGZ1bmN0aW9uKGEpeyhhPWEuaigpKSYmUihhLGZ1bmN0aW9uKGEsYil7Yi5JYigpfSl9LCEwLCEwKTtTYShjLGZ1bmN0aW9uKGEpeyhhPWEuaigpKSYmUihhLGZ1bmN0aW9uKGEsYil7Yi5JYigpfSl9LCExKX1cclxua2UucHJvdG90eXBlLmljPWZ1bmN0aW9uKGEsYixjKXthPUkodGhpcy5vYSxhKS5qKCk7bnVsbCE9PWEmJlIoYSxmdW5jdGlvbihhLGUpe2UuaWMoYixjKX0pfTtmdW5jdGlvbiBxZShhKXtyZXR1cm4gU2EoYSxmdW5jdGlvbihhKXtyZXR1cm4gYS5qKCkmJmdlKGEuaigpKX0pfWZ1bmN0aW9uIG1lKGEsYixjLGQsZSl7aWYoZ2UoYyl8fHFlKGIpKWRlKGMsZCxlKTtlbHNle3ZhciBmLGc7Yy5mKCl8fChmPWMudG9TdHJpbmcoKSxnPWMuaGIoKSk7ZGUoYyxkLGUpO2Muc2V0QWN0aXZlKHVlKGEsYykpO2YmJmcmJnRkKGEudSxjLnBhdGgoKSxmLGcpfWdlKGMpJiZSYShiLGZ1bmN0aW9uKGEpe2lmKGE9YS5qKCkpYS56YSYmYS56YSgpLGEuemE9bnVsbH0pfVxyXG5mdW5jdGlvbiByZShhLGIpe2Z1bmN0aW9uIGMoYil7dmFyIGY9Yi5qKCk7aWYoZiYmZmUoZikpZC5wdXNoKGYucGF0aCgpKSxudWxsPT1mLnphJiZmLnNldEFjdGl2ZSh1ZShhLGYpKTtlbHNle2lmKGYpe251bGwhPWYuemF8fGYuc2V0QWN0aXZlKHVlKGEsZikpO3ZhciBnPXt9O1IoZixmdW5jdGlvbihhLGIpe2IuaS5BKGZ1bmN0aW9uKGEpe0EoZyxhKXx8KGdbYV09ITAsYT1mLnBhdGgoKS5HKGEpLGQucHVzaChhKSl9KX0pfWIuQShjKX19dmFyIGQ9W107YyhiKTtyZXR1cm4gZH1cclxuZnVuY3Rpb24gdWUoYSxiKXtpZihhLnUpe3ZhciBjPWEudSxkPWIucGF0aCgpLGU9Yi50b1N0cmluZygpLGY9Yi5oYigpLGcsaz1iLmtleXMoKSxsPWZlKGIpO3BkKGEudSxiLGZ1bmN0aW9uKGMpe1wib2tcIiE9PWM/KGM9Y2MoYyksTChcIm9uKCkgb3Igb25jZSgpIGZvciBcIitiLnBhdGgoKS50b1N0cmluZygpK1wiIGZhaWxlZDogXCIrYy50b1N0cmluZygpKSx2ZShhLGIsYykpOmd8fChsP3NlKGEsYi5wYXRoKCksITApOnViKGssZnVuY3Rpb24oYSl7KGE9Yi5nZXQoYSkpJiZYZChhKX0pLHRlKGEsYi5wYXRoKCkpKX0pO3JldHVybiBmdW5jdGlvbigpe2c9ITA7dGQoYyxkLGUsZil9fXJldHVybiBiYX1mdW5jdGlvbiB2ZShhLGIsYyl7YiYmKFIoYixmdW5jdGlvbihhLGIpe2Zvcih2YXIgZj0wO2Y8Yi5yYS5sZW5ndGg7ZisrKXt2YXIgZz1iLnJhW2ZdO2cuY2FuY2VsJiZhYyhnLmNhbmNlbCxnLlkpKGMpfX0pLHBlKGEsYikpfVxyXG5mdW5jdGlvbiBsZShhLGIpe3JldHVyblwiZGVmYXVsdFwiPT09YS5QYSgpP25ldyBZZChhLGIpOm5ldyBoZShhLGIpfWtlLnByb3RvdHlwZS5xYj1mdW5jdGlvbihhLGIsYyxkKXtmdW5jdGlvbiBlKGEpeyRiKGEsZnVuY3Rpb24oYSxiKXtmW2JdPTM9PT1hPzM6KHZhKGYsYil8fGEpPT09YT9hOjN9KX12YXIgZj17fTtSKGIsZnVuY3Rpb24oYixmKXtlKGYucWIoYSxjLGQpKX0pO2MuUCgpfHxjLkEoZnVuY3Rpb24oYSl7QShmLGEpfHwoZlthXT00KX0pO3JldHVybiBmfTtmdW5jdGlvbiB3ZShhLGIsYyxkLGUpe3ZhciBmPWIucGF0aCgpO2I9YS5xYihmLGIsZCxlKTt2YXIgZz1NLGs9W107JGIoYixmdW5jdGlvbihiLG0pe3ZhciBwPW5ldyBGKG0pOzM9PT1ifHwxPT09Yj9nPWcuSChtLGQuTChwKSk6KDI9PT1iJiZrLnB1c2goe3BhdGg6Zi5HKG0pLHRhOk19KSxrPWsuY29uY2F0KHhlKGEsZC5MKHApLEkoYyxwKSxlKSkpfSk7cmV0dXJuW3twYXRoOmYsdGE6Z31dLmNvbmNhdChrKX1cclxuZnVuY3Rpb24geWUoYSxiLGMsZCl7dmFyIGU7YTp7dmFyIGY9SShhLm9hLGIpO2U9Zi5wYXJlbnQoKTtmb3IodmFyIGc9W107bnVsbCE9PWU7KXt2YXIgaz1lLmooKTtpZihudWxsIT09ayl7aWYoZmUoaykpe2U9W3twYXRoOmIsdGE6Y31dO2JyZWFrIGF9az1hLnFiKGIsayxjLGQpO2Y9dmEoayxmLm5hbWUoKSk7aWYoMz09PWZ8fDE9PT1mKXtlPVt7cGF0aDpiLHRhOmN9XTticmVhayBhfTI9PT1mJiZnLnB1c2goe3BhdGg6Yix0YTpNfSl9Zj1lO2U9ZS5wYXJlbnQoKX1lPWd9aWYoMT09ZS5sZW5ndGgmJighZVswXS50YS5mKCl8fGMuZigpKSlyZXR1cm4gZTtnPUkoYS5vYSxiKTtmPWcuaigpO251bGwhPT1mP2ZlKGYpP2UucHVzaCh7cGF0aDpiLHRhOmN9KTplPWUuY29uY2F0KHdlKGEsZixnLGMsZCkpOmU9ZS5jb25jYXQoeGUoYSxjLGcsZCkpO3JldHVybiBlfVxyXG5mdW5jdGlvbiB4ZShhLGIsYyxkKXt2YXIgZT1jLmooKTtpZihudWxsIT09ZSlyZXR1cm4gZmUoZSk/W3twYXRoOmMucGF0aCgpLHRhOmJ9XTp3ZShhLGUsYyxiLGQpO3ZhciBmPVtdO2MuQShmdW5jdGlvbihjKXt2YXIgZT1iLlAoKT9NOmIuTyhjLm5hbWUoKSk7Yz14ZShhLGUsYyxkKTtmPWYuY29uY2F0KGMpfSk7cmV0dXJuIGZ9O2Z1bmN0aW9uIHplKGEpe3RoaXMuTj1hO3RoaXMuYWE9RGMoYSk7dGhpcy51PW5ldyBsZCh0aGlzLk4scih0aGlzLmRjLHRoaXMpLHIodGhpcy5iYyx0aGlzKSxyKHRoaXMuemIsdGhpcykscih0aGlzLlFjLHRoaXMpLHIodGhpcy5HYyx0aGlzKSk7dGhpcy56ZD1FYyhhLHIoZnVuY3Rpb24oKXtyZXR1cm4gbmV3IEFjKHRoaXMuYWEsdGhpcy51KX0sdGhpcykpO3RoaXMuU2E9bmV3IFBhO3RoaXMuSGE9bmV3IEhkO3RoaXMuZz1uZXcgSWQ7dGhpcy5JPW5ldyBrZSh0aGlzLnUsdGhpcy5nLnBhKTt0aGlzLkljPW5ldyBIZDt0aGlzLkpjPW5ldyBrZShudWxsLHRoaXMuSWMpO0FlKHRoaXMsXCJjb25uZWN0ZWRcIiwhMSk7QWUodGhpcyxcImF1dGhlbnRpY2F0ZWRcIiwhMSk7dGhpcy5UPW5ldyBEZDt0aGlzLkNjPTB9aD16ZS5wcm90b3R5cGU7aC50b1N0cmluZz1mdW5jdGlvbigpe3JldHVybih0aGlzLk4ubmM/XCJodHRwczovL1wiOlwiaHR0cDovL1wiKSt0aGlzLk4uaG9zdH07aC5uYW1lPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuTi5ZYn07XHJcbmZ1bmN0aW9uIEJlKGEpe2E9UyhhLkljLG5ldyBGKFwiLmluZm8vc2VydmVyVGltZU9mZnNldFwiKSkuVigpfHwwO3JldHVybihuZXcgRGF0ZSkuZ2V0VGltZSgpK2F9ZnVuY3Rpb24gQ2UoYSl7YT1hPXt0aW1lc3RhbXA6QmUoYSl9O2EudGltZXN0YW1wPWEudGltZXN0YW1wfHwobmV3IERhdGUpLmdldFRpbWUoKTtyZXR1cm4gYX1cclxuaC5kYz1mdW5jdGlvbihhLGIsYyl7dGhpcy5DYysrO3RoaXMubWQmJihiPXRoaXMubWQoYSxiKSk7dmFyIGQsZSxmPVtdOzk8PWEubGVuZ3RoJiZhLmxhc3RJbmRleE9mKFwiLnByaW9yaXR5XCIpPT09YS5sZW5ndGgtOT8oZD1uZXcgRihhLnN1YnN0cmluZygwLGEubGVuZ3RoLTkpKSxlPVModGhpcy5nLnZhLGQpLklhKGIpLGYucHVzaChkKSk6Yz8oZD1uZXcgRihhKSxlPVModGhpcy5nLnZhLGQpLCRiKGIsZnVuY3Rpb24oYSxiKXt2YXIgYz1uZXcgRihiKTtcIi5wcmlvcml0eVwiPT09Yj9lPWUuSWEoYSk6KGU9ZS5BYShjLE8oYSkpLGYucHVzaChkLkcoYikpKX0pKTooZD1uZXcgRihhKSxlPU8oYiksZi5wdXNoKGQpKTthPXllKHRoaXMuSSxkLGUsdGhpcy5nLk0pO2I9ITE7Zm9yKGM9MDtjPGEubGVuZ3RoOysrYyl7dmFyIGc9YVtjXTtiPUpkKHRoaXMuZyxnLnBhdGgsZy50YSl8fGJ9YiYmKGQ9RGUodGhpcyxkKSk7Vyh0aGlzLkksZCxmKX07XHJcbmguYmM9ZnVuY3Rpb24oYSl7QWUodGhpcyxcImNvbm5lY3RlZFwiLGEpOyExPT09YSYmRWUodGhpcyl9O2guUWM9ZnVuY3Rpb24oYSl7dmFyIGI9dGhpcztaYihhLGZ1bmN0aW9uKGEsZCl7QWUoYixkLGEpfSl9O2guR2M9ZnVuY3Rpb24oYSl7YT1uZXcgRihhKTtyZXR1cm4gUyh0aGlzLmcudmEsYSkuaGFzaCgpfTtoLnpiPWZ1bmN0aW9uKGEpe0FlKHRoaXMsXCJhdXRoZW50aWNhdGVkXCIsYSl9O2Z1bmN0aW9uIEFlKGEsYixjKXtiPW5ldyBGKFwiLy5pbmZvL1wiK2IpO1QoYS5JYyxiLE8oYykpO1coYS5KYyxiLFtiXSl9XHJcbmgubWI9ZnVuY3Rpb24oYSxiLGMpe1wiZmlyZWJhc2Vpby1kZW1vLmNvbVwiPT09dGhpcy5OLmRvbWFpbiYmTChcIkZpcmViYXNlUmVmLmF1dGgoKSBub3Qgc3VwcG9ydGVkIG9uIGRlbW8gKCouZmlyZWJhc2Vpby1kZW1vLmNvbSkgRmlyZWJhc2VzLiBQbGVhc2UgdXNlIG9uIHByb2R1Y3Rpb24gKCouZmlyZWJhc2Vpby5jb20pIEZpcmViYXNlcyBvbmx5LlwiKTt0aGlzLnUubWIoYSxmdW5jdGlvbihhLGMpe1goYixhLGMpfSxmdW5jdGlvbihhLGIpe0woXCJhdXRoKCkgd2FzIGNhbmNlbGVkOiBcIitiKTtpZihjKXt2YXIgZj1FcnJvcihiKTtmLmNvZGU9YS50b1VwcGVyQ2FzZSgpO2MoZil9fSl9O2guUGI9ZnVuY3Rpb24oYSl7dGhpcy51LlBiKGZ1bmN0aW9uKGIsYyl7WChhLGIsYyl9KX07XHJcbmgua2I9ZnVuY3Rpb24oYSxiLGMsZCl7dGhpcy5lKFwic2V0XCIse3BhdGg6YS50b1N0cmluZygpLHZhbHVlOmIsa2E6Y30pO3ZhciBlPUNlKHRoaXMpO2I9TyhiLGMpO3ZhciBlPVBkKGIsZSksZT15ZSh0aGlzLkksYSxlLHRoaXMuZy5NKSxmPXRoaXMuZy5zZXQoYSxlKSxnPXRoaXM7dGhpcy51LnB1dChhLnRvU3RyaW5nKCksYi5WKCEwKSxmdW5jdGlvbihiLGMpe1wib2tcIiE9PWImJkwoXCJzZXQgYXQgXCIrYStcIiBmYWlsZWQ6IFwiK2IpO01kKGcuZyxmKTtLZChnLmcsYSk7dmFyIGU9RGUoZyxhKTtXKGcuSSxlLFtdKTtYKGQsYixjKX0pO2U9RmUodGhpcyxhKTtEZSh0aGlzLGUpO1codGhpcy5JLGUsW2FdKX07XHJcbmgudXBkYXRlPWZ1bmN0aW9uKGEsYixjKXt0aGlzLmUoXCJ1cGRhdGVcIix7cGF0aDphLnRvU3RyaW5nKCksdmFsdWU6Yn0pO3ZhciBkPVModGhpcy5nLnBhLGEpLGU9ITAsZj1bXSxnPUNlKHRoaXMpLGs9W10sbDtmb3IobCBpbiBiKXt2YXIgZT0hMSxtPU8oYltsXSksbT1QZChtLGcpLGQ9ZC5IKGwsbSkscD1hLkcobCk7Zi5wdXNoKHApO209eWUodGhpcy5JLHAsbSx0aGlzLmcuTSk7az1rLmNvbmNhdCh0aGlzLmcuc2V0KGEsbSkpfWlmKGUpSyhcInVwZGF0ZSgpIGNhbGxlZCB3aXRoIGVtcHR5IGRhdGEuICBEb24ndCBkbyBhbnl0aGluZy5cIiksWChjLFwib2tcIik7ZWxzZXt2YXIgdD10aGlzO3pkKHRoaXMudSxhLnRvU3RyaW5nKCksYixmdW5jdGlvbihiLGQpe3YoXCJva1wiPT09Ynx8XCJwZXJtaXNzaW9uX2RlbmllZFwiPT09YixcIm1lcmdlIGF0IFwiK2ErXCIgZmFpbGVkLlwiKTtcIm9rXCIhPT1iJiZMKFwidXBkYXRlIGF0IFwiK2ErXCIgZmFpbGVkOiBcIitiKTtNZCh0Lmcsayk7S2QodC5nLGEpO3ZhciBlPVxyXG5EZSh0LGEpO1codC5JLGUsW10pO1goYyxiLGQpfSk7Yj1GZSh0aGlzLGEpO0RlKHRoaXMsYik7Vyh0LkksYixmKX19O2guV2M9ZnVuY3Rpb24oYSxiLGMpe3RoaXMuZShcInNldFByaW9yaXR5XCIse3BhdGg6YS50b1N0cmluZygpLGthOmJ9KTt2YXIgZD1DZSh0aGlzKSxkPU5kKGIsZCksZD1TKHRoaXMuZy5NLGEpLklhKGQpLGQ9eWUodGhpcy5JLGEsZCx0aGlzLmcuTSksZT10aGlzLmcuc2V0KGEsZCksZj10aGlzO3RoaXMudS5wdXQoYS50b1N0cmluZygpK1wiLy5wcmlvcml0eVwiLGIsZnVuY3Rpb24oYixkKXtcInBlcm1pc3Npb25fZGVuaWVkXCI9PT1iJiZMKFwic2V0UHJpb3JpdHkgYXQgXCIrYStcIiBmYWlsZWQ6IFwiK2IpO01kKGYuZyxlKTtLZChmLmcsYSk7dmFyIGw9RGUoZixhKTtXKGYuSSxsLFtdKTtYKGMsYixkKX0pO2I9RGUodGhpcyxhKTtXKGYuSSxiLFtdKX07XHJcbmZ1bmN0aW9uIEVlKGEpe2EuZShcIm9uRGlzY29ubmVjdEV2ZW50c1wiKTt2YXIgYj1bXSxjPUNlKGEpO0dkKE9kKGEuVCxjKSxuZXcgRihcIlwiKSxmdW5jdGlvbihjLGUpe3ZhciBmPXllKGEuSSxjLGUsYS5nLk0pO2IucHVzaC5hcHBseShiLGEuZy5zZXQoYyxmKSk7Zj1GZShhLGMpO0RlKGEsZik7VyhhLkksZixbY10pfSk7TWQoYS5nLGIpO2EuVD1uZXcgRGR9aC5OYz1mdW5jdGlvbihhLGIpe3ZhciBjPXRoaXM7dGhpcy51Lk5jKGEudG9TdHJpbmcoKSxmdW5jdGlvbihkLGUpe1wib2tcIj09PWQmJkZkKGMuVCxhKTtYKGIsZCxlKX0pfTtmdW5jdGlvbiBHZShhLGIsYyxkKXt2YXIgZT1PKGMpO3ZkKGEudSxiLnRvU3RyaW5nKCksZS5WKCEwKSxmdW5jdGlvbihjLGcpe1wib2tcIj09PWMmJkVkKGEuVCxiLGUpO1goZCxjLGcpfSl9XHJcbmZ1bmN0aW9uIEhlKGEsYixjLGQsZSl7dmFyIGY9TyhjLGQpO3ZkKGEudSxiLnRvU3RyaW5nKCksZi5WKCEwKSxmdW5jdGlvbihjLGQpe1wib2tcIj09PWMmJkVkKGEuVCxiLGYpO1goZSxjLGQpfSl9ZnVuY3Rpb24gSWUoYSxiLGMsZCl7dmFyIGU9ITAsZjtmb3IoZiBpbiBjKWU9ITE7ZT8oSyhcIm9uRGlzY29ubmVjdCgpLnVwZGF0ZSgpIGNhbGxlZCB3aXRoIGVtcHR5IGRhdGEuICBEb24ndCBkbyBhbnl0aGluZy5cIiksWChkLFwib2tcIikpOnhkKGEudSxiLnRvU3RyaW5nKCksYyxmdW5jdGlvbihlLGYpe2lmKFwib2tcIj09PWUpZm9yKHZhciBsIGluIGMpe3ZhciBtPU8oY1tsXSk7RWQoYS5ULGIuRyhsKSxtKX1YKGQsZSxmKX0pfWZ1bmN0aW9uIEplKGEpe3ljKGEuYWEsXCJkZXByZWNhdGVkX29uX2Rpc2Nvbm5lY3RcIik7YS56ZC5aYy5kZXByZWNhdGVkX29uX2Rpc2Nvbm5lY3Q9ITB9XHJcbmguUmI9ZnVuY3Rpb24oYSxiLGMsZCxlKXtcIi5pbmZvXCI9PT1DKGEucGF0aCk/dGhpcy5KYy5SYihhLGIsYyxkLGUpOnRoaXMuSS5SYihhLGIsYyxkLGUpfTtoLmxjPWZ1bmN0aW9uKGEsYixjLGQpe2lmKFwiLmluZm9cIj09PUMoYS5wYXRoKSl0aGlzLkpjLmxjKGEsYixjLGQpO2Vsc2V7Yj10aGlzLkkubGMoYSxiLGMsZCk7aWYoYz1udWxsIT09Yil7Yz10aGlzLmc7ZD1hLnBhdGg7Zm9yKHZhciBlPVtdLGY9MDtmPGIubGVuZ3RoOysrZillW2ZdPVMoYy52YSxiW2ZdKTtUKGMudmEsZCxNKTtmb3IoZj0wO2Y8Yi5sZW5ndGg7KytmKVQoYy52YSxiW2ZdLGVbZl0pO2M9S2QoYyxkKX1jJiYodih0aGlzLmcucGEuJD09PXRoaXMuSS5hYyxcIldlIHNob3VsZCBoYXZlIHJhaXNlZCBhbnkgb3V0c3RhbmRpbmcgZXZlbnRzIGJ5IG5vdy4gIEVsc2UsIHdlJ2xsIGJsb3cgdGhlbSBhd2F5LlwiKSxUKHRoaXMuZy5wYSxhLnBhdGgsUyh0aGlzLmcuTSxhLnBhdGgpKSx0aGlzLkkuYWM9dGhpcy5nLnBhLiQpfX07XHJcbmguTGE9ZnVuY3Rpb24oKXt0aGlzLnUuTGEoKX07aC5qYj1mdW5jdGlvbigpe3RoaXMudS5qYigpfTtoLlhjPWZ1bmN0aW9uKGEpe2lmKFwidW5kZWZpbmVkXCIhPT10eXBlb2YgY29uc29sZSl7YT8odGhpcy5xY3x8KHRoaXMucWM9bmV3IHpjKHRoaXMuYWEpKSxhPXRoaXMucWMuZ2V0KCkpOmE9dGhpcy5hYS5nZXQoKTt2YXIgYj13Yih2YyhhKSxmdW5jdGlvbihhLGIpe3JldHVybiBNYXRoLm1heChiLmxlbmd0aCxhKX0sMCksYztmb3IoYyBpbiBhKXtmb3IodmFyIGQ9YVtjXSxlPWMubGVuZ3RoO2U8YisyO2UrKyljKz1cIiBcIjtjb25zb2xlLmxvZyhjK2QpfX19O2guWWM9ZnVuY3Rpb24oYSl7eWModGhpcy5hYSxhKTt0aGlzLnpkLlpjW2FdPSEwfTtoLmU9ZnVuY3Rpb24oKXtLKFwicjpcIit0aGlzLnUuaWQrXCI6XCIsYXJndW1lbnRzKX07XHJcbmZ1bmN0aW9uIFgoYSxiLGMpe2EmJmVjKGZ1bmN0aW9uKCl7aWYoXCJva1wiPT1iKWEobnVsbCxjKTtlbHNle3ZhciBkPShifHxcImVycm9yXCIpLnRvVXBwZXJDYXNlKCksZT1kO2MmJihlKz1cIjogXCIrYyk7ZT1FcnJvcihlKTtlLmNvZGU9ZDthKGUpfX0pfTtmdW5jdGlvbiBLZShhLGIsYyxkLGUpe2Z1bmN0aW9uIGYoKXt9YS5lKFwidHJhbnNhY3Rpb24gb24gXCIrYik7dmFyIGc9bmV3IEUoYSxiKTtnLmZiKFwidmFsdWVcIixmKTtjPXtwYXRoOmIsdXBkYXRlOmMsRDpkLHN0YXR1czpudWxsLHFkOktiKCksd2M6ZSx2ZDowLHRjOmZ1bmN0aW9uKCl7Zy55YihcInZhbHVlXCIsZil9LHVjOm51bGx9O2EuSGEuJD1MZShhLGEuSGEuJCxhLmcuTS4kLGEuU2EpO2Q9Yy51cGRhdGUoUyhhLkhhLGIpLlYoKSk7aWYobihkKSl7QWEoXCJ0cmFuc2FjdGlvbiBmYWlsZWQ6IERhdGEgcmV0dXJuZWQgXCIsZCk7Yy5zdGF0dXM9MTtlPUkoYS5TYSxiKTt2YXIgaz1lLmooKXx8W107ay5wdXNoKGMpO0ooZSxrKTtrPVwib2JqZWN0XCI9PT10eXBlb2YgZCYmbnVsbCE9PWQmJkEoZCxcIi5wcmlvcml0eVwiKT9kW1wiLnByaW9yaXR5XCJdOlMoYS5nLk0sYikuaygpO2U9Q2UoYSk7ZD1PKGQsayk7ZD1QZChkLGUpO1QoYS5IYSxiLGQpO2Mud2MmJihUKGEuZy5wYSxiLGQpLFcoYS5JLFxyXG5iLFtiXSkpO01lKGEpfWVsc2UgYy50YygpLGMuRCYmKGE9TmUoYSxiKSxjLkQobnVsbCwhMSxhKSl9ZnVuY3Rpb24gTWUoYSxiKXt2YXIgYz1ifHxhLlNhO2J8fE9lKGEsYyk7aWYobnVsbCE9PWMuaigpKXt2YXIgZD1QZShhLGMpO3YoMDxkLmxlbmd0aCk7eGIoZCxmdW5jdGlvbihhKXtyZXR1cm4gMT09PWEuc3RhdHVzfSkmJlFlKGEsYy5wYXRoKCksZCl9ZWxzZSBjLnNiKCkmJmMuQShmdW5jdGlvbihiKXtNZShhLGIpfSl9XHJcbmZ1bmN0aW9uIFFlKGEsYixjKXtmb3IodmFyIGQ9MDtkPGMubGVuZ3RoO2QrKyl2KDE9PT1jW2RdLnN0YXR1cyxcInRyeVRvU2VuZFRyYW5zYWN0aW9uUXVldWVfOiBpdGVtcyBpbiBxdWV1ZSBzaG91bGQgYWxsIGJlIHJ1bi5cIiksY1tkXS5zdGF0dXM9MixjW2RdLnZkKys7dmFyIGU9UyhhLmcuTSxiKS5oYXNoKCk7VChhLmcuTSxiLFMoYS5nLnBhLGIpKTtmb3IodmFyIGY9UyhhLkhhLGIpLlYoITApLGc9S2IoKSxrPVJlKGMpLGQ9MDtkPGsubGVuZ3RoO2QrKylKKEkoYS5nLkZiLGtbZF0pLGcpO2EudS5wdXQoYi50b1N0cmluZygpLGYsZnVuY3Rpb24oZSl7YS5lKFwidHJhbnNhY3Rpb24gcHV0IHJlc3BvbnNlXCIse3BhdGg6Yi50b1N0cmluZygpLHN0YXR1czplfSk7Zm9yKGQ9MDtkPGsubGVuZ3RoO2QrKyl7dmFyIGY9SShhLmcuRmIsa1tkXSkscD1mLmooKTt2KG51bGwhPT1wLFwic2VuZFRyYW5zYWN0aW9uUXVldWVfOiBwZW5kaW5nUHV0IHNob3VsZCBub3QgYmUgbnVsbC5cIik7cD09PVxyXG5nJiYoSihmLG51bGwpLFQoYS5nLk0sa1tkXSxTKGEuZy52YSxrW2RdKSkpfWlmKFwib2tcIj09PWUpe2U9W107Zm9yKGQ9MDtkPGMubGVuZ3RoO2QrKyljW2RdLnN0YXR1cz0zLGNbZF0uRCYmKGY9TmUoYSxjW2RdLnBhdGgpLGUucHVzaChyKGNbZF0uRCxudWxsLG51bGwsITAsZikpKSxjW2RdLnRjKCk7T2UoYSxJKGEuU2EsYikpO01lKGEpO2ZvcihkPTA7ZDxlLmxlbmd0aDtkKyspZWMoZVtkXSl9ZWxzZXtpZihcImRhdGFzdGFsZVwiPT09ZSlmb3IoZD0wO2Q8Yy5sZW5ndGg7ZCsrKWNbZF0uc3RhdHVzPTQ9PT1jW2RdLnN0YXR1cz81OjE7ZWxzZSBmb3IoTChcInRyYW5zYWN0aW9uIGF0IFwiK2IrXCIgZmFpbGVkOiBcIitlKSxkPTA7ZDxjLmxlbmd0aDtkKyspY1tkXS5zdGF0dXM9NSxjW2RdLnVjPWU7ZT1EZShhLGIpO1coYS5JLGUsW2JdKX19LGUpfVxyXG5mdW5jdGlvbiBSZShhKXtmb3IodmFyIGI9e30sYz0wO2M8YS5sZW5ndGg7YysrKWFbY10ud2MmJihiW2FbY10ucGF0aC50b1N0cmluZygpXT1hW2NdLnBhdGgpO2E9W107Zm9yKHZhciBkIGluIGIpYS5wdXNoKGJbZF0pO3JldHVybiBhfVxyXG5mdW5jdGlvbiBEZShhLGIpe3ZhciBjPVNlKGEsYiksZD1jLnBhdGgoKSxjPVBlKGEsYyk7VChhLmcucGEsZCxTKGEuZy5NLGQpKTtUKGEuSGEsZCxTKGEuZy5NLGQpKTtpZigwIT09Yy5sZW5ndGgpe2Zvcih2YXIgZT1TKGEuZy5wYSxkKSxmPWUsZz1bXSxrPTA7azxjLmxlbmd0aDtrKyspe3ZhciBsPU5hKGQsY1trXS5wYXRoKSxtPSExLHA7dihudWxsIT09bCxcInJlcnVuVHJhbnNhY3Rpb25zVW5kZXJOb2RlXzogcmVsYXRpdmVQYXRoIHNob3VsZCBub3QgYmUgbnVsbC5cIik7aWYoNT09PWNba10uc3RhdHVzKW09ITAscD1jW2tdLnVjO2Vsc2UgaWYoMT09PWNba10uc3RhdHVzKWlmKDI1PD1jW2tdLnZkKW09ITAscD1cIm1heHJldHJ5XCI7ZWxzZXt2YXIgdD1lLkwobCkscz1jW2tdLnVwZGF0ZSh0LlYoKSk7aWYobihzKSl7QWEoXCJ0cmFuc2FjdGlvbiBmYWlsZWQ6IERhdGEgcmV0dXJuZWQgXCIscyk7dmFyIHc9TyhzKTtcIm9iamVjdFwiPT09dHlwZW9mIHMmJm51bGwhPXMmJkEocyxcIi5wcmlvcml0eVwiKXx8XHJcbih3PXcuSWEodC5rKCkpKTtlPWUuQWEobCx3KTtjW2tdLndjJiYoZj1mLkFhKGwsdykpfWVsc2UgbT0hMCxwPVwibm9kYXRhXCJ9bSYmKGNba10uc3RhdHVzPTMsc2V0VGltZW91dChjW2tdLnRjLDApLGNba10uRCYmKG09bmV3IEUoYSxjW2tdLnBhdGgpLGw9bmV3IFAoZS5MKGwpLG0pLFwibm9kYXRhXCI9PT1wP2cucHVzaChyKGNba10uRCxudWxsLG51bGwsITEsbCkpOmcucHVzaChyKGNba10uRCxudWxsLEVycm9yKHApLCExLGwpKSkpfVQoYS5IYSxkLGUpO1QoYS5nLnBhLGQsZik7T2UoYSxhLlNhKTtmb3Ioaz0wO2s8Zy5sZW5ndGg7aysrKWVjKGdba10pO01lKGEpfXJldHVybiBkfWZ1bmN0aW9uIFNlKGEsYil7Zm9yKHZhciBjLGQ9YS5TYTtudWxsIT09KGM9QyhiKSkmJm51bGw9PT1kLmooKTspZD1JKGQsYyksYj1MYShiKTtyZXR1cm4gZH1cclxuZnVuY3Rpb24gUGUoYSxiKXt2YXIgYz1bXTtUZShhLGIsYyk7Yy5zb3J0KGZ1bmN0aW9uKGEsYil7cmV0dXJuIGEucWQtYi5xZH0pO3JldHVybiBjfWZ1bmN0aW9uIFRlKGEsYixjKXt2YXIgZD1iLmooKTtpZihudWxsIT09ZClmb3IodmFyIGU9MDtlPGQubGVuZ3RoO2UrKyljLnB1c2goZFtlXSk7Yi5BKGZ1bmN0aW9uKGIpe1RlKGEsYixjKX0pfWZ1bmN0aW9uIE9lKGEsYil7dmFyIGM9Yi5qKCk7aWYoYyl7Zm9yKHZhciBkPTAsZT0wO2U8Yy5sZW5ndGg7ZSsrKTMhPT1jW2VdLnN0YXR1cyYmKGNbZF09Y1tlXSxkKyspO2MubGVuZ3RoPWQ7SihiLDA8Yy5sZW5ndGg/YzpudWxsKX1iLkEoZnVuY3Rpb24oYil7T2UoYSxiKX0pfWZ1bmN0aW9uIEZlKGEsYil7dmFyIGM9U2UoYSxiKS5wYXRoKCksZD1JKGEuU2EsYik7U2EoZCxmdW5jdGlvbihhKXtVZShhKX0pO1VlKGQpO1JhKGQsZnVuY3Rpb24oYSl7VWUoYSl9KTtyZXR1cm4gY31cclxuZnVuY3Rpb24gVWUoYSl7dmFyIGI9YS5qKCk7aWYobnVsbCE9PWIpe2Zvcih2YXIgYz1bXSxkPS0xLGU9MDtlPGIubGVuZ3RoO2UrKyk0IT09YltlXS5zdGF0dXMmJigyPT09YltlXS5zdGF0dXM/KHYoZD09PWUtMSxcIkFsbCBTRU5UIGl0ZW1zIHNob3VsZCBiZSBhdCBiZWdpbm5pbmcgb2YgcXVldWUuXCIpLGQ9ZSxiW2VdLnN0YXR1cz00LGJbZV0udWM9XCJzZXRcIik6KHYoMT09PWJbZV0uc3RhdHVzKSxiW2VdLnRjKCksYltlXS5EJiZjLnB1c2gocihiW2VdLkQsbnVsbCxFcnJvcihcInNldFwiKSwhMSxudWxsKSkpKTstMT09PWQ/SihhLG51bGwpOmIubGVuZ3RoPWQrMTtmb3IoZT0wO2U8Yy5sZW5ndGg7ZSsrKWVjKGNbZV0pfX1mdW5jdGlvbiBOZShhLGIpe3ZhciBjPW5ldyBFKGEsYik7cmV0dXJuIG5ldyBQKFMoYS5IYSxiKSxjKX1cclxuZnVuY3Rpb24gTGUoYSxiLGMsZCl7aWYoZC5mKCkpcmV0dXJuIGM7aWYobnVsbCE9ZC5qKCkpcmV0dXJuIGI7dmFyIGU9YztkLkEoZnVuY3Rpb24oZCl7dmFyIGc9ZC5uYW1lKCksaz1uZXcgRihnKTtkPUxlKGEsYi5MKGspLGMuTChrKSxkKTtlPWUuSChnLGQpfSk7cmV0dXJuIGV9O2Z1bmN0aW9uIFkoKXt0aGlzLmliPXt9fWNhKFkpO1kucHJvdG90eXBlLkxhPWZ1bmN0aW9uKCl7Zm9yKHZhciBhIGluIHRoaXMuaWIpdGhpcy5pYlthXS5MYSgpfTtZLnByb3RvdHlwZS5pbnRlcnJ1cHQ9WS5wcm90b3R5cGUuTGE7WS5wcm90b3R5cGUuamI9ZnVuY3Rpb24oKXtmb3IodmFyIGEgaW4gdGhpcy5pYil0aGlzLmliW2FdLmpiKCl9O1kucHJvdG90eXBlLnJlc3VtZT1ZLnByb3RvdHlwZS5qYjt2YXIgWj17TmQ6ZnVuY3Rpb24oYSl7dmFyIGI9Ti5wcm90b3R5cGUuaGFzaDtOLnByb3RvdHlwZS5oYXNoPWE7dmFyIGM9ZmMucHJvdG90eXBlLmhhc2g7ZmMucHJvdG90eXBlLmhhc2g9YTtyZXR1cm4gZnVuY3Rpb24oKXtOLnByb3RvdHlwZS5oYXNoPWI7ZmMucHJvdG90eXBlLmhhc2g9Y319fTtaLmhpamFja0hhc2g9Wi5OZDtaLlBhPWZ1bmN0aW9uKGEpe3JldHVybiBhLlBhKCl9O1oucXVlcnlJZGVudGlmaWVyPVouUGE7Wi5RZD1mdW5jdGlvbihhKXtyZXR1cm4gYS5tLnUuaWF9O1oubGlzdGVucz1aLlFkO1ouWWQ9ZnVuY3Rpb24oYSl7cmV0dXJuIGEubS51LmxhfTtaLnJlZkNvbm5lY3Rpb249Wi5ZZDtaLkNkPWxkO1ouRGF0YUNvbm5lY3Rpb249Wi5DZDtsZC5wcm90b3R5cGUuc2VuZFJlcXVlc3Q9bGQucHJvdG90eXBlLkdhO2xkLnByb3RvdHlwZS5pbnRlcnJ1cHQ9bGQucHJvdG90eXBlLkxhO1ouRGQ9JGM7Wi5SZWFsVGltZUNvbm5lY3Rpb249Wi5EZDtcclxuJGMucHJvdG90eXBlLnNlbmRSZXF1ZXN0PSRjLnByb3RvdHlwZS54ZDskYy5wcm90b3R5cGUuY2xvc2U9JGMucHJvdG90eXBlLmNsb3NlO1ouQmQ9b2I7Wi5Db25uZWN0aW9uVGFyZ2V0PVouQmQ7Wi5MZD1mdW5jdGlvbigpe09jPUdjPSEwfTtaLmZvcmNlTG9uZ1BvbGxpbmc9Wi5MZDtaLk1kPWZ1bmN0aW9uKCl7UGM9ITB9O1ouZm9yY2VXZWJTb2NrZXRzPVouTWQ7Wi5kZT1mdW5jdGlvbihhLGIpe2EubS51LlZjPWJ9O1ouc2V0U2VjdXJpdHlEZWJ1Z0NhbGxiYWNrPVouZGU7Wi5YYz1mdW5jdGlvbihhLGIpe2EubS5YYyhiKX07Wi5zdGF0cz1aLlhjO1ouWWM9ZnVuY3Rpb24oYSxiKXthLm0uWWMoYil9O1ouc3RhdHNJbmNyZW1lbnRDb3VudGVyPVouWWM7Wi5DYz1mdW5jdGlvbihhKXtyZXR1cm4gYS5tLkNjfTtaLk9kPWZ1bmN0aW9uKGEsYil7YS5tLm1kPWJ9O1ouaW50ZXJjZXB0U2VydmVyRGF0YT1aLk9kO2Z1bmN0aW9uICQoYSxiLGMpe3RoaXMuSmI9YTt0aGlzLlg9Yjt0aGlzLkZhPWN9JC5wcm90b3R5cGUuY2FuY2VsPWZ1bmN0aW9uKGEpe3goXCJGaXJlYmFzZS5vbkRpc2Nvbm5lY3QoKS5jYW5jZWxcIiwwLDEsYXJndW1lbnRzLmxlbmd0aCk7eihcIkZpcmViYXNlLm9uRGlzY29ubmVjdCgpLmNhbmNlbFwiLDEsYSwhMCk7dGhpcy5KYi5OYyh0aGlzLlgsYSl9OyQucHJvdG90eXBlLmNhbmNlbD0kLnByb3RvdHlwZS5jYW5jZWw7JC5wcm90b3R5cGUucmVtb3ZlPWZ1bmN0aW9uKGEpe3goXCJGaXJlYmFzZS5vbkRpc2Nvbm5lY3QoKS5yZW1vdmVcIiwwLDEsYXJndW1lbnRzLmxlbmd0aCk7QihcIkZpcmViYXNlLm9uRGlzY29ubmVjdCgpLnJlbW92ZVwiLHRoaXMuWCk7eihcIkZpcmViYXNlLm9uRGlzY29ubmVjdCgpLnJlbW92ZVwiLDEsYSwhMCk7R2UodGhpcy5KYix0aGlzLlgsbnVsbCxhKX07JC5wcm90b3R5cGUucmVtb3ZlPSQucHJvdG90eXBlLnJlbW92ZTtcclxuJC5wcm90b3R5cGUuc2V0PWZ1bmN0aW9uKGEsYil7eChcIkZpcmViYXNlLm9uRGlzY29ubmVjdCgpLnNldFwiLDEsMixhcmd1bWVudHMubGVuZ3RoKTtCKFwiRmlyZWJhc2Uub25EaXNjb25uZWN0KCkuc2V0XCIsdGhpcy5YKTt6YShcIkZpcmViYXNlLm9uRGlzY29ubmVjdCgpLnNldFwiLGEsITEpO3ooXCJGaXJlYmFzZS5vbkRpc2Nvbm5lY3QoKS5zZXRcIiwyLGIsITApO0dlKHRoaXMuSmIsdGhpcy5YLGEsYil9OyQucHJvdG90eXBlLnNldD0kLnByb3RvdHlwZS5zZXQ7XHJcbiQucHJvdG90eXBlLmtiPWZ1bmN0aW9uKGEsYixjKXt4KFwiRmlyZWJhc2Uub25EaXNjb25uZWN0KCkuc2V0V2l0aFByaW9yaXR5XCIsMiwzLGFyZ3VtZW50cy5sZW5ndGgpO0IoXCJGaXJlYmFzZS5vbkRpc2Nvbm5lY3QoKS5zZXRXaXRoUHJpb3JpdHlcIix0aGlzLlgpO3phKFwiRmlyZWJhc2Uub25EaXNjb25uZWN0KCkuc2V0V2l0aFByaW9yaXR5XCIsYSwhMSk7RWEoXCJGaXJlYmFzZS5vbkRpc2Nvbm5lY3QoKS5zZXRXaXRoUHJpb3JpdHlcIiwyLGIsITEpO3ooXCJGaXJlYmFzZS5vbkRpc2Nvbm5lY3QoKS5zZXRXaXRoUHJpb3JpdHlcIiwzLGMsITApO2lmKFwiLmxlbmd0aFwiPT09dGhpcy5GYXx8XCIua2V5c1wiPT09dGhpcy5GYSl0aHJvd1wiRmlyZWJhc2Uub25EaXNjb25uZWN0KCkuc2V0V2l0aFByaW9yaXR5IGZhaWxlZDogXCIrdGhpcy5GYStcIiBpcyBhIHJlYWQtb25seSBvYmplY3QuXCI7SGUodGhpcy5KYix0aGlzLlgsYSxiLGMpfTskLnByb3RvdHlwZS5zZXRXaXRoUHJpb3JpdHk9JC5wcm90b3R5cGUua2I7XHJcbiQucHJvdG90eXBlLnVwZGF0ZT1mdW5jdGlvbihhLGIpe3goXCJGaXJlYmFzZS5vbkRpc2Nvbm5lY3QoKS51cGRhdGVcIiwxLDIsYXJndW1lbnRzLmxlbmd0aCk7QihcIkZpcmViYXNlLm9uRGlzY29ubmVjdCgpLnVwZGF0ZVwiLHRoaXMuWCk7RGEoXCJGaXJlYmFzZS5vbkRpc2Nvbm5lY3QoKS51cGRhdGVcIixhKTt6KFwiRmlyZWJhc2Uub25EaXNjb25uZWN0KCkudXBkYXRlXCIsMixiLCEwKTtJZSh0aGlzLkpiLHRoaXMuWCxhLGIpfTskLnByb3RvdHlwZS51cGRhdGU9JC5wcm90b3R5cGUudXBkYXRlO3ZhciBWZT1mdW5jdGlvbigpe3ZhciBhPTAsYj1bXTtyZXR1cm4gZnVuY3Rpb24oYyl7dmFyIGQ9Yz09PWE7YT1jO2Zvcih2YXIgZT1BcnJheSg4KSxmPTc7MDw9ZjtmLS0pZVtmXT1cIi0wMTIzNDU2Nzg5QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpfYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXpcIi5jaGFyQXQoYyU2NCksYz1NYXRoLmZsb29yKGMvNjQpO3YoMD09PWMsXCJDYW5ub3QgcHVzaCBhdCB0aW1lID09IDBcIik7Yz1lLmpvaW4oXCJcIik7aWYoZCl7Zm9yKGY9MTE7MDw9ZiYmNjM9PT1iW2ZdO2YtLSliW2ZdPTA7YltmXSsrfWVsc2UgZm9yKGY9MDsxMj5mO2YrKyliW2ZdPU1hdGguZmxvb3IoNjQqTWF0aC5yYW5kb20oKSk7Zm9yKGY9MDsxMj5mO2YrKyljKz1cIi0wMTIzNDU2Nzg5QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpfYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXpcIi5jaGFyQXQoYltmXSk7digyMD09PWMubGVuZ3RoLFwiTmV4dFB1c2hJZDogTGVuZ3RoIHNob3VsZCBiZSAyMC5cIik7XHJcbnJldHVybiBjfX0oKTtmdW5jdGlvbiBFKGEsYil7dmFyIGMsZDtpZihhIGluc3RhbmNlb2YgemUpYz1hLGQ9YjtlbHNle3goXCJuZXcgRmlyZWJhc2VcIiwxLDIsYXJndW1lbnRzLmxlbmd0aCk7dmFyIGU9YXJndW1lbnRzWzBdO2Q9Yz1cIlwiO3ZhciBmPSEwLGc9XCJcIjtpZihxKGUpKXt2YXIgaz1lLmluZGV4T2YoXCIvL1wiKTtpZigwPD1rKXZhciBsPWUuc3Vic3RyaW5nKDAsay0xKSxlPWUuc3Vic3RyaW5nKGsrMik7az1lLmluZGV4T2YoXCIvXCIpOy0xPT09ayYmKGs9ZS5sZW5ndGgpO2M9ZS5zdWJzdHJpbmcoMCxrKTt2YXIgZT1lLnN1YnN0cmluZyhrKzEpLG09Yy5zcGxpdChcIi5cIik7aWYoMz09bS5sZW5ndGgpe2s9bVsyXS5pbmRleE9mKFwiOlwiKTtmPTA8PWs/XCJodHRwc1wiPT09bHx8XCJ3c3NcIj09PWw6ITA7aWYoXCJmaXJlYmFzZVwiPT09bVsxXSlTYihjK1wiIGlzIG5vIGxvbmdlciBzdXBwb3J0ZWQuIFBsZWFzZSB1c2UgPFlPVVIgRklSRUJBU0U+LmZpcmViYXNlaW8uY29tIGluc3RlYWRcIik7ZWxzZSBmb3IoZD1tWzBdLFxyXG5nPVwiXCIsZT0oXCIvXCIrZSkuc3BsaXQoXCIvXCIpLGs9MDtrPGUubGVuZ3RoO2srKylpZigwPGVba10ubGVuZ3RoKXttPWVba107dHJ5e209ZGVjb2RlVVJJQ29tcG9uZW50KG0ucmVwbGFjZSgvXFwrL2csXCIgXCIpKX1jYXRjaChwKXt9Zys9XCIvXCIrbX1kPWQudG9Mb3dlckNhc2UoKX1lbHNlIFNiKFwiQ2Fubm90IHBhcnNlIEZpcmViYXNlIHVybC4gUGxlYXNlIHVzZSBodHRwczo8WU9VUiBGSVJFQkFTRT4uZmlyZWJhc2Vpby5jb21cIil9Znx8XCJ1bmRlZmluZWRcIiE9PXR5cGVvZiB3aW5kb3cmJndpbmRvdy5sb2NhdGlvbiYmd2luZG93LmxvY2F0aW9uLnByb3RvY29sJiYtMSE9PXdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbC5pbmRleE9mKFwiaHR0cHM6XCIpJiZMKFwiSW5zZWN1cmUgRmlyZWJhc2UgYWNjZXNzIGZyb20gYSBzZWN1cmUgcGFnZS4gUGxlYXNlIHVzZSBodHRwcyBpbiBjYWxscyB0byBuZXcgRmlyZWJhc2UoKS5cIik7Yz1uZXcgb2IoYyxmLGQsXCJ3c1wiPT09bHx8XCJ3c3NcIj09PWwpO2Q9bmV3IEYoZyk7XHJcbmY9ZC50b1N0cmluZygpOyEobD0hcShjLmhvc3QpfHwwPT09Yy5ob3N0Lmxlbmd0aHx8IXlhKGMuWWIpKSYmKGw9MCE9PWYubGVuZ3RoKSYmKGYmJihmPWYucmVwbGFjZSgvXlxcLypcXC5pbmZvKFxcL3wkKS8sXCIvXCIpKSxsPSEocShmKSYmMCE9PWYubGVuZ3RoJiYheGEudGVzdChmKSkpO2lmKGwpdGhyb3cgRXJyb3IoeShcIm5ldyBGaXJlYmFzZVwiLDEsITEpKydtdXN0IGJlIGEgdmFsaWQgZmlyZWJhc2UgVVJMIGFuZCB0aGUgcGF0aCBjYW5cXCd0IGNvbnRhaW4gXCIuXCIsIFwiI1wiLCBcIiRcIiwgXCJbXCIsIG9yIFwiXVwiLicpO2lmKGIpaWYoYiBpbnN0YW5jZW9mIFkpZj1iO2Vsc2UgdGhyb3cgRXJyb3IoXCJFeHBlY3RlZCBhIHZhbGlkIEZpcmViYXNlLkNvbnRleHQgZm9yIHNlY29uZCBhcmd1bWVudCB0byBuZXcgRmlyZWJhc2UoKVwiKTtlbHNlIGY9WS5yYigpO2w9Yy50b1N0cmluZygpO2U9dmEoZi5pYixsKTtlfHwoZT1uZXcgemUoYyksZi5pYltsXT1lKTtjPWV9RC5jYWxsKHRoaXMsYyxkKX1cclxuamEoRSxEKTt2YXIgV2U9RSxYZT1bXCJGaXJlYmFzZVwiXSxZZT1hYTtYZVswXWluIFllfHwhWWUuZXhlY1NjcmlwdHx8WWUuZXhlY1NjcmlwdChcInZhciBcIitYZVswXSk7Zm9yKHZhciBaZTtYZS5sZW5ndGgmJihaZT1YZS5zaGlmdCgpKTspIVhlLmxlbmd0aCYmbihXZSk/WWVbWmVdPVdlOlllPVllW1plXT9ZZVtaZV06WWVbWmVdPXt9O0UucHJvdG90eXBlLm5hbWU9ZnVuY3Rpb24oKXt4KFwiRmlyZWJhc2UubmFtZVwiLDAsMCxhcmd1bWVudHMubGVuZ3RoKTtyZXR1cm4gdGhpcy5wYXRoLmYoKT9udWxsOk1hKHRoaXMucGF0aCl9O0UucHJvdG90eXBlLm5hbWU9RS5wcm90b3R5cGUubmFtZTtcclxuRS5wcm90b3R5cGUuRz1mdW5jdGlvbihhKXt4KFwiRmlyZWJhc2UuY2hpbGRcIiwxLDEsYXJndW1lbnRzLmxlbmd0aCk7aWYoZmEoYSkpYT1TdHJpbmcoYSk7ZWxzZSBpZighKGEgaW5zdGFuY2VvZiBGKSlpZihudWxsPT09Qyh0aGlzLnBhdGgpKXt2YXIgYj1hO2ImJihiPWIucmVwbGFjZSgvXlxcLypcXC5pbmZvKFxcL3wkKS8sXCIvXCIpKTtIYShcIkZpcmViYXNlLmNoaWxkXCIsYil9ZWxzZSBIYShcIkZpcmViYXNlLmNoaWxkXCIsYSk7cmV0dXJuIG5ldyBFKHRoaXMubSx0aGlzLnBhdGguRyhhKSl9O0UucHJvdG90eXBlLmNoaWxkPUUucHJvdG90eXBlLkc7RS5wcm90b3R5cGUucGFyZW50PWZ1bmN0aW9uKCl7eChcIkZpcmViYXNlLnBhcmVudFwiLDAsMCxhcmd1bWVudHMubGVuZ3RoKTt2YXIgYT10aGlzLnBhdGgucGFyZW50KCk7cmV0dXJuIG51bGw9PT1hP251bGw6bmV3IEUodGhpcy5tLGEpfTtFLnByb3RvdHlwZS5wYXJlbnQ9RS5wcm90b3R5cGUucGFyZW50O1xyXG5FLnByb3RvdHlwZS5yb290PWZ1bmN0aW9uKCl7eChcIkZpcmViYXNlLnJlZlwiLDAsMCxhcmd1bWVudHMubGVuZ3RoKTtmb3IodmFyIGE9dGhpcztudWxsIT09YS5wYXJlbnQoKTspYT1hLnBhcmVudCgpO3JldHVybiBhfTtFLnByb3RvdHlwZS5yb290PUUucHJvdG90eXBlLnJvb3Q7RS5wcm90b3R5cGUudG9TdHJpbmc9ZnVuY3Rpb24oKXt4KFwiRmlyZWJhc2UudG9TdHJpbmdcIiwwLDAsYXJndW1lbnRzLmxlbmd0aCk7dmFyIGE7aWYobnVsbD09PXRoaXMucGFyZW50KCkpYT10aGlzLm0udG9TdHJpbmcoKTtlbHNle2E9dGhpcy5wYXJlbnQoKS50b1N0cmluZygpK1wiL1wiO3ZhciBiPXRoaXMubmFtZSgpO2ErPWVuY29kZVVSSUNvbXBvbmVudChTdHJpbmcoYikpfXJldHVybiBhfTtFLnByb3RvdHlwZS50b1N0cmluZz1FLnByb3RvdHlwZS50b1N0cmluZztcclxuRS5wcm90b3R5cGUuc2V0PWZ1bmN0aW9uKGEsYil7eChcIkZpcmViYXNlLnNldFwiLDEsMixhcmd1bWVudHMubGVuZ3RoKTtCKFwiRmlyZWJhc2Uuc2V0XCIsdGhpcy5wYXRoKTt6YShcIkZpcmViYXNlLnNldFwiLGEsITEpO3ooXCJGaXJlYmFzZS5zZXRcIiwyLGIsITApO3RoaXMubS5rYih0aGlzLnBhdGgsYSxudWxsLGIpfTtFLnByb3RvdHlwZS5zZXQ9RS5wcm90b3R5cGUuc2V0O0UucHJvdG90eXBlLnVwZGF0ZT1mdW5jdGlvbihhLGIpe3goXCJGaXJlYmFzZS51cGRhdGVcIiwxLDIsYXJndW1lbnRzLmxlbmd0aCk7QihcIkZpcmViYXNlLnVwZGF0ZVwiLHRoaXMucGF0aCk7RGEoXCJGaXJlYmFzZS51cGRhdGVcIixhKTt6KFwiRmlyZWJhc2UudXBkYXRlXCIsMixiLCEwKTtpZihBKGEsXCIucHJpb3JpdHlcIikpdGhyb3cgRXJyb3IoXCJ1cGRhdGUoKSBkb2VzIG5vdCBjdXJyZW50bHkgc3VwcG9ydCB1cGRhdGluZyAucHJpb3JpdHkuXCIpO3RoaXMubS51cGRhdGUodGhpcy5wYXRoLGEsYil9O1xyXG5FLnByb3RvdHlwZS51cGRhdGU9RS5wcm90b3R5cGUudXBkYXRlO0UucHJvdG90eXBlLmtiPWZ1bmN0aW9uKGEsYixjKXt4KFwiRmlyZWJhc2Uuc2V0V2l0aFByaW9yaXR5XCIsMiwzLGFyZ3VtZW50cy5sZW5ndGgpO0IoXCJGaXJlYmFzZS5zZXRXaXRoUHJpb3JpdHlcIix0aGlzLnBhdGgpO3phKFwiRmlyZWJhc2Uuc2V0V2l0aFByaW9yaXR5XCIsYSwhMSk7RWEoXCJGaXJlYmFzZS5zZXRXaXRoUHJpb3JpdHlcIiwyLGIsITEpO3ooXCJGaXJlYmFzZS5zZXRXaXRoUHJpb3JpdHlcIiwzLGMsITApO2lmKFwiLmxlbmd0aFwiPT09dGhpcy5uYW1lKCl8fFwiLmtleXNcIj09PXRoaXMubmFtZSgpKXRocm93XCJGaXJlYmFzZS5zZXRXaXRoUHJpb3JpdHkgZmFpbGVkOiBcIit0aGlzLm5hbWUoKStcIiBpcyBhIHJlYWQtb25seSBvYmplY3QuXCI7dGhpcy5tLmtiKHRoaXMucGF0aCxhLGIsYyl9O0UucHJvdG90eXBlLnNldFdpdGhQcmlvcml0eT1FLnByb3RvdHlwZS5rYjtcclxuRS5wcm90b3R5cGUucmVtb3ZlPWZ1bmN0aW9uKGEpe3goXCJGaXJlYmFzZS5yZW1vdmVcIiwwLDEsYXJndW1lbnRzLmxlbmd0aCk7QihcIkZpcmViYXNlLnJlbW92ZVwiLHRoaXMucGF0aCk7eihcIkZpcmViYXNlLnJlbW92ZVwiLDEsYSwhMCk7dGhpcy5zZXQobnVsbCxhKX07RS5wcm90b3R5cGUucmVtb3ZlPUUucHJvdG90eXBlLnJlbW92ZTtcclxuRS5wcm90b3R5cGUudHJhbnNhY3Rpb249ZnVuY3Rpb24oYSxiLGMpe3goXCJGaXJlYmFzZS50cmFuc2FjdGlvblwiLDEsMyxhcmd1bWVudHMubGVuZ3RoKTtCKFwiRmlyZWJhc2UudHJhbnNhY3Rpb25cIix0aGlzLnBhdGgpO3ooXCJGaXJlYmFzZS50cmFuc2FjdGlvblwiLDEsYSwhMSk7eihcIkZpcmViYXNlLnRyYW5zYWN0aW9uXCIsMixiLCEwKTtpZihuKGMpJiZcImJvb2xlYW5cIiE9dHlwZW9mIGMpdGhyb3cgRXJyb3IoeShcIkZpcmViYXNlLnRyYW5zYWN0aW9uXCIsMywhMCkrXCJtdXN0IGJlIGEgYm9vbGVhbi5cIik7aWYoXCIubGVuZ3RoXCI9PT10aGlzLm5hbWUoKXx8XCIua2V5c1wiPT09dGhpcy5uYW1lKCkpdGhyb3dcIkZpcmViYXNlLnRyYW5zYWN0aW9uIGZhaWxlZDogXCIrdGhpcy5uYW1lKCkrXCIgaXMgYSByZWFkLW9ubHkgb2JqZWN0LlwiO1widW5kZWZpbmVkXCI9PT10eXBlb2YgYyYmKGM9ITApO0tlKHRoaXMubSx0aGlzLnBhdGgsYSxiLGMpfTtFLnByb3RvdHlwZS50cmFuc2FjdGlvbj1FLnByb3RvdHlwZS50cmFuc2FjdGlvbjtcclxuRS5wcm90b3R5cGUuV2M9ZnVuY3Rpb24oYSxiKXt4KFwiRmlyZWJhc2Uuc2V0UHJpb3JpdHlcIiwxLDIsYXJndW1lbnRzLmxlbmd0aCk7QihcIkZpcmViYXNlLnNldFByaW9yaXR5XCIsdGhpcy5wYXRoKTtFYShcIkZpcmViYXNlLnNldFByaW9yaXR5XCIsMSxhLCExKTt6KFwiRmlyZWJhc2Uuc2V0UHJpb3JpdHlcIiwyLGIsITApO3RoaXMubS5XYyh0aGlzLnBhdGgsYSxiKX07RS5wcm90b3R5cGUuc2V0UHJpb3JpdHk9RS5wcm90b3R5cGUuV2M7RS5wcm90b3R5cGUucHVzaD1mdW5jdGlvbihhLGIpe3goXCJGaXJlYmFzZS5wdXNoXCIsMCwyLGFyZ3VtZW50cy5sZW5ndGgpO0IoXCJGaXJlYmFzZS5wdXNoXCIsdGhpcy5wYXRoKTt6YShcIkZpcmViYXNlLnB1c2hcIixhLCEwKTt6KFwiRmlyZWJhc2UucHVzaFwiLDIsYiwhMCk7dmFyIGM9QmUodGhpcy5tKSxjPVZlKGMpLGM9dGhpcy5HKGMpO1widW5kZWZpbmVkXCIhPT10eXBlb2YgYSYmbnVsbCE9PWEmJmMuc2V0KGEsYik7cmV0dXJuIGN9O1xyXG5FLnByb3RvdHlwZS5wdXNoPUUucHJvdG90eXBlLnB1c2g7RS5wcm90b3R5cGUuamE9ZnVuY3Rpb24oKXtyZXR1cm4gbmV3ICQodGhpcy5tLHRoaXMucGF0aCx0aGlzLm5hbWUoKSl9O0UucHJvdG90eXBlLm9uRGlzY29ubmVjdD1FLnByb3RvdHlwZS5qYTtFLnByb3RvdHlwZS5aZD1mdW5jdGlvbigpe0woXCJGaXJlYmFzZVJlZi5yZW1vdmVPbkRpc2Nvbm5lY3QoKSBiZWluZyBkZXByZWNhdGVkLiBQbGVhc2UgdXNlIEZpcmViYXNlUmVmLm9uRGlzY29ubmVjdCgpLnJlbW92ZSgpIGluc3RlYWQuXCIpO3RoaXMuamEoKS5yZW1vdmUoKTtKZSh0aGlzLm0pfTtFLnByb3RvdHlwZS5yZW1vdmVPbkRpc2Nvbm5lY3Q9RS5wcm90b3R5cGUuWmQ7XHJcbkUucHJvdG90eXBlLmNlPWZ1bmN0aW9uKGEpe0woXCJGaXJlYmFzZVJlZi5zZXRPbkRpc2Nvbm5lY3QodmFsdWUpIGJlaW5nIGRlcHJlY2F0ZWQuIFBsZWFzZSB1c2UgRmlyZWJhc2VSZWYub25EaXNjb25uZWN0KCkuc2V0KHZhbHVlKSBpbnN0ZWFkLlwiKTt0aGlzLmphKCkuc2V0KGEpO0plKHRoaXMubSl9O0UucHJvdG90eXBlLnNldE9uRGlzY29ubmVjdD1FLnByb3RvdHlwZS5jZTtFLnByb3RvdHlwZS5tYj1mdW5jdGlvbihhLGIsYyl7eChcIkZpcmViYXNlLmF1dGhcIiwxLDMsYXJndW1lbnRzLmxlbmd0aCk7aWYoIXEoYSkpdGhyb3cgRXJyb3IoeShcIkZpcmViYXNlLmF1dGhcIiwxLCExKStcIm11c3QgYmUgYSB2YWxpZCBjcmVkZW50aWFsIChhIHN0cmluZykuXCIpO3ooXCJGaXJlYmFzZS5hdXRoXCIsMixiLCEwKTt6KFwiRmlyZWJhc2UuYXV0aFwiLDMsYiwhMCk7dGhpcy5tLm1iKGEsYixjKX07RS5wcm90b3R5cGUuYXV0aD1FLnByb3RvdHlwZS5tYjtcclxuRS5wcm90b3R5cGUuUGI9ZnVuY3Rpb24oYSl7eChcIkZpcmViYXNlLnVuYXV0aFwiLDAsMSxhcmd1bWVudHMubGVuZ3RoKTt6KFwiRmlyZWJhc2UudW5hdXRoXCIsMSxhLCEwKTt0aGlzLm0uUGIoYSl9O0UucHJvdG90eXBlLnVuYXV0aD1FLnByb3RvdHlwZS5QYjtFLmdvT2ZmbGluZT1mdW5jdGlvbigpe3goXCJGaXJlYmFzZS5nb09mZmxpbmVcIiwwLDAsYXJndW1lbnRzLmxlbmd0aCk7WS5yYigpLkxhKCl9O0UuZ29PbmxpbmU9ZnVuY3Rpb24oKXt4KFwiRmlyZWJhc2UuZ29PbmxpbmVcIiwwLDAsYXJndW1lbnRzLmxlbmd0aCk7WS5yYigpLmpiKCl9O1xyXG5mdW5jdGlvbiBQYihhLGIpe3YoIWJ8fCEwPT09YXx8ITE9PT1hLFwiQ2FuJ3QgdHVybiBvbiBjdXN0b20gbG9nZ2VycyBwZXJzaXN0ZW50bHkuXCIpOyEwPT09YT8oXCJ1bmRlZmluZWRcIiE9PXR5cGVvZiBjb25zb2xlJiYoXCJmdW5jdGlvblwiPT09dHlwZW9mIGNvbnNvbGUubG9nP05iPXIoY29uc29sZS5sb2csY29uc29sZSk6XCJvYmplY3RcIj09PXR5cGVvZiBjb25zb2xlLmxvZyYmKE5iPWZ1bmN0aW9uKGEpe2NvbnNvbGUubG9nKGEpfSkpLGImJm5iLnNldChcImxvZ2dpbmdfZW5hYmxlZFwiLCEwKSk6YT9OYj1hOihOYj1udWxsLG5iLnJlbW92ZShcImxvZ2dpbmdfZW5hYmxlZFwiKSl9RS5lbmFibGVMb2dnaW5nPVBiO0UuU2VydmVyVmFsdWU9e1RJTUVTVEFNUDp7XCIuc3ZcIjpcInRpbWVzdGFtcFwifX07RS5JTlRFUk5BTD1aO0UuQ29udGV4dD1ZO30pKCk7XHJcbm1vZHVsZS5leHBvcnRzID0gRmlyZWJhc2U7XHJcbiIsIihmdW5jdGlvbiAocHJvY2Vzcyl7XG4vLyB2aW06dHM9NDpzdHM9NDpzdz00OlxuLyohXG4gKlxuICogQ29weXJpZ2h0IDIwMDktMjAxMiBLcmlzIEtvd2FsIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgTUlUXG4gKiBsaWNlbnNlIGZvdW5kIGF0IGh0dHA6Ly9naXRodWIuY29tL2tyaXNrb3dhbC9xL3Jhdy9tYXN0ZXIvTElDRU5TRVxuICpcbiAqIFdpdGggcGFydHMgYnkgVHlsZXIgQ2xvc2VcbiAqIENvcHlyaWdodCAyMDA3LTIwMDkgVHlsZXIgQ2xvc2UgdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBNSVQgWCBsaWNlbnNlIGZvdW5kXG4gKiBhdCBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLmh0bWxcbiAqIEZvcmtlZCBhdCByZWZfc2VuZC5qcyB2ZXJzaW9uOiAyMDA5LTA1LTExXG4gKlxuICogV2l0aCBwYXJ0cyBieSBNYXJrIE1pbGxlclxuICogQ29weXJpZ2h0IChDKSAyMDExIEdvb2dsZSBJbmMuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKlxuICovXG5cbihmdW5jdGlvbiAoZGVmaW5pdGlvbikge1xuICAgIC8vIFR1cm4gb2ZmIHN0cmljdCBtb2RlIGZvciB0aGlzIGZ1bmN0aW9uIHNvIHdlIGNhbiBhc3NpZ24gdG8gZ2xvYmFsLlFcbiAgICAvKiBqc2hpbnQgc3RyaWN0OiBmYWxzZSAqL1xuXG4gICAgLy8gVGhpcyBmaWxlIHdpbGwgZnVuY3Rpb24gcHJvcGVybHkgYXMgYSA8c2NyaXB0PiB0YWcsIG9yIGEgbW9kdWxlXG4gICAgLy8gdXNpbmcgQ29tbW9uSlMgYW5kIE5vZGVKUyBvciBSZXF1aXJlSlMgbW9kdWxlIGZvcm1hdHMuICBJblxuICAgIC8vIENvbW1vbi9Ob2RlL1JlcXVpcmVKUywgdGhlIG1vZHVsZSBleHBvcnRzIHRoZSBRIEFQSSBhbmQgd2hlblxuICAgIC8vIGV4ZWN1dGVkIGFzIGEgc2ltcGxlIDxzY3JpcHQ+LCBpdCBjcmVhdGVzIGEgUSBnbG9iYWwgaW5zdGVhZC5cblxuICAgIC8vIE1vbnRhZ2UgUmVxdWlyZVxuICAgIGlmICh0eXBlb2YgYm9vdHN0cmFwID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgYm9vdHN0cmFwKFwicHJvbWlzZVwiLCBkZWZpbml0aW9uKTtcblxuICAgIC8vIENvbW1vbkpTXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IGRlZmluaXRpb24oKTtcblxuICAgIC8vIFJlcXVpcmVKU1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQpIHtcbiAgICAgICAgZGVmaW5lKGRlZmluaXRpb24pO1xuXG4gICAgLy8gU0VTIChTZWN1cmUgRWNtYVNjcmlwdClcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZXMgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgaWYgKCFzZXMub2soKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VzLm1ha2VRID0gZGVmaW5pdGlvbjtcbiAgICAgICAgfVxuXG4gICAgLy8gPHNjcmlwdD5cbiAgICB9IGVsc2Uge1xuICAgICAgICBRID0gZGVmaW5pdGlvbigpO1xuICAgIH1cblxufSkoZnVuY3Rpb24gKCkge1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBoYXNTdGFja3MgPSBmYWxzZTtcbnRyeSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCk7XG59IGNhdGNoIChlKSB7XG4gICAgaGFzU3RhY2tzID0gISFlLnN0YWNrO1xufVxuXG4vLyBBbGwgY29kZSBhZnRlciB0aGlzIHBvaW50IHdpbGwgYmUgZmlsdGVyZWQgZnJvbSBzdGFjayB0cmFjZXMgcmVwb3J0ZWRcbi8vIGJ5IFEuXG52YXIgcVN0YXJ0aW5nTGluZSA9IGNhcHR1cmVMaW5lKCk7XG52YXIgcUZpbGVOYW1lO1xuXG4vLyBzaGltc1xuXG4vLyB1c2VkIGZvciBmYWxsYmFjayBpbiBcImFsbFJlc29sdmVkXCJcbnZhciBub29wID0gZnVuY3Rpb24gKCkge307XG5cbi8vIFVzZSB0aGUgZmFzdGVzdCBwb3NzaWJsZSBtZWFucyB0byBleGVjdXRlIGEgdGFzayBpbiBhIGZ1dHVyZSB0dXJuXG4vLyBvZiB0aGUgZXZlbnQgbG9vcC5cbnZhciBuZXh0VGljayA9KGZ1bmN0aW9uICgpIHtcbiAgICAvLyBsaW5rZWQgbGlzdCBvZiB0YXNrcyAoc2luZ2xlLCB3aXRoIGhlYWQgbm9kZSlcbiAgICB2YXIgaGVhZCA9IHt0YXNrOiB2b2lkIDAsIG5leHQ6IG51bGx9O1xuICAgIHZhciB0YWlsID0gaGVhZDtcbiAgICB2YXIgZmx1c2hpbmcgPSBmYWxzZTtcbiAgICB2YXIgcmVxdWVzdFRpY2sgPSB2b2lkIDA7XG4gICAgdmFyIGlzTm9kZUpTID0gZmFsc2U7XG5cbiAgICBmdW5jdGlvbiBmbHVzaCgpIHtcbiAgICAgICAgLyoganNoaW50IGxvb3BmdW5jOiB0cnVlICovXG5cbiAgICAgICAgd2hpbGUgKGhlYWQubmV4dCkge1xuICAgICAgICAgICAgaGVhZCA9IGhlYWQubmV4dDtcbiAgICAgICAgICAgIHZhciB0YXNrID0gaGVhZC50YXNrO1xuICAgICAgICAgICAgaGVhZC50YXNrID0gdm9pZCAwO1xuICAgICAgICAgICAgdmFyIGRvbWFpbiA9IGhlYWQuZG9tYWluO1xuXG4gICAgICAgICAgICBpZiAoZG9tYWluKSB7XG4gICAgICAgICAgICAgICAgaGVhZC5kb21haW4gPSB2b2lkIDA7XG4gICAgICAgICAgICAgICAgZG9tYWluLmVudGVyKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgdGFzaygpO1xuXG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzTm9kZUpTKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEluIG5vZGUsIHVuY2F1Z2h0IGV4Y2VwdGlvbnMgYXJlIGNvbnNpZGVyZWQgZmF0YWwgZXJyb3JzLlxuICAgICAgICAgICAgICAgICAgICAvLyBSZS10aHJvdyB0aGVtIHN5bmNocm9ub3VzbHkgdG8gaW50ZXJydXB0IGZsdXNoaW5nIVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIEVuc3VyZSBjb250aW51YXRpb24gaWYgdGhlIHVuY2F1Z2h0IGV4Y2VwdGlvbiBpcyBzdXBwcmVzc2VkXG4gICAgICAgICAgICAgICAgICAgIC8vIGxpc3RlbmluZyBcInVuY2F1Z2h0RXhjZXB0aW9uXCIgZXZlbnRzIChhcyBkb21haW5zIGRvZXMpLlxuICAgICAgICAgICAgICAgICAgICAvLyBDb250aW51ZSBpbiBuZXh0IGV2ZW50IHRvIGF2b2lkIHRpY2sgcmVjdXJzaW9uLlxuICAgICAgICAgICAgICAgICAgICBpZiAoZG9tYWluKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkb21haW4uZXhpdCgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZmx1c2gsIDApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZG9tYWluKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkb21haW4uZW50ZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRocm93IGU7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBJbiBicm93c2VycywgdW5jYXVnaHQgZXhjZXB0aW9ucyBhcmUgbm90IGZhdGFsLlxuICAgICAgICAgICAgICAgICAgICAvLyBSZS10aHJvdyB0aGVtIGFzeW5jaHJvbm91c2x5IHRvIGF2b2lkIHNsb3ctZG93bnMuXG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICAgICAgICAgIH0sIDApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRvbWFpbikge1xuICAgICAgICAgICAgICAgIGRvbWFpbi5leGl0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmbHVzaGluZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIG5leHRUaWNrID0gZnVuY3Rpb24gKHRhc2spIHtcbiAgICAgICAgdGFpbCA9IHRhaWwubmV4dCA9IHtcbiAgICAgICAgICAgIHRhc2s6IHRhc2ssXG4gICAgICAgICAgICBkb21haW46IGlzTm9kZUpTICYmIHByb2Nlc3MuZG9tYWluLFxuICAgICAgICAgICAgbmV4dDogbnVsbFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmICghZmx1c2hpbmcpIHtcbiAgICAgICAgICAgIGZsdXNoaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHJlcXVlc3RUaWNrKCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKHR5cGVvZiBwcm9jZXNzICE9PSBcInVuZGVmaW5lZFwiICYmIHByb2Nlc3MubmV4dFRpY2spIHtcbiAgICAgICAgLy8gTm9kZS5qcyBiZWZvcmUgMC45LiBOb3RlIHRoYXQgc29tZSBmYWtlLU5vZGUgZW52aXJvbm1lbnRzLCBsaWtlIHRoZVxuICAgICAgICAvLyBNb2NoYSB0ZXN0IHJ1bm5lciwgaW50cm9kdWNlIGEgYHByb2Nlc3NgIGdsb2JhbCB3aXRob3V0IGEgYG5leHRUaWNrYC5cbiAgICAgICAgaXNOb2RlSlMgPSB0cnVlO1xuXG4gICAgICAgIHJlcXVlc3RUaWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcHJvY2Vzcy5uZXh0VGljayhmbHVzaCk7XG4gICAgICAgIH07XG5cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAvLyBJbiBJRTEwLCBOb2RlLmpzIDAuOSssIG9yIGh0dHBzOi8vZ2l0aHViLmNvbS9Ob2JsZUpTL3NldEltbWVkaWF0ZVxuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgcmVxdWVzdFRpY2sgPSBzZXRJbW1lZGlhdGUuYmluZCh3aW5kb3csIGZsdXNoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlcXVlc3RUaWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNldEltbWVkaWF0ZShmbHVzaCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBNZXNzYWdlQ2hhbm5lbCAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAvLyBtb2Rlcm4gYnJvd3NlcnNcbiAgICAgICAgLy8gaHR0cDovL3d3dy5ub25ibG9ja2luZy5pby8yMDExLzA2L3dpbmRvd25leHR0aWNrLmh0bWxcbiAgICAgICAgdmFyIGNoYW5uZWwgPSBuZXcgTWVzc2FnZUNoYW5uZWwoKTtcbiAgICAgICAgLy8gQXQgbGVhc3QgU2FmYXJpIFZlcnNpb24gNi4wLjUgKDg1MzYuMzAuMSkgaW50ZXJtaXR0ZW50bHkgY2Fubm90IGNyZWF0ZVxuICAgICAgICAvLyB3b3JraW5nIG1lc3NhZ2UgcG9ydHMgdGhlIGZpcnN0IHRpbWUgYSBwYWdlIGxvYWRzLlxuICAgICAgICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJlcXVlc3RUaWNrID0gcmVxdWVzdFBvcnRUaWNrO1xuICAgICAgICAgICAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSBmbHVzaDtcbiAgICAgICAgICAgIGZsdXNoKCk7XG4gICAgICAgIH07XG4gICAgICAgIHZhciByZXF1ZXN0UG9ydFRpY2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAvLyBPcGVyYSByZXF1aXJlcyB1cyB0byBwcm92aWRlIGEgbWVzc2FnZSBwYXlsb2FkLCByZWdhcmRsZXNzIG9mXG4gICAgICAgICAgICAvLyB3aGV0aGVyIHdlIHVzZSBpdC5cbiAgICAgICAgICAgIGNoYW5uZWwucG9ydDIucG9zdE1lc3NhZ2UoMCk7XG4gICAgICAgIH07XG4gICAgICAgIHJlcXVlc3RUaWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2V0VGltZW91dChmbHVzaCwgMCk7XG4gICAgICAgICAgICByZXF1ZXN0UG9ydFRpY2soKTtcbiAgICAgICAgfTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIG9sZCBicm93c2Vyc1xuICAgICAgICByZXF1ZXN0VGljayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZmx1c2gsIDApO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBuZXh0VGljaztcbn0pKCk7XG5cbi8vIEF0dGVtcHQgdG8gbWFrZSBnZW5lcmljcyBzYWZlIGluIHRoZSBmYWNlIG9mIGRvd25zdHJlYW1cbi8vIG1vZGlmaWNhdGlvbnMuXG4vLyBUaGVyZSBpcyBubyBzaXR1YXRpb24gd2hlcmUgdGhpcyBpcyBuZWNlc3NhcnkuXG4vLyBJZiB5b3UgbmVlZCBhIHNlY3VyaXR5IGd1YXJhbnRlZSwgdGhlc2UgcHJpbW9yZGlhbHMgbmVlZCB0byBiZVxuLy8gZGVlcGx5IGZyb3plbiBhbnl3YXksIGFuZCBpZiB5b3UgZG9u4oCZdCBuZWVkIGEgc2VjdXJpdHkgZ3VhcmFudGVlLFxuLy8gdGhpcyBpcyBqdXN0IHBsYWluIHBhcmFub2lkLlxuLy8gSG93ZXZlciwgdGhpcyAqKm1pZ2h0KiogaGF2ZSB0aGUgbmljZSBzaWRlLWVmZmVjdCBvZiByZWR1Y2luZyB0aGUgc2l6ZSBvZlxuLy8gdGhlIG1pbmlmaWVkIGNvZGUgYnkgcmVkdWNpbmcgeC5jYWxsKCkgdG8gbWVyZWx5IHgoKVxuLy8gU2VlIE1hcmsgTWlsbGVy4oCZcyBleHBsYW5hdGlvbiBvZiB3aGF0IHRoaXMgZG9lcy5cbi8vIGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWNvbnZlbnRpb25zOnNhZmVfbWV0YV9wcm9ncmFtbWluZ1xudmFyIGNhbGwgPSBGdW5jdGlvbi5jYWxsO1xuZnVuY3Rpb24gdW5jdXJyeVRoaXMoZikge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBjYWxsLmFwcGx5KGYsIGFyZ3VtZW50cyk7XG4gICAgfTtcbn1cbi8vIFRoaXMgaXMgZXF1aXZhbGVudCwgYnV0IHNsb3dlcjpcbi8vIHVuY3VycnlUaGlzID0gRnVuY3Rpb25fYmluZC5iaW5kKEZ1bmN0aW9uX2JpbmQuY2FsbCk7XG4vLyBodHRwOi8vanNwZXJmLmNvbS91bmN1cnJ5dGhpc1xuXG52YXIgYXJyYXlfc2xpY2UgPSB1bmN1cnJ5VGhpcyhBcnJheS5wcm90b3R5cGUuc2xpY2UpO1xuXG52YXIgYXJyYXlfcmVkdWNlID0gdW5jdXJyeVRoaXMoXG4gICAgQXJyYXkucHJvdG90eXBlLnJlZHVjZSB8fCBmdW5jdGlvbiAoY2FsbGJhY2ssIGJhc2lzKSB7XG4gICAgICAgIHZhciBpbmRleCA9IDAsXG4gICAgICAgICAgICBsZW5ndGggPSB0aGlzLmxlbmd0aDtcbiAgICAgICAgLy8gY29uY2VybmluZyB0aGUgaW5pdGlhbCB2YWx1ZSwgaWYgb25lIGlzIG5vdCBwcm92aWRlZFxuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgLy8gc2VlayB0byB0aGUgZmlyc3QgdmFsdWUgaW4gdGhlIGFycmF5LCBhY2NvdW50aW5nXG4gICAgICAgICAgICAvLyBmb3IgdGhlIHBvc3NpYmlsaXR5IHRoYXQgaXMgaXMgYSBzcGFyc2UgYXJyYXlcbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXggaW4gdGhpcykge1xuICAgICAgICAgICAgICAgICAgICBiYXNpcyA9IHRoaXNbaW5kZXgrK107XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoKytpbmRleCA+PSBsZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gd2hpbGUgKDEpO1xuICAgICAgICB9XG4gICAgICAgIC8vIHJlZHVjZVxuICAgICAgICBmb3IgKDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgICAgIC8vIGFjY291bnQgZm9yIHRoZSBwb3NzaWJpbGl0eSB0aGF0IHRoZSBhcnJheSBpcyBzcGFyc2VcbiAgICAgICAgICAgIGlmIChpbmRleCBpbiB0aGlzKSB7XG4gICAgICAgICAgICAgICAgYmFzaXMgPSBjYWxsYmFjayhiYXNpcywgdGhpc1tpbmRleF0sIGluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYmFzaXM7XG4gICAgfVxuKTtcblxudmFyIGFycmF5X2luZGV4T2YgPSB1bmN1cnJ5VGhpcyhcbiAgICBBcnJheS5wcm90b3R5cGUuaW5kZXhPZiB8fCBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgLy8gbm90IGEgdmVyeSBnb29kIHNoaW0sIGJ1dCBnb29kIGVub3VnaCBmb3Igb3VyIG9uZSB1c2Ugb2YgaXRcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpc1tpXSA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gLTE7XG4gICAgfVxuKTtcblxudmFyIGFycmF5X21hcCA9IHVuY3VycnlUaGlzKFxuICAgIEFycmF5LnByb3RvdHlwZS5tYXAgfHwgZnVuY3Rpb24gKGNhbGxiYWNrLCB0aGlzcCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciBjb2xsZWN0ID0gW107XG4gICAgICAgIGFycmF5X3JlZHVjZShzZWxmLCBmdW5jdGlvbiAodW5kZWZpbmVkLCB2YWx1ZSwgaW5kZXgpIHtcbiAgICAgICAgICAgIGNvbGxlY3QucHVzaChjYWxsYmFjay5jYWxsKHRoaXNwLCB2YWx1ZSwgaW5kZXgsIHNlbGYpKTtcbiAgICAgICAgfSwgdm9pZCAwKTtcbiAgICAgICAgcmV0dXJuIGNvbGxlY3Q7XG4gICAgfVxuKTtcblxudmFyIG9iamVjdF9jcmVhdGUgPSBPYmplY3QuY3JlYXRlIHx8IGZ1bmN0aW9uIChwcm90b3R5cGUpIHtcbiAgICBmdW5jdGlvbiBUeXBlKCkgeyB9XG4gICAgVHlwZS5wcm90b3R5cGUgPSBwcm90b3R5cGU7XG4gICAgcmV0dXJuIG5ldyBUeXBlKCk7XG59O1xuXG52YXIgb2JqZWN0X2hhc093blByb3BlcnR5ID0gdW5jdXJyeVRoaXMoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eSk7XG5cbnZhciBvYmplY3Rfa2V5cyA9IE9iamVjdC5rZXlzIHx8IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmplY3QpIHtcbiAgICAgICAgaWYgKG9iamVjdF9oYXNPd25Qcm9wZXJ0eShvYmplY3QsIGtleSkpIHtcbiAgICAgICAgICAgIGtleXMucHVzaChrZXkpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBrZXlzO1xufTtcblxudmFyIG9iamVjdF90b1N0cmluZyA9IHVuY3VycnlUaGlzKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcpO1xuXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSA9PT0gT2JqZWN0KHZhbHVlKTtcbn1cblxuLy8gZ2VuZXJhdG9yIHJlbGF0ZWQgc2hpbXNcblxuLy8gRklYTUU6IFJlbW92ZSB0aGlzIGZ1bmN0aW9uIG9uY2UgRVM2IGdlbmVyYXRvcnMgYXJlIGluIFNwaWRlck1vbmtleS5cbmZ1bmN0aW9uIGlzU3RvcEl0ZXJhdGlvbihleGNlcHRpb24pIHtcbiAgICByZXR1cm4gKFxuICAgICAgICBvYmplY3RfdG9TdHJpbmcoZXhjZXB0aW9uKSA9PT0gXCJbb2JqZWN0IFN0b3BJdGVyYXRpb25dXCIgfHxcbiAgICAgICAgZXhjZXB0aW9uIGluc3RhbmNlb2YgUVJldHVyblZhbHVlXG4gICAgKTtcbn1cblxuLy8gRklYTUU6IFJlbW92ZSB0aGlzIGhlbHBlciBhbmQgUS5yZXR1cm4gb25jZSBFUzYgZ2VuZXJhdG9ycyBhcmUgaW5cbi8vIFNwaWRlck1vbmtleS5cbnZhciBRUmV0dXJuVmFsdWU7XG5pZiAodHlwZW9mIFJldHVyblZhbHVlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgUVJldHVyblZhbHVlID0gUmV0dXJuVmFsdWU7XG59IGVsc2Uge1xuICAgIFFSZXR1cm5WYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gICAgfTtcbn1cblxuLy8gbG9uZyBzdGFjayB0cmFjZXNcblxudmFyIFNUQUNLX0pVTVBfU0VQQVJBVE9SID0gXCJGcm9tIHByZXZpb3VzIGV2ZW50OlwiO1xuXG5mdW5jdGlvbiBtYWtlU3RhY2tUcmFjZUxvbmcoZXJyb3IsIHByb21pc2UpIHtcbiAgICAvLyBJZiBwb3NzaWJsZSwgdHJhbnNmb3JtIHRoZSBlcnJvciBzdGFjayB0cmFjZSBieSByZW1vdmluZyBOb2RlIGFuZCBRXG4gICAgLy8gY3J1ZnQsIHRoZW4gY29uY2F0ZW5hdGluZyB3aXRoIHRoZSBzdGFjayB0cmFjZSBvZiBgcHJvbWlzZWAuIFNlZSAjNTcuXG4gICAgaWYgKGhhc1N0YWNrcyAmJlxuICAgICAgICBwcm9taXNlLnN0YWNrICYmXG4gICAgICAgIHR5cGVvZiBlcnJvciA9PT0gXCJvYmplY3RcIiAmJlxuICAgICAgICBlcnJvciAhPT0gbnVsbCAmJlxuICAgICAgICBlcnJvci5zdGFjayAmJlxuICAgICAgICBlcnJvci5zdGFjay5pbmRleE9mKFNUQUNLX0pVTVBfU0VQQVJBVE9SKSA9PT0gLTFcbiAgICApIHtcbiAgICAgICAgdmFyIHN0YWNrcyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBwID0gcHJvbWlzZTsgISFwOyBwID0gcC5zb3VyY2UpIHtcbiAgICAgICAgICAgIGlmIChwLnN0YWNrKSB7XG4gICAgICAgICAgICAgICAgc3RhY2tzLnVuc2hpZnQocC5zdGFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgc3RhY2tzLnVuc2hpZnQoZXJyb3Iuc3RhY2spO1xuXG4gICAgICAgIHZhciBjb25jYXRlZFN0YWNrcyA9IHN0YWNrcy5qb2luKFwiXFxuXCIgKyBTVEFDS19KVU1QX1NFUEFSQVRPUiArIFwiXFxuXCIpO1xuICAgICAgICBlcnJvci5zdGFjayA9IGZpbHRlclN0YWNrU3RyaW5nKGNvbmNhdGVkU3RhY2tzKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGZpbHRlclN0YWNrU3RyaW5nKHN0YWNrU3RyaW5nKSB7XG4gICAgdmFyIGxpbmVzID0gc3RhY2tTdHJpbmcuc3BsaXQoXCJcXG5cIik7XG4gICAgdmFyIGRlc2lyZWRMaW5lcyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGxpbmUgPSBsaW5lc1tpXTtcblxuICAgICAgICBpZiAoIWlzSW50ZXJuYWxGcmFtZShsaW5lKSAmJiAhaXNOb2RlRnJhbWUobGluZSkgJiYgbGluZSkge1xuICAgICAgICAgICAgZGVzaXJlZExpbmVzLnB1c2gobGluZSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRlc2lyZWRMaW5lcy5qb2luKFwiXFxuXCIpO1xufVxuXG5mdW5jdGlvbiBpc05vZGVGcmFtZShzdGFja0xpbmUpIHtcbiAgICByZXR1cm4gc3RhY2tMaW5lLmluZGV4T2YoXCIobW9kdWxlLmpzOlwiKSAhPT0gLTEgfHxcbiAgICAgICAgICAgc3RhY2tMaW5lLmluZGV4T2YoXCIobm9kZS5qczpcIikgIT09IC0xO1xufVxuXG5mdW5jdGlvbiBnZXRGaWxlTmFtZUFuZExpbmVOdW1iZXIoc3RhY2tMaW5lKSB7XG4gICAgLy8gTmFtZWQgZnVuY3Rpb25zOiBcImF0IGZ1bmN0aW9uTmFtZSAoZmlsZW5hbWU6bGluZU51bWJlcjpjb2x1bW5OdW1iZXIpXCJcbiAgICAvLyBJbiBJRTEwIGZ1bmN0aW9uIG5hbWUgY2FuIGhhdmUgc3BhY2VzIChcIkFub255bW91cyBmdW5jdGlvblwiKSBPX29cbiAgICB2YXIgYXR0ZW1wdDEgPSAvYXQgLisgXFwoKC4rKTooXFxkKyk6KD86XFxkKylcXCkkLy5leGVjKHN0YWNrTGluZSk7XG4gICAgaWYgKGF0dGVtcHQxKSB7XG4gICAgICAgIHJldHVybiBbYXR0ZW1wdDFbMV0sIE51bWJlcihhdHRlbXB0MVsyXSldO1xuICAgIH1cblxuICAgIC8vIEFub255bW91cyBmdW5jdGlvbnM6IFwiYXQgZmlsZW5hbWU6bGluZU51bWJlcjpjb2x1bW5OdW1iZXJcIlxuICAgIHZhciBhdHRlbXB0MiA9IC9hdCAoW14gXSspOihcXGQrKTooPzpcXGQrKSQvLmV4ZWMoc3RhY2tMaW5lKTtcbiAgICBpZiAoYXR0ZW1wdDIpIHtcbiAgICAgICAgcmV0dXJuIFthdHRlbXB0MlsxXSwgTnVtYmVyKGF0dGVtcHQyWzJdKV07XG4gICAgfVxuXG4gICAgLy8gRmlyZWZveCBzdHlsZTogXCJmdW5jdGlvbkBmaWxlbmFtZTpsaW5lTnVtYmVyIG9yIEBmaWxlbmFtZTpsaW5lTnVtYmVyXCJcbiAgICB2YXIgYXR0ZW1wdDMgPSAvLipAKC4rKTooXFxkKykkLy5leGVjKHN0YWNrTGluZSk7XG4gICAgaWYgKGF0dGVtcHQzKSB7XG4gICAgICAgIHJldHVybiBbYXR0ZW1wdDNbMV0sIE51bWJlcihhdHRlbXB0M1syXSldO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gaXNJbnRlcm5hbEZyYW1lKHN0YWNrTGluZSkge1xuICAgIHZhciBmaWxlTmFtZUFuZExpbmVOdW1iZXIgPSBnZXRGaWxlTmFtZUFuZExpbmVOdW1iZXIoc3RhY2tMaW5lKTtcblxuICAgIGlmICghZmlsZU5hbWVBbmRMaW5lTnVtYmVyKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgZmlsZU5hbWUgPSBmaWxlTmFtZUFuZExpbmVOdW1iZXJbMF07XG4gICAgdmFyIGxpbmVOdW1iZXIgPSBmaWxlTmFtZUFuZExpbmVOdW1iZXJbMV07XG5cbiAgICByZXR1cm4gZmlsZU5hbWUgPT09IHFGaWxlTmFtZSAmJlxuICAgICAgICBsaW5lTnVtYmVyID49IHFTdGFydGluZ0xpbmUgJiZcbiAgICAgICAgbGluZU51bWJlciA8PSBxRW5kaW5nTGluZTtcbn1cblxuLy8gZGlzY292ZXIgb3duIGZpbGUgbmFtZSBhbmQgbGluZSBudW1iZXIgcmFuZ2UgZm9yIGZpbHRlcmluZyBzdGFja1xuLy8gdHJhY2VzXG5mdW5jdGlvbiBjYXB0dXJlTGluZSgpIHtcbiAgICBpZiAoIWhhc1N0YWNrcykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB2YXIgbGluZXMgPSBlLnN0YWNrLnNwbGl0KFwiXFxuXCIpO1xuICAgICAgICB2YXIgZmlyc3RMaW5lID0gbGluZXNbMF0uaW5kZXhPZihcIkBcIikgPiAwID8gbGluZXNbMV0gOiBsaW5lc1syXTtcbiAgICAgICAgdmFyIGZpbGVOYW1lQW5kTGluZU51bWJlciA9IGdldEZpbGVOYW1lQW5kTGluZU51bWJlcihmaXJzdExpbmUpO1xuICAgICAgICBpZiAoIWZpbGVOYW1lQW5kTGluZU51bWJlcikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgcUZpbGVOYW1lID0gZmlsZU5hbWVBbmRMaW5lTnVtYmVyWzBdO1xuICAgICAgICByZXR1cm4gZmlsZU5hbWVBbmRMaW5lTnVtYmVyWzFdO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZGVwcmVjYXRlKGNhbGxiYWNrLCBuYW1lLCBhbHRlcm5hdGl2ZSkge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29uc29sZSAhPT0gXCJ1bmRlZmluZWRcIiAmJlxuICAgICAgICAgICAgdHlwZW9mIGNvbnNvbGUud2FybiA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4obmFtZSArIFwiIGlzIGRlcHJlY2F0ZWQsIHVzZSBcIiArIGFsdGVybmF0aXZlICtcbiAgICAgICAgICAgICAgICAgICAgICAgICBcIiBpbnN0ZWFkLlwiLCBuZXcgRXJyb3IoXCJcIikuc3RhY2spO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjYWxsYmFjay5hcHBseShjYWxsYmFjaywgYXJndW1lbnRzKTtcbiAgICB9O1xufVxuXG4vLyBlbmQgb2Ygc2hpbXNcbi8vIGJlZ2lubmluZyBvZiByZWFsIHdvcmtcblxuLyoqXG4gKiBDb25zdHJ1Y3RzIGEgcHJvbWlzZSBmb3IgYW4gaW1tZWRpYXRlIHJlZmVyZW5jZSwgcGFzc2VzIHByb21pc2VzIHRocm91Z2gsIG9yXG4gKiBjb2VyY2VzIHByb21pc2VzIGZyb20gZGlmZmVyZW50IHN5c3RlbXMuXG4gKiBAcGFyYW0gdmFsdWUgaW1tZWRpYXRlIHJlZmVyZW5jZSBvciBwcm9taXNlXG4gKi9cbmZ1bmN0aW9uIFEodmFsdWUpIHtcbiAgICAvLyBJZiB0aGUgb2JqZWN0IGlzIGFscmVhZHkgYSBQcm9taXNlLCByZXR1cm4gaXQgZGlyZWN0bHkuICBUaGlzIGVuYWJsZXNcbiAgICAvLyB0aGUgcmVzb2x2ZSBmdW5jdGlvbiB0byBib3RoIGJlIHVzZWQgdG8gY3JlYXRlZCByZWZlcmVuY2VzIGZyb20gb2JqZWN0cyxcbiAgICAvLyBidXQgdG8gdG9sZXJhYmx5IGNvZXJjZSBub24tcHJvbWlzZXMgdG8gcHJvbWlzZXMuXG4gICAgaWYgKGlzUHJvbWlzZSh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIC8vIGFzc2ltaWxhdGUgdGhlbmFibGVzXG4gICAgaWYgKGlzUHJvbWlzZUFsaWtlKHZhbHVlKSkge1xuICAgICAgICByZXR1cm4gY29lcmNlKHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZnVsZmlsbCh2YWx1ZSk7XG4gICAgfVxufVxuUS5yZXNvbHZlID0gUTtcblxuLyoqXG4gKiBQZXJmb3JtcyBhIHRhc2sgaW4gYSBmdXR1cmUgdHVybiBvZiB0aGUgZXZlbnQgbG9vcC5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHRhc2tcbiAqL1xuUS5uZXh0VGljayA9IG5leHRUaWNrO1xuXG4vKipcbiAqIENvbnRyb2xzIHdoZXRoZXIgb3Igbm90IGxvbmcgc3RhY2sgdHJhY2VzIHdpbGwgYmUgb25cbiAqL1xuUS5sb25nU3RhY2tTdXBwb3J0ID0gZmFsc2U7XG5cbi8qKlxuICogQ29uc3RydWN0cyBhIHtwcm9taXNlLCByZXNvbHZlLCByZWplY3R9IG9iamVjdC5cbiAqXG4gKiBgcmVzb2x2ZWAgaXMgYSBjYWxsYmFjayB0byBpbnZva2Ugd2l0aCBhIG1vcmUgcmVzb2x2ZWQgdmFsdWUgZm9yIHRoZVxuICogcHJvbWlzZS4gVG8gZnVsZmlsbCB0aGUgcHJvbWlzZSwgaW52b2tlIGByZXNvbHZlYCB3aXRoIGFueSB2YWx1ZSB0aGF0IGlzXG4gKiBub3QgYSB0aGVuYWJsZS4gVG8gcmVqZWN0IHRoZSBwcm9taXNlLCBpbnZva2UgYHJlc29sdmVgIHdpdGggYSByZWplY3RlZFxuICogdGhlbmFibGUsIG9yIGludm9rZSBgcmVqZWN0YCB3aXRoIHRoZSByZWFzb24gZGlyZWN0bHkuIFRvIHJlc29sdmUgdGhlXG4gKiBwcm9taXNlIHRvIGFub3RoZXIgdGhlbmFibGUsIHRodXMgcHV0dGluZyBpdCBpbiB0aGUgc2FtZSBzdGF0ZSwgaW52b2tlXG4gKiBgcmVzb2x2ZWAgd2l0aCB0aGF0IG90aGVyIHRoZW5hYmxlLlxuICovXG5RLmRlZmVyID0gZGVmZXI7XG5mdW5jdGlvbiBkZWZlcigpIHtcbiAgICAvLyBpZiBcIm1lc3NhZ2VzXCIgaXMgYW4gXCJBcnJheVwiLCB0aGF0IGluZGljYXRlcyB0aGF0IHRoZSBwcm9taXNlIGhhcyBub3QgeWV0XG4gICAgLy8gYmVlbiByZXNvbHZlZC4gIElmIGl0IGlzIFwidW5kZWZpbmVkXCIsIGl0IGhhcyBiZWVuIHJlc29sdmVkLiAgRWFjaFxuICAgIC8vIGVsZW1lbnQgb2YgdGhlIG1lc3NhZ2VzIGFycmF5IGlzIGl0c2VsZiBhbiBhcnJheSBvZiBjb21wbGV0ZSBhcmd1bWVudHMgdG9cbiAgICAvLyBmb3J3YXJkIHRvIHRoZSByZXNvbHZlZCBwcm9taXNlLiAgV2UgY29lcmNlIHRoZSByZXNvbHV0aW9uIHZhbHVlIHRvIGFcbiAgICAvLyBwcm9taXNlIHVzaW5nIHRoZSBgcmVzb2x2ZWAgZnVuY3Rpb24gYmVjYXVzZSBpdCBoYW5kbGVzIGJvdGggZnVsbHlcbiAgICAvLyBub24tdGhlbmFibGUgdmFsdWVzIGFuZCBvdGhlciB0aGVuYWJsZXMgZ3JhY2VmdWxseS5cbiAgICB2YXIgbWVzc2FnZXMgPSBbXSwgcHJvZ3Jlc3NMaXN0ZW5lcnMgPSBbXSwgcmVzb2x2ZWRQcm9taXNlO1xuXG4gICAgdmFyIGRlZmVycmVkID0gb2JqZWN0X2NyZWF0ZShkZWZlci5wcm90b3R5cGUpO1xuICAgIHZhciBwcm9taXNlID0gb2JqZWN0X2NyZWF0ZShQcm9taXNlLnByb3RvdHlwZSk7XG5cbiAgICBwcm9taXNlLnByb21pc2VEaXNwYXRjaCA9IGZ1bmN0aW9uIChyZXNvbHZlLCBvcCwgb3BlcmFuZHMpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMpO1xuICAgICAgICBpZiAobWVzc2FnZXMpIHtcbiAgICAgICAgICAgIG1lc3NhZ2VzLnB1c2goYXJncyk7XG4gICAgICAgICAgICBpZiAob3AgPT09IFwid2hlblwiICYmIG9wZXJhbmRzWzFdKSB7IC8vIHByb2dyZXNzIG9wZXJhbmRcbiAgICAgICAgICAgICAgICBwcm9ncmVzc0xpc3RlbmVycy5wdXNoKG9wZXJhbmRzWzFdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlZFByb21pc2UucHJvbWlzZURpc3BhdGNoLmFwcGx5KHJlc29sdmVkUHJvbWlzZSwgYXJncyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBYWFggZGVwcmVjYXRlZFxuICAgIHByb21pc2UudmFsdWVPZiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKG1lc3NhZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbmVhcmVyVmFsdWUgPSBuZWFyZXIocmVzb2x2ZWRQcm9taXNlKTtcbiAgICAgICAgaWYgKGlzUHJvbWlzZShuZWFyZXJWYWx1ZSkpIHtcbiAgICAgICAgICAgIHJlc29sdmVkUHJvbWlzZSA9IG5lYXJlclZhbHVlOyAvLyBzaG9ydGVuIGNoYWluXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5lYXJlclZhbHVlO1xuICAgIH07XG5cbiAgICBwcm9taXNlLmluc3BlY3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghcmVzb2x2ZWRQcm9taXNlKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdGF0ZTogXCJwZW5kaW5nXCIgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzb2x2ZWRQcm9taXNlLmluc3BlY3QoKTtcbiAgICB9O1xuXG4gICAgaWYgKFEubG9uZ1N0YWNrU3VwcG9ydCAmJiBoYXNTdGFja3MpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvLyBOT1RFOiBkb24ndCB0cnkgdG8gdXNlIGBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZWAgb3IgdHJhbnNmZXIgdGhlXG4gICAgICAgICAgICAvLyBhY2Nlc3NvciBhcm91bmQ7IHRoYXQgY2F1c2VzIG1lbW9yeSBsZWFrcyBhcyBwZXIgR0gtMTExLiBKdXN0XG4gICAgICAgICAgICAvLyByZWlmeSB0aGUgc3RhY2sgdHJhY2UgYXMgYSBzdHJpbmcgQVNBUC5cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBBdCB0aGUgc2FtZSB0aW1lLCBjdXQgb2ZmIHRoZSBmaXJzdCBsaW5lOyBpdCdzIGFsd2F5cyBqdXN0XG4gICAgICAgICAgICAvLyBcIltvYmplY3QgUHJvbWlzZV1cXG5cIiwgYXMgcGVyIHRoZSBgdG9TdHJpbmdgLlxuICAgICAgICAgICAgcHJvbWlzZS5zdGFjayA9IGUuc3RhY2suc3Vic3RyaW5nKGUuc3RhY2suaW5kZXhPZihcIlxcblwiKSArIDEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gTk9URTogd2UgZG8gdGhlIGNoZWNrcyBmb3IgYHJlc29sdmVkUHJvbWlzZWAgaW4gZWFjaCBtZXRob2QsIGluc3RlYWQgb2ZcbiAgICAvLyBjb25zb2xpZGF0aW5nIHRoZW0gaW50byBgYmVjb21lYCwgc2luY2Ugb3RoZXJ3aXNlIHdlJ2QgY3JlYXRlIG5ld1xuICAgIC8vIHByb21pc2VzIHdpdGggdGhlIGxpbmVzIGBiZWNvbWUod2hhdGV2ZXIodmFsdWUpKWAuIFNlZSBlLmcuIEdILTI1Mi5cblxuICAgIGZ1bmN0aW9uIGJlY29tZShuZXdQcm9taXNlKSB7XG4gICAgICAgIHJlc29sdmVkUHJvbWlzZSA9IG5ld1Byb21pc2U7XG4gICAgICAgIHByb21pc2Uuc291cmNlID0gbmV3UHJvbWlzZTtcblxuICAgICAgICBhcnJheV9yZWR1Y2UobWVzc2FnZXMsIGZ1bmN0aW9uICh1bmRlZmluZWQsIG1lc3NhZ2UpIHtcbiAgICAgICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBuZXdQcm9taXNlLnByb21pc2VEaXNwYXRjaC5hcHBseShuZXdQcm9taXNlLCBtZXNzYWdlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCB2b2lkIDApO1xuXG4gICAgICAgIG1lc3NhZ2VzID0gdm9pZCAwO1xuICAgICAgICBwcm9ncmVzc0xpc3RlbmVycyA9IHZvaWQgMDtcbiAgICB9XG5cbiAgICBkZWZlcnJlZC5wcm9taXNlID0gcHJvbWlzZTtcbiAgICBkZWZlcnJlZC5yZXNvbHZlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIGlmIChyZXNvbHZlZFByb21pc2UpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGJlY29tZShRKHZhbHVlKSk7XG4gICAgfTtcblxuICAgIGRlZmVycmVkLmZ1bGZpbGwgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgaWYgKHJlc29sdmVkUHJvbWlzZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgYmVjb21lKGZ1bGZpbGwodmFsdWUpKTtcbiAgICB9O1xuICAgIGRlZmVycmVkLnJlamVjdCA9IGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgaWYgKHJlc29sdmVkUHJvbWlzZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgYmVjb21lKHJlamVjdChyZWFzb24pKTtcbiAgICB9O1xuICAgIGRlZmVycmVkLm5vdGlmeSA9IGZ1bmN0aW9uIChwcm9ncmVzcykge1xuICAgICAgICBpZiAocmVzb2x2ZWRQcm9taXNlKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBhcnJheV9yZWR1Y2UocHJvZ3Jlc3NMaXN0ZW5lcnMsIGZ1bmN0aW9uICh1bmRlZmluZWQsIHByb2dyZXNzTGlzdGVuZXIpIHtcbiAgICAgICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBwcm9ncmVzc0xpc3RlbmVyKHByb2dyZXNzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCB2b2lkIDApO1xuICAgIH07XG5cbiAgICByZXR1cm4gZGVmZXJyZWQ7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIE5vZGUtc3R5bGUgY2FsbGJhY2sgdGhhdCB3aWxsIHJlc29sdmUgb3IgcmVqZWN0IHRoZSBkZWZlcnJlZFxuICogcHJvbWlzZS5cbiAqIEByZXR1cm5zIGEgbm9kZWJhY2tcbiAqL1xuZGVmZXIucHJvdG90eXBlLm1ha2VOb2RlUmVzb2x2ZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBmdW5jdGlvbiAoZXJyb3IsIHZhbHVlKSB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgc2VsZi5yZWplY3QoZXJyb3IpO1xuICAgICAgICB9IGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAyKSB7XG4gICAgICAgICAgICBzZWxmLnJlc29sdmUoYXJyYXlfc2xpY2UoYXJndW1lbnRzLCAxKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZWxmLnJlc29sdmUodmFsdWUpO1xuICAgICAgICB9XG4gICAgfTtcbn07XG5cbi8qKlxuICogQHBhcmFtIHJlc29sdmVyIHtGdW5jdGlvbn0gYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgbm90aGluZyBhbmQgYWNjZXB0c1xuICogdGhlIHJlc29sdmUsIHJlamVjdCwgYW5kIG5vdGlmeSBmdW5jdGlvbnMgZm9yIGEgZGVmZXJyZWQuXG4gKiBAcmV0dXJucyBhIHByb21pc2UgdGhhdCBtYXkgYmUgcmVzb2x2ZWQgd2l0aCB0aGUgZ2l2ZW4gcmVzb2x2ZSBhbmQgcmVqZWN0XG4gKiBmdW5jdGlvbnMsIG9yIHJlamVjdGVkIGJ5IGEgdGhyb3duIGV4Y2VwdGlvbiBpbiByZXNvbHZlclxuICovXG5RLlByb21pc2UgPSBwcm9taXNlOyAvLyBFUzZcblEucHJvbWlzZSA9IHByb21pc2U7XG5mdW5jdGlvbiBwcm9taXNlKHJlc29sdmVyKSB7XG4gICAgaWYgKHR5cGVvZiByZXNvbHZlciAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJyZXNvbHZlciBtdXN0IGJlIGEgZnVuY3Rpb24uXCIpO1xuICAgIH1cbiAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgIHRyeSB7XG4gICAgICAgIHJlc29sdmVyKGRlZmVycmVkLnJlc29sdmUsIGRlZmVycmVkLnJlamVjdCwgZGVmZXJyZWQubm90aWZ5KTtcbiAgICB9IGNhdGNoIChyZWFzb24pIHtcbiAgICAgICAgZGVmZXJyZWQucmVqZWN0KHJlYXNvbik7XG4gICAgfVxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufVxuXG5wcm9taXNlLnJhY2UgPSByYWNlOyAvLyBFUzZcbnByb21pc2UuYWxsID0gYWxsOyAvLyBFUzZcbnByb21pc2UucmVqZWN0ID0gcmVqZWN0OyAvLyBFUzZcbnByb21pc2UucmVzb2x2ZSA9IFE7IC8vIEVTNlxuXG4vLyBYWFggZXhwZXJpbWVudGFsLiAgVGhpcyBtZXRob2QgaXMgYSB3YXkgdG8gZGVub3RlIHRoYXQgYSBsb2NhbCB2YWx1ZSBpc1xuLy8gc2VyaWFsaXphYmxlIGFuZCBzaG91bGQgYmUgaW1tZWRpYXRlbHkgZGlzcGF0Y2hlZCB0byBhIHJlbW90ZSB1cG9uIHJlcXVlc3QsXG4vLyBpbnN0ZWFkIG9mIHBhc3NpbmcgYSByZWZlcmVuY2UuXG5RLnBhc3NCeUNvcHkgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgLy9mcmVlemUob2JqZWN0KTtcbiAgICAvL3Bhc3NCeUNvcGllcy5zZXQob2JqZWN0LCB0cnVlKTtcbiAgICByZXR1cm4gb2JqZWN0O1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUucGFzc0J5Q29weSA9IGZ1bmN0aW9uICgpIHtcbiAgICAvL2ZyZWV6ZShvYmplY3QpO1xuICAgIC8vcGFzc0J5Q29waWVzLnNldChvYmplY3QsIHRydWUpO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBJZiB0d28gcHJvbWlzZXMgZXZlbnR1YWxseSBmdWxmaWxsIHRvIHRoZSBzYW1lIHZhbHVlLCBwcm9taXNlcyB0aGF0IHZhbHVlLFxuICogYnV0IG90aGVyd2lzZSByZWplY3RzLlxuICogQHBhcmFtIHgge0FueSp9XG4gKiBAcGFyYW0geSB7QW55Kn1cbiAqIEByZXR1cm5zIHtBbnkqfSBhIHByb21pc2UgZm9yIHggYW5kIHkgaWYgdGhleSBhcmUgdGhlIHNhbWUsIGJ1dCBhIHJlamVjdGlvblxuICogb3RoZXJ3aXNlLlxuICpcbiAqL1xuUS5qb2luID0gZnVuY3Rpb24gKHgsIHkpIHtcbiAgICByZXR1cm4gUSh4KS5qb2luKHkpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuam9pbiA9IGZ1bmN0aW9uICh0aGF0KSB7XG4gICAgcmV0dXJuIFEoW3RoaXMsIHRoYXRdKS5zcHJlYWQoZnVuY3Rpb24gKHgsIHkpIHtcbiAgICAgICAgaWYgKHggPT09IHkpIHtcbiAgICAgICAgICAgIC8vIFRPRE86IFwiPT09XCIgc2hvdWxkIGJlIE9iamVjdC5pcyBvciBlcXVpdlxuICAgICAgICAgICAgcmV0dXJuIHg7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBqb2luOiBub3QgdGhlIHNhbWU6IFwiICsgeCArIFwiIFwiICsgeSk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8qKlxuICogUmV0dXJucyBhIHByb21pc2UgZm9yIHRoZSBmaXJzdCBvZiBhbiBhcnJheSBvZiBwcm9taXNlcyB0byBiZWNvbWUgZnVsZmlsbGVkLlxuICogQHBhcmFtIGFuc3dlcnMge0FycmF5W0FueSpdfSBwcm9taXNlcyB0byByYWNlXG4gKiBAcmV0dXJucyB7QW55Kn0gdGhlIGZpcnN0IHByb21pc2UgdG8gYmUgZnVsZmlsbGVkXG4gKi9cblEucmFjZSA9IHJhY2U7XG5mdW5jdGlvbiByYWNlKGFuc3dlclBzKSB7XG4gICAgcmV0dXJuIHByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIC8vIFN3aXRjaCB0byB0aGlzIG9uY2Ugd2UgY2FuIGFzc3VtZSBhdCBsZWFzdCBFUzVcbiAgICAgICAgLy8gYW5zd2VyUHMuZm9yRWFjaChmdW5jdGlvbihhbnN3ZXJQKSB7XG4gICAgICAgIC8vICAgICBRKGFuc3dlclApLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgLy8gfSk7XG4gICAgICAgIC8vIFVzZSB0aGlzIGluIHRoZSBtZWFudGltZVxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYW5zd2VyUHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIFEoYW5zd2VyUHNbaV0pLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5yYWNlID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnRoZW4oUS5yYWNlKTtcbn07XG5cbi8qKlxuICogQ29uc3RydWN0cyBhIFByb21pc2Ugd2l0aCBhIHByb21pc2UgZGVzY3JpcHRvciBvYmplY3QgYW5kIG9wdGlvbmFsIGZhbGxiYWNrXG4gKiBmdW5jdGlvbi4gIFRoZSBkZXNjcmlwdG9yIGNvbnRhaW5zIG1ldGhvZHMgbGlrZSB3aGVuKHJlamVjdGVkKSwgZ2V0KG5hbWUpLFxuICogc2V0KG5hbWUsIHZhbHVlKSwgcG9zdChuYW1lLCBhcmdzKSwgYW5kIGRlbGV0ZShuYW1lKSwgd2hpY2ggYWxsXG4gKiByZXR1cm4gZWl0aGVyIGEgdmFsdWUsIGEgcHJvbWlzZSBmb3IgYSB2YWx1ZSwgb3IgYSByZWplY3Rpb24uICBUaGUgZmFsbGJhY2tcbiAqIGFjY2VwdHMgdGhlIG9wZXJhdGlvbiBuYW1lLCBhIHJlc29sdmVyLCBhbmQgYW55IGZ1cnRoZXIgYXJndW1lbnRzIHRoYXQgd291bGRcbiAqIGhhdmUgYmVlbiBmb3J3YXJkZWQgdG8gdGhlIGFwcHJvcHJpYXRlIG1ldGhvZCBhYm92ZSBoYWQgYSBtZXRob2QgYmVlblxuICogcHJvdmlkZWQgd2l0aCB0aGUgcHJvcGVyIG5hbWUuICBUaGUgQVBJIG1ha2VzIG5vIGd1YXJhbnRlZXMgYWJvdXQgdGhlIG5hdHVyZVxuICogb2YgdGhlIHJldHVybmVkIG9iamVjdCwgYXBhcnQgZnJvbSB0aGF0IGl0IGlzIHVzYWJsZSB3aGVyZWV2ZXIgcHJvbWlzZXMgYXJlXG4gKiBib3VnaHQgYW5kIHNvbGQuXG4gKi9cblEubWFrZVByb21pc2UgPSBQcm9taXNlO1xuZnVuY3Rpb24gUHJvbWlzZShkZXNjcmlwdG9yLCBmYWxsYmFjaywgaW5zcGVjdCkge1xuICAgIGlmIChmYWxsYmFjayA9PT0gdm9pZCAwKSB7XG4gICAgICAgIGZhbGxiYWNrID0gZnVuY3Rpb24gKG9wKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBcIlByb21pc2UgZG9lcyBub3Qgc3VwcG9ydCBvcGVyYXRpb246IFwiICsgb3BcbiAgICAgICAgICAgICkpO1xuICAgICAgICB9O1xuICAgIH1cbiAgICBpZiAoaW5zcGVjdCA9PT0gdm9pZCAwKSB7XG4gICAgICAgIGluc3BlY3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4ge3N0YXRlOiBcInVua25vd25cIn07XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2UgPSBvYmplY3RfY3JlYXRlKFByb21pc2UucHJvdG90eXBlKTtcblxuICAgIHByb21pc2UucHJvbWlzZURpc3BhdGNoID0gZnVuY3Rpb24gKHJlc29sdmUsIG9wLCBhcmdzKSB7XG4gICAgICAgIHZhciByZXN1bHQ7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoZGVzY3JpcHRvcltvcF0pIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBkZXNjcmlwdG9yW29wXS5hcHBseShwcm9taXNlLCBhcmdzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gZmFsbGJhY2suY2FsbChwcm9taXNlLCBvcCwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xuICAgICAgICAgICAgcmVzdWx0ID0gcmVqZWN0KGV4Y2VwdGlvbik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc29sdmUpIHtcbiAgICAgICAgICAgIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwcm9taXNlLmluc3BlY3QgPSBpbnNwZWN0O1xuXG4gICAgLy8gWFhYIGRlcHJlY2F0ZWQgYHZhbHVlT2ZgIGFuZCBgZXhjZXB0aW9uYCBzdXBwb3J0XG4gICAgaWYgKGluc3BlY3QpIHtcbiAgICAgICAgdmFyIGluc3BlY3RlZCA9IGluc3BlY3QoKTtcbiAgICAgICAgaWYgKGluc3BlY3RlZC5zdGF0ZSA9PT0gXCJyZWplY3RlZFwiKSB7XG4gICAgICAgICAgICBwcm9taXNlLmV4Y2VwdGlvbiA9IGluc3BlY3RlZC5yZWFzb247XG4gICAgICAgIH1cblxuICAgICAgICBwcm9taXNlLnZhbHVlT2YgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgaW5zcGVjdGVkID0gaW5zcGVjdCgpO1xuICAgICAgICAgICAgaWYgKGluc3BlY3RlZC5zdGF0ZSA9PT0gXCJwZW5kaW5nXCIgfHxcbiAgICAgICAgICAgICAgICBpbnNwZWN0ZWQuc3RhdGUgPT09IFwicmVqZWN0ZWRcIikge1xuICAgICAgICAgICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGluc3BlY3RlZC52YWx1ZTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFwiW29iamVjdCBQcm9taXNlXVwiO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUudGhlbiA9IGZ1bmN0aW9uIChmdWxmaWxsZWQsIHJlamVjdGVkLCBwcm9ncmVzc2VkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBkZWZlcnJlZCA9IGRlZmVyKCk7XG4gICAgdmFyIGRvbmUgPSBmYWxzZTsgICAvLyBlbnN1cmUgdGhlIHVudHJ1c3RlZCBwcm9taXNlIG1ha2VzIGF0IG1vc3QgYVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2luZ2xlIGNhbGwgdG8gb25lIG9mIHRoZSBjYWxsYmFja3NcblxuICAgIGZ1bmN0aW9uIF9mdWxmaWxsZWQodmFsdWUpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiB0eXBlb2YgZnVsZmlsbGVkID09PSBcImZ1bmN0aW9uXCIgPyBmdWxmaWxsZWQodmFsdWUpIDogdmFsdWU7XG4gICAgICAgIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChleGNlcHRpb24pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3JlamVjdGVkKGV4Y2VwdGlvbikge1xuICAgICAgICBpZiAodHlwZW9mIHJlamVjdGVkID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIG1ha2VTdGFja1RyYWNlTG9uZyhleGNlcHRpb24sIHNlbGYpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0ZWQoZXhjZXB0aW9uKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKG5ld0V4Y2VwdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWplY3QobmV3RXhjZXB0aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVqZWN0KGV4Y2VwdGlvbik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3Byb2dyZXNzZWQodmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBwcm9ncmVzc2VkID09PSBcImZ1bmN0aW9uXCIgPyBwcm9ncmVzc2VkKHZhbHVlKSA6IHZhbHVlO1xuICAgIH1cblxuICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2VsZi5wcm9taXNlRGlzcGF0Y2goZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAoZG9uZSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRvbmUgPSB0cnVlO1xuXG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKF9mdWxmaWxsZWQodmFsdWUpKTtcbiAgICAgICAgfSwgXCJ3aGVuXCIsIFtmdW5jdGlvbiAoZXhjZXB0aW9uKSB7XG4gICAgICAgICAgICBpZiAoZG9uZSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRvbmUgPSB0cnVlO1xuXG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKF9yZWplY3RlZChleGNlcHRpb24pKTtcbiAgICAgICAgfV0pO1xuICAgIH0pO1xuXG4gICAgLy8gUHJvZ3Jlc3MgcHJvcGFnYXRvciBuZWVkIHRvIGJlIGF0dGFjaGVkIGluIHRoZSBjdXJyZW50IHRpY2suXG4gICAgc2VsZi5wcm9taXNlRGlzcGF0Y2godm9pZCAwLCBcIndoZW5cIiwgW3ZvaWQgMCwgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHZhciBuZXdWYWx1ZTtcbiAgICAgICAgdmFyIHRocmV3ID0gZmFsc2U7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBuZXdWYWx1ZSA9IF9wcm9ncmVzc2VkKHZhbHVlKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyZXcgPSB0cnVlO1xuICAgICAgICAgICAgaWYgKFEub25lcnJvcikge1xuICAgICAgICAgICAgICAgIFEub25lcnJvcihlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhyZXcpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLm5vdGlmeShuZXdWYWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XSk7XG5cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbi8qKlxuICogUmVnaXN0ZXJzIGFuIG9ic2VydmVyIG9uIGEgcHJvbWlzZS5cbiAqXG4gKiBHdWFyYW50ZWVzOlxuICpcbiAqIDEuIHRoYXQgZnVsZmlsbGVkIGFuZCByZWplY3RlZCB3aWxsIGJlIGNhbGxlZCBvbmx5IG9uY2UuXG4gKiAyLiB0aGF0IGVpdGhlciB0aGUgZnVsZmlsbGVkIGNhbGxiYWNrIG9yIHRoZSByZWplY3RlZCBjYWxsYmFjayB3aWxsIGJlXG4gKiAgICBjYWxsZWQsIGJ1dCBub3QgYm90aC5cbiAqIDMuIHRoYXQgZnVsZmlsbGVkIGFuZCByZWplY3RlZCB3aWxsIG5vdCBiZSBjYWxsZWQgaW4gdGhpcyB0dXJuLlxuICpcbiAqIEBwYXJhbSB2YWx1ZSAgICAgIHByb21pc2Ugb3IgaW1tZWRpYXRlIHJlZmVyZW5jZSB0byBvYnNlcnZlXG4gKiBAcGFyYW0gZnVsZmlsbGVkICBmdW5jdGlvbiB0byBiZSBjYWxsZWQgd2l0aCB0aGUgZnVsZmlsbGVkIHZhbHVlXG4gKiBAcGFyYW0gcmVqZWN0ZWQgICBmdW5jdGlvbiB0byBiZSBjYWxsZWQgd2l0aCB0aGUgcmVqZWN0aW9uIGV4Y2VwdGlvblxuICogQHBhcmFtIHByb2dyZXNzZWQgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIG9uIGFueSBwcm9ncmVzcyBub3RpZmljYXRpb25zXG4gKiBAcmV0dXJuIHByb21pc2UgZm9yIHRoZSByZXR1cm4gdmFsdWUgZnJvbSB0aGUgaW52b2tlZCBjYWxsYmFja1xuICovXG5RLndoZW4gPSB3aGVuO1xuZnVuY3Rpb24gd2hlbih2YWx1ZSwgZnVsZmlsbGVkLCByZWplY3RlZCwgcHJvZ3Jlc3NlZCkge1xuICAgIHJldHVybiBRKHZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQsIHByb2dyZXNzZWQpO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS50aGVuUmVzb2x2ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIHJldHVybiB0aGlzLnRoZW4oZnVuY3Rpb24gKCkgeyByZXR1cm4gdmFsdWU7IH0pO1xufTtcblxuUS50aGVuUmVzb2x2ZSA9IGZ1bmN0aW9uIChwcm9taXNlLCB2YWx1ZSkge1xuICAgIHJldHVybiBRKHByb21pc2UpLnRoZW5SZXNvbHZlKHZhbHVlKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLnRoZW5SZWplY3QgPSBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgcmV0dXJuIHRoaXMudGhlbihmdW5jdGlvbiAoKSB7IHRocm93IHJlYXNvbjsgfSk7XG59O1xuXG5RLnRoZW5SZWplY3QgPSBmdW5jdGlvbiAocHJvbWlzZSwgcmVhc29uKSB7XG4gICAgcmV0dXJuIFEocHJvbWlzZSkudGhlblJlamVjdChyZWFzb24pO1xufTtcblxuLyoqXG4gKiBJZiBhbiBvYmplY3QgaXMgbm90IGEgcHJvbWlzZSwgaXQgaXMgYXMgXCJuZWFyXCIgYXMgcG9zc2libGUuXG4gKiBJZiBhIHByb21pc2UgaXMgcmVqZWN0ZWQsIGl0IGlzIGFzIFwibmVhclwiIGFzIHBvc3NpYmxlIHRvby5cbiAqIElmIGl04oCZcyBhIGZ1bGZpbGxlZCBwcm9taXNlLCB0aGUgZnVsZmlsbG1lbnQgdmFsdWUgaXMgbmVhcmVyLlxuICogSWYgaXTigJlzIGEgZGVmZXJyZWQgcHJvbWlzZSBhbmQgdGhlIGRlZmVycmVkIGhhcyBiZWVuIHJlc29sdmVkLCB0aGVcbiAqIHJlc29sdXRpb24gaXMgXCJuZWFyZXJcIi5cbiAqIEBwYXJhbSBvYmplY3RcbiAqIEByZXR1cm5zIG1vc3QgcmVzb2x2ZWQgKG5lYXJlc3QpIGZvcm0gb2YgdGhlIG9iamVjdFxuICovXG5cbi8vIFhYWCBzaG91bGQgd2UgcmUtZG8gdGhpcz9cblEubmVhcmVyID0gbmVhcmVyO1xuZnVuY3Rpb24gbmVhcmVyKHZhbHVlKSB7XG4gICAgaWYgKGlzUHJvbWlzZSh2YWx1ZSkpIHtcbiAgICAgICAgdmFyIGluc3BlY3RlZCA9IHZhbHVlLmluc3BlY3QoKTtcbiAgICAgICAgaWYgKGluc3BlY3RlZC5zdGF0ZSA9PT0gXCJmdWxmaWxsZWRcIikge1xuICAgICAgICAgICAgcmV0dXJuIGluc3BlY3RlZC52YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG59XG5cbi8qKlxuICogQHJldHVybnMgd2hldGhlciB0aGUgZ2l2ZW4gb2JqZWN0IGlzIGEgcHJvbWlzZS5cbiAqIE90aGVyd2lzZSBpdCBpcyBhIGZ1bGZpbGxlZCB2YWx1ZS5cbiAqL1xuUS5pc1Byb21pc2UgPSBpc1Byb21pc2U7XG5mdW5jdGlvbiBpc1Byb21pc2Uob2JqZWN0KSB7XG4gICAgcmV0dXJuIGlzT2JqZWN0KG9iamVjdCkgJiZcbiAgICAgICAgdHlwZW9mIG9iamVjdC5wcm9taXNlRGlzcGF0Y2ggPT09IFwiZnVuY3Rpb25cIiAmJlxuICAgICAgICB0eXBlb2Ygb2JqZWN0Lmluc3BlY3QgPT09IFwiZnVuY3Rpb25cIjtcbn1cblxuUS5pc1Byb21pc2VBbGlrZSA9IGlzUHJvbWlzZUFsaWtlO1xuZnVuY3Rpb24gaXNQcm9taXNlQWxpa2Uob2JqZWN0KSB7XG4gICAgcmV0dXJuIGlzT2JqZWN0KG9iamVjdCkgJiYgdHlwZW9mIG9iamVjdC50aGVuID09PSBcImZ1bmN0aW9uXCI7XG59XG5cbi8qKlxuICogQHJldHVybnMgd2hldGhlciB0aGUgZ2l2ZW4gb2JqZWN0IGlzIGEgcGVuZGluZyBwcm9taXNlLCBtZWFuaW5nIG5vdFxuICogZnVsZmlsbGVkIG9yIHJlamVjdGVkLlxuICovXG5RLmlzUGVuZGluZyA9IGlzUGVuZGluZztcbmZ1bmN0aW9uIGlzUGVuZGluZyhvYmplY3QpIHtcbiAgICByZXR1cm4gaXNQcm9taXNlKG9iamVjdCkgJiYgb2JqZWN0Lmluc3BlY3QoKS5zdGF0ZSA9PT0gXCJwZW5kaW5nXCI7XG59XG5cblByb21pc2UucHJvdG90eXBlLmlzUGVuZGluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5pbnNwZWN0KCkuc3RhdGUgPT09IFwicGVuZGluZ1wiO1xufTtcblxuLyoqXG4gKiBAcmV0dXJucyB3aGV0aGVyIHRoZSBnaXZlbiBvYmplY3QgaXMgYSB2YWx1ZSBvciBmdWxmaWxsZWRcbiAqIHByb21pc2UuXG4gKi9cblEuaXNGdWxmaWxsZWQgPSBpc0Z1bGZpbGxlZDtcbmZ1bmN0aW9uIGlzRnVsZmlsbGVkKG9iamVjdCkge1xuICAgIHJldHVybiAhaXNQcm9taXNlKG9iamVjdCkgfHwgb2JqZWN0Lmluc3BlY3QoKS5zdGF0ZSA9PT0gXCJmdWxmaWxsZWRcIjtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUuaXNGdWxmaWxsZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5zcGVjdCgpLnN0YXRlID09PSBcImZ1bGZpbGxlZFwiO1xufTtcblxuLyoqXG4gKiBAcmV0dXJucyB3aGV0aGVyIHRoZSBnaXZlbiBvYmplY3QgaXMgYSByZWplY3RlZCBwcm9taXNlLlxuICovXG5RLmlzUmVqZWN0ZWQgPSBpc1JlamVjdGVkO1xuZnVuY3Rpb24gaXNSZWplY3RlZChvYmplY3QpIHtcbiAgICByZXR1cm4gaXNQcm9taXNlKG9iamVjdCkgJiYgb2JqZWN0Lmluc3BlY3QoKS5zdGF0ZSA9PT0gXCJyZWplY3RlZFwiO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5pc1JlamVjdGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmluc3BlY3QoKS5zdGF0ZSA9PT0gXCJyZWplY3RlZFwiO1xufTtcblxuLy8vLyBCRUdJTiBVTkhBTkRMRUQgUkVKRUNUSU9OIFRSQUNLSU5HXG5cbi8vIFRoaXMgcHJvbWlzZSBsaWJyYXJ5IGNvbnN1bWVzIGV4Y2VwdGlvbnMgdGhyb3duIGluIGhhbmRsZXJzIHNvIHRoZXkgY2FuIGJlXG4vLyBoYW5kbGVkIGJ5IGEgc3Vic2VxdWVudCBwcm9taXNlLiAgVGhlIGV4Y2VwdGlvbnMgZ2V0IGFkZGVkIHRvIHRoaXMgYXJyYXkgd2hlblxuLy8gdGhleSBhcmUgY3JlYXRlZCwgYW5kIHJlbW92ZWQgd2hlbiB0aGV5IGFyZSBoYW5kbGVkLiAgTm90ZSB0aGF0IGluIEVTNiBvclxuLy8gc2hpbW1lZCBlbnZpcm9ubWVudHMsIHRoaXMgd291bGQgbmF0dXJhbGx5IGJlIGEgYFNldGAuXG52YXIgdW5oYW5kbGVkUmVhc29ucyA9IFtdO1xudmFyIHVuaGFuZGxlZFJlamVjdGlvbnMgPSBbXTtcbnZhciB0cmFja1VuaGFuZGxlZFJlamVjdGlvbnMgPSB0cnVlO1xuXG5mdW5jdGlvbiByZXNldFVuaGFuZGxlZFJlamVjdGlvbnMoKSB7XG4gICAgdW5oYW5kbGVkUmVhc29ucy5sZW5ndGggPSAwO1xuICAgIHVuaGFuZGxlZFJlamVjdGlvbnMubGVuZ3RoID0gMDtcblxuICAgIGlmICghdHJhY2tVbmhhbmRsZWRSZWplY3Rpb25zKSB7XG4gICAgICAgIHRyYWNrVW5oYW5kbGVkUmVqZWN0aW9ucyA9IHRydWU7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0cmFja1JlamVjdGlvbihwcm9taXNlLCByZWFzb24pIHtcbiAgICBpZiAoIXRyYWNrVW5oYW5kbGVkUmVqZWN0aW9ucykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdW5oYW5kbGVkUmVqZWN0aW9ucy5wdXNoKHByb21pc2UpO1xuICAgIGlmIChyZWFzb24gJiYgdHlwZW9mIHJlYXNvbi5zdGFjayAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICB1bmhhbmRsZWRSZWFzb25zLnB1c2gocmVhc29uLnN0YWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB1bmhhbmRsZWRSZWFzb25zLnB1c2goXCIobm8gc3RhY2spIFwiICsgcmVhc29uKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHVudHJhY2tSZWplY3Rpb24ocHJvbWlzZSkge1xuICAgIGlmICghdHJhY2tVbmhhbmRsZWRSZWplY3Rpb25zKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgYXQgPSBhcnJheV9pbmRleE9mKHVuaGFuZGxlZFJlamVjdGlvbnMsIHByb21pc2UpO1xuICAgIGlmIChhdCAhPT0gLTEpIHtcbiAgICAgICAgdW5oYW5kbGVkUmVqZWN0aW9ucy5zcGxpY2UoYXQsIDEpO1xuICAgICAgICB1bmhhbmRsZWRSZWFzb25zLnNwbGljZShhdCwgMSk7XG4gICAgfVxufVxuXG5RLnJlc2V0VW5oYW5kbGVkUmVqZWN0aW9ucyA9IHJlc2V0VW5oYW5kbGVkUmVqZWN0aW9ucztcblxuUS5nZXRVbmhhbmRsZWRSZWFzb25zID0gZnVuY3Rpb24gKCkge1xuICAgIC8vIE1ha2UgYSBjb3B5IHNvIHRoYXQgY29uc3VtZXJzIGNhbid0IGludGVyZmVyZSB3aXRoIG91ciBpbnRlcm5hbCBzdGF0ZS5cbiAgICByZXR1cm4gdW5oYW5kbGVkUmVhc29ucy5zbGljZSgpO1xufTtcblxuUS5zdG9wVW5oYW5kbGVkUmVqZWN0aW9uVHJhY2tpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmVzZXRVbmhhbmRsZWRSZWplY3Rpb25zKCk7XG4gICAgdHJhY2tVbmhhbmRsZWRSZWplY3Rpb25zID0gZmFsc2U7XG59O1xuXG5yZXNldFVuaGFuZGxlZFJlamVjdGlvbnMoKTtcblxuLy8vLyBFTkQgVU5IQU5ETEVEIFJFSkVDVElPTiBUUkFDS0lOR1xuXG4vKipcbiAqIENvbnN0cnVjdHMgYSByZWplY3RlZCBwcm9taXNlLlxuICogQHBhcmFtIHJlYXNvbiB2YWx1ZSBkZXNjcmliaW5nIHRoZSBmYWlsdXJlXG4gKi9cblEucmVqZWN0ID0gcmVqZWN0O1xuZnVuY3Rpb24gcmVqZWN0KHJlYXNvbikge1xuICAgIHZhciByZWplY3Rpb24gPSBQcm9taXNlKHtcbiAgICAgICAgXCJ3aGVuXCI6IGZ1bmN0aW9uIChyZWplY3RlZCkge1xuICAgICAgICAgICAgLy8gbm90ZSB0aGF0IHRoZSBlcnJvciBoYXMgYmVlbiBoYW5kbGVkXG4gICAgICAgICAgICBpZiAocmVqZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICB1bnRyYWNrUmVqZWN0aW9uKHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdGVkID8gcmVqZWN0ZWQocmVhc29uKSA6IHRoaXM7XG4gICAgICAgIH1cbiAgICB9LCBmdW5jdGlvbiBmYWxsYmFjaygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSwgZnVuY3Rpb24gaW5zcGVjdCgpIHtcbiAgICAgICAgcmV0dXJuIHsgc3RhdGU6IFwicmVqZWN0ZWRcIiwgcmVhc29uOiByZWFzb24gfTtcbiAgICB9KTtcblxuICAgIC8vIE5vdGUgdGhhdCB0aGUgcmVhc29uIGhhcyBub3QgYmVlbiBoYW5kbGVkLlxuICAgIHRyYWNrUmVqZWN0aW9uKHJlamVjdGlvbiwgcmVhc29uKTtcblxuICAgIHJldHVybiByZWplY3Rpb247XG59XG5cbi8qKlxuICogQ29uc3RydWN0cyBhIGZ1bGZpbGxlZCBwcm9taXNlIGZvciBhbiBpbW1lZGlhdGUgcmVmZXJlbmNlLlxuICogQHBhcmFtIHZhbHVlIGltbWVkaWF0ZSByZWZlcmVuY2VcbiAqL1xuUS5mdWxmaWxsID0gZnVsZmlsbDtcbmZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHtcbiAgICByZXR1cm4gUHJvbWlzZSh7XG4gICAgICAgIFwid2hlblwiOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH0sXG4gICAgICAgIFwiZ2V0XCI6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWVbbmFtZV07XG4gICAgICAgIH0sXG4gICAgICAgIFwic2V0XCI6IGZ1bmN0aW9uIChuYW1lLCByaHMpIHtcbiAgICAgICAgICAgIHZhbHVlW25hbWVdID0gcmhzO1xuICAgICAgICB9LFxuICAgICAgICBcImRlbGV0ZVwiOiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgZGVsZXRlIHZhbHVlW25hbWVdO1xuICAgICAgICB9LFxuICAgICAgICBcInBvc3RcIjogZnVuY3Rpb24gKG5hbWUsIGFyZ3MpIHtcbiAgICAgICAgICAgIC8vIE1hcmsgTWlsbGVyIHByb3Bvc2VzIHRoYXQgcG9zdCB3aXRoIG5vIG5hbWUgc2hvdWxkIGFwcGx5IGFcbiAgICAgICAgICAgIC8vIHByb21pc2VkIGZ1bmN0aW9uLlxuICAgICAgICAgICAgaWYgKG5hbWUgPT09IG51bGwgfHwgbmFtZSA9PT0gdm9pZCAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlLmFwcGx5KHZvaWQgMCwgYXJncyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZVtuYW1lXS5hcHBseSh2YWx1ZSwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIFwiYXBwbHlcIjogZnVuY3Rpb24gKHRoaXNwLCBhcmdzKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWUuYXBwbHkodGhpc3AsIGFyZ3MpO1xuICAgICAgICB9LFxuICAgICAgICBcImtleXNcIjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIG9iamVjdF9rZXlzKHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH0sIHZvaWQgMCwgZnVuY3Rpb24gaW5zcGVjdCgpIHtcbiAgICAgICAgcmV0dXJuIHsgc3RhdGU6IFwiZnVsZmlsbGVkXCIsIHZhbHVlOiB2YWx1ZSB9O1xuICAgIH0pO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIHRoZW5hYmxlcyB0byBRIHByb21pc2VzLlxuICogQHBhcmFtIHByb21pc2UgdGhlbmFibGUgcHJvbWlzZVxuICogQHJldHVybnMgYSBRIHByb21pc2VcbiAqL1xuZnVuY3Rpb24gY29lcmNlKHByb21pc2UpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihkZWZlcnJlZC5yZXNvbHZlLCBkZWZlcnJlZC5yZWplY3QsIGRlZmVycmVkLm5vdGlmeSk7XG4gICAgICAgIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGV4Y2VwdGlvbik7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxuLyoqXG4gKiBBbm5vdGF0ZXMgYW4gb2JqZWN0IHN1Y2ggdGhhdCBpdCB3aWxsIG5ldmVyIGJlXG4gKiB0cmFuc2ZlcnJlZCBhd2F5IGZyb20gdGhpcyBwcm9jZXNzIG92ZXIgYW55IHByb21pc2VcbiAqIGNvbW11bmljYXRpb24gY2hhbm5lbC5cbiAqIEBwYXJhbSBvYmplY3RcbiAqIEByZXR1cm5zIHByb21pc2UgYSB3cmFwcGluZyBvZiB0aGF0IG9iamVjdCB0aGF0XG4gKiBhZGRpdGlvbmFsbHkgcmVzcG9uZHMgdG8gdGhlIFwiaXNEZWZcIiBtZXNzYWdlXG4gKiB3aXRob3V0IGEgcmVqZWN0aW9uLlxuICovXG5RLm1hc3RlciA9IG1hc3RlcjtcbmZ1bmN0aW9uIG1hc3RlcihvYmplY3QpIHtcbiAgICByZXR1cm4gUHJvbWlzZSh7XG4gICAgICAgIFwiaXNEZWZcIjogZnVuY3Rpb24gKCkge31cbiAgICB9LCBmdW5jdGlvbiBmYWxsYmFjayhvcCwgYXJncykge1xuICAgICAgICByZXR1cm4gZGlzcGF0Y2gob2JqZWN0LCBvcCwgYXJncyk7XG4gICAgfSwgZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gUShvYmplY3QpLmluc3BlY3QoKTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBTcHJlYWRzIHRoZSB2YWx1ZXMgb2YgYSBwcm9taXNlZCBhcnJheSBvZiBhcmd1bWVudHMgaW50byB0aGVcbiAqIGZ1bGZpbGxtZW50IGNhbGxiYWNrLlxuICogQHBhcmFtIGZ1bGZpbGxlZCBjYWxsYmFjayB0aGF0IHJlY2VpdmVzIHZhcmlhZGljIGFyZ3VtZW50cyBmcm9tIHRoZVxuICogcHJvbWlzZWQgYXJyYXlcbiAqIEBwYXJhbSByZWplY3RlZCBjYWxsYmFjayB0aGF0IHJlY2VpdmVzIHRoZSBleGNlcHRpb24gaWYgdGhlIHByb21pc2VcbiAqIGlzIHJlamVjdGVkLlxuICogQHJldHVybnMgYSBwcm9taXNlIGZvciB0aGUgcmV0dXJuIHZhbHVlIG9yIHRocm93biBleGNlcHRpb24gb2ZcbiAqIGVpdGhlciBjYWxsYmFjay5cbiAqL1xuUS5zcHJlYWQgPSBzcHJlYWQ7XG5mdW5jdGlvbiBzcHJlYWQodmFsdWUsIGZ1bGZpbGxlZCwgcmVqZWN0ZWQpIHtcbiAgICByZXR1cm4gUSh2YWx1ZSkuc3ByZWFkKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5zcHJlYWQgPSBmdW5jdGlvbiAoZnVsZmlsbGVkLCByZWplY3RlZCkge1xuICAgIHJldHVybiB0aGlzLmFsbCgpLnRoZW4oZnVuY3Rpb24gKGFycmF5KSB7XG4gICAgICAgIHJldHVybiBmdWxmaWxsZWQuYXBwbHkodm9pZCAwLCBhcnJheSk7XG4gICAgfSwgcmVqZWN0ZWQpO1xufTtcblxuLyoqXG4gKiBUaGUgYXN5bmMgZnVuY3Rpb24gaXMgYSBkZWNvcmF0b3IgZm9yIGdlbmVyYXRvciBmdW5jdGlvbnMsIHR1cm5pbmdcbiAqIHRoZW0gaW50byBhc3luY2hyb25vdXMgZ2VuZXJhdG9ycy4gIEFsdGhvdWdoIGdlbmVyYXRvcnMgYXJlIG9ubHkgcGFydFxuICogb2YgdGhlIG5ld2VzdCBFQ01BU2NyaXB0IDYgZHJhZnRzLCB0aGlzIGNvZGUgZG9lcyBub3QgY2F1c2Ugc3ludGF4XG4gKiBlcnJvcnMgaW4gb2xkZXIgZW5naW5lcy4gIFRoaXMgY29kZSBzaG91bGQgY29udGludWUgdG8gd29yayBhbmQgd2lsbFxuICogaW4gZmFjdCBpbXByb3ZlIG92ZXIgdGltZSBhcyB0aGUgbGFuZ3VhZ2UgaW1wcm92ZXMuXG4gKlxuICogRVM2IGdlbmVyYXRvcnMgYXJlIGN1cnJlbnRseSBwYXJ0IG9mIFY4IHZlcnNpb24gMy4xOSB3aXRoIHRoZVxuICogLS1oYXJtb255LWdlbmVyYXRvcnMgcnVudGltZSBmbGFnIGVuYWJsZWQuICBTcGlkZXJNb25rZXkgaGFzIGhhZCB0aGVtXG4gKiBmb3IgbG9uZ2VyLCBidXQgdW5kZXIgYW4gb2xkZXIgUHl0aG9uLWluc3BpcmVkIGZvcm0uICBUaGlzIGZ1bmN0aW9uXG4gKiB3b3JrcyBvbiBib3RoIGtpbmRzIG9mIGdlbmVyYXRvcnMuXG4gKlxuICogRGVjb3JhdGVzIGEgZ2VuZXJhdG9yIGZ1bmN0aW9uIHN1Y2ggdGhhdDpcbiAqICAtIGl0IG1heSB5aWVsZCBwcm9taXNlc1xuICogIC0gZXhlY3V0aW9uIHdpbGwgY29udGludWUgd2hlbiB0aGF0IHByb21pc2UgaXMgZnVsZmlsbGVkXG4gKiAgLSB0aGUgdmFsdWUgb2YgdGhlIHlpZWxkIGV4cHJlc3Npb24gd2lsbCBiZSB0aGUgZnVsZmlsbGVkIHZhbHVlXG4gKiAgLSBpdCByZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIHJldHVybiB2YWx1ZSAod2hlbiB0aGUgZ2VuZXJhdG9yXG4gKiAgICBzdG9wcyBpdGVyYXRpbmcpXG4gKiAgLSB0aGUgZGVjb3JhdGVkIGZ1bmN0aW9uIHJldHVybnMgYSBwcm9taXNlIGZvciB0aGUgcmV0dXJuIHZhbHVlXG4gKiAgICBvZiB0aGUgZ2VuZXJhdG9yIG9yIHRoZSBmaXJzdCByZWplY3RlZCBwcm9taXNlIGFtb25nIHRob3NlXG4gKiAgICB5aWVsZGVkLlxuICogIC0gaWYgYW4gZXJyb3IgaXMgdGhyb3duIGluIHRoZSBnZW5lcmF0b3IsIGl0IHByb3BhZ2F0ZXMgdGhyb3VnaFxuICogICAgZXZlcnkgZm9sbG93aW5nIHlpZWxkIHVudGlsIGl0IGlzIGNhdWdodCwgb3IgdW50aWwgaXQgZXNjYXBlc1xuICogICAgdGhlIGdlbmVyYXRvciBmdW5jdGlvbiBhbHRvZ2V0aGVyLCBhbmQgaXMgdHJhbnNsYXRlZCBpbnRvIGFcbiAqICAgIHJlamVjdGlvbiBmb3IgdGhlIHByb21pc2UgcmV0dXJuZWQgYnkgdGhlIGRlY29yYXRlZCBnZW5lcmF0b3IuXG4gKi9cblEuYXN5bmMgPSBhc3luYztcbmZ1bmN0aW9uIGFzeW5jKG1ha2VHZW5lcmF0b3IpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyB3aGVuIHZlcmIgaXMgXCJzZW5kXCIsIGFyZyBpcyBhIHZhbHVlXG4gICAgICAgIC8vIHdoZW4gdmVyYiBpcyBcInRocm93XCIsIGFyZyBpcyBhbiBleGNlcHRpb25cbiAgICAgICAgZnVuY3Rpb24gY29udGludWVyKHZlcmIsIGFyZykge1xuICAgICAgICAgICAgdmFyIHJlc3VsdDtcblxuICAgICAgICAgICAgLy8gVW50aWwgVjggMy4xOSAvIENocm9taXVtIDI5IGlzIHJlbGVhc2VkLCBTcGlkZXJNb25rZXkgaXMgdGhlIG9ubHlcbiAgICAgICAgICAgIC8vIGVuZ2luZSB0aGF0IGhhcyBhIGRlcGxveWVkIGJhc2Ugb2YgYnJvd3NlcnMgdGhhdCBzdXBwb3J0IGdlbmVyYXRvcnMuXG4gICAgICAgICAgICAvLyBIb3dldmVyLCBTTSdzIGdlbmVyYXRvcnMgdXNlIHRoZSBQeXRob24taW5zcGlyZWQgc2VtYW50aWNzIG9mXG4gICAgICAgICAgICAvLyBvdXRkYXRlZCBFUzYgZHJhZnRzLiAgV2Ugd291bGQgbGlrZSB0byBzdXBwb3J0IEVTNiwgYnV0IHdlJ2QgYWxzb1xuICAgICAgICAgICAgLy8gbGlrZSB0byBtYWtlIGl0IHBvc3NpYmxlIHRvIHVzZSBnZW5lcmF0b3JzIGluIGRlcGxveWVkIGJyb3dzZXJzLCBzb1xuICAgICAgICAgICAgLy8gd2UgYWxzbyBzdXBwb3J0IFB5dGhvbi1zdHlsZSBnZW5lcmF0b3JzLiAgQXQgc29tZSBwb2ludCB3ZSBjYW4gcmVtb3ZlXG4gICAgICAgICAgICAvLyB0aGlzIGJsb2NrLlxuXG4gICAgICAgICAgICBpZiAodHlwZW9mIFN0b3BJdGVyYXRpb24gPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgICAgICAvLyBFUzYgR2VuZXJhdG9yc1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGdlbmVyYXRvclt2ZXJiXShhcmcpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0KGV4Y2VwdGlvbik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0LnZhbHVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB3aGVuKHJlc3VsdC52YWx1ZSwgY2FsbGJhY2ssIGVycmJhY2spO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gU3BpZGVyTW9ua2V5IEdlbmVyYXRvcnNcbiAgICAgICAgICAgICAgICAvLyBGSVhNRTogUmVtb3ZlIHRoaXMgY2FzZSB3aGVuIFNNIGRvZXMgRVM2IGdlbmVyYXRvcnMuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gZ2VuZXJhdG9yW3ZlcmJdKGFyZyk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXhjZXB0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc1N0b3BJdGVyYXRpb24oZXhjZXB0aW9uKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGV4Y2VwdGlvbi52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZWplY3QoZXhjZXB0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gd2hlbihyZXN1bHQsIGNhbGxiYWNrLCBlcnJiYWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB2YXIgZ2VuZXJhdG9yID0gbWFrZUdlbmVyYXRvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB2YXIgY2FsbGJhY2sgPSBjb250aW51ZXIuYmluZChjb250aW51ZXIsIFwibmV4dFwiKTtcbiAgICAgICAgdmFyIGVycmJhY2sgPSBjb250aW51ZXIuYmluZChjb250aW51ZXIsIFwidGhyb3dcIik7XG4gICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgIH07XG59XG5cbi8qKlxuICogVGhlIHNwYXduIGZ1bmN0aW9uIGlzIGEgc21hbGwgd3JhcHBlciBhcm91bmQgYXN5bmMgdGhhdCBpbW1lZGlhdGVseVxuICogY2FsbHMgdGhlIGdlbmVyYXRvciBhbmQgYWxzbyBlbmRzIHRoZSBwcm9taXNlIGNoYWluLCBzbyB0aGF0IGFueVxuICogdW5oYW5kbGVkIGVycm9ycyBhcmUgdGhyb3duIGluc3RlYWQgb2YgZm9yd2FyZGVkIHRvIHRoZSBlcnJvclxuICogaGFuZGxlci4gVGhpcyBpcyB1c2VmdWwgYmVjYXVzZSBpdCdzIGV4dHJlbWVseSBjb21tb24gdG8gcnVuXG4gKiBnZW5lcmF0b3JzIGF0IHRoZSB0b3AtbGV2ZWwgdG8gd29yayB3aXRoIGxpYnJhcmllcy5cbiAqL1xuUS5zcGF3biA9IHNwYXduO1xuZnVuY3Rpb24gc3Bhd24obWFrZUdlbmVyYXRvcikge1xuICAgIFEuZG9uZShRLmFzeW5jKG1ha2VHZW5lcmF0b3IpKCkpO1xufVxuXG4vLyBGSVhNRTogUmVtb3ZlIHRoaXMgaW50ZXJmYWNlIG9uY2UgRVM2IGdlbmVyYXRvcnMgYXJlIGluIFNwaWRlck1vbmtleS5cbi8qKlxuICogVGhyb3dzIGEgUmV0dXJuVmFsdWUgZXhjZXB0aW9uIHRvIHN0b3AgYW4gYXN5bmNocm9ub3VzIGdlbmVyYXRvci5cbiAqXG4gKiBUaGlzIGludGVyZmFjZSBpcyBhIHN0b3AtZ2FwIG1lYXN1cmUgdG8gc3VwcG9ydCBnZW5lcmF0b3IgcmV0dXJuXG4gKiB2YWx1ZXMgaW4gb2xkZXIgRmlyZWZveC9TcGlkZXJNb25rZXkuICBJbiBicm93c2VycyB0aGF0IHN1cHBvcnQgRVM2XG4gKiBnZW5lcmF0b3JzIGxpa2UgQ2hyb21pdW0gMjksIGp1c3QgdXNlIFwicmV0dXJuXCIgaW4geW91ciBnZW5lcmF0b3JcbiAqIGZ1bmN0aW9ucy5cbiAqXG4gKiBAcGFyYW0gdmFsdWUgdGhlIHJldHVybiB2YWx1ZSBmb3IgdGhlIHN1cnJvdW5kaW5nIGdlbmVyYXRvclxuICogQHRocm93cyBSZXR1cm5WYWx1ZSBleGNlcHRpb24gd2l0aCB0aGUgdmFsdWUuXG4gKiBAZXhhbXBsZVxuICogLy8gRVM2IHN0eWxlXG4gKiBRLmFzeW5jKGZ1bmN0aW9uKiAoKSB7XG4gKiAgICAgIHZhciBmb28gPSB5aWVsZCBnZXRGb29Qcm9taXNlKCk7XG4gKiAgICAgIHZhciBiYXIgPSB5aWVsZCBnZXRCYXJQcm9taXNlKCk7XG4gKiAgICAgIHJldHVybiBmb28gKyBiYXI7XG4gKiB9KVxuICogLy8gT2xkZXIgU3BpZGVyTW9ua2V5IHN0eWxlXG4gKiBRLmFzeW5jKGZ1bmN0aW9uICgpIHtcbiAqICAgICAgdmFyIGZvbyA9IHlpZWxkIGdldEZvb1Byb21pc2UoKTtcbiAqICAgICAgdmFyIGJhciA9IHlpZWxkIGdldEJhclByb21pc2UoKTtcbiAqICAgICAgUS5yZXR1cm4oZm9vICsgYmFyKTtcbiAqIH0pXG4gKi9cblFbXCJyZXR1cm5cIl0gPSBfcmV0dXJuO1xuZnVuY3Rpb24gX3JldHVybih2YWx1ZSkge1xuICAgIHRocm93IG5ldyBRUmV0dXJuVmFsdWUodmFsdWUpO1xufVxuXG4vKipcbiAqIFRoZSBwcm9taXNlZCBmdW5jdGlvbiBkZWNvcmF0b3IgZW5zdXJlcyB0aGF0IGFueSBwcm9taXNlIGFyZ3VtZW50c1xuICogYXJlIHNldHRsZWQgYW5kIHBhc3NlZCBhcyB2YWx1ZXMgKGB0aGlzYCBpcyBhbHNvIHNldHRsZWQgYW5kIHBhc3NlZFxuICogYXMgYSB2YWx1ZSkuICBJdCB3aWxsIGFsc28gZW5zdXJlIHRoYXQgdGhlIHJlc3VsdCBvZiBhIGZ1bmN0aW9uIGlzXG4gKiBhbHdheXMgYSBwcm9taXNlLlxuICpcbiAqIEBleGFtcGxlXG4gKiB2YXIgYWRkID0gUS5wcm9taXNlZChmdW5jdGlvbiAoYSwgYikge1xuICogICAgIHJldHVybiBhICsgYjtcbiAqIH0pO1xuICogYWRkKFEoYSksIFEoQikpO1xuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIFRoZSBmdW5jdGlvbiB0byBkZWNvcmF0ZVxuICogQHJldHVybnMge2Z1bmN0aW9ufSBhIGZ1bmN0aW9uIHRoYXQgaGFzIGJlZW4gZGVjb3JhdGVkLlxuICovXG5RLnByb21pc2VkID0gcHJvbWlzZWQ7XG5mdW5jdGlvbiBwcm9taXNlZChjYWxsYmFjaykge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBzcHJlYWQoW3RoaXMsIGFsbChhcmd1bWVudHMpXSwgZnVuY3Rpb24gKHNlbGYsIGFyZ3MpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjay5hcHBseShzZWxmLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbn1cblxuLyoqXG4gKiBzZW5kcyBhIG1lc3NhZ2UgdG8gYSB2YWx1ZSBpbiBhIGZ1dHVyZSB0dXJuXG4gKiBAcGFyYW0gb2JqZWN0KiB0aGUgcmVjaXBpZW50XG4gKiBAcGFyYW0gb3AgdGhlIG5hbWUgb2YgdGhlIG1lc3NhZ2Ugb3BlcmF0aW9uLCBlLmcuLCBcIndoZW5cIixcbiAqIEBwYXJhbSBhcmdzIGZ1cnRoZXIgYXJndW1lbnRzIHRvIGJlIGZvcndhcmRlZCB0byB0aGUgb3BlcmF0aW9uXG4gKiBAcmV0dXJucyByZXN1bHQge1Byb21pc2V9IGEgcHJvbWlzZSBmb3IgdGhlIHJlc3VsdCBvZiB0aGUgb3BlcmF0aW9uXG4gKi9cblEuZGlzcGF0Y2ggPSBkaXNwYXRjaDtcbmZ1bmN0aW9uIGRpc3BhdGNoKG9iamVjdCwgb3AsIGFyZ3MpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLmRpc3BhdGNoKG9wLCBhcmdzKTtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUuZGlzcGF0Y2ggPSBmdW5jdGlvbiAob3AsIGFyZ3MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYucHJvbWlzZURpc3BhdGNoKGRlZmVycmVkLnJlc29sdmUsIG9wLCBhcmdzKTtcbiAgICB9KTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbi8qKlxuICogR2V0cyB0aGUgdmFsdWUgb2YgYSBwcm9wZXJ0eSBpbiBhIGZ1dHVyZSB0dXJuLlxuICogQHBhcmFtIG9iamVjdCAgICBwcm9taXNlIG9yIGltbWVkaWF0ZSByZWZlcmVuY2UgZm9yIHRhcmdldCBvYmplY3RcbiAqIEBwYXJhbSBuYW1lICAgICAgbmFtZSBvZiBwcm9wZXJ0eSB0byBnZXRcbiAqIEByZXR1cm4gcHJvbWlzZSBmb3IgdGhlIHByb3BlcnR5IHZhbHVlXG4gKi9cblEuZ2V0ID0gZnVuY3Rpb24gKG9iamVjdCwga2V5KSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS5kaXNwYXRjaChcImdldFwiLCBba2V5XSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgcmV0dXJuIHRoaXMuZGlzcGF0Y2goXCJnZXRcIiwgW2tleV0pO1xufTtcblxuLyoqXG4gKiBTZXRzIHRoZSB2YWx1ZSBvZiBhIHByb3BlcnR5IGluIGEgZnV0dXJlIHR1cm4uXG4gKiBAcGFyYW0gb2JqZWN0ICAgIHByb21pc2Ugb3IgaW1tZWRpYXRlIHJlZmVyZW5jZSBmb3Igb2JqZWN0IG9iamVjdFxuICogQHBhcmFtIG5hbWUgICAgICBuYW1lIG9mIHByb3BlcnR5IHRvIHNldFxuICogQHBhcmFtIHZhbHVlICAgICBuZXcgdmFsdWUgb2YgcHJvcGVydHlcbiAqIEByZXR1cm4gcHJvbWlzZSBmb3IgdGhlIHJldHVybiB2YWx1ZVxuICovXG5RLnNldCA9IGZ1bmN0aW9uIChvYmplY3QsIGtleSwgdmFsdWUpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLmRpc3BhdGNoKFwic2V0XCIsIFtrZXksIHZhbHVlXSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgIHJldHVybiB0aGlzLmRpc3BhdGNoKFwic2V0XCIsIFtrZXksIHZhbHVlXSk7XG59O1xuXG4vKipcbiAqIERlbGV0ZXMgYSBwcm9wZXJ0eSBpbiBhIGZ1dHVyZSB0dXJuLlxuICogQHBhcmFtIG9iamVjdCAgICBwcm9taXNlIG9yIGltbWVkaWF0ZSByZWZlcmVuY2UgZm9yIHRhcmdldCBvYmplY3RcbiAqIEBwYXJhbSBuYW1lICAgICAgbmFtZSBvZiBwcm9wZXJ0eSB0byBkZWxldGVcbiAqIEByZXR1cm4gcHJvbWlzZSBmb3IgdGhlIHJldHVybiB2YWx1ZVxuICovXG5RLmRlbCA9IC8vIFhYWCBsZWdhY3lcblFbXCJkZWxldGVcIl0gPSBmdW5jdGlvbiAob2JqZWN0LCBrZXkpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLmRpc3BhdGNoKFwiZGVsZXRlXCIsIFtrZXldKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLmRlbCA9IC8vIFhYWCBsZWdhY3lcblByb21pc2UucHJvdG90eXBlW1wiZGVsZXRlXCJdID0gZnVuY3Rpb24gKGtleSkge1xuICAgIHJldHVybiB0aGlzLmRpc3BhdGNoKFwiZGVsZXRlXCIsIFtrZXldKTtcbn07XG5cbi8qKlxuICogSW52b2tlcyBhIG1ldGhvZCBpbiBhIGZ1dHVyZSB0dXJuLlxuICogQHBhcmFtIG9iamVjdCAgICBwcm9taXNlIG9yIGltbWVkaWF0ZSByZWZlcmVuY2UgZm9yIHRhcmdldCBvYmplY3RcbiAqIEBwYXJhbSBuYW1lICAgICAgbmFtZSBvZiBtZXRob2QgdG8gaW52b2tlXG4gKiBAcGFyYW0gdmFsdWUgICAgIGEgdmFsdWUgdG8gcG9zdCwgdHlwaWNhbGx5IGFuIGFycmF5IG9mXG4gKiAgICAgICAgICAgICAgICAgIGludm9jYXRpb24gYXJndW1lbnRzIGZvciBwcm9taXNlcyB0aGF0XG4gKiAgICAgICAgICAgICAgICAgIGFyZSB1bHRpbWF0ZWx5IGJhY2tlZCB3aXRoIGByZXNvbHZlYCB2YWx1ZXMsXG4gKiAgICAgICAgICAgICAgICAgIGFzIG9wcG9zZWQgdG8gdGhvc2UgYmFja2VkIHdpdGggVVJMc1xuICogICAgICAgICAgICAgICAgICB3aGVyZWluIHRoZSBwb3N0ZWQgdmFsdWUgY2FuIGJlIGFueVxuICogICAgICAgICAgICAgICAgICBKU09OIHNlcmlhbGl6YWJsZSBvYmplY3QuXG4gKiBAcmV0dXJuIHByb21pc2UgZm9yIHRoZSByZXR1cm4gdmFsdWVcbiAqL1xuLy8gYm91bmQgbG9jYWxseSBiZWNhdXNlIGl0IGlzIHVzZWQgYnkgb3RoZXIgbWV0aG9kc1xuUS5tYXBwbHkgPSAvLyBYWFggQXMgcHJvcG9zZWQgYnkgXCJSZWRzYW5kcm9cIlxuUS5wb3N0ID0gZnVuY3Rpb24gKG9iamVjdCwgbmFtZSwgYXJncykge1xuICAgIHJldHVybiBRKG9iamVjdCkuZGlzcGF0Y2goXCJwb3N0XCIsIFtuYW1lLCBhcmdzXSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5tYXBwbHkgPSAvLyBYWFggQXMgcHJvcG9zZWQgYnkgXCJSZWRzYW5kcm9cIlxuUHJvbWlzZS5wcm90b3R5cGUucG9zdCA9IGZ1bmN0aW9uIChuYW1lLCBhcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuZGlzcGF0Y2goXCJwb3N0XCIsIFtuYW1lLCBhcmdzXSk7XG59O1xuXG4vKipcbiAqIEludm9rZXMgYSBtZXRob2QgaW4gYSBmdXR1cmUgdHVybi5cbiAqIEBwYXJhbSBvYmplY3QgICAgcHJvbWlzZSBvciBpbW1lZGlhdGUgcmVmZXJlbmNlIGZvciB0YXJnZXQgb2JqZWN0XG4gKiBAcGFyYW0gbmFtZSAgICAgIG5hbWUgb2YgbWV0aG9kIHRvIGludm9rZVxuICogQHBhcmFtIC4uLmFyZ3MgICBhcnJheSBvZiBpbnZvY2F0aW9uIGFyZ3VtZW50c1xuICogQHJldHVybiBwcm9taXNlIGZvciB0aGUgcmV0dXJuIHZhbHVlXG4gKi9cblEuc2VuZCA9IC8vIFhYWCBNYXJrIE1pbGxlcidzIHByb3Bvc2VkIHBhcmxhbmNlXG5RLm1jYWxsID0gLy8gWFhYIEFzIHByb3Bvc2VkIGJ5IFwiUmVkc2FuZHJvXCJcblEuaW52b2tlID0gZnVuY3Rpb24gKG9iamVjdCwgbmFtZSAvKi4uLmFyZ3MqLykge1xuICAgIHJldHVybiBRKG9iamVjdCkuZGlzcGF0Y2goXCJwb3N0XCIsIFtuYW1lLCBhcnJheV9zbGljZShhcmd1bWVudHMsIDIpXSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5zZW5kID0gLy8gWFhYIE1hcmsgTWlsbGVyJ3MgcHJvcG9zZWQgcGFybGFuY2VcblByb21pc2UucHJvdG90eXBlLm1jYWxsID0gLy8gWFhYIEFzIHByb3Bvc2VkIGJ5IFwiUmVkc2FuZHJvXCJcblByb21pc2UucHJvdG90eXBlLmludm9rZSA9IGZ1bmN0aW9uIChuYW1lIC8qLi4uYXJncyovKSB7XG4gICAgcmV0dXJuIHRoaXMuZGlzcGF0Y2goXCJwb3N0XCIsIFtuYW1lLCBhcnJheV9zbGljZShhcmd1bWVudHMsIDEpXSk7XG59O1xuXG4vKipcbiAqIEFwcGxpZXMgdGhlIHByb21pc2VkIGZ1bmN0aW9uIGluIGEgZnV0dXJlIHR1cm4uXG4gKiBAcGFyYW0gb2JqZWN0ICAgIHByb21pc2Ugb3IgaW1tZWRpYXRlIHJlZmVyZW5jZSBmb3IgdGFyZ2V0IGZ1bmN0aW9uXG4gKiBAcGFyYW0gYXJncyAgICAgIGFycmF5IG9mIGFwcGxpY2F0aW9uIGFyZ3VtZW50c1xuICovXG5RLmZhcHBseSA9IGZ1bmN0aW9uIChvYmplY3QsIGFyZ3MpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLmRpc3BhdGNoKFwiYXBwbHlcIiwgW3ZvaWQgMCwgYXJnc10pO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuZmFwcGx5ID0gZnVuY3Rpb24gKGFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy5kaXNwYXRjaChcImFwcGx5XCIsIFt2b2lkIDAsIGFyZ3NdKTtcbn07XG5cbi8qKlxuICogQ2FsbHMgdGhlIHByb21pc2VkIGZ1bmN0aW9uIGluIGEgZnV0dXJlIHR1cm4uXG4gKiBAcGFyYW0gb2JqZWN0ICAgIHByb21pc2Ugb3IgaW1tZWRpYXRlIHJlZmVyZW5jZSBmb3IgdGFyZ2V0IGZ1bmN0aW9uXG4gKiBAcGFyYW0gLi4uYXJncyAgIGFycmF5IG9mIGFwcGxpY2F0aW9uIGFyZ3VtZW50c1xuICovXG5RW1widHJ5XCJdID1cblEuZmNhbGwgPSBmdW5jdGlvbiAob2JqZWN0IC8qIC4uLmFyZ3MqLykge1xuICAgIHJldHVybiBRKG9iamVjdCkuZGlzcGF0Y2goXCJhcHBseVwiLCBbdm9pZCAwLCBhcnJheV9zbGljZShhcmd1bWVudHMsIDEpXSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5mY2FsbCA9IGZ1bmN0aW9uICgvKi4uLmFyZ3MqLykge1xuICAgIHJldHVybiB0aGlzLmRpc3BhdGNoKFwiYXBwbHlcIiwgW3ZvaWQgMCwgYXJyYXlfc2xpY2UoYXJndW1lbnRzKV0pO1xufTtcblxuLyoqXG4gKiBCaW5kcyB0aGUgcHJvbWlzZWQgZnVuY3Rpb24sIHRyYW5zZm9ybWluZyByZXR1cm4gdmFsdWVzIGludG8gYSBmdWxmaWxsZWRcbiAqIHByb21pc2UgYW5kIHRocm93biBlcnJvcnMgaW50byBhIHJlamVjdGVkIG9uZS5cbiAqIEBwYXJhbSBvYmplY3QgICAgcHJvbWlzZSBvciBpbW1lZGlhdGUgcmVmZXJlbmNlIGZvciB0YXJnZXQgZnVuY3Rpb25cbiAqIEBwYXJhbSAuLi5hcmdzICAgYXJyYXkgb2YgYXBwbGljYXRpb24gYXJndW1lbnRzXG4gKi9cblEuZmJpbmQgPSBmdW5jdGlvbiAob2JqZWN0IC8qLi4uYXJncyovKSB7XG4gICAgdmFyIHByb21pc2UgPSBRKG9iamVjdCk7XG4gICAgdmFyIGFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBmdW5jdGlvbiBmYm91bmQoKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlLmRpc3BhdGNoKFwiYXBwbHlcIiwgW1xuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgIGFyZ3MuY29uY2F0KGFycmF5X3NsaWNlKGFyZ3VtZW50cykpXG4gICAgICAgIF0pO1xuICAgIH07XG59O1xuUHJvbWlzZS5wcm90b3R5cGUuZmJpbmQgPSBmdW5jdGlvbiAoLyouLi5hcmdzKi8pIHtcbiAgICB2YXIgcHJvbWlzZSA9IHRoaXM7XG4gICAgdmFyIGFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMpO1xuICAgIHJldHVybiBmdW5jdGlvbiBmYm91bmQoKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlLmRpc3BhdGNoKFwiYXBwbHlcIiwgW1xuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgIGFyZ3MuY29uY2F0KGFycmF5X3NsaWNlKGFyZ3VtZW50cykpXG4gICAgICAgIF0pO1xuICAgIH07XG59O1xuXG4vKipcbiAqIFJlcXVlc3RzIHRoZSBuYW1lcyBvZiB0aGUgb3duZWQgcHJvcGVydGllcyBvZiBhIHByb21pc2VkXG4gKiBvYmplY3QgaW4gYSBmdXR1cmUgdHVybi5cbiAqIEBwYXJhbSBvYmplY3QgICAgcHJvbWlzZSBvciBpbW1lZGlhdGUgcmVmZXJlbmNlIGZvciB0YXJnZXQgb2JqZWN0XG4gKiBAcmV0dXJuIHByb21pc2UgZm9yIHRoZSBrZXlzIG9mIHRoZSBldmVudHVhbGx5IHNldHRsZWQgb2JqZWN0XG4gKi9cblEua2V5cyA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLmRpc3BhdGNoKFwia2V5c1wiLCBbXSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5rZXlzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmRpc3BhdGNoKFwia2V5c1wiLCBbXSk7XG59O1xuXG4vKipcbiAqIFR1cm5zIGFuIGFycmF5IG9mIHByb21pc2VzIGludG8gYSBwcm9taXNlIGZvciBhbiBhcnJheS4gIElmIGFueSBvZlxuICogdGhlIHByb21pc2VzIGdldHMgcmVqZWN0ZWQsIHRoZSB3aG9sZSBhcnJheSBpcyByZWplY3RlZCBpbW1lZGlhdGVseS5cbiAqIEBwYXJhbSB7QXJyYXkqfSBhbiBhcnJheSAob3IgcHJvbWlzZSBmb3IgYW4gYXJyYXkpIG9mIHZhbHVlcyAob3JcbiAqIHByb21pc2VzIGZvciB2YWx1ZXMpXG4gKiBAcmV0dXJucyBhIHByb21pc2UgZm9yIGFuIGFycmF5IG9mIHRoZSBjb3JyZXNwb25kaW5nIHZhbHVlc1xuICovXG4vLyBCeSBNYXJrIE1pbGxlclxuLy8gaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9c3RyYXdtYW46Y29uY3VycmVuY3kmcmV2PTEzMDg3NzY1MjEjYWxsZnVsZmlsbGVkXG5RLmFsbCA9IGFsbDtcbmZ1bmN0aW9uIGFsbChwcm9taXNlcykge1xuICAgIHJldHVybiB3aGVuKHByb21pc2VzLCBmdW5jdGlvbiAocHJvbWlzZXMpIHtcbiAgICAgICAgdmFyIGNvdW50RG93biA9IDA7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IGRlZmVyKCk7XG4gICAgICAgIGFycmF5X3JlZHVjZShwcm9taXNlcywgZnVuY3Rpb24gKHVuZGVmaW5lZCwgcHJvbWlzZSwgaW5kZXgpIHtcbiAgICAgICAgICAgIHZhciBzbmFwc2hvdDtcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBpc1Byb21pc2UocHJvbWlzZSkgJiZcbiAgICAgICAgICAgICAgICAoc25hcHNob3QgPSBwcm9taXNlLmluc3BlY3QoKSkuc3RhdGUgPT09IFwiZnVsZmlsbGVkXCJcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIHByb21pc2VzW2luZGV4XSA9IHNuYXBzaG90LnZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICArK2NvdW50RG93bjtcbiAgICAgICAgICAgICAgICB3aGVuKFxuICAgICAgICAgICAgICAgICAgICBwcm9taXNlLFxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb21pc2VzW2luZGV4XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKC0tY291bnREb3duID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShwcm9taXNlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdCxcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKHByb2dyZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5ub3RpZnkoeyBpbmRleDogaW5kZXgsIHZhbHVlOiBwcm9ncmVzcyB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHZvaWQgMCk7XG4gICAgICAgIGlmIChjb3VudERvd24gPT09IDApIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocHJvbWlzZXMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0pO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5hbGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGFsbCh0aGlzKTtcbn07XG5cbi8qKlxuICogV2FpdHMgZm9yIGFsbCBwcm9taXNlcyB0byBiZSBzZXR0bGVkLCBlaXRoZXIgZnVsZmlsbGVkIG9yXG4gKiByZWplY3RlZC4gIFRoaXMgaXMgZGlzdGluY3QgZnJvbSBgYWxsYCBzaW5jZSB0aGF0IHdvdWxkIHN0b3BcbiAqIHdhaXRpbmcgYXQgdGhlIGZpcnN0IHJlamVjdGlvbi4gIFRoZSBwcm9taXNlIHJldHVybmVkIGJ5XG4gKiBgYWxsUmVzb2x2ZWRgIHdpbGwgbmV2ZXIgYmUgcmVqZWN0ZWQuXG4gKiBAcGFyYW0gcHJvbWlzZXMgYSBwcm9taXNlIGZvciBhbiBhcnJheSAob3IgYW4gYXJyYXkpIG9mIHByb21pc2VzXG4gKiAob3IgdmFsdWVzKVxuICogQHJldHVybiBhIHByb21pc2UgZm9yIGFuIGFycmF5IG9mIHByb21pc2VzXG4gKi9cblEuYWxsUmVzb2x2ZWQgPSBkZXByZWNhdGUoYWxsUmVzb2x2ZWQsIFwiYWxsUmVzb2x2ZWRcIiwgXCJhbGxTZXR0bGVkXCIpO1xuZnVuY3Rpb24gYWxsUmVzb2x2ZWQocHJvbWlzZXMpIHtcbiAgICByZXR1cm4gd2hlbihwcm9taXNlcywgZnVuY3Rpb24gKHByb21pc2VzKSB7XG4gICAgICAgIHByb21pc2VzID0gYXJyYXlfbWFwKHByb21pc2VzLCBRKTtcbiAgICAgICAgcmV0dXJuIHdoZW4oYWxsKGFycmF5X21hcChwcm9taXNlcywgZnVuY3Rpb24gKHByb21pc2UpIHtcbiAgICAgICAgICAgIHJldHVybiB3aGVuKHByb21pc2UsIG5vb3AsIG5vb3ApO1xuICAgICAgICB9KSksIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBwcm9taXNlcztcbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cblByb21pc2UucHJvdG90eXBlLmFsbFJlc29sdmVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBhbGxSZXNvbHZlZCh0aGlzKTtcbn07XG5cbi8qKlxuICogQHNlZSBQcm9taXNlI2FsbFNldHRsZWRcbiAqL1xuUS5hbGxTZXR0bGVkID0gYWxsU2V0dGxlZDtcbmZ1bmN0aW9uIGFsbFNldHRsZWQocHJvbWlzZXMpIHtcbiAgICByZXR1cm4gUShwcm9taXNlcykuYWxsU2V0dGxlZCgpO1xufVxuXG4vKipcbiAqIFR1cm5zIGFuIGFycmF5IG9mIHByb21pc2VzIGludG8gYSBwcm9taXNlIGZvciBhbiBhcnJheSBvZiB0aGVpciBzdGF0ZXMgKGFzXG4gKiByZXR1cm5lZCBieSBgaW5zcGVjdGApIHdoZW4gdGhleSBoYXZlIGFsbCBzZXR0bGVkLlxuICogQHBhcmFtIHtBcnJheVtBbnkqXX0gdmFsdWVzIGFuIGFycmF5IChvciBwcm9taXNlIGZvciBhbiBhcnJheSkgb2YgdmFsdWVzIChvclxuICogcHJvbWlzZXMgZm9yIHZhbHVlcylcbiAqIEByZXR1cm5zIHtBcnJheVtTdGF0ZV19IGFuIGFycmF5IG9mIHN0YXRlcyBmb3IgdGhlIHJlc3BlY3RpdmUgdmFsdWVzLlxuICovXG5Qcm9taXNlLnByb3RvdHlwZS5hbGxTZXR0bGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnRoZW4oZnVuY3Rpb24gKHByb21pc2VzKSB7XG4gICAgICAgIHJldHVybiBhbGwoYXJyYXlfbWFwKHByb21pc2VzLCBmdW5jdGlvbiAocHJvbWlzZSkge1xuICAgICAgICAgICAgcHJvbWlzZSA9IFEocHJvbWlzZSk7XG4gICAgICAgICAgICBmdW5jdGlvbiByZWdhcmRsZXNzKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBwcm9taXNlLmluc3BlY3QoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBwcm9taXNlLnRoZW4ocmVnYXJkbGVzcywgcmVnYXJkbGVzcyk7XG4gICAgICAgIH0pKTtcbiAgICB9KTtcbn07XG5cbi8qKlxuICogQ2FwdHVyZXMgdGhlIGZhaWx1cmUgb2YgYSBwcm9taXNlLCBnaXZpbmcgYW4gb3BvcnR1bml0eSB0byByZWNvdmVyXG4gKiB3aXRoIGEgY2FsbGJhY2suICBJZiB0aGUgZ2l2ZW4gcHJvbWlzZSBpcyBmdWxmaWxsZWQsIHRoZSByZXR1cm5lZFxuICogcHJvbWlzZSBpcyBmdWxmaWxsZWQuXG4gKiBAcGFyYW0ge0FueSp9IHByb21pc2UgZm9yIHNvbWV0aGluZ1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgdG8gZnVsZmlsbCB0aGUgcmV0dXJuZWQgcHJvbWlzZSBpZiB0aGVcbiAqIGdpdmVuIHByb21pc2UgaXMgcmVqZWN0ZWRcbiAqIEByZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgY2FsbGJhY2tcbiAqL1xuUS5mYWlsID0gLy8gWFhYIGxlZ2FjeVxuUVtcImNhdGNoXCJdID0gZnVuY3Rpb24gKG9iamVjdCwgcmVqZWN0ZWQpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLnRoZW4odm9pZCAwLCByZWplY3RlZCk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5mYWlsID0gLy8gWFhYIGxlZ2FjeVxuUHJvbWlzZS5wcm90b3R5cGVbXCJjYXRjaFwiXSA9IGZ1bmN0aW9uIChyZWplY3RlZCkge1xuICAgIHJldHVybiB0aGlzLnRoZW4odm9pZCAwLCByZWplY3RlZCk7XG59O1xuXG4vKipcbiAqIEF0dGFjaGVzIGEgbGlzdGVuZXIgdGhhdCBjYW4gcmVzcG9uZCB0byBwcm9ncmVzcyBub3RpZmljYXRpb25zIGZyb20gYVxuICogcHJvbWlzZSdzIG9yaWdpbmF0aW5nIGRlZmVycmVkLiBUaGlzIGxpc3RlbmVyIHJlY2VpdmVzIHRoZSBleGFjdCBhcmd1bWVudHNcbiAqIHBhc3NlZCB0byBgYGRlZmVycmVkLm5vdGlmeWBgLlxuICogQHBhcmFtIHtBbnkqfSBwcm9taXNlIGZvciBzb21ldGhpbmdcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIHRvIHJlY2VpdmUgYW55IHByb2dyZXNzIG5vdGlmaWNhdGlvbnNcbiAqIEByZXR1cm5zIHRoZSBnaXZlbiBwcm9taXNlLCB1bmNoYW5nZWRcbiAqL1xuUS5wcm9ncmVzcyA9IHByb2dyZXNzO1xuZnVuY3Rpb24gcHJvZ3Jlc3Mob2JqZWN0LCBwcm9ncmVzc2VkKSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS50aGVuKHZvaWQgMCwgdm9pZCAwLCBwcm9ncmVzc2VkKTtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUucHJvZ3Jlc3MgPSBmdW5jdGlvbiAocHJvZ3Jlc3NlZCkge1xuICAgIHJldHVybiB0aGlzLnRoZW4odm9pZCAwLCB2b2lkIDAsIHByb2dyZXNzZWQpO1xufTtcblxuLyoqXG4gKiBQcm92aWRlcyBhbiBvcHBvcnR1bml0eSB0byBvYnNlcnZlIHRoZSBzZXR0bGluZyBvZiBhIHByb21pc2UsXG4gKiByZWdhcmRsZXNzIG9mIHdoZXRoZXIgdGhlIHByb21pc2UgaXMgZnVsZmlsbGVkIG9yIHJlamVjdGVkLiAgRm9yd2FyZHNcbiAqIHRoZSByZXNvbHV0aW9uIHRvIHRoZSByZXR1cm5lZCBwcm9taXNlIHdoZW4gdGhlIGNhbGxiYWNrIGlzIGRvbmUuXG4gKiBUaGUgY2FsbGJhY2sgY2FuIHJldHVybiBhIHByb21pc2UgdG8gZGVmZXIgY29tcGxldGlvbi5cbiAqIEBwYXJhbSB7QW55Kn0gcHJvbWlzZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgdG8gb2JzZXJ2ZSB0aGUgcmVzb2x1dGlvbiBvZiB0aGUgZ2l2ZW5cbiAqIHByb21pc2UsIHRha2VzIG5vIGFyZ3VtZW50cy5cbiAqIEByZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIHJlc29sdXRpb24gb2YgdGhlIGdpdmVuIHByb21pc2Ugd2hlblxuICogYGBmaW5gYCBpcyBkb25lLlxuICovXG5RLmZpbiA9IC8vIFhYWCBsZWdhY3lcblFbXCJmaW5hbGx5XCJdID0gZnVuY3Rpb24gKG9iamVjdCwgY2FsbGJhY2spIHtcbiAgICByZXR1cm4gUShvYmplY3QpW1wiZmluYWxseVwiXShjYWxsYmFjayk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5maW4gPSAvLyBYWFggbGVnYWN5XG5Qcm9taXNlLnByb3RvdHlwZVtcImZpbmFsbHlcIl0gPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICBjYWxsYmFjayA9IFEoY2FsbGJhY2spO1xuICAgIHJldHVybiB0aGlzLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjay5mY2FsbCgpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICB9KTtcbiAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIC8vIFRPRE8gYXR0ZW1wdCB0byByZWN5Y2xlIHRoZSByZWplY3Rpb24gd2l0aCBcInRoaXNcIi5cbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrLmZjYWxsKCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aHJvdyByZWFzb247XG4gICAgICAgIH0pO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKiBUZXJtaW5hdGVzIGEgY2hhaW4gb2YgcHJvbWlzZXMsIGZvcmNpbmcgcmVqZWN0aW9ucyB0byBiZVxuICogdGhyb3duIGFzIGV4Y2VwdGlvbnMuXG4gKiBAcGFyYW0ge0FueSp9IHByb21pc2UgYXQgdGhlIGVuZCBvZiBhIGNoYWluIG9mIHByb21pc2VzXG4gKiBAcmV0dXJucyBub3RoaW5nXG4gKi9cblEuZG9uZSA9IGZ1bmN0aW9uIChvYmplY3QsIGZ1bGZpbGxlZCwgcmVqZWN0ZWQsIHByb2dyZXNzKSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS5kb25lKGZ1bGZpbGxlZCwgcmVqZWN0ZWQsIHByb2dyZXNzKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLmRvbmUgPSBmdW5jdGlvbiAoZnVsZmlsbGVkLCByZWplY3RlZCwgcHJvZ3Jlc3MpIHtcbiAgICB2YXIgb25VbmhhbmRsZWRFcnJvciA9IGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAvLyBmb3J3YXJkIHRvIGEgZnV0dXJlIHR1cm4gc28gdGhhdCBgYHdoZW5gYFxuICAgICAgICAvLyBkb2VzIG5vdCBjYXRjaCBpdCBhbmQgdHVybiBpdCBpbnRvIGEgcmVqZWN0aW9uLlxuICAgICAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBtYWtlU3RhY2tUcmFjZUxvbmcoZXJyb3IsIHByb21pc2UpO1xuICAgICAgICAgICAgaWYgKFEub25lcnJvcikge1xuICAgICAgICAgICAgICAgIFEub25lcnJvcihlcnJvcik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8gQXZvaWQgdW5uZWNlc3NhcnkgYG5leHRUaWNrYGluZyB2aWEgYW4gdW5uZWNlc3NhcnkgYHdoZW5gLlxuICAgIHZhciBwcm9taXNlID0gZnVsZmlsbGVkIHx8IHJlamVjdGVkIHx8IHByb2dyZXNzID9cbiAgICAgICAgdGhpcy50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQsIHByb2dyZXNzKSA6XG4gICAgICAgIHRoaXM7XG5cbiAgICBpZiAodHlwZW9mIHByb2Nlc3MgPT09IFwib2JqZWN0XCIgJiYgcHJvY2VzcyAmJiBwcm9jZXNzLmRvbWFpbikge1xuICAgICAgICBvblVuaGFuZGxlZEVycm9yID0gcHJvY2Vzcy5kb21haW4uYmluZChvblVuaGFuZGxlZEVycm9yKTtcbiAgICB9XG5cbiAgICBwcm9taXNlLnRoZW4odm9pZCAwLCBvblVuaGFuZGxlZEVycm9yKTtcbn07XG5cbi8qKlxuICogQ2F1c2VzIGEgcHJvbWlzZSB0byBiZSByZWplY3RlZCBpZiBpdCBkb2VzIG5vdCBnZXQgZnVsZmlsbGVkIGJlZm9yZVxuICogc29tZSBtaWxsaXNlY29uZHMgdGltZSBvdXQuXG4gKiBAcGFyYW0ge0FueSp9IHByb21pc2VcbiAqIEBwYXJhbSB7TnVtYmVyfSBtaWxsaXNlY29uZHMgdGltZW91dFxuICogQHBhcmFtIHtTdHJpbmd9IGN1c3RvbSBlcnJvciBtZXNzYWdlIChvcHRpb25hbClcbiAqIEByZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIHJlc29sdXRpb24gb2YgdGhlIGdpdmVuIHByb21pc2UgaWYgaXQgaXNcbiAqIGZ1bGZpbGxlZCBiZWZvcmUgdGhlIHRpbWVvdXQsIG90aGVyd2lzZSByZWplY3RlZC5cbiAqL1xuUS50aW1lb3V0ID0gZnVuY3Rpb24gKG9iamVjdCwgbXMsIG1lc3NhZ2UpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLnRpbWVvdXQobXMsIG1lc3NhZ2UpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUudGltZW91dCA9IGZ1bmN0aW9uIChtcywgbWVzc2FnZSkge1xuICAgIHZhciBkZWZlcnJlZCA9IGRlZmVyKCk7XG4gICAgdmFyIHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICBkZWZlcnJlZC5yZWplY3QobmV3IEVycm9yKG1lc3NhZ2UgfHwgXCJUaW1lZCBvdXQgYWZ0ZXIgXCIgKyBtcyArIFwiIG1zXCIpKTtcbiAgICB9LCBtcyk7XG5cbiAgICB0aGlzLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHZhbHVlKTtcbiAgICB9LCBmdW5jdGlvbiAoZXhjZXB0aW9uKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXhjZXB0aW9uKTtcbiAgICB9LCBkZWZlcnJlZC5ub3RpZnkpO1xuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG4vKipcbiAqIFJldHVybnMgYSBwcm9taXNlIGZvciB0aGUgZ2l2ZW4gdmFsdWUgKG9yIHByb21pc2VkIHZhbHVlKSwgc29tZVxuICogbWlsbGlzZWNvbmRzIGFmdGVyIGl0IHJlc29sdmVkLiBQYXNzZXMgcmVqZWN0aW9ucyBpbW1lZGlhdGVseS5cbiAqIEBwYXJhbSB7QW55Kn0gcHJvbWlzZVxuICogQHBhcmFtIHtOdW1iZXJ9IG1pbGxpc2Vjb25kc1xuICogQHJldHVybnMgYSBwcm9taXNlIGZvciB0aGUgcmVzb2x1dGlvbiBvZiB0aGUgZ2l2ZW4gcHJvbWlzZSBhZnRlciBtaWxsaXNlY29uZHNcbiAqIHRpbWUgaGFzIGVsYXBzZWQgc2luY2UgdGhlIHJlc29sdXRpb24gb2YgdGhlIGdpdmVuIHByb21pc2UuXG4gKiBJZiB0aGUgZ2l2ZW4gcHJvbWlzZSByZWplY3RzLCB0aGF0IGlzIHBhc3NlZCBpbW1lZGlhdGVseS5cbiAqL1xuUS5kZWxheSA9IGZ1bmN0aW9uIChvYmplY3QsIHRpbWVvdXQpIHtcbiAgICBpZiAodGltZW91dCA9PT0gdm9pZCAwKSB7XG4gICAgICAgIHRpbWVvdXQgPSBvYmplY3Q7XG4gICAgICAgIG9iamVjdCA9IHZvaWQgMDtcbiAgICB9XG4gICAgcmV0dXJuIFEob2JqZWN0KS5kZWxheSh0aW1lb3V0KTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLmRlbGF5ID0gZnVuY3Rpb24gKHRpbWVvdXQpIHtcbiAgICByZXR1cm4gdGhpcy50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUodmFsdWUpO1xuICAgICAgICB9LCB0aW1lb3V0KTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIFBhc3NlcyBhIGNvbnRpbnVhdGlvbiB0byBhIE5vZGUgZnVuY3Rpb24sIHdoaWNoIGlzIGNhbGxlZCB3aXRoIHRoZSBnaXZlblxuICogYXJndW1lbnRzIHByb3ZpZGVkIGFzIGFuIGFycmF5LCBhbmQgcmV0dXJucyBhIHByb21pc2UuXG4gKlxuICogICAgICBRLm5mYXBwbHkoRlMucmVhZEZpbGUsIFtfX2ZpbGVuYW1lXSlcbiAqICAgICAgLnRoZW4oZnVuY3Rpb24gKGNvbnRlbnQpIHtcbiAqICAgICAgfSlcbiAqXG4gKi9cblEubmZhcHBseSA9IGZ1bmN0aW9uIChjYWxsYmFjaywgYXJncykge1xuICAgIHJldHVybiBRKGNhbGxiYWNrKS5uZmFwcGx5KGFyZ3MpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUubmZhcHBseSA9IGZ1bmN0aW9uIChhcmdzKSB7XG4gICAgdmFyIGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICB2YXIgbm9kZUFyZ3MgPSBhcnJheV9zbGljZShhcmdzKTtcbiAgICBub2RlQXJncy5wdXNoKGRlZmVycmVkLm1ha2VOb2RlUmVzb2x2ZXIoKSk7XG4gICAgdGhpcy5mYXBwbHkobm9kZUFyZ3MpLmZhaWwoZGVmZXJyZWQucmVqZWN0KTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbi8qKlxuICogUGFzc2VzIGEgY29udGludWF0aW9uIHRvIGEgTm9kZSBmdW5jdGlvbiwgd2hpY2ggaXMgY2FsbGVkIHdpdGggdGhlIGdpdmVuXG4gKiBhcmd1bWVudHMgcHJvdmlkZWQgaW5kaXZpZHVhbGx5LCBhbmQgcmV0dXJucyBhIHByb21pc2UuXG4gKiBAZXhhbXBsZVxuICogUS5uZmNhbGwoRlMucmVhZEZpbGUsIF9fZmlsZW5hbWUpXG4gKiAudGhlbihmdW5jdGlvbiAoY29udGVudCkge1xuICogfSlcbiAqXG4gKi9cblEubmZjYWxsID0gZnVuY3Rpb24gKGNhbGxiYWNrIC8qLi4uYXJncyovKSB7XG4gICAgdmFyIGFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBRKGNhbGxiYWNrKS5uZmFwcGx5KGFyZ3MpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUubmZjYWxsID0gZnVuY3Rpb24gKC8qLi4uYXJncyovKSB7XG4gICAgdmFyIG5vZGVBcmdzID0gYXJyYXlfc2xpY2UoYXJndW1lbnRzKTtcbiAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgIG5vZGVBcmdzLnB1c2goZGVmZXJyZWQubWFrZU5vZGVSZXNvbHZlcigpKTtcbiAgICB0aGlzLmZhcHBseShub2RlQXJncykuZmFpbChkZWZlcnJlZC5yZWplY3QpO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuLyoqXG4gKiBXcmFwcyBhIE5vZGVKUyBjb250aW51YXRpb24gcGFzc2luZyBmdW5jdGlvbiBhbmQgcmV0dXJucyBhbiBlcXVpdmFsZW50XG4gKiB2ZXJzaW9uIHRoYXQgcmV0dXJucyBhIHByb21pc2UuXG4gKiBAZXhhbXBsZVxuICogUS5uZmJpbmQoRlMucmVhZEZpbGUsIF9fZmlsZW5hbWUpKFwidXRmLThcIilcbiAqIC50aGVuKGNvbnNvbGUubG9nKVxuICogLmRvbmUoKVxuICovXG5RLm5mYmluZCA9XG5RLmRlbm9kZWlmeSA9IGZ1bmN0aW9uIChjYWxsYmFjayAvKi4uLmFyZ3MqLykge1xuICAgIHZhciBiYXNlQXJncyA9IGFycmF5X3NsaWNlKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIG5vZGVBcmdzID0gYmFzZUFyZ3MuY29uY2F0KGFycmF5X3NsaWNlKGFyZ3VtZW50cykpO1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgICAgICBub2RlQXJncy5wdXNoKGRlZmVycmVkLm1ha2VOb2RlUmVzb2x2ZXIoKSk7XG4gICAgICAgIFEoY2FsbGJhY2spLmZhcHBseShub2RlQXJncykuZmFpbChkZWZlcnJlZC5yZWplY3QpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUubmZiaW5kID1cblByb21pc2UucHJvdG90eXBlLmRlbm9kZWlmeSA9IGZ1bmN0aW9uICgvKi4uLmFyZ3MqLykge1xuICAgIHZhciBhcmdzID0gYXJyYXlfc2xpY2UoYXJndW1lbnRzKTtcbiAgICBhcmdzLnVuc2hpZnQodGhpcyk7XG4gICAgcmV0dXJuIFEuZGVub2RlaWZ5LmFwcGx5KHZvaWQgMCwgYXJncyk7XG59O1xuXG5RLm5iaW5kID0gZnVuY3Rpb24gKGNhbGxiYWNrLCB0aGlzcCAvKi4uLmFyZ3MqLykge1xuICAgIHZhciBiYXNlQXJncyA9IGFycmF5X3NsaWNlKGFyZ3VtZW50cywgMik7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIG5vZGVBcmdzID0gYmFzZUFyZ3MuY29uY2F0KGFycmF5X3NsaWNlKGFyZ3VtZW50cykpO1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgICAgICBub2RlQXJncy5wdXNoKGRlZmVycmVkLm1ha2VOb2RlUmVzb2x2ZXIoKSk7XG4gICAgICAgIGZ1bmN0aW9uIGJvdW5kKCkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrLmFwcGx5KHRoaXNwLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG4gICAgICAgIFEoYm91bmQpLmZhcHBseShub2RlQXJncykuZmFpbChkZWZlcnJlZC5yZWplY3QpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUubmJpbmQgPSBmdW5jdGlvbiAoLyp0aGlzcCwgLi4uYXJncyovKSB7XG4gICAgdmFyIGFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMsIDApO1xuICAgIGFyZ3MudW5zaGlmdCh0aGlzKTtcbiAgICByZXR1cm4gUS5uYmluZC5hcHBseSh2b2lkIDAsIGFyZ3MpO1xufTtcblxuLyoqXG4gKiBDYWxscyBhIG1ldGhvZCBvZiBhIE5vZGUtc3R5bGUgb2JqZWN0IHRoYXQgYWNjZXB0cyBhIE5vZGUtc3R5bGVcbiAqIGNhbGxiYWNrIHdpdGggYSBnaXZlbiBhcnJheSBvZiBhcmd1bWVudHMsIHBsdXMgYSBwcm92aWRlZCBjYWxsYmFjay5cbiAqIEBwYXJhbSBvYmplY3QgYW4gb2JqZWN0IHRoYXQgaGFzIHRoZSBuYW1lZCBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG5hbWUgb2YgdGhlIG1ldGhvZCBvZiBvYmplY3RcbiAqIEBwYXJhbSB7QXJyYXl9IGFyZ3MgYXJndW1lbnRzIHRvIHBhc3MgdG8gdGhlIG1ldGhvZDsgdGhlIGNhbGxiYWNrXG4gKiB3aWxsIGJlIHByb3ZpZGVkIGJ5IFEgYW5kIGFwcGVuZGVkIHRvIHRoZXNlIGFyZ3VtZW50cy5cbiAqIEByZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIHZhbHVlIG9yIGVycm9yXG4gKi9cblEubm1hcHBseSA9IC8vIFhYWCBBcyBwcm9wb3NlZCBieSBcIlJlZHNhbmRyb1wiXG5RLm5wb3N0ID0gZnVuY3Rpb24gKG9iamVjdCwgbmFtZSwgYXJncykge1xuICAgIHJldHVybiBRKG9iamVjdCkubnBvc3QobmFtZSwgYXJncyk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5ubWFwcGx5ID0gLy8gWFhYIEFzIHByb3Bvc2VkIGJ5IFwiUmVkc2FuZHJvXCJcblByb21pc2UucHJvdG90eXBlLm5wb3N0ID0gZnVuY3Rpb24gKG5hbWUsIGFyZ3MpIHtcbiAgICB2YXIgbm9kZUFyZ3MgPSBhcnJheV9zbGljZShhcmdzIHx8IFtdKTtcbiAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgIG5vZGVBcmdzLnB1c2goZGVmZXJyZWQubWFrZU5vZGVSZXNvbHZlcigpKTtcbiAgICB0aGlzLmRpc3BhdGNoKFwicG9zdFwiLCBbbmFtZSwgbm9kZUFyZ3NdKS5mYWlsKGRlZmVycmVkLnJlamVjdCk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG4vKipcbiAqIENhbGxzIGEgbWV0aG9kIG9mIGEgTm9kZS1zdHlsZSBvYmplY3QgdGhhdCBhY2NlcHRzIGEgTm9kZS1zdHlsZVxuICogY2FsbGJhY2ssIGZvcndhcmRpbmcgdGhlIGdpdmVuIHZhcmlhZGljIGFyZ3VtZW50cywgcGx1cyBhIHByb3ZpZGVkXG4gKiBjYWxsYmFjayBhcmd1bWVudC5cbiAqIEBwYXJhbSBvYmplY3QgYW4gb2JqZWN0IHRoYXQgaGFzIHRoZSBuYW1lZCBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG5hbWUgb2YgdGhlIG1ldGhvZCBvZiBvYmplY3RcbiAqIEBwYXJhbSAuLi5hcmdzIGFyZ3VtZW50cyB0byBwYXNzIHRvIHRoZSBtZXRob2Q7IHRoZSBjYWxsYmFjayB3aWxsXG4gKiBiZSBwcm92aWRlZCBieSBRIGFuZCBhcHBlbmRlZCB0byB0aGVzZSBhcmd1bWVudHMuXG4gKiBAcmV0dXJucyBhIHByb21pc2UgZm9yIHRoZSB2YWx1ZSBvciBlcnJvclxuICovXG5RLm5zZW5kID0gLy8gWFhYIEJhc2VkIG9uIE1hcmsgTWlsbGVyJ3MgcHJvcG9zZWQgXCJzZW5kXCJcblEubm1jYWxsID0gLy8gWFhYIEJhc2VkIG9uIFwiUmVkc2FuZHJvJ3NcIiBwcm9wb3NhbFxuUS5uaW52b2tlID0gZnVuY3Rpb24gKG9iamVjdCwgbmFtZSAvKi4uLmFyZ3MqLykge1xuICAgIHZhciBub2RlQXJncyA9IGFycmF5X3NsaWNlKGFyZ3VtZW50cywgMik7XG4gICAgdmFyIGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICBub2RlQXJncy5wdXNoKGRlZmVycmVkLm1ha2VOb2RlUmVzb2x2ZXIoKSk7XG4gICAgUShvYmplY3QpLmRpc3BhdGNoKFwicG9zdFwiLCBbbmFtZSwgbm9kZUFyZ3NdKS5mYWlsKGRlZmVycmVkLnJlamVjdCk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5uc2VuZCA9IC8vIFhYWCBCYXNlZCBvbiBNYXJrIE1pbGxlcidzIHByb3Bvc2VkIFwic2VuZFwiXG5Qcm9taXNlLnByb3RvdHlwZS5ubWNhbGwgPSAvLyBYWFggQmFzZWQgb24gXCJSZWRzYW5kcm8nc1wiIHByb3Bvc2FsXG5Qcm9taXNlLnByb3RvdHlwZS5uaW52b2tlID0gZnVuY3Rpb24gKG5hbWUgLyouLi5hcmdzKi8pIHtcbiAgICB2YXIgbm9kZUFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMsIDEpO1xuICAgIHZhciBkZWZlcnJlZCA9IGRlZmVyKCk7XG4gICAgbm9kZUFyZ3MucHVzaChkZWZlcnJlZC5tYWtlTm9kZVJlc29sdmVyKCkpO1xuICAgIHRoaXMuZGlzcGF0Y2goXCJwb3N0XCIsIFtuYW1lLCBub2RlQXJnc10pLmZhaWwoZGVmZXJyZWQucmVqZWN0KTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbi8qKlxuICogSWYgYSBmdW5jdGlvbiB3b3VsZCBsaWtlIHRvIHN1cHBvcnQgYm90aCBOb2RlIGNvbnRpbnVhdGlvbi1wYXNzaW5nLXN0eWxlIGFuZFxuICogcHJvbWlzZS1yZXR1cm5pbmctc3R5bGUsIGl0IGNhbiBlbmQgaXRzIGludGVybmFsIHByb21pc2UgY2hhaW4gd2l0aFxuICogYG5vZGVpZnkobm9kZWJhY2spYCwgZm9yd2FyZGluZyB0aGUgb3B0aW9uYWwgbm9kZWJhY2sgYXJndW1lbnQuICBJZiB0aGUgdXNlclxuICogZWxlY3RzIHRvIHVzZSBhIG5vZGViYWNrLCB0aGUgcmVzdWx0IHdpbGwgYmUgc2VudCB0aGVyZS4gIElmIHRoZXkgZG8gbm90XG4gKiBwYXNzIGEgbm9kZWJhY2ssIHRoZXkgd2lsbCByZWNlaXZlIHRoZSByZXN1bHQgcHJvbWlzZS5cbiAqIEBwYXJhbSBvYmplY3QgYSByZXN1bHQgKG9yIGEgcHJvbWlzZSBmb3IgYSByZXN1bHQpXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBub2RlYmFjayBhIE5vZGUuanMtc3R5bGUgY2FsbGJhY2tcbiAqIEByZXR1cm5zIGVpdGhlciB0aGUgcHJvbWlzZSBvciBub3RoaW5nXG4gKi9cblEubm9kZWlmeSA9IG5vZGVpZnk7XG5mdW5jdGlvbiBub2RlaWZ5KG9iamVjdCwgbm9kZWJhY2spIHtcbiAgICByZXR1cm4gUShvYmplY3QpLm5vZGVpZnkobm9kZWJhY2spO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5ub2RlaWZ5ID0gZnVuY3Rpb24gKG5vZGViYWNrKSB7XG4gICAgaWYgKG5vZGViYWNrKSB7XG4gICAgICAgIHRoaXMudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBub2RlYmFjayhudWxsLCB2YWx1ZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgbm9kZWJhY2soZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn07XG5cbi8vIEFsbCBjb2RlIGJlZm9yZSB0aGlzIHBvaW50IHdpbGwgYmUgZmlsdGVyZWQgZnJvbSBzdGFjayB0cmFjZXMuXG52YXIgcUVuZGluZ0xpbmUgPSBjYXB0dXJlTGluZSgpO1xuXG5yZXR1cm4gUTtcblxufSk7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKCdfcHJvY2VzcycpKSIsInZhciBRID0gcmVxdWlyZSgncScpO1xudmFyIEZpcmViYXNlID0gcmVxdWlyZSgnY2xpZW50LWZpcmViYXNlJyk7XG5cbmZ1bmN0aW9uIEZpcmViYXNlQWRhcHRvcih1cmwpIHtcbiAgdGhpcy5iYXNlcmVmID0gbmV3IEZpcmViYXNlKHVybCk7XG59XG5GaXJlYmFzZUFkYXB0b3IucHJvdG90eXBlID0ge1xuICBjb25zdHJ1Y3RvcjogRmlyZWJhc2VBZGFwdG9yLFxuICBvbmNlOiBmdW5jdGlvbihwcm9wZXJ0eSkge1xuICAgIHZhciBkZWZlcnJlZCA9IFEuZGVmZXIoKTtcbiAgICB0aGlzLmJhc2VyZWYuY2hpbGQocHJvcGVydHkpLm9uY2UoJ3ZhbHVlJywgdGhpcy5fcmVzb2x2ZVByb21pc2VXaXRoU25hcHNob3RWYWx1ZS5iaW5kKHRoaXMsIGRlZmVycmVkKSk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gIH0sXG4gIG9uQ2hhbmdlOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHRoaXMuYmFzZXJlZi5vbignY2hpbGRfY2hhbmdlZCcsIHRoaXMuX2NhbGxDYWxsYmFja1dpdGhTbmFwc2hvdFZhbHVlLmJpbmQodGhpcywgY2FsbGJhY2spKTtcbiAgfSxcbiAgX3Jlc29sdmVQcm9taXNlV2l0aFNuYXBzaG90VmFsdWU6IGZ1bmN0aW9uKGRlZmVycmVkLCBzbmFwc2hvdCkge1xuICAgIGRlZmVycmVkLnJlc29sdmUoc25hcHNob3QudmFsKCkpO1xuICB9LFxuICBfY2FsbENhbGxiYWNrV2l0aFNuYXBzaG90VmFsdWU6IGZ1bmN0aW9uKGNhbGxiYWNrLCBzbmFwc2hvdCkge1xuICAgIGNhbGxiYWNrKHNuYXBzaG90Lm5hbWUoKSwgc25hcHNob3QudmFsKCkpO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZpcmViYXNlQWRhcHRvcjsiLCJ2YXIgUSA9IHJlcXVpcmUoJ3EnKTtcblxuZnVuY3Rpb24gTWFwcGVyKHN0b3JlLCBtYXAsIHVwZGF0ZWFibGUpIHtcbiAgdGhpcy5zdG9yZSA9IHN0b3JlO1xuICB0aGlzLm1hcCA9IG1hcDtcbiAgdGhpcy52aWV3TW9kZWwgPSB7fTtcbiAgdGhpcy5kZXBlbmRlbmN5TWFwID0ge307XG4gIGlmKHVwZGF0ZWFibGUpIHtcbiAgICB0aGlzLmJpbmQoKTtcbiAgfVxufVxuTWFwcGVyLnByb3RvdHlwZSA9IHtcbiAgY29uc3RydWN0b3I6IE1hcHBlcixcbiAgZ2V0Vmlld01vZGVsOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5pbml0TWFwKClcbiAgICAgICAgICAgIC50aGVuKHRoaXMuaW5pdERlcGVuZGFudHMuYmluZCh0aGlzKSlcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICByZXR1cm4gdGhpcy52aWV3TW9kZWw7XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBpbml0TWFwOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gUS5hbGwoT2JqZWN0LmtleXModGhpcy5tYXApLm1hcCh0aGlzLmluaXRNYXBwaW5nLmJpbmQodGhpcykpKTtcbiAgfSxcbiAgaW5pdE1hcHBpbmc6IGZ1bmN0aW9uKHBhdGgpIHtcbiAgICB2YXIgbWFwcGluZyA9IHRoaXMubWFwW3BhdGhdO1xuICAgIGlmKHR5cGVvZiBtYXBwaW5nID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIHRoaXMuc3RvcmUub25jZShwYXRoKS50aGVuKHRoaXMuc2V0T25WaWV3TW9kZWwuYmluZCh0aGlzLCBwYXRoKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJEZXBlbmRlbmNpZXMocGF0aCwgbWFwcGluZyk7XG4gICAgICByZXR1cm4gUSgpO1xuICAgIH1cbiAgfSxcbiAgZ2V0RnJvbVZpZXdNb2RlbDogZnVuY3Rpb24ocGF0aCkge1xuICAgIHJldHVybiB0aGlzLnZpZXdNb2RlbFtwYXRoXTtcbiAgfSxcbiAgc2V0T25WaWV3TW9kZWw6IGZ1bmN0aW9uKHBhdGgsIHZhbHVlKSB7XG4gICAgdGhpcy52aWV3TW9kZWxbcGF0aF0gPSB2YWx1ZTtcbiAgICB0aGlzLnVwZGF0ZURlcGVuZGFudHNGb3IocGF0aCk7XG4gIH0sXG4gIHVwZGF0ZURlcGVuZGFudHNGb3I6IGZ1bmN0aW9uKHBhdGgpIHtcbiAgICBpZih0aGlzLmRlcGVuZGVuY3lNYXBbcGF0aF0pIHtcbiAgICAgIHRoaXMuZGVwZW5kZW5jeU1hcFtwYXRoXS5mb3JFYWNoKHRoaXMuc2V0RGVwZW5kZW50LmJpbmQodGhpcykpO1xuICAgIH1cbiAgfSxcbiAgcmVnaXN0ZXJEZXBlbmRlbmNpZXM6IGZ1bmN0aW9uKHBhdGgsIG1hcHBpbmcpIHtcbiAgICB2YXIgY2FsbGJhY2sgPSBtYXBwaW5nLnBvcCgpO1xuICAgIG1hcHBpbmcuZm9yRWFjaCh0aGlzLnJlZ2lzdGVyRGVwZW5kZW5jeS5iaW5kKHRoaXMsIHtcbiAgICAgIHByb3A6IHBhdGgsXG4gICAgICBjYjogY2FsbGJhY2ssXG4gICAgICBkZXBzOiBtYXBwaW5nXG4gICAgfSkpO1xuICB9LFxuICByZWdpc3RlckRlcGVuZGVuY3k6IGZ1bmN0aW9uKHJlbGF0aW9uc2hpcCwgZGVwZW5kZW5jeSkge1xuICAgIGlmKCF0aGlzLmRlcGVuZGVuY3lNYXBbZGVwZW5kZW5jeV0pIHtcbiAgICAgIHRoaXMuZGVwZW5kZW5jeU1hcFtkZXBlbmRlbmN5XSA9IFtdO1xuICAgIH1cbiAgICB0aGlzLmRlcGVuZGVuY3lNYXBbZGVwZW5kZW5jeV0ucHVzaChyZWxhdGlvbnNoaXApO1xuICB9LFxuICBpbml0RGVwZW5kYW50czogZnVuY3Rpb24oKSB7XG4gICAgT2JqZWN0LmtleXModGhpcy5kZXBlbmRlbmN5TWFwKS5mb3JFYWNoKHRoaXMuc2V0RGVwZW5kZW50cy5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgc2V0RGVwZW5kZW50czogZnVuY3Rpb24oZGVwKSB7XG4gICAgdGhpcy5kZXBlbmRlbmN5TWFwW2RlcF0uZm9yRWFjaCh0aGlzLnNldERlcGVuZGVudC5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgc2V0RGVwZW5kZW50OiBmdW5jdGlvbihyZWxhdGlvbnNoaXApIHtcbiAgICB0aGlzLnNldE9uVmlld01vZGVsKHJlbGF0aW9uc2hpcC5wcm9wLCByZWxhdGlvbnNoaXAuY2IuYXBwbHkodGhpcywgcmVsYXRpb25zaGlwLmRlcHMubWFwKHRoaXMuZ2V0RnJvbVZpZXdNb2RlbC5iaW5kKHRoaXMpKSkpO1xuICB9LFxuICBiaW5kOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnN0b3JlLm9uQ2hhbmdlKHRoaXMub25TdG9yZUNoYW5nZS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgb25TdG9yZUNoYW5nZTogZnVuY3Rpb24ocGF0aCwgdmFsdWUpIHtcbiAgICB0aGlzLnNldE9uVmlld01vZGVsKHBhdGgsIHZhbHVlKTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBNYXBwZXI7IiwiZnVuY3Rpb24gV2Fsa2VyT2JqZWN0KHBhdGgpIHtcbiAgdGhpcy5pbml0aWFsUGFyYW1zID0gW3BhdGggfHwgW11dO1xuICB0aGlzLl9zdGFjayA9IFtdO1xufTtcbldhbGtlck9iamVjdC5wcm90b3R5cGUgPSB7XG4gIGNvbnN0cnVjdG9yOiBXYWxrZXJPYmplY3QsXG4gIGNoaWxkOiBmdW5jdGlvbihjYiwgbm9kZSwgcGF0aCkge1xuICAgIHZhciBuZXh0O1xuICAgIGlmKHR5cGVvZiBub2RlID09PSAnb2JqZWN0Jykge1xuICAgICAgaWYoQXJyYXkuaXNBcnJheShub2RlKSkge1xuICAgICAgICB0aGlzLl9zdGFjay51bnNoaWZ0KG5vZGUubWFwKGZ1bmN0aW9uKHZhbCwga2V5KSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGtleToga2V5LFxuICAgICAgICAgICAgdmFsOiB2YWxcbiAgICAgICAgICB9O1xuICAgICAgICB9KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9zdGFjay51bnNoaWZ0KE9iamVjdC5rZXlzKG5vZGUpLm1hcChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAga2V5OiBrZXksXG4gICAgICAgICAgICB2YWw6IG5vZGVba2V5XVxuICAgICAgICAgIH07XG4gICAgICAgIH0pKTtcbiAgICAgIH1cbiAgICAgIG5leHQgPSB0aGlzLl9zdGFja1swXS5zaGlmdCgpO1xuICAgIH1cbiAgICBpZihuZXh0KSB7XG4gICAgICBjYihuZXh0LnZhbCwgcGF0aC5jb25jYXQobmV4dC5rZXkpKTtcbiAgICB9XG4gIH0sXG4gIHNpYmxpbmc6IGZ1bmN0aW9uKGNiLCBub2RlLCBwYXRoKSB7XG4gICAgdmFyIG5leHQ7XG4gICAgaWYodGhpcy5fc3RhY2subGVuZ3RoKSB7XG4gICAgICB2YXIgbGV2ZWwgPSB0aGlzLl9zdGFja1swXTtcbiAgICAgIGlmKGxldmVsLmxlbmd0aCkge1xuICAgICAgICBuZXh0ID0gbGV2ZWwuc2hpZnQoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3N0YWNrLnNoaWZ0KCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKG5leHQpIHtcbiAgICAgIHBhdGgucG9wKCk7XG4gICAgICBjYihuZXh0LnZhbCwgcGF0aC5jb25jYXQobmV4dC5rZXkpKTtcbiAgICB9XG4gIH1cbn07XG5tb2R1bGUuZXhwb3J0cyA9IFdhbGtlck9iamVjdDsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGFkYXB0b3IsIHJvb3Rub2RlLCBjYWxsYmFjaykge1xuXG4gIGZ1bmN0aW9uIHdhbGtlcihub2RlKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDApO1xuICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIGFkYXB0b3IuY2hpbGQuYmluZChhZGFwdG9yLCB3YWxrZXIpLmFwcGx5KGFkYXB0b3IsIGFyZ3MpO1xuICAgIGFkYXB0b3Iuc2libGluZy5iaW5kKGFkYXB0b3IsIHdhbGtlcikuYXBwbHkoYWRhcHRvciwgYXJncyk7XG4gIH1cblxuICB3YWxrZXIuYmluZCh0aGlzLCByb290bm9kZSkuYXBwbHkodGhpcywgYWRhcHRvci5pbml0aWFsUGFyYW1zIHx8IFtdKTtcblxufTsiLCJ2YXIgd2Fsa2VyID0gcmVxdWlyZSgnd2Fsa2VyJyk7XG52YXIgV2Fsa2VyT2JqZWN0ID0gcmVxdWlyZSgnd2Fsa2VyLW9iamVjdCcpO1xuXG5mdW5jdGlvbiBnZXRGdWxsUGF0aChwYXRoLCBrZXkpIHtcbiAgcmV0dXJuIHBhdGguY29uY2F0KGtleSk7XG59XG5cbmZ1bmN0aW9uIG9uQ2hhbmdlKG9iaiwgcGF0aCwgY2IsIGNoYW5nZXMpIHtcbiAgdmFyIGNoYW5nZSwgY1BhdGgsIGNUeXBlLCBjT2xkLCBjTmV3O1xuICB3aGlsZShjaGFuZ2VzLmxlbmd0aCkge1xuICAgIGNoYW5nZSA9IGNoYW5nZXMuc2hpZnQoKTtcbiAgICBjUGF0aCA9IGdldEZ1bGxQYXRoKHBhdGgsIGNoYW5nZS5uYW1lKTtcbiAgICBjVHlwZSA9IGNoYW5nZS50eXBlO1xuICAgIGNPbGQgPSBjaGFuZ2Uub2xkVmFsdWU7XG4gICAgc3dpdGNoKGNoYW5nZS50eXBlKSB7XG4gICAgICBjYXNlICdhZGQnOlxuICAgICAgY2FzZSAndXBkYXRlJzpcbiAgICAgICAgY05ldyA9IG9ialtjaGFuZ2UubmFtZV07XG4gICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3NwbGljZSc6XG4gICAgICAgIGNQYXRoID0gZ2V0RnVsbFBhdGgocGF0aCwgY2hhbmdlLmluZGV4KTtcbiAgICAgICAgaWYoY2hhbmdlLnJlbW92ZWQubGVuZ3RoKSB7XG4gICAgICAgICAgY1R5cGUgPSAncmVtb3ZlJztcbiAgICAgICAgICBjT2xkID0gY2hhbmdlLnJlbW92ZWRbMF07XG4gICAgICAgICAgaWYoY2hhbmdlLnJlbW92ZWQubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgY2hhbmdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgYWRkZWRDb3VudDogY2hhbmdlLmFkZGVkQ291bnQsXG4gICAgICAgICAgICAgIGluZGV4OiBjaGFuZ2UuaW5kZXggKyAxLFxuICAgICAgICAgICAgICBvYmplY3Q6IGNoYW5nZS5vYmplY3QsXG4gICAgICAgICAgICAgIHJlbW92ZWQ6IGNoYW5nZS5yZW1vdmVkLnNsaWNlKDEpLFxuICAgICAgICAgICAgICB0eXBlOiBjaGFuZ2UudHlwZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYoY2hhbmdlLmFkZGVkQ291bnQpIHtcbiAgICAgICAgICBjVHlwZSA9ICdhZGQnO1xuICAgICAgICAgIGNOZXcgPSBvYmpbY2hhbmdlLmluZGV4XTtcbiAgICAgICAgICBpZihjaGFuZ2UuYWRkZWRDb3VudCA+IDEpIHtcbiAgICAgICAgICAgIGNoYW5nZXMucHVzaCh7XG4gICAgICAgICAgICAgIGFkZGVkQ291bnQ6IGNoYW5nZS5hZGRlZENvdW50IC0gMSxcbiAgICAgICAgICAgICAgaW5kZXg6IGNoYW5nZS5pbmRleCArIDEsXG4gICAgICAgICAgICAgIG9iamVjdDogY2hhbmdlLm9iamVjdCxcbiAgICAgICAgICAgICAgcmVtb3ZlZDogY2hhbmdlLnJlbW92ZWQsXG4gICAgICAgICAgICAgIHR5cGU6IGNoYW5nZS50eXBlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY1R5cGUgPSAndXBkYXRlJztcbiAgICAgICAgICBjT2xkID0gY2hhbmdlLnJlbW92ZWRbMF07XG4gICAgICAgICAgY05ldyA9IG9ialtjaGFuZ2UuaW5kZXhdO1xuICAgICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgaWYodHlwZW9mIGNOZXcgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIHBhdGhPYnNlcnZlcihjTmV3LCBjYiwgW10uY29uY2F0KGNQYXRoKSk7XG4gICAgfVxuICAgIGNiKGNQYXRoLCBjVHlwZSwgY05ldywgY09sZCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcGF0aE9ic2VydmVyKG9iaiwgY2IsIHBhdGgpIHtcbiAgd2Fsa2VyKG5ldyBXYWxrZXJPYmplY3QocGF0aCksIG9iaiwgZnVuY3Rpb24obm9kZSwgcGF0aCkge1xuICAgIGlmKHR5cGVvZiBub2RlID09PSBcIm9iamVjdFwiKSB7XG4gICAgICB2YXIgdHlwZSA9IE9iamVjdDtcbiAgICAgIGlmKEFycmF5LmlzQXJyYXkobm9kZSkpIHtcbiAgICAgICAgdHlwZSA9IEFycmF5O1xuICAgICAgfVxuICAgICAgdHlwZS5vYnNlcnZlKG5vZGUsIG9uQ2hhbmdlLmJpbmQodGhpcywgbm9kZSwgW10uY29uY2F0KHBhdGgpLCBjYikpO1xuICAgIH1cbiAgfSk7XG59XG5pZihtb2R1bGUgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSBwYXRoT2JzZXJ2ZXI7XG59IiwiZnVuY3Rpb24gV2Fsa2VyRG9tKCkge307XG5XYWxrZXJEb20ucHJvdG90eXBlID0ge1xuXHRjb25zdHJ1Y3RvcjogV2Fsa2VyRG9tLFxuXHRjaGlsZDogZnVuY3Rpb24oY2IsIG5vZGUpIHtcbiAgICB2YXIgbmV4dCA9IG5vZGUuZmlyc3RDaGlsZDtcbiAgICBpZihuZXh0KSB7XG4gICAgICBjYihuZXh0KTtcbiAgICB9XG5cdH0sXG5cdHNpYmxpbmc6IGZ1bmN0aW9uKGNiLCBub2RlKSB7XG4gICAgdmFyIG5leHQgPSBub2RlLm5leHRTaWJsaW5nO1xuICAgIGlmKG5leHQpIHtcbiAgICAgIGNiKG5leHQpO1xuICAgIH1cblx0fVxufTtcbm1vZHVsZS5leHBvcnRzID0gV2Fsa2VyRG9tOyIsInZhciBhYnN0cmFjdG9yID0gcmVxdWlyZSgnYWJzdHJhY3RvcicpO1xudmFyIG9ic2VydmVyID0gcmVxdWlyZSgnb2JzZXJ2ZXInKTtcbnZhciB3YWxrZXIgPSByZXF1aXJlKCd3YWxrZXInKTtcbnZhciBXYWxrZXJEb20gPSByZXF1aXJlKCd3YWxrZXItZG9tJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24obW9kLCB0cGwsIGRvbSkge1xuICBpZighbW9kKSB0aHJvdyBuZXcgRXJyb3IoXCJNaXNzaW5nIG1vZGVsLCB0ZW1wbGF0ZSBhbmQgZG9tXCIpO1xuICBpZih0eXBlb2YgdHBsICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IEVycm9yKFwiTWlzc2luZyB0ZW1wbGF0ZSBhbmQgZG9tXCIpO1xuICBpZighZG9tKSB0aHJvdyBuZXcgRXJyb3IoXCJNaXNzaW5nIGRvbVwiKTtcblxuICB2YXIgbm9kZVdhbGtDb3VudCA9IDA7XG4gIHZhciBiaW5kaW5ncyA9IHt9O1xuICB2YXIgdHBsQXJyYXkgPSBhYnN0cmFjdG9yKHRwbCk7XG5cbiAgZnVuY3Rpb24gYmluZERhdGEocHJvcCwgbm9kZSkge1xuICAgIGJpbmRpbmdzW3Byb3BdID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIG5vZGUuZGF0YSA9IHZhbHVlO1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBiaW5kQXR0cihwcm9wLCBub2RlLCBhdHRyKSB7XG4gICAgYmluZGluZ3NbcHJvcF0gPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoYXR0ciwgISF2YWx1ZSk7XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uTW9kZWxDaGFuZ2UocGF0aCwgdHlwZSwgbmV3VmFsLCBvbGRWYWwpIHtcbiAgICBiaW5kaW5nc1twYXRoXShuZXdWYWwpO1xuICB9XG5cbiAgd2Fsa2VyKG5ldyBXYWxrZXJEb20oKSwgZG9tLCBmdW5jdGlvbihub2RlKSB7XG4gICAgaWYoIShub2RlLm5vZGVOYW1lID09PSBcIiN0ZXh0XCIgJiYgbm9kZS5kYXRhLmNoYXJBdCgwKSA9PT0gXCJcXG5cIikpIHtcbiAgICAgIHZhciBleHBlY3RlZCA9IHRwbEFycmF5W25vZGVXYWxrQ291bnRdO1xuICAgICAgd2hpbGUoZXhwZWN0ZWQuY2xvc2UpIHtcbiAgICAgICAgZXhwZWN0ZWQgPSB0cGxBcnJheVsrK25vZGVXYWxrQ291bnRdO1xuICAgICAgfVxuICAgICAgaWYoZXhwZWN0ZWQudHlwZSA9PT0gXCI+XCIpIHtcbiAgICAgICAgYmluZERhdGEoZXhwZWN0ZWQuYmluZCwgbm9kZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZihub2RlLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgIT09IGV4cGVjdGVkLnR5cGUpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vZGUgZG9lcyBub3QgbWF0Y2ggdGVtcGxhdGUsIGdvdCA8JyArIG5vZGUubm9kZU5hbWUudG9Mb3dlckNhc2UoKSArICc+IGV4cGVjdGluZyA8JyArIGV4cGVjdGVkLnR5cGUgKyAnPicsIG5vZGUubm9kZU5hbWUudG9Mb3dlckNhc2UoKSwgZXhwZWN0ZWQpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBhdHRySGFzaCA9IGV4cGVjdGVkLmF0dHJpYnV0ZXM7XG4gICAgICAgIGZvcih2YXIgYXR0ciBpbiBhdHRySGFzaCkge1xuICAgICAgICAgIGlmKGF0dHJIYXNoLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgICAgICB2YXIgZXhwcmVzc2lvbiA9IGF0dHJIYXNoW2F0dHJdLm1hdGNoKC9eXFx7XFx7KFthLXpBLVpdKylcXH1cXH0vKVsxXTtcbiAgICAgICAgICAgIGlmKGV4cHJlc3Npb24pIHtcbiAgICAgICAgICAgICAgYmluZEF0dHIoZXhwcmVzc2lvbiwgbm9kZSwgYXR0cik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBub2RlV2Fsa0NvdW50Kys7XG4gICAgfVxuICB9KTtcblxuICBvYnNlcnZlcihtb2QsIG9uTW9kZWxDaGFuZ2UpO1xuXG4gIHJldHVybiBkb207XG59OyIsInZhciBGQlN0b3JlID0gcmVxdWlyZSgnbWFwcGVyLWZpcmViYXNlJyk7XG52YXIgTWFwcGVyID0gcmVxdWlyZSgnbWFwcGVyJyk7XG52YXIgYnVpbGRlciA9IHJlcXVpcmUoJ2J1aWxkZXInKTtcbnZhciBzdGl0Y2hlciA9IHJlcXVpcmUoJ3N0aXRjaGVyJyk7XG5cbnZhciBtYXAgPSB7XG5cdHVzZXJuYW1lOiAndXNlcicsXG5cdGZpcnN0bmFtZTogJ2ZpcnN0bmFtZScsXG5cdGxhc3RuYW1lOiAnbGFzdG5hbWUnLFxuXHR0b3duOiAndG93bicsXG5cdHVzZXJNc2c6IFsnZmlyc3RuYW1lJywgJ2xhc3RuYW1lJywgJ3Rvd24nLCBmdW5jdGlvbihmaXJzdG5hbWUsIGxhc3RuYW1lLCB0b3duKSB7XG5cdFx0cmV0dXJuICdXZWxjb21lICcgKyBmaXJzdG5hbWUgKyAnICcgKyBsYXN0bmFtZSArICcgZnJvbSAnICsgdG93bjtcblx0fV0sXG5cdGRvYjogJ2RvYicsXG5cdGFnZTogWydkb2InLCBmdW5jdGlvbihkb2IpIHtcblx0XHR2YXIgZG9iU3BsaXQgPSBkb2Iuc3BsaXQoJy8nKTtcblx0XHR2YXIgeWVhciA9IHBhcnNlSW50KGRvYlNwbGl0W2RvYlNwbGl0Lmxlbmd0aCAtIDFdLCAxMCk7XG5cdFx0dmFyIGZ1bGx5ZWFyID0gKHllYXIgPCAxNSA/IDIwMDAgOiAxOTAwKSArIHllYXJcblx0XHRyZXR1cm4gJ1JvdWdobHkgJyArICgyMDE0IC0gZnVsbHllYXIpO1xuXHR9XSxcblx0c3RhclNpZ246IFsnZG9iJywgZnVuY3Rpb24oZG9iKSB7XG5cdFx0dmFyIGRvYlNwbGl0ID0gZG9iLnNwbGl0KCcvJyk7XG5cdFx0dmFyIG1vbnRoID0gcGFyc2VJbnQoZG9iU3BsaXRbMV0sIDEwKTtcblx0XHRyZXR1cm4gbW9udGggPCA3ID8gJ2Vhcmx5JyA6ICdsYXRlJztcblx0fV1cbn07XG52YXIgdHBsID0gJzxkbD4nICsgT2JqZWN0LmtleXMobWFwKS5tYXAoZnVuY3Rpb24oa2V5KSB7XG5cdHJldHVybiAnPGR0Picra2V5Kyc8L2R0PjxkZD57eycra2V5Kyd9fTwvZGQ+Jztcbn0pLmpvaW4oJycpICsgJzwvZGw+JztcbnZhciBzdG9yZSA9IG5ldyBGQlN0b3JlKFwiaHR0cHM6Ly9ibGluZGluZy1maXJlLTM2MjMuZmlyZWJhc2Vpby5jb20vXCIpO1xudmFyIG1hcHBlciA9IG5ldyBNYXBwZXIoc3RvcmUsIG1hcCwgdHJ1ZSk7XG5tYXBwZXIuZ2V0Vmlld01vZGVsKCkudGhlbihmdW5jdGlvbih2aWV3TW9kZWwpIHtcblx0ZG9jdW1lbnQuYm9keS5pbm5lckhUTUwgPSBidWlsZGVyKHZpZXdNb2RlbCwgdHBsKTtcblx0c3RpdGNoZXIodmlld01vZGVsLCB0cGwsIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2RsJykpO1xufSk7Il19
