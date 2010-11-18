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
				lookup["dta"].obscurity = -50;
				lookup["flashgot"].obscurity = -40;
				lookup["saveas"].obscurity = -30;
				break;
			case "openover":
				lookup["open-over"].obscurity = -50;
				break;
			default:
				UnPlug2.log("UnPlug2DownloadMethod preference of " + prefer + " is not supported");
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
			var file = UnPlug2SearchPage._save_as_box(result.details.name, result.details.file_ext);
			if (!file) {
				return;
			}
			data.exec_fp(result, file);
		} else {
			data.exec(result);
		}
	})
}

var UnPlug2ExternDownloader = {
	/* nsIWindowMediator looked interesing -- we could enumerate all the
	windows of type dialog for example.
	
	// XXX should use this method:
	// for each dialog in nsIWindowMediator
	// (as defined at ./objdir-ff-release/dist/idl/nsIWindowMediator.idl)
	// check if the location is this.url
	
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator);
		wm.getMostRecentWindow("dialog");
		...
	
	nsIWindowWatcher looks better -- we can grab any window which says they
	are what we want, and do postMessage() to it.
	
	We don't actually care about MiTM attacks here, I think? We only send JSON,
	over a postMessage(), so would only be an information leak / DoS.
	*/
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
		if (extern_window) {
			extern_window.postMessage(action, "*");
		} else {
			extern_window = window.openDialog(this.url, "", "chrome");
			var onload = (function (action) {
				return (function () {
					this.postMessage(action, "*");
				});
			})(action);
			extern_window.addEventListener("load", onload, false);
		}
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
		// TODO -- move _download_ff2_version in here
		UnPlug2SearchPage._download_ff2_version(res.download.url, file.fileURL, res.download.referer);
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
	obscurity : 20,
	css : "dta",
	group : "main"
});

UnPlug2DownloadMethods.add_button("flashgot", {
	avail : (function (res) {
		if (UnPlug2SearchPage._flashgot) {
			// flashgot installed
			return (res.download.url && (
				res.download.url.indexOf("http://") == 0
				|| res.download.url.indexOf("https://") == 0))
		} else {
			// flashgot not installed
			return false;
		}
	}),
	exec  : (function (res) {
		var fg = UnPlug2SearchPage._flashgot;
		fg.download([res.download.url], fg.OP_ONE);
	}),
	obscurity : 25,
	css : "flashgot",
	group : "main"
});

UnPlug2DownloadMethods.add_button("rtmpdump", {
	avail : (function (res) {
		return res.download.url && (
			res.download.url.indexOf("rtmp://") == 0
			|| res.download.url.indexOf("rtmpe://") == 0);
	}),
	exec_fp : (function (res, savefile) {
		UnPlug2ExternDownloader.signal(res);
		// XXX stuff below here actually works!!
		// XXX we should import this file into extern.xul/extern.js
		// XXX pass the extern.xul window the result (and possibly savefile location?)
		// XXX and get it to do its magic.
		return
		
		var argv = [
			"--rtmp", res.download.url,
			"--pageUrl", res.download.referer,
			"--swfUrl", res.download.referer, // this is invalid, but good enough most of the time.
			"--flv", savefile.file.path ];
		var exec_file = this._get_exec_file();
		if (exec_file) {
			var process = Components.classes["@mozilla.org/process/util;1"]
				.createInstance(Components.interfaces.nsIProcess);
			process.init(exec_file);
			// TODO - we should use runwAsync and use utf-16 strings
			// this requires firefox 4, so I'll leave this as is for testing
			process.runAsync(
				argv,
				argv.length,
				{ observe : (function (subj, topic, data) {
					// TODO - this should be associtated with a dialog of some kind
					alert(subj + "..." + topic + "..." + data);
					}) },
				false );
		} else {
			// TODO: localize, improve
			alert("To run this downloader, you need to install one of the following services:\n\t"
				+ this.exec_file_list.join("\n\t"));
		}
	}),
	exec_file_list : [
		"/usr/bin/rtmpdump" ],
	_get_exec_file : (function () {
		for (var i = 0; i < this.exec_file_list.length; ++i) {
			var nsifile = Components.classes["@mozilla.org/file/local;1"]
				.createInstance(Components.interfaces.nsILocalFile);
			nsifile.initWithPath(this.exec_file_list[i]);
			if (nsifile.exists()) {
				return nsifile;
			}
		}
		return null;
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
		var t = UnPlug2SearchPage._gbrowser.addTab(res.download.url);
		UnPlug2SearchPage._gbrowser.selectedTab = t;
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
		UnPlug2SearchPage._clipboard.copyString(res.download.url);
	}),
	obscurity : 200,
	css : "copyurl",
	group : "copy"
});

UnPlug2DownloadMethods.finish();

