/*
 *         _        ___
 *    /\ / /___    / _ \ /\ /\  _ ___
 *   / // // _ \  / // // // // // _ \
 *  / // // // / / ___// // // // // /
 *  \___//_//_/ /_/   /_/ \___/ \_  /
 *                             \___/
 * 
 *  Compunach UnPlug
 *  Copyright (C) 2010, 2011 David Batley <unplug@dbatley.com>
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 * 
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 * 
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */


UnPlug2Rules = {
	/*
	 * Executes an if_* statement.
	 * statement_name should not begin with "if_"
	 * If there isn't a suitable if_* statement, one will be made by returning the result from appropriate each_* functions
	 */
	exec_if : function (statement_name, node, variables, url, text, doc) {
		var rule = UnPlug2Rules.get_rule("if_" + statement_name);
		
		// if no <if...>, try and return the first part of the <each...> statement.
		if (!rule) {
			// response list is already prefixed variables with ref
			var response_list = UnPlug2Rules.exec_each(statement_name, node, variables, url, text, doc);
			if (response_list.length < 1)
				throw statement_name + " returned empty list"
			return response_list[0];
		}
		
		// exec the <if...>
		var response = UnPlug2Rules.exec_statement(rule, node, variables, url, text, doc);
		
		// valid responses: true, false, object_of_new_variables_without_prefixes
		if (response === false) {
			// throw statement_name + " returned false";
			return false;
		}
		if (response === true) {
			return {};
		}
		if (rule.apply_ref) {
			var ref = node.getAttribute("ref");
			return UnPlug2Rules._prefix_variables(ref, response);
		}
		UnPlug2.log("if_" + statement_name + " did not return true or false, it returned " + response.toSource());
		return false;
	},
	
	/*
	 * Executes an ifnot_* statement.
	 * statement_name should not begin with "ifnot_"
	 * An ifnot_* statement is executes.
	 * If there's no if_* statement, the if_* (or each_*) statement is executed, and the opposite is returned. If <if_*> throws an exception, <ifnot_*> treats this as being true.
	 */
	exec_ifnot : function (statement_name, node, variables, url, text, doc) {
		var rule = UnPlug2Rules.get_rule("ifnot_" + statement_name);
		if (rule) {
			return (UnPlug2Rules.exec_statement(rule, node, variables, url, text, doc) !== false);
		}
		
		try {
			return (!UnPlug2Rules.exec_if(statement_name, node, variables, url, text, doc));
		} catch (e) {
			return true;
		}
	},
	
	/*
	 * Executes an optional_* statement.
	 * statement_name should not begin with "optional_"
	 * This is actually just a wrapper for if_* statements.
	 */
	exec_optional : function (statement_name, node, variables, url, text, doc) {
		try {
			return UnPlug2Rules.exec_if(statement_name, node, variables, url, text, doc);
		} catch (e) {
			// it's optional, we don't care about failure.
		}
	},
	
	/*
	 * Executes an each_* statement.
	 * statement_name should not begin with "each_"
	 */
	exec_each : function (statement_name, node, variables, url, text, doc) {
		var rule = UnPlug2Rules.get_rule("each_" + statement_name);
		var response_list = UnPlug2Rules.exec_statement(rule, node, variables, url, text, doc);
		var ref = node.getAttribute("ref");
		for (var i=0; i < response_list.length; i++) {
			if (!rule.apply_ref) {
				// without apply_ref set this responds by exporting variables without the prefix!
				// TODO - is this right behaviour?
				// pass -- just leave as is
			} else  {
				response_list[i] = UnPlug2Rules._prefix_variables(ref, response_list[i]);
			}
		}
		return response_list;
	},
	
	/*
	 * Return an object describing the rule
	 */
	get_rule : function (rulename) {
		return UnPlug2Rules[rulename];
	},
	
	/*
	 * Private.
	 * puts "ref" in front of results
	 */
	_prefix_variables : function (ref, response) {
		if (!ref)
			return {};
		var response_with_ref = {};
		for (k in response) {
			response_with_ref[ref + "." + k] = response[k];
		}
		return response_with_ref;
	},
	
	/**
	 * Execute a statement.
	 * 
	 * IMPORTANT: You should not normally call this function - instead you should call the exec_if(), exec_optional() or exec_each() functions as appropriate.
	 * 
	 * This will return an object containing new variables which are not prefixed by $ref, or throw on failure.
	 * Rule is one of the rules, which you can get with get_rule().
	 * node is the dom element of the statement from rules.xml (so we can get attributes)
	 * variables is the variables available to this scope
	 */
	exec_statement : function (rule, node, variables, url, text, doc) {
		if (!rule)
			throw "Rule " + rule + " is not a rule which has been implemented in " + UnPlug2.version + " " + UnPlug2.revision;
		if (node.hasAttribute("debug")) {
			alert("Rule: " + rule + " Node: " + node + "\nVar: " + variables.toSource() + "\nUrl: " + url + "\nDoc: " + doc + "\n\n" + text);
		}
		
		// use rule.required and rule.optional to make a data object to feed to rule.execute
		var data = {}
		if (rule.required) {
			for (var i=0; i < rule.required.length; i++) {
				var attrname = rule.required[i];
				var value = null;
				if (attrname == "innerHTML") {
					value = UnPlug2.trim(node.textContent);
				} else {
					value = node.getAttribute(attrname);
				}
				if (!value)
					throw "Attribute " + attrname + " required";
				data[attrname] = variables.subst(value);
			}
		}
		if (rule.optional) {
			for (var i=0; i < rule.optional.length; i++) {
				var attrname = rule.optional[i];
				var value = null;
				if (attrname == "innerHTML") {
					value = UnPlug2.trim(node.textContent);
				} else {
					value = node.getAttribute(attrname);
				}
				try {
					data[attrname] = variables.subst(value ? value : "");
				} catch (e) {
					// problems substing variables is fine as it's optional
					// eg <media thumbnail="..."> - errors substing thumbnail won't take down rule.
					data[attrname] = "";
					
					// although we can force it to be required sometimes, like <if_re string="..." />
					if (rule.enforce && rule.enforce.indexOf(attrname) >= 0) {
						throw "If set, attribute " + attrname + " must be valid.";
					}
				}
			}
		}
		// exec function - may throw, return true or false, or return an object
		return rule.execute(data, url, text, doc);
	},
	
	/**
	 * Reurns true if name is not an empty string
	 */
	if_isset : {
		order     : 0,
		optional  : ["name"],
		execute   : function (data, url, text, doc) {
			if (data.name)
				return true;
			return false;
		}
	},
	
	/*
	 * Returns true if min <= unplug_version < max
	 * Also returns true if unplug_version is null.
	 */
	if_version : {
		order     : 10,
		optional  : ["min", "max"],
		execute   : function (data, url, text, doc) {
			if (data.min && UnPlug2.version < parseFloat(data.min))
				return false;
			if (data.max && UnPlug2.version >= parseFloat(data.max))
				return false;
			return true;
		}
	},
	
	/*
	 * Returns true if min <= unplug_revision < max
	 */
	if_revision : {
		// order decides which rule is done first. if_ is done 0..100; download/media/etc 500...600
		order     : 10,
		optional  : ["min", "max"],
		execute   : function (data, url, text, doc) {
			if (UnPlug2.revision == null)
				return true;
			if (data.min && UnPlug2.revision < parseFloat(data.min))
				return false;
			if (data.max && UnPlug2.revision >= parseFloat(data.max))
				return false;
			return true;
		}
	},
	
	/*
	 * Returns if config variable "name" is set to "value"
	 */
	if_config : {
		order     : 10,
		optional  : ["name", "value"],
		execute   : function (data, url, text, doc) {
			var prefvalue = String(UnPlug2.get_pref(data.name, ""))
			if (prefvalue == data.value)
				return true;
			return false;
		}
	},

	/*
	 * Private.
	 * Takes the response to a RegExp.exec (or String.match) and creates an object containing {"1" : "subexpression 1 result", "2" : ... };
	 */
	_re_resp : function (re_resp) {
		if (!re_resp)
			return false; // no matches
		var result = {};
		for (var i=1; i < re_resp.length; i++)
			if (re_resp[i])
				result[i] = re_resp[i];			
		return result;
	},
	
	/*
	 * Matches a regular expression contained in innerHTML
	 */
	if_re : {
		order     : 90,
		optional  : ["string", "flags", "tagname", "innerHTML", "re"],
		enforce   : ["string"],
		apply_ref : true,
		execute   : function (data, url, text, doc) {
			if (!data.innerHTML && !data.re) {
				throw "Needs innerHTML or re in if_re";
			}
			
			var re = RegExp(data.re || data.innerHTML, data.flags);
			
			if (data.tagname && !doc)
				UnPlug2.log("No document for if_re with elemname - searching page");
			
			if (data.tagname && doc) {
				for each (elem in doc.getElementsByTagName(data.tagname)) {
					var r = UnPlug2Rules._re_resp(re.exec(elem.textContent));
					if (r) {
						return r;
					}
				}
				return false;
			} else {
				return UnPlug2Rules._re_resp(re.exec(data.string || text))
			}
		}
	},
	
	each_re : {
		order     : 90,
		required  : ["re"],
		optional  : ["string", "flags", "tagname"],
		enforce   : ["string"],
		apply_ref : true,
		execute   : function (data, url, text, doc) {
			var re = RegExp(data.re, data.flags + "g");
			var response = [];
			var texts = [];
			if (data.tagname && doc) {
				var elemlist = doc.getElementsByTagName(data.tagname);
				for each (elem in elemlist) {
					texts[texts.length] = elem.textContent;
				}
			} else {
				texts = [ data.string || text ];
			}
			for (var i = 0; i < texts.length; i++) {
				var rr;
				var k = 0;
				while (rr = re.exec(texts[i])) {
					response[response.length] = UnPlug2Rules._re_resp(rr);
					if (++k > 100) {
						UnPlug2.log("Baling out of each_re in rules.js because hit limit of " + k + ". Error is with " + data.toSource() + " on text " + texts[i].substring(100))
						break;
					}
				}
			}
			return response;
		}
	},
	
	/*
	 * Returns false
	 */
	if_false : {
		order     : 0,
		apply_ref : false,
		execute   : function (data, url, text, doc) {
			return false;
		}
	},
	if_true : {
		order     : 0,
		apply_ref : false,
		execute   : function (data, url, text, doc) {
			return true;
		}
	},
	
	/*
	 * Checks for equality
	 */
	if_equal : {
		order     : 1,
		required  : ["a", "b"],
		apply_ref : false,
		execute   : function (data, url, text, doc) {
			return ( data.a == data.b ) ? true : false;
		}
	},
	
	/*
	 * Is a switch statement
	 */
	if_switch : {
		order     : 10,
		required  : ["input"],
		optional : ["k1", "v1", "k2", "v2", "k3", "v3", "k4", "v4",
			"k5", "v5", "k6", "v6", "k7", "v7", "k8", "v8", "k9", "v9",
			"k10", "v10", "k11", "v11", "k12", "v12", "k13", "v13", "k14", "v14",
			"k15", "v15", "k16", "v16", "k17", "v17", "k18", "v18", "k19", "v19",
			"k20", "v20", "default"],
		apply_ref : true,
		execute   : function (data, url, text, doc) {
			if (!data.input) { return false; }
			switch (data.input) {
				case data.k1: return {1: data.v1};
				case data.k2: return {1: data.v2};
				case data.k3: return {1: data.v3};
				case data.k4: return {1: data.v4};
				case data.k5: return {1: data.v5};
				case data.k6: return {1: data.v6};
				case data.k7: return {1: data.v7};
				case data.k8: return {1: data.v8};
				case data.k9: return {1: data.v9};
				case data.k10: return {1: data.v10};
				case data.k11: return {1: data.v11};
				case data.k12: return {1: data.v12};
				case data.k13: return {1: data.v13};
				case data.k14: return {1: data.v14};
				case data.k15: return {1: data.v15};
				case data.k16: return {1: data.v16};
				case data.k17: return {1: data.v17};
				case data.k18: return {1: data.v18};
				case data.k19: return {1: data.v19};
				case data.k20: return {1: data.v20};
				default: return data.default ? {1: data.default} : false;
			}
		}
	},
	
	/*
	 * Checks the url.
	 */
	if_url : {
		order     : 20,
		optional  : [
			"inhost", // substring is in host
			"inurl",  // substring is in spec
			"inpath", // substring is in path
			"path",   // matches start of path
			"port",   // matches port exactly
			"host"],   // matches end of host in whole words
		apply_ref : true, // populate $ref = url.spec, $ref.host = url.host, etc....
		execute   : function (data, url, text, doc) {
			if (data.inhost) {
				if (url.host.indexOf(data.inhost) < 0)
					return false;
			}
			if (data.inurl) {
				if (url.spec.indexOf(data.inurl) < 0)
					return false;
			}
			if (data.inpath) {
				if (url.path.indexOf(data.inpath) < 0)
					return false;
			}
			if (data.port) {
				if (url.port != data.port)
					return false;
			}
			if (data.protocol) {
				if (url.scheme != data.protocol)
					return false;
			}
			if (data.path) {
				if (url.path.indexOf(data.path) != 0)
					return false;
			}
			if (data.host) {
				/*
				 * TODO - this isn't implemented properly
				 * examle of host
				 * eg: foo.com
				 * matches foo.com
				 * matches www.yay.foo.com
				 * doesn't match foo.com.nyud.net
				 * doesn't match xyay.com
				 * possibly matches yay.com.
				 */
				if (url.host.indexOf(data.host) < 0)
					return false;
			}
			var rtn = {
				"url"      : url.spec,
				"post"     : url.port,
				"path"     : url.path,
				"protocol" : url.scheme,
				"host"     : url.host }
			return rtn;
		}
	},
	
	/**
	 * When docs are not availaible, each_element calls this function
	 */
	_get_attrib_from_tagname_string : function (tag, attrib) {
		// attrib="value"
		// attrib='value'
		// var m = RegExp("\\b" + attrib + "=([\"\'])([^\\1]+)", "i").exec(tag); -- TODO why didn;t this work?
		var m = RegExp("\\b" + attrib + "=([\"\'])(.*?)\\1", "i").exec(tag);
		if (m)
			return m[2];
		// attrib=value
		var m = RegExp("\\b" + attrib + "=([^\\s]+)", "i").exec(tag);
		if (m)
			return m[1];
		return null;
	},
	
	/*
	 * Iterates over the dom elements in doc which match the specified pattern
	 */
	each_element : {
		order     : 70,
		optional  : [
			"tagname",
			"elemid",
			"require_attrs",
			"attrs",
			"string",
			"slow"],
		apply_ref : true,
		execute   : function (data, url, text, doc) {
			var search_with_dom = true;
			if (data.string || !doc)
				search_with_dom = false;
			// TODO - this next line should be configurable for flashblock/no flashblock and for about:config settings too!
			// TODO - and this is only really useful where we can get original source from cache
			if ((data.tagname == "embed" || data.tagname == "object") && false)
				search_with_dom = false;
			if (!search_with_dom) {
				UnPlug2.log("each_element works slowly when not given a document!");
				if (!data.tagname)
					throw "each_element requires a document or a tagname";
				// "slow" <each_element> tags, like searching all <a> anchors, is skipped because this is likely to be significantly worse performance than using the dom.
				if (data.slow)
					return false;
				var rtn = [];
				var reg = RegExp("<" + data.tagname + "([^>]*)>", "gi");
				while (true) {
					var regresult = reg.exec(data.string || text);
					if (!regresult)
						break;
					var tag = regresult[1];
					var single_rtn = {};
					
					var require_attrs = data.require_attrs.split(",");
					if (require_attrs.indexOf("innerHTML") > -1)
						throw "innerHTML not supported by <each_element> without a doc.";
					var got_all_req = true;
					for (var i = 0; i < require_attrs.length; i++) {
						var x = UnPlug2Rules._get_attrib_from_tagname_string(tag, require_attrs[i]);
						// x = (x || "").replace(RegExp("^\\s+|\\s+$", "g"), "") // strip whitespace
						if (!x) {
							got_all_req = false;
							break;
						}
						single_rtn[require_attrs[i]] = x;
					}
					if (!got_all_req)
						continue
					
					var attrs = data.attrs.split(",");
					for (var i = 0; i < attrs.length; i++) {
						var x = UnPlug2Rules._get_attrib_from_tagname_string(tag, attrs[i]);
						if (x)
							single_rtn[attrs[i]] = x;
					}
					rtn[rtn.length] = single_rtn;
				}
				return rtn;
			}
			// above this line is the slow regexp version for no document
			// below this line is the fast dom version for those with a document
			
			// apply elemid and tagname
			if (data.elemid) {
				var elem = doc.getElementById(data.elemid);
				if (!elem)
					return false;
				if (data.tagname && data.tagname != elem.tagName)
					throw "Element with id did not match tagname";
				var elem_list = [elem];
			} else if (data.tagname) {
				var elem_list = doc.getElementsByTagName(data.tagname);
			} else {
				throw "each_element has no tagname and no elemid";
			}
			
			// elem_list is populated with a list of possible elements
			var result_list = [];
			for (var i=0; i < elem_list.length; i++) {
				var elem = elem_list[i];
				
				// get the variables that are in response of this one element
				var result = {};
				var got_all_required = true;
				for each (req_attr in data.require_attrs.split(",")) {
					switch (req_attr) {
						case "innerHTML" : 
							result.innerHTML = elem.textContent;
							if (!result.innerHTML) {
								got_all_required = false;
							}
							break;
						case "":
							break;
						default:
							var attrvalue = elem.getAttribute(req_attr);
							if (attrvalue)
								result[req_attr] = attrvalue;
							else
								got_all_required = false;
							break;
					}
				}
				if (!got_all_required) {
					continue;
				}
				for each (attr in data.attrs.split(",")) {
					switch (attr) {
						case "innerHTML" : 
							result.innerHTML = elem.textContent;
							break;
						case "":
							break;
						default:
							var attrvalue = elem.getAttribute(attr);
							if (attrvalue)
								result[attr] = attrvalue;
							break;
					}
				}
				
				// add this one element's response to the list
				result_list[result_list.length] = result;
			}
			
			return result_list;
		}
	},
	
	_media_ext : [
		"wma", "wmv",
		"mpg", "mpeg", "mp3", "mp2", "mp4",
		"divx", "avi",
		"ogg", "ogv", "flac", "speex",
		"mkv",
		"3gp",
		"flv" ],
	
	if_ext : {
		order     : 70,
		required  : ["filename"],
		optional  : [
			"ext",
			"is_media"],
		apply_ref : true,
		execute   : function (data, url, text, doc) {
			var fullname = data.filename.toLowerCase();
			
			// strip gubbinns from end of url
			var lasthash = fullname.lastIndexOf("#");
			if (lasthash > 0)
				fullname = fullname.substring(0, lasthash);
			var lastquestion = fullname.lastIndexOf("?");
			if (lastquestion > 0)
				fullname = fullname.substring(0, lastquestion);
			var lastsemi = fullname.lastIndexOf(";");
			if (lastsemi > 0)
				fullname = fullname.substring(0, lastsemi);
		
			// get ext
			var lastdot = fullname.lastIndexOf(".");
			if (lastdot < 0)
				return false;
		
			var ext = fullname.substring(lastdot+1).toLowerCase();
			if (ext.length < 1 || ext.length > 5)
				return false;
		
			if (data.is_media) {
				if (UnPlug2Rules._media_ext.indexOf(ext) < 0)
					return false;
			}
		
			// return true
			return { ref : ext };
		}
	},
	
	end_of_object : 1 };
