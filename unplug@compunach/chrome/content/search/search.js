/*
 *         _        ___
 *    /\ / /___    / _ \ /\ /\  _ ___
 *   / // // _ \  / // // // // // _ \
 *  / // // // / / ___// // // // // /
 *  \___//_//_/ /_/   /_/ \___/ \_  /
 *                             \___/
 * 
 *  Compunach UnPlug
 *  Copyright (C) 2009 David Batley <unplug@dbatley.com>
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 2 of the License, or
 *  (at your option) any later version.
 * 
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 * 
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

// result object

/**
 * A download. Don't forget to make this with "new", ie:
 * 	var foo = new UnPlug2Download(url, UnPlug2Search._download_callback_ok, UnPlug2Search._download_callback_fail, 5000);
 * This should normally be created by calling a function in UnPlug2Search (so it gets registered in the "busy" list.
 * The download will timeout after timeout miliseconds (so we don't download all of a massive file, if we've got it wrong.
 * Reference is a way of working out what download is what.
 */
UnPlug2Download = function (reference, url, post_data, callback_ok, callback_fail, timeout) {
	this.url = url;
	this._post_data = post_data;
	this.reference = reference;
	this._extern_callback_ok = callback_ok;
	this._extern_callback_fail = callback_fail;
	this._done = false;
	this._percent = 0;
	this._xmlhttp = new XMLHttpRequest();
	this._timeout_delay = timeout;
	this.text = null;
	this.xmldoc = null;
	this._started = false;
	
	// this in these callbacks are xhttprequests.
	// which is dumb
	var realthis = this;
	try {
		this._xmlhttp.addEventListener("progress", function (evt) { realthis._internal_callback_progress(evt); }, false);
	} catch (e) {
		// pass -- fails for ff 2.0
	}
	this._xmlhttp.addEventListener("load", function () { realthis._internal_callback_ok(); }, false);
	this._xmlhttp.addEventListener("error", function () { realthis._internal_callback_fail(); }, false);
	
	// abort isn't in 3.0.5
	// this._xmlhttp.addEventListener("abort", this._internal_callback_fail, false); 
	
	return this;
}
UnPlug2Download.prototype = {
	/**
	 * Returns true if the download has started
	 */
	is_started : function () {
		return this._started || this._done;
	},
	
	/**
	 * Starts the download
	 */
	start : function () {
		if (this._started) {
			return;
		}
		this._started = true;
		if (this._done) {
			return; // this is set on cancel.
		}
		var realthis = this;
		this._timeout = window.setTimeout(function () { realthis._timeout_callback(); }, this._timeout_delay);
		
		if (this._post_data) {
			this._xmlhttp.open('POST', this.url, true);  
			this._xmlhttp.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
			this._xmlhttp.send(this._post_data);
		} else {
			this._xmlhttp.open('GET', this.url, true);  
			this._xmlhttp.send(null); 
		}
	},
	
	/**
	 * Returns true if the download has completed (or failed)
	 */
	is_complete : function () {
		return this._done;
	},
	
	/**
	 * Return the percetage of the file which has been downloaded.
	 */
	percent_complete : function () {
		if (this._done)
			return 100;
		return this._percent;
	},
	
	/**
	 * Aboarts the download, if possible
	 */
	cancel : function () {
		try {
			this._xmlhttp.abort();
		} catch (e) {
			UnPlug2.log("Cancel download error " + e);
		}
		if (!this._done) {
			this._internal_callback_fail();
		}
	},
	
	_internal_callback_ok : function () {
		if (this._done) {
			UnPlug2.log("Duplicate callback: ok " + this)
			return
		}
		this.clear_timeout()
		this._done = true;
		this.text = this._xmlhttp.responseText;
		this.xmldoc = this._xmlhttp.responseXML;
		this._extern_callback_ok(this);
	},
	
	_internal_callback_fail : function () {
		if (this._done) {
			UnPlug2.log("Duplicate callback: fail " + this)
			return
		}
		this.clear_timeout()
		this._done = true;
		this._extern_callback_fail(this);
	},
	
	_internal_callback_progress : function (evt) {
		if (evt.lengthComputable) {
			p = 100 * evt.loaded / evt.total;
			if (p >= 0 && p <= 100)
				this._percent = p;
		}
	},
	
	_timeout_callback : function () {
		UnPlug2.log("Timeout " + String(this));
		this._timeout = null;
		this.cancel();
	},
	
	clear_timeout : function () {
		if (this._timeout) {
			window.clearTimeout(this._timeout);
			this._timeout = null;
		}
	},
	
	toString : function () {
		return "<Download " + this.reference + " = " + this.url + " stage=" + this._xmlhttp.readyState + ">";
	},
	
	version: 2.0 }



/**
 * An object to keep track of variable scopes
 * init with a parent UnPlug2Variables object (or null), and an object containing variable names to update
 * don't forget to use "new" - new UnPlug2Variables(pnt, {foo : "bar"})
 */
function UnPlug2Variables(p, updates) {
	this._parent = p;
	this._vars = updates;
}
UnPlug2Variables.prototype = {
	/**
	 * Get a variable
	 */
	get : function (name) {
		var value = this._vars[name];
		if (typeof(value) != "undefined")
			return value;
		if (this._parent)
			return this._parent.get(name);
		return undefined;
	},
	
	/**
	 * Set a variable
	 */
	set : function (name, value) {
		this._vars[name] = value;
	},
	
	/**
	 * Set varaibles from an objecy
	 */
	update : function (updates) {
		for (k in updates)
			this._vars[k] = updates[k];
	},
	
	toString : function () {
		return "var(" + this._vars.toSource() + "+" + String(this._parent) + ")";
	},
	
	/**
	 * Return traceback as a string
	 */
	trace : function () {
		return "<Trace " + this.traceback().join("/") + ">";
	},
	
	/**
	 * Returns an array of .traceback strings.
	 */
	traceback : function (partial_list) {
		if (!partial_list)
			partial_list = Array("");
		if (this._parent)
			this._parent.traceback(partial_list);
		if (this._vars[".trace"])
			partial_list[partial_list.length] = this._vars[".trace"];
		return partial_list;
	},
	
	/**
	 * return "text" with the variables substituted into the ${...} placeholders.
	 * throws if invalid variable or other errors
	 */
	subst : function (text) {
		var variables = this;
		if (!text)
			return "";
		return text.replace(
			/\$\{([^\}]+)\}/g,
			function (wholematch, varfullname, offset, origstring) {
				// ${func3:func2:func1:varname}
				var parts = varfullname.split(":");
				parts.reverse() // reverse so we can .pop() in _subst_apply_functions()
				return variables._subst_apply_functions(parts);
			});
	},
	
	subst_optional : function (text) {
		try {
			return this.subst(text);
		} catch (e) {
			return "";
		} 
	},
	
	// parts here is in REVERSE ORDER
	_subst_apply_functions : function (parts) {
		// is last element, so get variable name
		if (parts.length == 1) {
			var value = this.get(parts[0]);
			if (!value)
				throw "Variable is undefined: " + parts[0] + " at " + this.trace() + " in " + this;
			return value;
		}
		
		// is not last element so first part is a function:
		var funcname = parts.pop()
		switch (funcname) {
			/**
			 * Decodes url %nn escape codes in variable
			 */
			case "urldecode":
				return unescape(this._subst_apply_functions(parts)).replace("+", " ", "g");
			/**
			 * Encodes url %nn escape codes in variable
			 */
			case "urlencode":
				return escape(this._subst_apply_functions(parts));
			/**
			 * decode html entities TODO
			 */
			case "htmldecode":
				return this._subst_apply_functions(parts).replace(
					/&(.*?);/g,
					function (str, m, offset, s) {
						switch (m) {
							case "amp": return "&";
							case "quot": return "\"";
						}
						if (m[0] == "#")
							return String.fromCharCode(m.substr(1));
						throw "Unknown htmldecode: entity " + m;
					});
			/**
			 * Decodes \xNN javascript escape sequences
			 */
			case "jsdecode":
				return this._subst_apply_functions(parts).replace(
					/\\(b|f|n|r|t|v|\'|\"|\\|\/|[0-7]{3}|x[0-9a-fA-F]{2}|u[0-9a-fA-f]{4})/g, function (wholematch, esc, offset, origstring) {
						switch (esc.charAt(0)) {
							case "b" : return "\b";
							case "f" : return "\f";
							case "n" : return "\n";
							case "r" : return "\r";
							case "t" : return "\t";
							case "v" : return "\v";
							case "\'" : return "\'";
							case "\"" : return "\"";
							case "/" : return "/";
							case "x": return String.fromCharCode(parseInt(esc.substring(1), 16));
							case "u": return String.fromCharCode(parseInt(esc.substring(1), 16));
							case "0": case "1": case "2": case "3": case "4": case "5": case "6": case "7": return String.fromCharCode(parseInt(esc, 8));
						}
						throw "Unknown escape in jsdecode " + esc;
					});
			/**
			 * ${randomfloat}
			 */
			case "randomfloat":
				if (parts.length != 0)
					throw "Cannot parse ${randomfloat}";
				return Math.random();
			/**
			 * ${randomint:numchars}
			 */
			case "randomint":
				if (parts.length != 1)
					throw "Cannot parse ${randomint:...}";
				var r = "";
				for (var i = 0; i < parseInt(parts[0]); ++i) {
					r += "0123456789"[Math.floor(Math.random() * 10)];
				}
				return r
			/**
			 * ${optional:varname}
			 */
			case "optional":
				try {
					return this._subst_apply_functions(parts);
				} catch (e) {
					return "";
				}
			/**
			 * ${required:varname}
			 */
			case "required":
				var r = this._subst_apply_functions(parts);
				if (r) {
					return r;
				} else {
					throw "Variable gave empty string: " + parts.toSource()
				}
			/**
			 * ${either:var1:var2:....}
			 */
			case "either":
				parts = parts.reverse()
				while (parts) {
					var p = parts.pop()
					var z = "";
					try {
						z = this._subst_apply_functions([p]);
					} catch (e) {
						continue;
					}
					if (z) {
						return z;
					}
				}
				return "";
			/**
			 * ${translate:name_in_locale_file}
			 */
			case "translate":
				if (parts.length != 1)
					throw "Invalid length for ${translate:...}";
				return UnPlug2.str(parts[0]);
			/*
			 * ${substring:start:variablename}
			 * ${substring:start:end:variablename}
			 * can be -ve numbers (like python)
			 */
			case "substring":
				var fullstring = this._subst_apply_functions(parts);
				var n1 = Number(parts[parts.length-1]);
				if (n1 < 0)
					n1 += fullstring.length;
				var n2 = Number(parts[parts.length-2]);
				parts.pop(); // pop n1
				if (n2 === NaN) {
					if (n2 < 0)
						n2 += fullstring.length;
					return String(fullstring).substring(n1);
				}
				parts.pop(); // pop n2 too
				return String(fullstring).substring(n1);
			case "reversed":
				var value = this._subst_apply_functions(parts);
				return value.split("").reverse().join("")
			/**
			 * ${padprefix:pad_char:boundary_size:variable}
			 * Pads variabe with pad_char until length divisible by boundary_size.
			 */
			case "padprefix":
				var prefixvalue = parts.pop()
				var prefixboundary = Number(parts.pop())
				var value = this._subst_apply_functions(parts);
				if (prefixvalue.length != 1)
					throw "char must be length 1 in ${padprefix}";
				if (!prefixboundary)
					throw "Invalid boundary size in ${padprefix}";
				while (value.length % prefixboundary)
					value = prefixvalue + value;
				return value;
			/**
			 * ${hextostr:varname}
			 */
			case "hextostr":
				var hex = this._subst_apply_functions(parts);
				if (hex.length % 2) {
					hex = "0" + hex;
				}
				var twohexes = Array();
				for (var i = 0; i < hex.length; i+= 2) {
					twohexes[twohexes.length] = hex.substring(i, i+2);
				}
				return twohexes.map(function (x) { return String.fromCharCode(Number("0x" + x)); }).join("");
			/**
			 * ${qparam:paramname:urlvarname}
			 */
			case "qparam":
				var qname = parts.pop();
				var urlstring = this._subst_apply_functions(parts);
				urlstring = urlstring.substring(urlstring.indexOf("?")+1);
				urlstring = "&" + urlstring + "&";
				var r = RegExp("&" + qname + "=([^&]+)");
				var m = r.exec(urlstring);
				if (!m) {
					throw "qparam:" + qname + " is not in " + urlstring;
				}
				return unescape(m[1]);
			/**
			 * ${megavideo:un:key1:key2}
			 */
			case "megavideo":
				if (parts.length != 3) {
					throw "wrong number of args for magavideo";
				}
				var un = this._subst_apply_functions([parts[2]]);
				var key1 = this._subst_apply_functions([parts[1]]);
				var key2 = this._subst_apply_functions([parts[0]]);
				return this.megavideo_hash(un, key1, key2);
			/**
			 * ${youku:....}
			 */
			case "youku":
				if (parts.length != 6) {
					throw "wrong number of args for youku";
				}
				var mediatype = parts[5];
				var key1 = this._subst_apply_functions([parts[4]]);
				var key2 = this._subst_apply_functions([parts[3]]);
				var seed = this._subst_apply_functions([parts[2]]);
				var streamid = this._subst_apply_functions([parts[1]]);
				var pieceid = this._subst_apply_functions([parts[0]]);
				return this.youku_url(mediatype, key1, key2, seed, streamid, pieceid);
			default:
				throw "Undefined function for variables: " + funcname;
		}
	},

	megavideo_hash : (function (un, key1, key2) {
		var hex2bin = {
			"0" : "0000", "1" : "0001", "2" : "0010", "3" : "0011",
			"4" : "0100", "5" : "0101", "6" : "0110", "7" : "0111",
			"8" : "1000", "9" : "1001", "a" : "1010", "b" : "1011",
			"c" : "1100", "d" : "1101", "e" : "1110", "f" : "1111" };
		var bin2hex = {
			"0000" : "0", "0001" : "1", "0010" : "2", "0011" : "3",
			"0100" : "4", "0101" : "5", "0110" : "6", "0111" : "7",
			"1000" : "8", "1001" : "9", "1010" : "a", "1011" : "b",
			"1100" : "c", "1101" : "d", "1110" : "e", "1111" : "f" };
		
		var donkey = Array();
		key1 = parseInt(key1);
		key2 = parseInt(key2);
		for (var i = 0; i < 384; ++i) {
			key1 = ((key1 * 11) + 77213) % 81371
			key2 = ((key2 * 17) + 92717) % 192811
			donkey[i] = (key1 + key2) % 128
		}
		
		var bin = Array();
		for (var i = 0; i < un.length; ++i) {
			bin.push(hex2bin[un[i]]);
		}
		bin = bin.join("").split("")
		
		if (bin.length != 128) {
			throw "bin is the wrong length";
		}
		
		for (var i = 256; i >= 0; --i) {
			var j = donkey[i];
			var k = i % 128;
			var tmp = bin[k];
			bin[k] = bin[j];
			bin[j] = tmp;
		}
		
		for (var i = 0; i < 128; ++i) {
			if (donkey[i + 256] & 0x01) {
				if (bin[i] == "0") {
					bin[i] = "1";
				} else if (bin[i] == "1") {
					bin[i] = "0";
				} else {
					throw "unexpected value";
				}
			}
		}
		
		var result = Array();
		bin = bin.join("");
		for (var i = 0; i < bin.length; i += 4) {
			result.push(bin2hex[bin.substring(i, i+4)]);
		}
		
		return result.join("");
	}),

	youku_url : (function (mediatype, key1, key2, randomseed, streamid, piece_num) {
		var r = (function () { return "0123456789"[Math.floor(Math.random() * 10)] });
		
		piece_num = ((parseInt(piece_num) < 10) ? "0" : "") + piece_num;
		
		// get the codebook like in cg_hun()
		var codebook = ""
		var t = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ/\\:._-1234567890"
		randomseed = parseInt(randomseed)
		while (t.length > 0) {
			randomseed = ((randomseed * 211) + 30031) % 65536;
			var idx = Math.floor(randomseed * t.length / 65536);
			var c = t.charAt(idx);
			if (!c) { throw "Youku: infinite loop of doom at " + idx.toSource() + " of " + t.toSource() + " => " + c.toSource() ; }
			codebook += c;
			t = t.replace(c, "");
		}
		
		// decode the uuid like in cg_fun()
		var fileid = "";
		var fileid_stars = streamid.split("*");
		fileid_stars.pop();
		for (var i = 0; i < fileid_stars.length; ++i) {
			fileid += codebook[parseInt(fileid_stars[i])];
		}
		
		// make the url
		var url = [];
		url.push("http://f.youku.com/player/getFlvPath/sid/");
		url.push(Math.floor((new Date()).getTime()))
		for (var i = 0; i < 8; ++i) {
			url.push(r());
		}
		url.push("_");
		url.push(piece_num);
		url.push("/st/");
		url.push(mediatype);
		url.push("/fileid/");
		url.push(fileid);
		url.push("?K=");
		url.push(key2);
		url.push((parseInt(key1, 16) ^ 0xa55aa5a5).toString(16).toLowerCase()); // xor
		url.push("&myp=0&ts=" + r() + r() + r());
		return url.join("");
	}),
	
	endofobject : 1 }

UnPlug2Search = {
	UnPlug2Search : function () {
		this._reset();
		
		this.blank_variables = new UnPlug2Variables(null, {
			'.version'  : UnPlug2.version,
			'.revision' : UnPlug2.revision,
			'$'         : '$' })
		
		this._io_service = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService)
	},
	
	/**
	 * Default timeout to downloads, in ms.
	 */
	default_timeout : 30000,
	
	/**
	 * Ask for a file to be downloaded
	 * url must be an nsIURI object
	 */
	_queue_download : function (url, post_data, rules_to_apply, variables, timeout) {
		if (UnPlug2Search._stopped)
			return
		
		var dl_id = UnPlug2Search._downloads.length;
		if (dl_id > 100) {
			UnPlug2.log("Not queuing download: too many downloads " + url);
			return
		}
		
		// set priority from download-priority hook
		priority = 50;
		for each (node in UnPlug2Search.get_hooks("download-priority")) {
			for each (child in node.getElementsByTagName("priority")) {
				if (url.host.indexOf(child.textContent) < 0) {
					continue;
				}
				switch (child.getAttribute("level")) {
					case "very-high": priority -= 20; break;
					case "high": priority -= 10; break;
					case "normal": break;
					case "low": priority += 10; break;
					case "very-low": priority += 20; break;
					case "never":
						UnPlug2.log("Not downloading " + url.spec + " because forbidden in download-priority hook");
						return;
					default:
						UnPlug2.log("Invalid priority for download-priority hook " + child.getAttribute("level"));
						break;
				}
			}
		}
		
		UnPlug2Search._downloads[dl_id] = {
			rules_to_apply: rules_to_apply,
			variables : variables,
			download: null,
			nsiuri: url,
			priority : priority };
		// start download after setting everything else up
		try {
			UnPlug2Search._downloads[dl_id].download = new UnPlug2Download(
				dl_id,
				url.spec,
				post_data,
				UnPlug2Search._download_callback_ok,
				UnPlug2Search._download_callback_fail,
				timeout);
			UnPlug2.log("Download queued " + UnPlug2Search._downloads[dl_id].download + " priority " + UnPlug2Search._downloads[dl_id].priority);
		} catch (e) {
			UnPlug2.log("Download failed to be queued for " + UnPlug2Search._downloads[dl_id].download + " because " + e);
			// .download not assigned
			UnPlug2Search._downloads[dl_id].download = null;
		}
		UnPlug2Search._do_download_poll = true;
	},
	
	poll : function () {
		if (UnPlug2Search._stopped) {
			return;
		}
		
		if (UnPlug2Search._do_download_poll) {
			UnPlug2Search._do_download_poll = false;
			UnPlug2Search._download_poll();
		}
	},
	
	/**
	 * Should be called regularly to start queued downloads
	 */
	_download_poll : function () {
		var concurrent_downloads = 5; // XXX CONFIGURABLE
		for (var i = 0; i < UnPlug2Search._downloads.length; i++) {
			if (UnPlug2Search._downloads[i]
				&& UnPlug2Search._downloads[i].download
				&& UnPlug2Search._downloads[i].download.is_started() == true
				&& UnPlug2Search._downloads[i].download.is_complete() == false) {
					--concurrent_downloads;
			}
		}
		if (concurrent_downloads <= 0) {
			return;
		}
		var startable_downloads = [];
		for (var i = 0; i < UnPlug2Search._downloads.length; i++) {
			if (UnPlug2Search._downloads[i]
				&& UnPlug2Search._downloads[i].download
				&& UnPlug2Search._downloads[i].download.is_started() == false) {
					startable_downloads[startable_downloads.length] = i;
			}
		}
		startable_downloads.sort(function (a, b) {
			return UnPlug2Search._downloads[a].priority - UnPlug2Search._downloads[b].priority;
		});
		for (var i = 0; i < startable_downloads.length && i < concurrent_downloads; ++i) {
			var dl_id = startable_downloads[i];
			try {
				UnPlug2Search._downloads[dl_id].download.start();
				UnPlug2.log("Starting download id = " + dl_id);
			} catch (e) {
				UnPlug2.log("Starting Download failed for " + dl_id + " / " + UnPlug2Search._downloads[dl_id].download + " because " + e);
				UnPlug2Search._downloads[dl_id].download = null;
			}
		}
	},
	
	_download_callback_ok : function (dl) {
		UnPlug2.log("Downloaded " + dl);
		var dlinfo = UnPlug2Search._downloads[dl.reference];
		var dlxml = dl.xmldoc;
		if (dlxml && dlxml.getElementsByTagName("parsererror").length > 0) {
			UnPlug2.log("Document has poorly-formatted xml (consider regexp on whole text). Url=" + dl.url)  
			dlxml = null;
		}
		UnPlug2Search._apply_rules_to_document(dlinfo.nsiuri, dl.text, dlxml, dlinfo.rules_to_apply, dlinfo.variables);
		UnPlug2Search._downloads[dl.reference].download = null;
		UnPlug2Search._do_download_poll = true;
	},
	
	_download_callback_fail : function (dl) {
		// it really can't find UnPlug2 object in all cases!
		try {
			UnPlug2.log("Failed download " + dl);
		} catch(e) {
			// can't do alert() here either .. sheesh!
		}
		UnPlug2Search._downloads[dl.reference].download = null;
		UnPlug2Search._do_download_poll = true;
	},
	
	/**
	 * Cancels all downloads
	 */
	cancel_downloads : function () {
		for (var i = 0; i < UnPlug2Search._downloads.length; i++) {
			var d = UnPlug2Search._downloads[i];
			if (d && d.download) {
				d.download.cancel()
			}
		}
	},
	
	/**
	 * Stop downloading and stop search process
	 */
	abort : function () {
		UnPlug2Search._stopped = true;
		UnPlug2Search.cancel_downloads();
	},
	
	/**
	 * Get a "hooks" item from rules.xml for adjusting eg download priority
	 * Returns an array
	 */
	get_hooks : function (hookname) {
		if (UnPlug2Search._hooks === undefined) {
			UnPlug2Search._hooks = {};
			var hooknodes = UnPlug2Search.get_rules_xml().getElementsByTagName("hook");
			for (var i = 0; i < hooknodes.length; ++i) {
				var hooknode = hooknodes[i];
				var hookname = hooknode.getAttribute("for");
				if (UnPlug2Search._hooks[hookname] === undefined) {
					UnPlug2Search._hooks[hookname] = [];
				}
				UnPlug2Search._hooks[hookname].push(hooknode);
			}
		}
		return UnPlug2Search._hooks[hookname] || [];
	},
	
	/**
	 * Load the xml document containing the rules
	 * Returns the <unplug> element of the document (which contains a number of <rule> elements as children)
	 */
	get_rules_xml : function () {
		if (!UnPlug2Search._search_xml) {
			var req = new XMLHttpRequest();  
			var filename = "chrome://unplug/content/rules.xml";
			
			// this response is synchronous (not async) because it's a local file.
			// sync by use of false in 3rd arg
			req.open('GET', filename, false);   
			req.send(null);  
			if (req.status != 0) {
				UnPlug2.log("Cannot open " + filename);
				throw "Cannot open " + filename;
			}
			var xmldoc = req.responseXML;
			var unplugnode = null;
			for each (node in xmldoc.childNodes) {
				if (node.tagName && node.tagName.toLowerCase() == "unplug") {
					unplugnode = node;
					break;
				}
			}
			if (!unplugnode) {
				UnPlug2.log("Invalid root node for document " + xmldoc);
				throw "Cannot load xml rules - no root node";
			}
			UnPlug2Search._search_xml = unplugnode;
		}
		return UnPlug2Search._search_xml;
	},
	
	/**
	 * Find media in window "win", and call function "callback" for eac result found.
	 * Callback may be called both immediately, and after additional files are downloaded.
	 */
	search : function (win, callback) {
		if (!this.has_finished()) {
			throw "Already in search";
		}
		
		// assign callback func
		this.callback = callback;
		
		this._apply_rules_to_window(
			win,
			this.get_rules_xml(),
			this.blank_variables);
		
		if (UnPlug2.get_pref("popularity_contest"))
			new UnPlug2Download(
				null, // ref
				"http://unplug.dbatley.com/popularity_contest/submit.cgi",
				"useragent=" +  escape(window.navigator.userAgent) + "&url="  + escape(win.location.href) + "&version=" + UnPlug2.version + "&revision=" + UnPlug2.revision + "&codename=" + UnPlug2.codename,
				null, null, // callbacks
				10000);
	},
	
	/**
	 * apply rules in a <ruleset>-type element to a window.
	 */
	_apply_rules_to_window : function (win, rules_xml, variables) {
		var serializer = new XMLSerializer();
		var xml_text = serializer.serializeToString(win.document);
		//var xml_text = win.document.body.innerHTML;
		
		var url = this._io_service.newURI(String(win.location), null, null);
		UnPlug2Search._apply_rules_to_document(
			url,                   // url (a nsiURI)
			xml_text,              // we need to serialize the document into text
			win.document,          // the xml of the document
			rules_xml,             // a <ruleset> to apply
			variables);            // for ${...} substitution in the rules.
		
		// also search in frames
		for (var i = 0; i < win.frames.length; i++) {
			UnPlug2Search._apply_rules_to_window(win.frames[i], rules_xml, variables);
		} 
	},
	
	/**
	 * The protocols it's fine to download with a <download>
	 */
	_downloadable_protocols : [
		"http", "https", "ftp", "gopher",
		],
	
	/**
	 * apply rules in a <ruleset>-type element to a document and url.
	 * To apply the rules, we need the url of the document, the  document in text and in xml (or null).
	 * We also need the rules we'll be applying, and the variables for the variable substitutions - ${...} - in those rules.
	 * The url is a nsIURI
	 */
	_apply_rules_to_document : function (url, text, doc, rules_xml, variables) {
		if (UnPlug2Search._stopped)
			return;
		
		if (["http", "https"].indexOf(url.scheme) < 0) {
			UnPlug2.log("Invalid url for search " + url.spec);
			return;
		}
		
		// add special variables
		variables = new UnPlug2Variables(variables, {
			".url"              : url.spec,
			".url.protocol"     : url.protocol,
			".has_doc"          : doc ? true : false,
			".trace"            : rules_xml.getAttribute("id") || "" })
		
		// the if_* statements add variables, which are available to deeper levels in rules.xml
		var updated_variables = new UnPlug2Variables(variables, {})
		
		/*
		 * evaluate all the if_* statements, updating the variables in updated_variables if needed
		 */
		var node;
		for each (node in rules_xml.childNodes) {
			var nodetagname = node.tagName ? node.tagName.toLowerCase() : "";
			var funcname = null;
			var optional = null;
			var exectype = null;
			if (nodetagname.substring(0, 3) == "if_") {
				funcname = nodetagname.substring(3);
				exectype = "if";
				optional = false;
			} else if (nodetagname.substring(0, 6) == "ifnot_") {
				funcname = nodetagname.substring(6);
				exectype = "ifnot";
				optional = false;
			} else if (nodetagname.substring(0, 9) == "optional_") {
				funcname = nodetagname.substring(9);
				exectype = "optional";
				optional = true;
			} else {
				continue;
			}
			
			// exec UnPlug2Rules.if_*(...);
			// which returns either false or an object with additional variables
			// note: variables are passed to this function for use with eg <if_re string="${...}">
			//       but variables object should not be edited directly.
			var result = false;
			try {
				result = UnPlug2Rules["exec_" + exectype](funcname, node, variables, url, text, doc);
			} catch (e) {
				UnPlug2.log("Error in " + nodetagname + " because " + e + " " + variables.trace());
			}
			
			if (result) {
				// add to updated variables
				updated_variables.update(result);
			} else {
				// fail one if_* condition means the whole <rule> is failed
				if (!optional)
					return; // failed
			}	
		}
		
		/*
		 * evaluate all each_* statements
		 */
		var node;
		for each (node in rules_xml.childNodes) {
			var nodetagname = node.tagName ? node.tagName.toLowerCase() : "";
			if (nodetagname.substring(0, 5) == "each_") {
				// exec UnPlug2Rules.each_*(...);
				// which returns either false or an array of objects which contain updated variables
				// example:
				//    <each_element tagname="em" ref="someref"><media ... /> </each_element>
				// on
				//    <em id="hello">foo</em><em id="bar" lang="en">bar</em>
				// returns [{ id: "hello" }, { id: "bar", lang: "en" }]] 
				var result_list = false;
				try {
					result_list = UnPlug2Rules.exec_each(nodetagname.substring(5), node, updated_variables, url, text, doc);
				} catch (e) {
					UnPlug2.log("Error in " + nodetagname + " because " + e + " " + variables.trace());
				}
				if (result_list) {
					for (var j = 0; j < result_list.length; j++) {
						var result = result_list[j];
						var new_variables = new UnPlug2Variables(updated_variables, result)
						UnPlug2Search._apply_rules_to_document(
							url,
							text,
							doc,
							node, // this is the <each_*> node
							new_variables) // updated_variables + variables from each_* tag
					}
				}
			}
		}
		
		
		/*
		 * apply all the <media...> and <download...> nodes, etc.
		 */
		var node;
		for each (node in rules_xml.childNodes) {
			if (!node.tagName) {
				continue;
			}
			if (node.tagName == "hook") {
				continue;
			}
			var nodetagname = node.tagName.toLowerCase();
			if (nodetagname.substring(0, 3) != "if_" && nodetagname.substring(0, 6) != "ifnot_" && nodetagname.substring(0, 9) != "optional_" && nodetagname.substring(0, 5) != "each_") {
				try {
					switch (nodetagname.toLowerCase()) {
						case "rule":
						case "then":
						case "ruleset":
							var referenced_node = node;
							if (node.hasAttribute("goto")) {
								// getElementById is broken on firefox! gah!
								if (node.getAttribute("goto") === "*") {
									referenced_node = UnPlug2Search.get_rules_xml()
								} else {
									referenced_node = UnPlug2.get_element(UnPlug2Search.get_rules_xml(), "rule", node.getAttribute("goto"));
								}
								if (!referenced_node)
									throw "Cannot find node to goto " + node.getAttribute("goto");
							}
							UnPlug2Search._apply_rules_to_document(
								url,
								text,
								doc,
								referenced_node,
								updated_variables)
							break;
						case "download":
						case "playlist": // synonym, eg for .3mu/.asx files which we can parse
							var relative_url = updated_variables.subst(node.getAttribute("url"));
							if (!relative_url)
								throw "download has no url";
							var abs_url = this._io_service.newURI(relative_url, null, url);
							if (UnPlug2Search._downloadable_protocols.indexOf(abs_url.scheme) < 0) {
								throw "Cannot download " + abs_url.spec + " because bad protocol";
							}
							UnPlug2Search._queue_download(
								abs_url,
								updated_variables.subst_optional(node.getAttribute("post")),
								node,
								updated_variables,
								UnPlug2Search.default_timeout)
							break;
						case "media":
							// get url
							var relative_url = updated_variables.subst(node.getAttribute("url"));
							if (!relative_url)
								throw "Media invalid as empty url";
							var abs_url = this._io_service.newURI(relative_url, null, url);
							
							// get download method
							var download_method = {	"url" : abs_url.spec }
							if (node.hasAttribute("post")) {
								download_method = {
									"http_post" : [
										abs_url.spec,
										updated_variables.subst(node.getAttribute("post"))
										]
									};
							}
							if (node.hasAttribute("referer")) {
								download_method.referer = updated_variables.subst_optional(node.getAttribute("referer")) || undefined;
							}
							
							// make response
							var result = UnPlug2Search._make_response_object_result(
								abs_url,
								download_method,
								node.getAttribute("type"),
								updated_variables.subst_optional(node.getAttribute("description")),
								updated_variables.subst_optional(node.getAttribute("thumbnail")),
								updated_variables.trace());
							
							// callback
							UnPlug2Search.callback(result);
							break;
						default:
							throw "Not implemented";
					} 
				} catch(e) {
					UnPlug2.log("Failed to action " + nodetagname + " because " + e + " " + variables.trace());
				}
			}
		}
	},
	
	/**
	 * Return an unplug result object, for passing to the callback
	 * The format is JSON-compatible
	 * 
	 * Download method must be a javascrit object. It's used by download components (eg "copy url", "save with firefox", "save with dta", etc) to decide how and if they work. Examples below:
	 * { "link" : url }
	 * 	for basic urls
	 * { "link" : url, "referer" : referer }.
	 * 	urls with referer. The referer attribute will be ignored by components which don't support it.
	 * { "http_post" : [ url, post_data ] }
	 * 	http post request
	 * 
	 * Download can be used to track duplicate results
	 */
	_make_response_object_result : function (nsiuri, download_method, file_ext, description, thumbnailurl, trace) {
		var name = UnPlug2Search.get_name(nsiuri.spec);
		var result_object = {
			"type"     : "result",
			"details"  : {
				"name"        : name || "(no name!)",
				"url"         : nsiuri.spec, // this is used for advice only (not used for downloading)
				"swf"         : (nsiuri.path.indexOf(".swf") >= 0) ? true : false,
				"trace"       : trace || "TRACE!?" },
			"download" : download_method };
		
		// details section ( { "label" : undefined } has odd results, so assign here )
		if (description)
			result_object.details.description = description;
		if (file_ext)
			result_object.details.file_ext = file_ext;
		if (thumbnailurl)
			result_object.details.thumbnail = thumbnailurl;
		try {
			result_object.details.protocol = nsiuri.scheme
		} catch (e) {
			// probably will never fail
		}
		try {
			result_object.details.host = nsiuri.host
		} catch (e) {
			// fails for rtmp links (difference between nsIURI and nsIURL?)
		}
		return result_object;
	},
	
	/**
	 * Turn a relative url into a full url
	 */
	_abs_url : function (url, base_url) {
		UnPlug2.log("_abs_url is depricaed!");
		// TODO - should use nsIURI-type URIs everywhere
		UnPlug2.log("URL: " + url + " from base " + base_url);
		if (base_url) {
			var base_nsiuri = UnPlug2Search.make_uri(base_url);
			return UnPlug2Search.make_uri(url, base_nsiuri).spec;
		}			
		return url;
	},
	
	make_uri : function (uri, base_uri) {
		UnPlug2.log("make_uri is depricated");
		// TODO - DEPRICATED
		var io_service = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);
		return io_service.newURI(uri, null, base_uri || null);
	},

	/**
	 * Gets a filename from the url
	 */
	get_name : function (full_url) {
		if (full_url.indexOf("#") > 0)
			full_url = full_url.substring(0, full_url.indexOf("#"));
		// index of last slash (except slashes in query part)
		var last_slash = full_url.lastIndexOf("/");
		if (full_url.indexOf("?") > 0)
			last_slash = full_url.substring(0, full_url.indexOf("?")).lastIndexOf("/");
		// take everything after last slash, like foo.flv?foo=bar&woo=y
		full_url = full_url.substring(last_slash+1);
		// take first 30 chars of nnn?qqqq or take all of nnnnnn
		if (full_url.indexOf("?") > 0) {
			full_url = full_url.substring(0, Math.max(30, full_url.indexOf("?")));
		}
		if (!full_url)
			return "(no name)"
		return full_url;
	},
	
	/**
	 * TODO depricated
	 */
	_subst_node : function (node, attrib, variables) {
		throw "_subst_node is depricated!";
	},
	_subst : function (text, variables) {
		throw "_subst is depricated!";
	},
	
	/**
	 * Call when it's all over
	 */
	_reset : function () {
		// "this" is a lie!!
		UnPlug2Search.callback = function ( res ) { UnPlug2.log("Cannot use callback for result " + res); };
		UnPlug2Search._downloads = [];
		UnPlug2Search._do_download_poll = false;
		window.setInterval(UnPlug2Search.poll, 100);
	},
	
	/**
	 * Returns false if still doing stuff
	 * TODO - depricate this in favor of statusinfo()
	 */
	has_finished : function () {
		for (var i = 0; i < UnPlug2Search._downloads.length; i++) {
			if (UnPlug2Search._downloads[i] && UnPlug2Search._downloads[i].download)
				return false;
		}
		// TODO - more checks about doing stuff while not downloading stuff
		return true;
	},
	
	/**
	 * Returns information about the current status
	 */
	statusinfo : function () {
		var info = { downloads : 0, finished : false, percent : 0 };
		var attempted_downloads = 0;
		var active_downloads = 0;
		var completed_pct = 0;
		for (var i = 0; i < UnPlug2Search._downloads.length; i++) {
			var di = UnPlug2Search._downloads[i];
			if (di) {
				++attempted_downloads;
				if (di.download) {
					completed_pct += di.download.percent_complete();
					if (di.download.is_complete() == false) {
						++active_downloads;
					}
				} else {
					// we cleared the download because it was done
					completed_pct += 100;
				}
			}
		}
		info.downloads = active_downloads;
		// info.percent = 100 * (attempted_downloads - active_downloads) / (attempted_downloads || 1);
		info.percent = completed_pct / (attempted_downloads || 1);
		switch (info.downloads) {
			case 0:
				info.finished = true;
				info.text = UnPlug2.str("search_done");
				break;
			case 1:
				info.text = UnPlug2.str("search_1_active_download");
				break;
			default:
				info.text = UnPlug2.str("search_n_active_downloads").replace("#", info.downloads);
				break;
		}
		return info;
	},
	
	toString : function () {
		return '<UnPlug2Search>';
	},
	
	version : 2.0 }

// init
UnPlug2Search.UnPlug2Search()





