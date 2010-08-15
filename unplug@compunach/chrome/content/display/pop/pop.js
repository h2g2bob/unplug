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

UnPlug2SearchPage = {
	UnPlug2SearchPage : function (args) {
		// parent window (the one we want to search)
		this._win = args.tgt_window;
		
		// parent window's getBrowser() and global window namespace
		this._gbrowser = args.gbrowser;
		this._flashgot = args.flashgotserv;
		
		// firefox 
		this._download_mgr = Components.classes["@mozilla.org/download-manager;1"]
			.getService(Components.interfaces.nsIDownloadManager);
		
		// io service
		this._io_service = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService)
		
		// clipboard
		this._clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Components.interfaces.nsIClipboardHelper);  
		
		// preferered downloaders from config
		switch (UnPlug2.get_pref("downloader")) {
			case "saveas":
				this.preferred_downloaders = ["saveas"];
				break;
			case "openover":
				this.preferred_downloaders = ["openover"];
				break;
			default:
				this.preferred_downloaders = ["dta", "flashgot", "saveas"];
				break;
		}
		// fallbacks (if the default fails)
		this.preferred_downloaders.push("special");
		this.preferred_downloaders.push("saveas");
		// this.preferred_downloaders.push("openover");
		this.preferred_downloaders.push("fallback");
		
		// set this to true to stop everything
		this._stopped = false;
		
		// results array to be populated when a callback occurs
		this.download_to_uid = {}; // { result.download.toSource() : 1 }
		this.results = []; // { 1 : result }  ... or rather [ ..., result, ... ]
		this.media_id_lookup = {}; // { "youtube-324121" : [1, ...] }
		this.playlist_id_lookup = {}; // { "youtube-uploader-1213" : [1, ...] }
	},
	
	/**
	 * search the parent window for media, returning search result objects
	 */
	do_search : function () {
		document.getElementById("dynamic_download").value = UnPlug2.str("search_busy");
		document.getElementById("dynamic_results").value = UnPlug2.str("search_no_results_yet");
		
		try {
			UnPlug2Search._reset(); // this may not be needed because we always start from a fresh window
			UnPlug2Search.search(this._win, this._search_callback)
			this.poll()
		} catch (e) {
			UnPlug2.log(e);
		}
	},
	
	/**
	 * See if we've finished looking for suff yet
	 */
	poll : function () {
		try {
			var statusinfo = UnPlug2Search.statusinfo();
			document.getElementById("dynamic_download").value = statusinfo.text;
			var searchbar = document.getElementById("search_progress");
			if (statusinfo.finished) {
				searchbar.mode = "determined";
				searchbar.value = "100";
				
				var num_results = UnPlug2SearchPage.results.length;
				document.getElementById("stop_button").disabled = true;
				if (num_results == 0) {
					document.getElementById("dynamic_results").value = UnPlug2.str("search_no_results");
					document.getElementById("dynamic_results").className = "failed";
				} else if (num_results == 1) {
					document.getElementById("dynamic_results").value = UnPlug2.str("search_1_result");
				} else {
					document.getElementById("dynamic_results").value = UnPlug2.str("search_n_results").replace("#", num_results);
				}
			} else {
				if (statusinfo.percent == 0 || statusinfo.percent == 100) {
					searchbar.mode = "undetermined";
				} else {
					searchbar.mode = "determined";
					searchbar.value = statusinfo.percent;
				}
				window.setTimeout(UnPlug2SearchPage.poll, 500);
			}
		} catch (e) {
			UnPlug2.log(e);
			var e = document.getElementById("dynamic_results");
			e.value = "Have errors";
		}
	},
	
	/**
	 * Callback for UnPlug2Rules.search
	 * Called for each result found. This may be asynchromous (ie, after additional files are downloaded).
	 */
	_search_callback : function (result) {
		if (result.type != "result") {
			UnPlug2.log("Callback function got a " + result.type + " (not a result)!");
			return;
		}
		
		/*
		 * detect if it's an exact duplicate
		 * In JavaScript, asking if {"X" : "Y"} == {"X" : "Y"} -> false
		 *  So convert to source strings and compare to give the correct answer!
		*/
		var download_tosource = result.download.toSource();
		var uid = UnPlug2SearchPage.download_to_uid[download_tosource]; // TODO -- also need to check this key is not a "native object" like "length", "toString", etc!
		
		UnPlug2.log("FOUND: " + result.toSource() + " as " + (uid || "new result"));
		
		if (uid === undefined) {
			try {
				// we need to add a new object
				var uid = UnPlug2SearchPage.results.length;
				UnPlug2SearchPage.download_to_uid[download_tosource] = uid;
				UnPlug2SearchPage.results[uid] = result;
				result.uid = uid;
				
				var reselem = UnPlug2SearchPage.result_e_create();
				reselem.setAttribute("id", "result_" + uid);
				reselem.setAttribute("tooltiptext", "uid=" + uid + "\n\ndownload=" + result.download.toSource() + "\n\noriginal = " + result.details.toSource());
				
				// sets download callbacks, etc
				UnPlug2SearchPage.result_e_set_download(reselem, result);
				
				// this sets labels, icons, descripions, css, etc
				// but wont ever move the element
				UnPlug2SearchPage.result_e_set_description(reselem, result);
				
				// container for the group, eg the mediaid and/or playlistid
				UnPlug2SearchPage.set_container(uid, reselem, result.details);
				
			} catch(e) {
				UnPlug2.log("ERROR displaying result " + e);
			}
		} else {
			var reselem = document.getElementById("result_" + uid);
			var old_result = UnPlug2SearchPage.results[uid];
			if (old_result.certainty > result.certainty) {
				// Update
				UnPlug2SearchPage.results[uid].details = result.description;
				
				// we need to update this.results and the widget displayed on the page with our better data
				reselem.setAttribute("tooltiptext", reselem.getAttribute("tooltiptext") + "\n\nupdated = " + result.details.toSource());
				UnPlug2SearchPage.result_e_set_description(reselem, result);
				
				// it can attach/detach from the parent element as needed
				UnPlug2SearchPage.update_container(uid, reselem, old_result.details, result.description);
			} else {
				reselem.setAttribute("tooltiptext", reselem.getAttribute("tooltiptext") + "\n\nignored = " + result.details.toSource());
			}
		}
	},
	
	result_e_create : function () {
		var orig = document.getElementById("unplug_result_template");
		var dupe = orig.cloneNode(true);
		dupe.collapsed = false;
		return dupe;
	},
	
	result_e_set_download : function (reselem, result) {
		// variables for use in the callbaks (closures)
		var uid = result.uid;
		var download = result.download;
		var that = UnPlug2SearchPage;
		
		var getwidget = (function (wname) {
			var l = reselem.getElementsByTagName("menuitem")
			for (var i = 0; i < l.length; ++i) {
				if (l[i].className && l[i].className.split(" ").indexOf(wname) >= 0) {
					return l[i];
				}
			}
			var l = reselem.getElementsByTagName("toolbarbutton")
			for (var i = 0; i < l.length; ++i) {
				if (l[i].className && l[i].className.split(" ").indexOf(wname) >= 0) {
					return l[i];
				}
			}
			return null;
		});
		
		var buttons = ["copyurl", "saveas", "dta", "flashgot", "special", "opentab", "opennew", "openover", "config", "fallback"]
		// what's available
		var available_buttons = [];
		for (var i = 0; i < buttons.length; ++i) {
			var wname = buttons[i];
			if (that.widgets[wname].avail(result)) {
				available_buttons.push(wname);
			}
		}
		// what's best of those available (for main button action)
		var best_downloader = null;
		for (var i = 0; i < that.preferred_downloaders.length; ++i) {
			var wname = that.preferred_downloaders[i];
			if (available_buttons.indexOf(wname) >= 0) {
				best_downloader = wname;
				break;
			}
		}
		// hook up events and enable
		for (var i = 0; i < available_buttons.length; ++i) {
			var wname = available_buttons[i];
			var w = getwidget(wname);
			// use closure to get correct scoping
			var function_function = (function (that, uid, wname) {
				return (function (evt) {
					that.widgetresponse(uid, wname, wname == "config" ? "downloader" : null);
					evt.stopPropagation();
				});
			});
			if (w) {
				w.addEventListener("command", function_function(that, uid, wname), false);
				w.setAttribute("disabled", false);
			}
			if (best_downloader == wname) {
				// also hook up main button
				var main = getwidget("big-download-button");
				main.addEventListener("command", function_function(that, uid, wname), false);
				main.className = "big-download-button menuitem-iconic " + wname;
			}
		}
		
		// setup drag and drop
		if (result.download.url) { // make draggable if simple url only
			var image = reselem.getElementsByTagName("image")[0]; // ur-thumbnail
			reselem.setAttribute("draggable", true);
			reselem.addEventListener("dragstart", (function (url, image) {
				return (function (event) {
					event.dataTransfer.setData('text/uri-list', url);
					event.dataTransfer.setData('text/plain', url);
					event.dataTransfer.effectAllowed = "link";
					event.dataTransfer.setDragImage(image, 25, 25);
				});
			})(result.download.url, image), true);
		}
	},
	
	result_e_set_description : function (reselem, result) {
		// variables for use in the callbaks (closures)
		var uid = result.uid;
		var details = result.details;
		var that = UnPlug2SearchPage;
		
		var name_label = reselem.getElementsByTagName("label")[0];
		name_label.setAttribute("value", details.name);
		var desc_label = reselem.getElementsByTagName("label")[1];
		desc_label.setAttribute("value", details.description);
		var protocol_label = reselem.getElementsByTagName("label")[2];
		protocol_label.setAttribute("value", details.protocol);
		var host_label = reselem.getElementsByTagName("label")[3];
		host_label.setAttribute("value", details.host);
		var thumbnail = reselem.getElementsByTagName("image")[0];
		thumbnail.setAttribute("src", details.thumbnail);
		
		reselem.className = [
			"file-ext-" + (details.file_ext || "unknown"),
			"certainty-" + (details.certainty < 0 ? "low" : "high"),
			reselem.className].join(" ")
	},
	
	set_container : function (uid, reselem, details) {
		if (!details.mediaid) {
			document.getElementById("results").appendChild(reselem);
			return;
		}
		
		var minfo = this.media_id_lookup[details.mediaid];
		// escape used here because could have all sorts of special characters in mediaid
		var eid = "mediaid_" + escape(details.mediaid || "none");
		var container = document.getElementById(eid);
		if (! container) {
			container = document.createElement("vbox");
			container.className = "container";
			container.id = eid;
			document.getElementById("results").appendChild(container);
		}
		if (minfo === undefined) {
			this.media_id_lookup[details.mediaid] = {
				certainty : details.certainty,
				quality : details.quality,
				best : uid };
			reselem.className += " mediaid-best";
			container.appendChild(reselem);
		} else {
			if (minfo.certainty < details.certainty || (minfo.certainty == details.certainty && minfo.quality < details.quality)) {
				var old_best = document.getElementById("result_" + minfo["best"]);
				old_best.className = old_best.className.replace("mediaid-best", "mediaid-collapse");
				// this media info is the main one
				this.media_id_lookup[details.mediaid] = {
					certainty : details.certainty,
					quality : details.quality,
					best : uid };
				reselem.className += " mediaid-best";
				container.insertBefore(reselem, container.firstChild);
			} else {
				reselem.className += " mediaid-collapse";
				container.appendChild(reselem);
			}
		}
		container.appendChild(reselem);
	},
	
	update_container : function (uid, reselem, old_details, new_details) {
		if ((old_details.mediaid || "none") != (new_descripton.mediaid || "none")) {
			// remove from current container
			reselem.parentNode.removeChild(reselem);
			// and add to the new one
			UnPlug2SearchPage.set_container(uid, reselem, new_details);
		}
	},
	
	toString : function () {
		return '<UnPlug2SearchPage>';
	},
	
	_download_ff2_version : function (url, file) {
		var nsiurl = Components.classes["@mozilla.org/network/io-service;1"].
			getService(Components.interfaces.nsIIOService).
			newURI(url, null, null);
		var nsireferer = nsiurl;
		try {
			// TODO - fix this to use the referer from result.download.referer, if avail
			nsireferer = Components.classes["@mozilla.org/network/io-service;1"].
				getService(Components.interfaces.nsIIOService).
				newURI(String(UnPlug2SearchPage._win.location), null, null);
		} catch(e) {
			// pass
		}
		
		var persistArgs = {
			source      : nsiurl,
			contentType : "application/octet-stream",
			target      : file,
			postData    : null,
			bypassCache : false
		};

		// var persist = makeWebBrowserPersist();
		var persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].
			createInstance(Components.interfaces.nsIWebBrowserPersist);

		// Calculate persist flags.
		const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
		persist.persistFlags = (
			nsIWBP.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
			nsIWBP.PERSIST_FLAGS_FROM_CACHE |
			nsIWBP.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION );

		// Create download and initiate it (below)
		var tr = Components.classes["@mozilla.org/transfer;1"].createInstance(Components.interfaces.nsITransfer);

		tr.init(persistArgs.source, persistArgs.target, "", null, null, null, persist);

		persist.progressListener = tr;
		persist.saveURI(persistArgs.source, null, nsireferer, persistArgs.postData, null, persistArgs.target);
	},
	
	/**
	 * return file or null.
	 */
	_save_as_box : function (name, ext) {
		// make string, strip whitespace
		name = (name || "no name").replace(RegExp("(^\\s|\\s$)", "g"), "");
		ext = (ext || "").replace(RegExp("(^\\s+|\\s+$)", "g"), "");
		
		// look for .ext in name
		if (!ext) {
			var ext_re = RegExp("\\.(\\w{1,5})$");
			var ext_match = ext_re.exec(name);
			if (ext_match) {
				ext = ext_match[1];
				name = name.replace(ext_re, "");
			} else {
				ext = "flv"; // fallback
			}
		}
		
		// replace non-letter characters with "_"
		name = name.replace(RegExp("[^\\w\\s_\\-\\(\\)]+", "g"), "_");
		ext = ext.replace(RegExp("[^\\w\\s]+", "g"), "_");
		
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var filepicker = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(nsIFilePicker);
		
		filepicker.defaultString = name + "." + ext;
		//filepicker.defaultExtention = ext;
		filepicker.init(window, "Save as", nsIFilePicker.modeSave);
		var ret = filepicker.show();
		
		if (ret != nsIFilePicker.returnOK && ret != nsIFilePicker.returnReplace)
			return null; // cancelled
		
		return { "file" : filepicker.file, "fileURL" : filepicker.fileURL };
	},
	
	/*
	 * save String url into a nsIFile file
	 */
	_download_with_downloadmgr : function (source_url, file) {
		var persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
			.createInstance(Components.interfaces.nsIWebBrowserPersist);
		
		var ioFile = this._io_service.newFileURI(file);   
		var obj_URI = this._io_service.newURI(source_url, null, null);
		
		persist.progressListener = this._download_mgr.addDownload(
			0, // aDownloadType
			obj_URI, // source
			ioFile, // target
			"", // aDisplayName
			null, //aMIMEInfo
			Date.now(), // aStartTim
			null, // aTempFile,
			persist); // aCancelable
		
		persist.saveURI(obj_URI, null, null, null, "", ioFile);
	},
	
	download_dta : function (reselem) {
		try {
			var source_url = reselem.getAttribute("url");
			window.opener.DTA_AddingFunctions.saveSingleLink(
				false, //turbo
				source_url, //url
				String(UnPlug2SearchPage._win.location), // referer
				null, // description
				null) // post data
		} catch(e) {
			UnPlug2.log("dta " + e);
		}
	},
	
	download_flashgot : function (reselem) {
		try {
			var fg = UnPlug2SearchPage._gbrowser.gFlashGotService;
			fg.download(["http://example.com"], fg.OP_ONE);
		} catch(e) {
			UnPlug2.log("flashgot " + e);
		}
	},
	
	send_nothing_found_msg : function () {
		if (!confirm(UnPlug2.str("nothing_found_send_data")))
			return;
		UnPlug2SearchPage.send_nothing_found_msg_noask();
	},
	
	send_nothing_found_msg_noask : function () {
		var post_data = "url=" + escape(UnPlug2SearchPage._win.location) + "&version=" + escape(UnPlug2.version) + "&revision=" + escape(UnPlug2.revision);
		
		var el = document.getElementById("notfound_button");
		if (!el) {
			UnPlug2.log("No element in xul called notfound");
			return;
		}
		el.disabled = "true";
		el.label = UnPlug2.str("nothing_found_sending");
		
		var dl = new UnPlug2Download(
			null, // id
			"http://unplug.dbatley.com/ajax/notfound.php",
			post_data,
			UnPlug2SearchPage.done_nothing_found_msg,
			UnPlug2SearchPage.failed_nothing_found_msg,
			60000)
	},
	
	done_nothing_found_msg : function () {
		var el = document.getElementById("notfound_button");
		el.label = UnPlug2.str("nothing_found_done");
	},
	
	failed_nothing_found_msg : function () {
		var el = document.getElementById("notfound_button");
		el.label = UnPlug2.str("nothing_found_failed");
		el.disabled = "false";
	},
	
	/*
	 * Stop downloading/searching pages!
	 */
	abort : function () {
		UnPlug2Search._stopped = true;
		UnPlug2Search.abort();
	},
	
	/**
	 * When someone clicks the configure button on unplug_result
	 */
	configure : function (tabname) {
		window.openDialog("chrome://unplug/content/config/config.xul", "", "", tabname);
	},
	
	/*
	 * For callbacks from unplug_result button presses
	 */
	widgets : {
		"special" : {
			avail : function (res) { return res.download.url && (
				res.download.url.indexOf("rtmp://") == 0
				|| res.download.url.indexOf("rtmpe://") == 0);
			},
			exec : function (res, data) {
				alert("Sorry, this feature is not available yet");
			}
		},
		"copyurl" : {
			avail : function (res) { return (res.download.url ? true : false); },
			exec  : function (res, data) {
				UnPlug2SearchPage._clipboard.copyString(res.download.url);
			}
		},
		"saveas" : {
			avail : function (res) { return res.download.url && (
				res.download.url.indexOf("http://") == 0
				|| res.download.url.indexOf("https://") == 0);
			},
			exec  : function (res, data) {
				var file = UnPlug2SearchPage._save_as_box(res.details.name, res.details.file_ext);
				if (!file)
					return;
				
				if (false)
					UnPlug2SearchPage._download_with_downloadmgr(res.download.url, file.file);
				
				UnPlug2SearchPage._download_ff2_version(res.download.url, file.fileURL);
			}
		},
		"opentab" : {
			avail : function (res) { return (res.download.url ? true : false); },
			exec  : function (res, data) {
				var t = UnPlug2SearchPage._gbrowser.addTab(res.download.url);
				UnPlug2SearchPage._gbrowser.selectedTab = t;
			}
		},
		"opennew" : {
			avail : function (res) { return (res.download.url ? true : false); },
			exec  : function (res, data) {
				window.open(res.download.url);
			}
		},
		"openover" : {
			avail : function (res) { return (res.download.url ? true : false); },
			exec  : function (res, data) {
				UnPlug2SearchPage._win.location = res.download.url;
			}
		},
		"dta" : {
			avail : function (res) {
				if (!UnPlug2.get_root_pref("extensions.{DDC359D1-844A-42a7-9AA1-88A850A938A8}.description")) {
					return false;
				}
				if (!res.download.url) {
					return false;
				}
				if (res.download.url.indexOf("http://") != 0 && res.download.url.indexOf("https://") != 0) {
					return false;
				}
				return true;
			},
			exec  : function (res, data) {
				var url = res.download.url;
				var post = null;
				/*
				post didn't seem to work
				if (res.download.http_post) {
					url = res.download.http_post[0];
					post = res.download.http_post[1];
				}
				*/
				window.opener.DTA_AddingFunctions.saveSingleLink(
					false, //turbo
					url, //url
					res.download.referer || String(UnPlug2SearchPage._win.location), // referer
					res.details.name, // description
					post) // post data
			}
		},
		"flashgot" : {
			avail : function (res) {
				if (UnPlug2SearchPage._flashgot) {
					// flashgot installed
					return (res.download.url && (
						res.download.url.indexOf("http://") == 0
						|| res.download.url.indexOf("https://") == 0))
				} else {
					// flashgot not installed
					return false;
				}
			},
			exec  : function (res, data) {
				var fg = UnPlug2SearchPage._flashgot;
				fg.download([res.download.url], fg.OP_ONE);
			}
		},
		"fallback" : {
			avail : function (res) { return true; },
			exec  : function (res, data) {
				alert(UnPlug2.str("cannot_download_this_kind"));
			}
		},
		"config" : {
			avail : function (res) { return true; },
			exec  : function (res, data) {
				UnPlug2SearchPage.configure(data);
			}
		}
	},
	
	widgetresponse : function (reference, widgetname, widgetdata) {
		try {
			var result = this.results[reference];
			if (!UnPlug2SearchPage.widgets[widgetname].avail(result)) {
				throw ("Widget " + widgetname + " not available for result " + result.toSource());
			}
			UnPlug2SearchPage.widgets[widgetname].exec(result, widgetdata);
		} catch(e) {
			UnPlug2.log("widgetresponse: " + e);
		}
	},
	
	widgetavailable : function (result, widgetname) {
		try {
			return UnPlug2SearchPage.widgets[widgetname].avail(result);
		} catch(e) {
			UnPlug2.log("widgetavailable: " + e);
		}
	},
	
	endofobject : 1 }

//init
UnPlug2SearchPage.UnPlug2SearchPage(window.arguments[0])





