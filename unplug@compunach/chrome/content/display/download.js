/*

TODO: not handled -- special cases

"copyurl" : {
	avail : function (res) { return (res.download.url ? true : false); },
	exec  : function (res, data) {
		UnPlug2SearchPage._clipboard.copyString(res.download.url);
	}
},
"fallback" : {
	avail : function (res) { return true; },
	exec  : function (res, data) {
		alert(UnPlug2.str("cannot_download_this_kind"));
	}
},
 */


UnPlug2DownloadMethods = {
	_button_data : {},
	_button_names : [],
	add_button : (function(name, data) {
		this._button_names.push(name);
		this._button_data[name] = data;
	}),
	button_names : (function () {
		return this._button_names;
	}),
	getinfo : (function (name) {
		return this._button_data[name];
	}),
	callback : (function (name, result) {
		var that = this;
		return (function () {
			try {
				that.exec(name, result);
			} catch (e) {
				UnPlug2.log("Error in UnPlug2DownloadMethods for " + name + " " + result.toSource() + " with error " + e);
			}
		});
	}),
	exec : (function (name, result) {
		var data = this._button_data[name];
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
	}),
}

UnPlug2DownloadMethods.add_button("saveas", {
	avail : (function (res) {
		return res.download.url && (
			res.download.url.indexOf("http://") == 0
			|| res.download.url.indexOf("https://") == 0
			|| res.download.url.indexOf("ftp://") == 0);
	}),
	exec_fp : (function (res) {
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

UnPlug2DownloadMethods.add_button("extern-rtmp", {
	avail : (function (res) {
		return res.download.url && (
			res.download.url.indexOf("rtmp://") == 0
			|| res.download.url.indexOf("rtmpe://") == 0);
	}),
	exec : (function (res) {
		alert("Sorry, this feature is not available yet");
	}),
	obscurity : 50,
	css : "extern extern-rtmp",
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


