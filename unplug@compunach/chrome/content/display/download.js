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

var UnPlug2DownloadMethods = {
	_button_lookup : {},
	_button_names : [],
	
	add_button : (function(name, data) {
		this._button_names.push(name);
		this._button_lookup[name] = data;
	}),
	
	finish : (function () {
		var lookup = this._button_lookup;
		
		// fix for config
		var prefer = UnPlug2.get_pref("downloader");
		switch (prefer) {
			case "saveas" :
				lookup["saveas"].obscurity = -50;
				break;
			case "auto":
				// use add-ons if possible
				lookup["flashgot"].obscurity = -50;
				lookup["dta"].obscurity = -40;
				lookup["saveas"].obscurity = -30;
				break;
			case "openover":
				lookup["open-over"].obscurity = -50;
				break;
			default:
				UnPlug2.log("UnPlug2DownloadMethods preference of " + prefer + " is not supported");
				break;
		}
		
		// sort _button_names
		this._button_names.sort(function (a, b) {
			var aobs = lookup[a].obscurity;
			var bobs = lookup[b].obscurity;
			return aobs - bobs;
		});
	}),
	
	/* methods_for_result:
	 * returns the button names (methods), in order of preference (ie,
	 * the most obscure last)
	 */
	methods_for_result : (function (result) {
		var that = this;
		return this._button_names.filter(function (val) {
			return that._button_lookup[val].avail(result);
		});
	}),

	/* methods_for_result_multiple:
	 * returns the names of all buttons (methods) available for
	 * exec_multiple, in order of preference (ie: the most obscure last)
	 */
	methods_for_result_multiple : (function (result) {
		var that = this;
		return this.methods_for_result(result).filter(function (val) {
			var info = that._button_lookup[val];
			return (info.exec_fp || info.exec_fp_multiple || info.signal_get_argv);
		});
	}),

	get_extern_tool_names : (function () {
		var out = [];
		for (var i = 0; i < this._button_names.length; ++i) {
			var name = this._button_names[i];
			if (this._button_lookup[name].signal_get_argv) {
				out.push(name);
			}
		}
		return out;
	}),
	
	getinfo : (function (name) {
		return this._button_lookup[name];
	}),
	
	callback : (function (method, result) {
		var that = this;
		return (function (evt) {
			try {
				that.prereq_then_exec(method, result);
			} catch (e) {
				UnPlug2.log("Error in UnPlug2DownloadMethods for " + method + " " + result.toSource() + " with error " + e.toSource());
			}
			evt.stopPropagation();
		});
	}),

	get_prerequisites : (function  (method) {
		// returns TRUE if all prerequisites are satisfied, or FALSE if you need to poll again.
		// extern -- open extern window
		if (this._button_lookup[method].signal_get_argv) {
			var extern_window = UnPlug2ExternDownloader.get_window();
			if (extern_window === null) {
				window.openDialog(UnPlug2ExternDownloader.url, "", "chrome");
				return false;
			}
			return extern_window.loaded;
		}
		// others -- nothing to do
		return true;
	}),

	prereq_then_exec : (function (method, result) {
		if (this.get_prerequisites(method)) {
			try {
				this.exec(method, result);
			} catch (e) {
				UnPlug2.log("prerq_then_exec on " + method + " res " + result.toSource() + " error " + e.toSource());
			}
		} else {
			window.setTimeout((function (that, method, result) {
				return (function () {that.prereq_then_exec(method, result); });
			})(this, method, result), 200);
		}
	}),

	exec : (function (method, result) {
		// This function is called when clicking to download an individual item

		// Sometimes the concept of a name is not valid, for example
		// when opening in a new tab. In these cases, the
		// DownloadMethod implements only exec()
		var info = this._button_lookup[method];
		if (!info) {
			throw "Invalid DownloadMethod " + method;
		}
		if (info.exec) {
			return info.exec(result);
		}

		// Otherwise share code with exec_multiple
		var file = this._save_as_box(result.details.name, result.details.file_ext);
		if (file) {
			return this.exec_multiple_fp(method, [[result, file]]);
		}
	}),
	
	exec_multiple : (function (method, result_list, folder) {
		const nsifile = Components.interfaces.nsIFile;
		if (folder === null) {
			return;
		}

		var info = this._button_lookup[method];
		var result_file_pairs = [];
		for (var i = 0; i < result_list.length; ++i) {
			var res = result_list[i];
			if (!info.avail(res)) {
				UnPlug2.log("Not doing save-all (is unavailable) for " + method + " result " + res.toSource());
				continue;
			}
			/* we create the file, then over-write it
			 * because calling exec() does not always create the
			 * file immediately (so testing file.exists() is not
			 * sufficient).
			 */
			var filename = folder.clone();
			filename.append(res.details.name + "." + res.details.file_ext);
			filename.createUnique(nsifile.NORMAL_FILE_TYPE, 0600);
			result_file_pairs.push([res, filename]);
		}

		this.exec_multiple_fp(method, result_file_pairs);
	}),

	exec_multiple_fp : (function (method, result_file_pairs) {
		var info = this._button_lookup[method];
		if (!info) {
			throw "Invalid DownloadMethod " + method;
		}

		if (info.exec_fp_multiple) {
			// DownloadMethod supports multiple downloads at the same time
			info.exec_fp_multiple(result_file_pairs);
		} else if (info.exec_fp) {
			// DownloadMethod supports downloads one at a time
			for (var i = 0; i < result_file_pairs.length; ++i) {
				info.exec_fp(result_file_pairs[i][0], result_file_pairs[i][1]);
			}
		} else if (info.signal_get_argv) {
			// DownloadMethod uses extern.xul to run an external process

			// check nsiProcess supports runwAsync -- see below
			// this will avoid disapointment of downloading rtmpdump before being
			// told there was no point
			var process = Components.classes["@mozilla.org/process/util;1"]
				.createInstance(Components.interfaces.nsIProcess);
			if (!process.runwAsync) {
				alert("Firefox 4 required");
				throw "nsIProcess.runwAsync is not implemented";
			}
			// work out where rtmpdump lives
			var exec_file = UnPlug2.get_pref("dmethod." + method);
			if (!this._nsifile_if_exec(exec_file)) {
				window.openDialog("chrome://unplug/content/config/extern.xul", "chrome,modal", "unplug_extern", method);
				return; // note: signal to downloader won't get sent
			}
			// open download window and get it to call exec_from_siganl
			UnPlug2ExternDownloader.signal({
				result_list : result_file_pairs.map((function (pair) {
					return { result : pair[0], dest_file : pair[1].path, description : pair[1].leafName };
				})),
				method : method });
		} else {
			// DownloadMethod does none of these
			var msg = "Unable to download file with method " + method;
			alert(msg);
			throw msg;
		}
	}),
	
	exec_from_signal : (function (signal) {
		/*
		 * This code is executed from display/extern/extern.xul
		 * and is triggered by sending that window a postMessage.
		 *
		 * IMPORTANT
		 * This will start a download, without asking, and save data
		 * to an arbitary location on disk, so this should only be
		 * called based on a response from priviliged code.
		 */
		var data = this._button_lookup[signal.method];
		if (!data) {
			throw "Unknown method for exec_from_signal " + signal.method;
		}

		var process_list = [];
		for (var i = 0; i < signal.result_list.length; ++i) {
			var result = signal.result_list[i];

			var dest_file = Components.classes["@mozilla.org/file/local;1"]
				.createInstance(Components.interfaces.nsILocalFile);
			dest_file.initWithPath(result.dest_file);

			var exec_file = UnPlug2.get_pref("dmethod." + signal.method);
			exec_file = this._nsifile_if_exec(exec_file);
			if (!exec_file) {
				throw "UnPlug display - this is not an exec_file"
			}
			var argv = data.signal_get_argv(result.result, dest_file);
			var process = Components.classes["@mozilla.org/process/util;1"]
				.createInstance(Components.interfaces.nsIProcess);
			process.init(exec_file);
			// we use runwAsync and use utf-16 strings, otherwise you get junk for
			// filenames due to the unicode encoding conversions
			if (!process.runwAsync) {
				alert("Firefox 4 required");
				throw "nsIProcess.runwAsync is not implemented";
			}
			UnPlug2.log("Running external program " + exec_file.path + " with arguments " + argv.toSource());
			process.runwAsync(
				argv,
				argv.length,
				null, // TODO: we could use an nsIObserver here, but we'll just poll process.isRunning for now
				false );
			process_list.push({
				process : process,
				file : dest_file })
		}
		return process_list;
	}),
	
	/**
	 * Displays save-as box
	 * return an nsILocalFile, or null for cancel.
	 */
	_save_as_box : (function (name, ext) {
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
		
		// replace bad characters with "_"
		name = name.replace(RegExp("[\\*\\\\/\\?\\<\\>~#\\|`\\$\\&;:%\"'\x00-\x1f]+", "g"), "_");
		ext = ext.replace(RegExp("[^\\w\\s]+", "g"), "_");
		
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var filepicker = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(nsIFilePicker);
		filepicker.init(window, UnPlug2.str("save_to_file"), nsIFilePicker.modeSave);
		
		// default directory
		var path = UnPlug2.get_pref("savepath");
		if (!path) {
			path = Components.classes["@mozilla.org/download-manager;1"]
				.getService(Components.interfaces.nsIDownloadManager)
				.defaultDownloadsDirectory.path;
		}
		if (path) {
			var f = Components.classes["@mozilla.org/file/local;1"]
				.createInstance(Components.interfaces.nsILocalFile);
			f.initWithPath(path);
			if (f.exists() && f.isDirectory()) {
				filepicker.displayDirectory = f;
			}
		}
		
		// default file name
		filepicker.defaultString = name + "." + ext;
		//filepicker.defaultExtention = ext;
		
		var ret = filepicker.show();
		if (ret != nsIFilePicker.returnOK && ret != nsIFilePicker.returnReplace)
			return null; // cancelled
		UnPlug2.set_pref("savepath", filepicker.file.parent.path);
		return filepicker.file;
	}),

	_nsifile_if_exec : (function (fname) {
		if (!fname) {
			return null;
		}
		var f = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		f.initWithPath(fname);
		return (f.exists() && f.isExecutable()) ? f : null;
	})
}

var UnPlug2ExternDownloader = {
	window_name : "x-unplug-exten-dld",
	url : "chrome://unplug/content/display/extern/extern.xul",
	get_window : (function () {
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator);
		// var wl = wm.getEnumerator("dialog");
		var wl = wm.getEnumerator(null);
		while (wl.hasMoreElements()) {
			var win = wl.getNext().QueryInterface(Components.interfaces.nsIDOMWindow);
			if (win.location == this.url) {
				return win;
			}
		}
		return null;
	}),
	signal : (function (action) {
		var action = window.JSON.stringify(action);
		var extern_window = this.get_window();
		extern_window.postMessage(action, "*");
	})
}


// ----- download method definitions follow -----

UnPlug2DownloadMethods.add_button("saveas", {
	avail : (function (res) {
		return res.download.url && (
			res.download.url.indexOf("http://") == 0
			|| res.download.url.indexOf("https://") == 0
			|| res.download.url.indexOf("ftp://") == 0);
	}),
	exec_fp : (function (res, file) {
		var io_service = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService)
		var nsiurl = io_service.newURI(res.download.url, null, null);
		var nsireferer = nsiurl;
		try {
			nsireferer = io_service.newURI(res.download.referer, null, null);
		} catch(e) {
			// pass
		}
		
		var persistArgs = {
			source      : nsiurl,
			contentType : "application/octet-stream",
			target      : io_service.newFileURI(file),
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
	}),
	obscurity : 0,
	css : "saveas",
	group : "main"
});

UnPlug2DownloadMethods.add_button("dta", {
	// downthemall
	avail : (function (res) {
		if (!window.opener.DTA_AddingFunctions && !window.DTA) {
			return false;
		}
		if (!res.download.url) {
			return false;
		}
		if (res.download.url.indexOf("http://") != 0 && res.download.url.indexOf("https://") != 0) {
			return false;
		}
		return true;
	}),
	exec_fp_multiple : (function (result_file_pairs) {
		var links = [];
		for (var i = 0; i < result_file_pairs.length; ++i) {
			var res = result_file_pairs[i][0];
			var file = result_file_pairs[i][1];

			// downthemall doesn't like to overwrite any existing files, so we clean them up here.
			// (note: we created empty files while determining what names were available)
			try {
				file.remove(false);
			} catch (e) {}

			if (file.leafName.indexOf("*") >= 0) {
				// we use the renaming mask, which treats *name*, etc as special.
				throw "Filename contains star";
			}
			
			// IMPORTANT: call String() explicitly as DTA alters string
			links.push({
				"url" : res.download.url, // string
				"postData" : null,
				"referrer" : String(res.download.referer || ""), // an object with toURL
				"dirSave" : String(file.parent.path), // an object with addFinalSlash

				// mask is the only reliable way of renaming: the other
				// methods clear the file name following a http 3xx redirect
				"mask" : String(file.leafName), // string. renaming mask == file name

				// these other file naming methods are less useful:
				"fileName" : String(file.leafName), // string
				"description" : String(file.leafName) }) // string
		}

		UnPlug2.log("Hello DTA, I'm sending you: " + links.toSource());
		if (window.DTA) {
			// DTA 2.0
			DTA.sendLinksToManager(window, true, links);
		} else {
			// DTA 1.0
			window.opener.DTA_AddingFunctions.sendToDown(true, link);
		}
	}),
	obscurity : 25,
	css : "dta",
	group : "main"
});

UnPlug2DownloadMethods.add_button("flashgot", {
	avail : (function (res) {
		if (! Components.classes["@maone.net/flashgot-service;1"]) {
			// flashgot not installed
			return false;
		}
		// flashgot is installed
		return (res.download.url && UnPlug2.get_root_pref("network.proxy.type") == 0 && (
			res.download.url.indexOf("http://") == 0
			|| res.download.url.indexOf("https://") == 0))
	}),
	exec_fp : (function (res, destfile) {
		var flashgot_service = Components.classes["@maone.net/flashgot-service;1"]
			.getService(Components.interfaces.nsISupports)
			.wrappedJSObject;
		var links=[{
			href: res.download.url,
			description: res.details.name,
			fname : destfile.leafName,
			// XXX can we set the save-as thingy?
			noRedir: false }];
		links.referrer = res.download.referer || null;
		links.folder = destfile.parent.path;

		// links.document = window.document; // origWindow, but should not be from chrome!
		// links.browserWindow = flashgot_service.getBrowserWindow(links.document);

		// flashgot_service.download(links);
		flashgot_service.DMS[flashgot_service.defaultDM].download(links, flashgot_service.OP_ONE)
	}),
	obscurity : 20,
	css : "flashgot",
	group : "main"
});

UnPlug2DownloadMethods.add_button("rtmpdump", {
	avail : (function (res) {
		var url = res.download.rtmp || res.download.url;
		// only compatible with socks proxies
		switch (UnPlug2.get_root_pref("network.proxy.type")) {
			case 0:
				break;
			case 1:
				if (!UnPlug2.get_pref("allow_external_via_proxy")) {
					return false;
				}
				break;
			default:
				return false;
		}
		return url && (
			url.indexOf("rtmp://") == 0
			|| url.indexOf("rtmpe://") == 0);
	}),
	signal_get_argv : (function (res, savefile) {
		var cmds = [
			"--verbose",
			"--rtmp", res.download.rtmp || res.download.url,
			"--pageUrl", res.download.referer,
			"--swfUrl", res.download.swfurl || res.download.referer, // this is invalid, but good enough most of the time.
			"--flv", savefile.path ];
		if  (UnPlug2.get_root_pref("network.proxy.type") == 1) {
			cmds.push("--socks");
			cmds.push(UnPlug2.get_root_pref("network.proxy.socks") + ":" + UnPlug2.get_root_pref("network.proxy.socks_port"));
		}
		if (res.download.rtmp) {
			if (res.download.playpath) {
				cmds.push("--playpath");
				cmds.push(res.download.playpath);
			}
			if (res.download.app) {
				cmds.push("--app");
				cmds.push(res.download.app);
			}
		}
		return cmds;
	}),
	exec_file_list : [
		"/usr/bin/rtmpdump" ],
	weblinks : [
		{ url : "http://rtmpdump.mplayerhq.hu/", label : "rtmpdump.mplayerhq.hu" }],
	obscurity : 50,
	css : "extern rtmpdump",
	group : "special"
});

UnPlug2DownloadMethods.add_button("open-tab", {
	avail : (function (res) {
		return (res.download.url ? true : false);
	}),
	exec  : (function (res) {
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]  
			.getService(Components.interfaces.nsIWindowMediator);  
		var gbrowser = wm.getMostRecentWindow("navigator:browser").gBrowser;
		var t = gbrowser.addTab(res.download.url);  
		gbrowser.selectedTab = t;
	}),
	obscurity : 100,
	css : "open open-tab",
	group : "open"
});

UnPlug2DownloadMethods.add_button("open-new", {
	avail : (function (res) {
		return (res.download.url ? true : false);
	}),
	exec  : (function (res) {
		window.open(res.download.url);
	}),
	obscurity : 100,
	css : "open open-new",
	group : "open"
});

UnPlug2DownloadMethods.add_button("open-over", {
	avail : (function (res) {
		return (res.download.url ? true : false);
	}),
	exec  : (function (res) {
		UnPlug2SearchPage._win.location = res.download.url;
	}),
	obscurity : 110,
	css : "open open-over",
	group : "open"
});

UnPlug2DownloadMethods.add_button("copyurl", {
	avail : (function (res) {
		return (res.download.url ? true : false);
	}),
	exec  : (function (res) {
		var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Components.interfaces.nsIClipboardHelper);  
		clipboard.copyString(res.download.url);
	}),
	obscurity : 200,
	css : "copyurl",
	group : "copy"
});

UnPlug2DownloadMethods.add_button("vlc", {
	avail : (function (res) {
		switch (UnPlug2.get_root_pref("network.proxy.type")) {
			case 0:
				break;
			case 1:
				if (!UnPlug2.get_pref("allow_external_via_proxy")) {
					return false;
				}
				break;
			default:
				return false;
		}
		var url = res.download.url;
		if (!url) {
			return false;
		}
		var proto = url.substring(0, url.indexOf(":"))
		return (["mms", "http", "https", "rtsp"].indexOf(proto) != -1);
	}),
	signal_get_argv : (function (res, savefile) {
		var argv = [
			"--no-one-instance",
			"-Isignals", // no gui
			"--http-user-agent=" + window.navigator.userAgent, // Note: uses "_" instead of "(" and appends VLC/1.0 to the end
			]
		if (UnPlug2.get_root_pref("network.proxy.type") == 1) {
			argv.push("--socks=" + UnPlug2.get_root_pref("network.proxy.socks") + ":" + UnPlug2.get_root_pref("network.proxy.socks_port"));
		}
		return argv.concat([
			res.download.url,
			":demux=dump",
            		":demuxdump-file=" + savefile.path,
			":sout-all",
			"vlc://quit" ]);
	}),
	exec_file_list : [
		"/usr/bin/vlc" ],
	weblinks : [
		{ url : "http://videolan.org/vlc", label : "videolan.org" }],
	obscurity : 90,
	css : "extern vlc",
	group : "special"
});

UnPlug2DownloadMethods.finish();

