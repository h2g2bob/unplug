UnPlug2DownloadMethods = {
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
	
	/* button_names:
	 * returns the button names, in order of preference (ie, the most obscure last)
	 */
	button_names : (function () {
		return this._button_names;
	}),
	getinfo : (function (name) {
		return this._button_lookup[name];
	}),
	callback : (function (name, result) {
		var that = this;
		return (function (evt) {
			try {
				that.exec(name, result);
			} catch (e) {
				UnPlug2.log("Error in UnPlug2DownloadMethods for " + name + " " + result.toSource() + " with error " + e);
			}
			evt.stopPropagation();
		});
	}),
	exec : (function (name, result) {
		var data = this._button_lookup[name];
		if (!data) {
			throw "Unknown button name " + name;
		}
		if (!data.avail(result)) {
			throw "Cannot use DownloadMethod " + name + " with " + result.toSource();
		}
		if (data.exec_fp) {
			// if a method implements exec_fp, it wishes to use the "normal" file-picker code
			// and we'll pass them the appropriate file object in the arguments
			// TODO move this _save_as_box code here
			var file = this._save_as_box(result.details.name, result.details.file_ext);
			if (!file) {
				return;
			}
			data.exec_fp(result, file);
		} else {
			data.exec(result);
		}
	}),
	
	/**
	 * Displays save-as box
	 * return { file : nsIFile?, fileURL : nsIFileURL? }, or null for cancel.
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
		filepicker.init(window, "Save as", nsIFilePicker.modeSave);
		
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
		return { "file" : filepicker.file, "fileURL" : filepicker.fileURL };
	})
}

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
			target      : file.fileURL,
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
	exec_fp : (function (res, fileobj) {
		var file = fileobj.file;
		if (file.leafName.indexOf("*") >= 0) {
			// we use the renaming mask, which treats *name*, etc as special.
			throw "Filename contains star";
		}
		
		// call String() explicitly as DTA alters string
		link = {
			"url" : res.download.url, // string
			"postData" : null,
			"referrer" : String(res.download.referer || ""), // an object with toURL
			"dirSave" : String(file.parent.path), // an object with addFinalSlash
			"fileName" : String(file.leafName), // string
			"description" : String(file.leafName) } // string
		UnPlug2.log("Hello DTA, I'm sending you: " + link.toSource());
		if (window.DTA) {
			// DTA 2.0
			DTA.sendLinksToManager(window, true, [link]);
		} else {
			// DTA 1.0
			window.opener.DTA_AddingFunctions.sendToDown(true, [link]);
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
		return (res.download.url && (
			res.download.url.indexOf("http://") == 0
			|| res.download.url.indexOf("https://") == 0))
	}),
	exec  : (function (res) {
		var flashgot_service = Components.classes["@maone.net/flashgot-service;1"]
			.getService(Components.interfaces.nsISupports)
			.wrappedJSObject;
		var name = res.details.name + "." + res.details.file_ext;
		var links=[{
			href: res.download.url,
			description: name,
			fname : name,
			// XXX can we set the save-as thingy?
			noRedir: false }];
		links.referrer = res.download.referer || null;
		links.document = window.document; // origWindow XXX TODO should not be from chrome
		links.browserWindow = flashgot_service.getBrowserWindow(links.document);
		flashgot_service.download(links);
		flashgot_service.DMS[flashgot_service.defaultDM].download(links, flashgot_service.OP_ONE)
	}),
	obscurity : 20,
	css : "flashgot",
	group : "main"
});

UnPlug2DownloadMethods.add_button("rtmpdump", {
	avail : (function (res) {
		return res.download.url && (
			res.download.url.indexOf("rtmp://") == 0
			|| res.download.url.indexOf("rtmpe://") == 0);
	}),
	exec : (function (res) {
		alert("Sorry, this feature is not available yet");
	}),
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

UnPlug2DownloadMethods.finish();

