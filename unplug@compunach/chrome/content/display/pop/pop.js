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
		
		// set this to true to stop everything
		this._stopped = false;
		
		// results array to be populated when a callback occurs
		this.results = [];
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
			if (statusinfo.finished) {
				with (document.getElementById("search_progress")) {
					mode = "determined";
					value = "100";
				}
				var all_results = document.getElementsByTagName("unplug_result");
				document.getElementById("stop_button").disabled = true;
				if (all_results.length == 0) {
					document.getElementById("dynamic_results").value = UnPlug2.str("search_no_results");
					document.getElementById("dynamic_results").className = "failed";
				} else if (all_results.length == 1) {
					document.getElementById("dynamic_results").value = UnPlug2.str("search_1_result");
				} else {
					document.getElementById("dynamic_results").value = UnPlug2.str("search_n_results").replace("#", all_results.length);
				}
			} else {
				with (document.getElementById("search_progress")) {
					mode = "undetermined";
				}
				window.setTimeout(UnPlug2SearchPage.poll, 500);
			}
		} catch (e) {
			UnPlug2.log(e);
		}
	},
	
	// drag+drop observer
	drag_and_drop_observer : function (url) {
		return {
			onDragStart: function (e, transferData, action) {
				transferData.data = new TransferData();
				transferData.data.addDataForFlavour("text/unicode", url);
				/* transferData.data.addDataForFlavour("text/html", url); */
			}
		};
	},
	
	/**
	 * Callback for UnPlug2Rules.search
	 * Called for each result found. This may be asynchromous (ie, after additional files are downloaded).
	 */
	_search_callback : function (result) {
		UnPlug2.log("FOUND: " + result.toSource());
		if (result.type != "result") {
			UnPlug2.log("Callback function got a " + result.type + " (not a result)!");
			return;
		}
		
		for (var i = 0; i < UnPlug2SearchPage.results.length; i++) {
			// JavaScript being retarded here:
			//     {"X" : "Y"} == {"X" : "Y"} -> false
			// So convert to source strings and compare to give the correct damned answer!
			if (UnPlug2SearchPage.results[i].download.toSource() === result.download.toSource()) {
				var old_result_widget = document.getElementById("result_" + i);
				old_result_widget.addDuplicate(result);
				
				if (!UnPlug2SearchPage.results[i].details.file_ext) {
					UnPlug2SearchPage.results[i].details.file_ext = result.details.file_ext;
				}
				return;
			}
		}
		
		// add this result
		var new_result_index = UnPlug2SearchPage.results.length;
		UnPlug2SearchPage.results[new_result_index] = result;
		
		try {
			var reselem = document.createElement("unplug_result");
			
			// add an id so we can edit this item later
			reselem.setAttribute("id", "result_" + new_result_index);
			reselem.setAttribute("reference", new_result_index);
			
			// change css classes in some circumstances
			// TODO -- improve css styling code
			if (result.details.swf) {
				reselem.className = "swf";
			}
			
			// make draggable if simple url only
			if (result.download.url) {
				reselem.addEventListener("draggesture", function (e) {
					nsDragAndDrop.startDrag(e, UnPlug2SearchPage.drag_and_drop_observer(result.download.url));
					}, false);
			}
			
			var preferred_downloaders;
			switch (UnPlug2.get_pref("downloader")) {
				case "saveas":
					preferred_downloaders = ["saveas"];
					break;
				case "openover":
					preferred_downloaders = ["openover"];
					break;
				default:
					preferred_downloaders = ["downthemall", "flashgot", "saveas"];
					break;
			}
			
			// hide before and show after calling init
			reselem.collapsed = true;
			document.getElementById("results").appendChild(reselem);
			reselem.initResult(result, preferred_downloaders);
			reselem.collapsed = false;
		} catch(e) {
			UnPlug2.log("ERROR displaying result " + e);
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
		"copyurl" : {
			avail : function (res) { return (res.download.url ? true : false); },
			exec  : function (res, data) {
				UnPlug2SearchPage._clipboard.copyString(res.download.url);
			}
		},
		"saveas" : {
			avail : function (res) { return (res.download.url ? true : false); },
			exec  : function (res, data) {
				var file = UnPlug2SearchPage._save_as_box(res.details.description || res.details.name, res.details.file_ext);
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
		"downthemall" : {
			avail : function (res) {
				if (!UnPlug2.get_root_pref("extensions.{DDC359D1-844A-42a7-9AA1-88A850A938A8}.description")) {
					return false;
				}
				if (res.download.url) {
					return true;
				}
				return false;
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
					return (res.download.url ? true : false);
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
				alert("No default downloader is available");
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





