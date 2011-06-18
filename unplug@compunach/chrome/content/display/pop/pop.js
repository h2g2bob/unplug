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

UnPlug2SearchPage = {
	UnPlug2SearchPage : function (args) {
		// parent window (the one we want to search)
		this._win = args.tgt_window;
		
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

		this.selected_methods_excluded = [];
		
		// set this to true to stop everything
		this._stopped = false;
		
		// results array to be populated when a callback occurs
		this.results_lookup = {}; // { download.toSource() : MediaResult }
		this.results_lookup_length = 0; // equivalent to this.results_lookup.keys().length (which would need FF >= 4.0)
		this.main_group = new UnPlug2SearchPage.MediaResultGroup([]);
		this.main_group.signal_user_change_checkbox = UnPlug2SearchPage.refresh_selected_methods;

		window.addEventListener("load", (function () {
			document.getElementById("results").appendChild(UnPlug2SearchPage.main_group.element);
			document.getElementById("notfound_button").addEventListener("click", UnPlug2SearchPage.send_nothing_found_msg, false);
			document.getElementById("views").value = UnPlug2.get_pref("view");
			document.getElementById("views").addEventListener("command", UnPlug2SearchPage.updated_view_setting, false);
			UnPlug2SearchPage.updated_view_setting();
			UnPlug2SearchPage.populate_download_folder();
		}), true);
	},
	
	done_load : (function () {
		// now start the search automatically
		UnPlug2SearchPage.do_search();
		document.getElementById("download_all").focus();
	}),

	/**
	 * search the parent window for media, returning search result objects
	 */
	do_search : function () {
		try {
			UnPlug2Search._reset(); // this may not be needed because we always start from a fresh window
			UnPlug2Search.search(this._win, this._search_callback)
		} catch (e) {
			UnPlug2.log(e.toSource());
		}
	},
	
	/* clicked "save all" button */
	do_saveall : (function () {
		var solution = UnPlug2SearchPage.selected_methods_solution();
		var have_prereq = true;
		for (var i = 0; i < solution["method_names"].length; ++i) {
			var method = solution["method_names"][i];
			have_prereq = have_prereq && UnPlug2DownloadMethods.get_prerequisites(method);
		}
		if (have_prereq) {
			var browsebox = document.getElementById("download_folder");
			var folder = Components.classes["@mozilla.org/file/local;1"]
				.createInstance(Components.interfaces.nsILocalFile);
			folder.initWithPath(browsebox.value);
			if (!folder.exists() || !folder.isDirectory()) {
				self.browse_download_folder();
				return;
			}
			for (var i = 0; i < solution["method_names"].length; ++i) {
				var method = solution["method_names"][i];
				var resultitem_list = solution["result_item_by_method"][method];
				var result_list = resultitem_list.map((function (x) { return x.result; }));
				UnPlug2DownloadMethods.exec_multiple(method, result_list, folder);
			}
			window.close();
		} else {
			window.setTimeout(UnPlug2SearchPage.do_saveall, 200);
		}
	}),
	
	updated_view_setting : (function () {
		var view_setting = document.getElementById("views").value;
		document.getElementById("unplug_search_window").className = "view-" + view_setting;
		UnPlug2.set_pref("view", view_setting);
	}),

	populate_download_folder : (function () {
		var path = UnPlug2.get_pref("savepath");
		if (!path) {
			path = Components.classes["@mozilla.org/download-manager;1"]
				.getService(Components.interfaces.nsIDownloadManager)
				.defaultDownloadsDirectory.path;
		}
		document.getElementById("download_folder").value = (path || "");
	}),

	browse_download_folder : (function () {
		const nsIFilePicker = Components.interfaces.nsIFilePicker;
		const nsifile = Components.interfaces.nsIFile;
		var filepicker = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(nsIFilePicker);
		filepicker.init(window, UnPlug2.str("save_to_directory"), nsIFilePicker.modeGetFolder);
		var browsebox = document.getElementById("download_folder");
		var path = browsebox.value;
		if (path) {
			try {
				var f = Components.classes["@mozilla.org/file/local;1"]
					.createInstance(Components.interfaces.nsILocalFile);
				f.initWithPath(path);
				if (f.exists() && f.isDirectory()) {
					filepicker.displayDirectory = f;
				}
			} catch (e) {
			}
		}
		var ret = filepicker.show();
		if (ret === nsIFilePicker.returnOK) {
			UnPlug2.set_pref("savepath", filepicker.file.path);
			browsebox.value = filepicker.file.path;
		}
	}),

	/**
	 * Callback for UnPlug2Rules.search
	 * Called for each result found. This may be asynchromous (ie, after additional files are downloaded).
	 */
	_search_callback : (function (obj) {
		switch (obj.type) {
			case "result":
				return UnPlug2SearchPage._search_callback_result(obj);
			case "progress":
				return UnPlug2SearchPage._search_callback_progress(obj);
			default:
				UnPlug2.log("Callback function got a " + obj.type + " (not a result)! Full value: " + obj.toSource());
				return;
		}
	}),
	
	_search_callback_progress : (function (info) {
		try {
			var searchbar = document.getElementById("search_progress");
			if (info.finished) {
				searchbar.mode = "determined";
				searchbar.value = "100";
				
				document.getElementById("stop_button").disabled = true;
				document.getElementById("search_active_buttons").collapsed = true;
				document.getElementById("search_finished_buttons").collapsed = false;
			} else {
				if (info.percent == 0 || info.percent == 100) {
					searchbar.mode = "undetermined";
				} else {
					searchbar.mode = "determined";
					searchbar.value = info.percent;
				}
			}
		} catch (e) {
			UnPlug2.log(e.toSource());
		}
	}),
	
	_search_callback_result : (function (result) {
		/*
		 * detect if it's an exact duplicate
		 * In JavaScript, asking if {"X" : "Y"} == {"X" : "Y"} -> false
		 *  So convert to source strings and compare to give the correct answer!
		*/
		UnPlug2.log("Found result: " + result.toSource());
		try {
			result.download_tosource = result.download.toSource();
			var existing_mediaresult = UnPlug2SearchPage.results_lookup[result.download_tosource];
			if (existing_mediaresult === undefined) {
				var mediaresult = new UnPlug2SearchPage.MediaResult(result);
				UnPlug2SearchPage.results_lookup_length += 1;
				UnPlug2SearchPage.results_lookup[result.download_tosource] = mediaresult;
				UnPlug2SearchPage.main_group.place_mediaresult(mediaresult);
			} else {
				existing_mediaresult.update(result);
			}
			UnPlug2SearchPage.refresh_selected_methods();
		} catch(e) {
			UnPlug2.log("ERROR displaying result " + e.toSource());
		}
	}),
	
	toString : function () {
		return '<UnPlug2SearchPage>';
	},
	
	send_nothing_found_msg : function () {
		if (!confirm(UnPlug2.str("nothing_found_send_data")))
			return;
		try {
			UnPlug2SearchPage.send_nothing_found_msg_noask();
		} catch (e) {
			UnPlug2.log("Error sending nothing found msg " + e.toSource());
		}
	},
	
	send_nothing_found_msg_noask : function () {
		var el = document.getElementById("notfound_button");
		if (!el) {
			UnPlug2.log("No element in xul called notfound");
			return;
		}
		el.disabled = "true";
		el.label = UnPlug2.str("nothing_found_sending");
		
		var dl = new UnPlug2Download(
				null, // ref
				"http://unplug.dbatley.com/popularity_contest/submit.cgi",
				"problem=yes&useragent=" +  escape(window.navigator.userAgent) + "&url="  + escape(UnPlug2SearchPage._win.location.href) + "&version=" + UnPlug2.version + "&revision=" + UnPlug2.revision + "&codename=" + UnPlug2.codename,
				null, null, // callbacks
				10000);
		dl.start()
	},

	report_status_cb : (function (working, result_item) {
		return (function (evt) {
			if (working === null) {
				alert("The following information can be used for debugging:" +
					"\n\nHow to download:\n" + result_item.result.download.toSource() +
					"\n\nFound by (\"traceback\"):\n" + result_item.trace() +
					"\n\nIdentifier and groupings (\"keychain\"):\n" + result_item.keychain.toSource() +
					"\n\nDescription from each instance found (\"history\"):\n" + result_item.history.toSource());
			} else {
				alert("NOT IMPLEMENTED: Send this to server:\n\n" + working + "\n" + result_item.trace());
			}
			evt.stopPropagation();
		});
	}),

	done_nothing_found_msg : function () {
		var el = document.getElementById("notfound_button");
		el.label = UnPlug2.str("nothing_found_done");
	},
	
	failed_nothing_found_msg : function () {
		var el = document.getElementById("notfound_button");
		el.label = UnPlug2.str("nothing_found_failed");
		el.disabled = "false";
	},

	refresh_selected_methods : (function () {
		var enabled_container = document.getElementById("selected_methods_enabled");
		var disabled_container = document.getElementById("selected_methods_disabled");
		var solution = UnPlug2SearchPage.selected_methods_solution();

		while (enabled_container.firstChild) {
			enabled_container.removeChild(enabled_container.firstChild);
		}
		while (disabled_container.firstChild) {
			disabled_container.removeChild(disabled_container.firstChild);
		}

		var download_btn_enabled = false;
		var new_checkbox = (function (container, method, count) {
			var elem = document.createElement("checkbox");
			var label = UnPlug2.str("dmethod." + name);
			if (count) {
				label += " (" + UnPlug2.str("n_files").replace("%s", count) + ")";
				checked = true;
			} else {
				checked = false;
			}
			elem.setAttribute("label", label);
			elem.setAttribute("accesskey", UnPlug2.str("dmethod." + name + ".a"));
			elem.setAttribute("tooltiptext", UnPlug2.str("dmethod." + name + ".tip"));
			elem.setAttribute("checked", checked);
			container.appendChild(elem);
			return elem;
		});
		
		for (var i = 0; i < solution["method_names"].length; ++i) {
			var name = solution["method_names"][i];
			var result_items_enabled = solution["result_item_by_method"][name];
			var count = result_items_enabled.length;
			if (name === null) {
				var elem = document.createElement("label");
				elem.setAttribute("value", UnPlug2.str("plus_n_extra_results").replace("%s", count));
				enabled_container.appendChild(elem);
			} else {
				download_btn_enabled = true;
				new_checkbox(enabled_container, name, count).addEventListener("command", (function (name) {
					return (function (evt) {
						if (UnPlug2SearchPage.selected_methods_excluded.indexOf(name) < 0) {
							UnPlug2SearchPage.selected_methods_excluded.push(name);
						}
						UnPlug2SearchPage.refresh_selected_methods();
					});
				})(name), false);
			}
			for (var j = 0; j < result_items_enabled.length; ++j) {
				result_items_enabled[j].style_will_download(name !== null);
			}
		}

		for (var i = 0; i < UnPlug2SearchPage.selected_methods_excluded.length; ++i) {
			var name = UnPlug2SearchPage.selected_methods_excluded[i];
			new_checkbox(disabled_container, name, null).addEventListener("command", (function (name) {
				return (function (evt) {
					var idx = UnPlug2SearchPage.selected_methods_excluded.indexOf(name);
					if (idx >= 0) {
						UnPlug2SearchPage.selected_methods_excluded.splice(idx, 1);
					}
					UnPlug2SearchPage.refresh_selected_methods();
				});
			})(name), false);
		}

		if (solution["method_names"].length == 0) {
			document.getElementById("downlad_selected_methods").collapsed = true;
		} else {
			document.getElementById("downlad_selected_methods").collapsed = false;
		}

		if (download_btn_enabled) {
			document.getElementById("download_all").removeAttribute("disabled");
		} else {
			document.getElementById("download_all").setAttribute("disabled", true);
		}
	}),

	selected_methods_solution : (function () {
		var solution = {
			"result_item_by_method" : {},
			"method_names" : []
		};
		var resultitem_list = UnPlug2SearchPage.main_group.list_checked_items();
		for (var i = 0; i < resultitem_list.length; ++i) {
			var methods = UnPlug2DownloadMethods.methods_for_result_multiple(resultitem_list[i].result);
			var best_method = null;
			for (var j = 0; j < methods.length; ++j) {
				if (UnPlug2SearchPage.selected_methods_excluded.indexOf(methods[j]) < 0) {
					best_method = methods[j];
					break;
				}
			}
			if (solution["method_names"].indexOf(best_method) < 0) {
				solution["method_names"].push(best_method);
				solution["result_item_by_method"][best_method] = [];
			}
			solution["result_item_by_method"][best_method].push(resultitem_list[i])
		}

		solution["method_names"].sort((function (a, b) {
			if (a === null) {
				return +1;
			} else if (b === null) {
				return -1;
			} else {
				return solution["result_item_by_method"][b].length - solution["result_item_by_method"][a].length;
			}
		}));

		return solution;
	}),

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
	
	endofobject : 1 }




UnPlug2SearchPage.MediaResultGroup = (function (keychain) {
	this.keychain = keychain;
	this.depth = keychain.length;
	this.parent = null;
	this.children = [];
	this.lookup = {};
	this.element_create();
});
UnPlug2SearchPage.MediaResultGroup.prototype = {
	element_create : (function () {
		this.element = document.createElement("vbox");
		this.element.className = "container";
	}),


	add_child : (function (child) {
		var key = child.keychain[this.depth];
		this.children.push(child);
		this.lookup[key] = child;
		this.element.appendChild(child.element);
		this.sort(); // could be more efficient by inserting in the correct place to begin with
		this.update_auto_ticked(); // sort doesn't always call this
		child.parent = this;
	}),

	remove_child : (function (child) {
		var key = child.keychain[this.depth];
		delete this.lookup[key];
		this.children = this.children.splice(this.children.indexOf(this), 1);
		this.element.removeChild(child.element);
		child.parent = null;
	}),

	root : (function () {
		if (this.parent === null) {
			return this;
		} else {
			return this.parent.root();
		}
	}),

	list_checked_items : (function () {
		var rtn = [];
		for (var i = 0; i < this.children.length; ++i) {
			if (this.children[i].list_checked_items) {
				rtn = rtn.concat(this.children[i].list_checked_items());
			} else if (this.children[i].is_checked()) {
				rtn.push(this.children[i]);
			}
		}
		return rtn;
	}),

	update_auto_ticked : (function () {
		// assumes .sort() has been called and ignore subgroups
		for (var i = 0; i < this.children.length; ++i) {
			if (this.children[i].update_auto_ticked) {
				return; // leave it alone
			}
			if (!this.children[i].auto_checked) {
				return; // user edited checkboxes
			}
		}
		for (var i = 0; i < this.children.length; ++i) {
			// XXX also check for certainty value
			this.children[i].set_checked(i == 0 && this.children[i].certainty >= 10); // assumes sorted results
		}
	}),

	place_mediaresult : (function (mediaresult) {
		var key = mediaresult.keychain[this.depth];
		if (this.depth+1 >= mediaresult.keychain.length) {
			this.add_child(mediaresult);
			this.update_sorting_keys(mediaresult);
		} else {
			// need to add to a sub group under this one
			var child = this.lookup[key];
			if (!child) {
				var new_keychain = this.keychain.concat([key]);
				child = new UnPlug2SearchPage.MediaResultGroup(new_keychain);
				this.add_child(child); // sets this.lookup[key]
			}
			// recurse
			child.place_mediaresult(mediaresult);
		}
	}),

	cmp : (function (c1, c2) {
		var r = (c2.certainty - c1.certainty);
		if (r) { return r; }
		r = (c2.quality - c1.quality);
		if (r) { return r; }
		return c2.download_tosource > c1.download_tosource;
	}),

	is_sorted : (function () {
		for (var i = 0; i < this.children.length - 1; ++i) {
			if (this.cmp(this.children[i], this.children[i+1]) > 0) {
				return false;
			}
		}
		return true;
	}),

	sort : (function () {
		if (this.is_sorted()) {
			// also catches case where this.children.length == 0
			return;
		}
		this.children.sort(this.cmp);
		for (var i = 0; i < this.children.length; ++i) {
			var c = this.element.removeChild(this.children[i].element);
			this.element.appendChild(c);
		}
		this.update_auto_ticked();
	}),

	update_sorting_keys : (function (child) {
		var changed = false;
		if (child.quality > this.quality || this.quality === undefined) {
			this.quality = child.quality;
			changed = true;
		}
		if (child.certainty > this.certainty || this.certainty === undefined) {
			this.certainty = child.certainty;
			changed = true;
		}
		if (changed && this.parent !== null) {
			this.parent.update_sorting_keys(this);
		}
		this.sort();
	})
}

UnPlug2SearchPage.MediaResult = (function (result) {
	this.parent = null;
	this.result = result;

	// history stores the results we were passed.
	// NOTE: It is not accurate because update() copies data over unset fields
	this.history = [];
	this.auto_checked = true;

	this.check_keychain_changed();

	// initial setup:
	this.element_create();
	this.update(result);
});
UnPlug2SearchPage.MediaResult.prototype = {
	element_create : (function () {
		this._create_copy_of_template();
		this._create_download_buttons();
	}),

	_create_copy_of_template : (function () {
		var orig = document.getElementById("unplug_result_template");
		this.element = orig.cloneNode(true);
		this.element.collapsed = false;

		var callback = (function (that) {
			return (function (evt) {
				that.auto_checked = false;
				that.element.className = that.basic_css;
				var f = that.root().signal_user_change_checkbox;
				if (f) {
					window.setTimeout(f, 10); // tickbox change hasn't been applied at this point
				}
			});
		});
		this.element.getElementsByTagName("checkbox")[0].addEventListener("click", callback(this), false);

		var downloadbutton = this.element.getElementsByTagName("toolbarbutton")[0];
		this.element.addEventListener("click", (function (evt) {
			if (evt.button == 2) {
				downloadbutton.open = true;
			}
		}), false);
	}),
	
	/*
	 * Sets the download buttons based on the result.download value
	 * result.download should not change once the object is created
	 * (although the download methods read result.details.title, etc, when
	 * actually saving stuff)
	 */
	_create_download_buttons : (function () {
		var popup = this.element.getElementsByTagName("menupopup")[0];
		var button_names = UnPlug2DownloadMethods.methods_for_result(this.result);
		var prev_elem_group = null;
		var avail_elements = [];
		
		var make_elem = (function (name, callback) {
			var elem = document.createElement("menuitem");
			elem.setAttribute("accesskey", UnPlug2.str(name + ".a"))
			elem.setAttribute("label", UnPlug2.str(name));
			elem.setAttribute("tooltiptext", UnPlug2.str(name + ".tip"));
			elem.addEventListener("command", callback, false);
			return elem
		});

		// we want to replace the old callbacks with new callbacks
		while (popup.firstChild) {
			popup.removeChild(popup.firstChild);
		}
		for (var i = 0; i < button_names.length; ++i) {
			var name = button_names[i];
			var info = UnPlug2DownloadMethods.getinfo(name);
			if (prev_elem_group != info.group && avail_elements.length != 0) {
				popup.appendChild(
					document.createElement("menuseparator"));
			}
			prev_elem_group = info.group;
			avail_elements.push(name);
			var elem = document.createElement("menuitem");
			prev_elem_is_spacer = false;
			elem.setAttribute("accesskey", UnPlug2.str("dmethod." + name + ".a"))
			elem.setAttribute("label", UnPlug2.str("dmethod." + name));
			elem.setAttribute("tooltiptext", UnPlug2.str("dmethod." + name + ".tip"));
			elem.className = "menuitem-iconic " + info.css;
			elem.addEventListener("command", UnPlug2DownloadMethods.callback(name, this.result), false);
			popup.appendChild(elem);
		}
		

		popup.appendChild(
			document.createElement("menuseparator"));
		popup.appendChild(
			make_elem("trace", UnPlug2SearchPage.report_status_cb(null, this)));

		var main_button = this.element.getElementsByTagName("toolbarbutton")[0];
		if (avail_elements.length == 0) {
			main_button.setAttribute("disabled", true);
			main_button.className = "menuitem-icon unavailable"
			main_button.setAttribute("tooltiptext", UnPlug2.str("dmethod.unavailable.tip"));
		} else {
			var name = avail_elements[0];
			var info = UnPlug2DownloadMethods.getinfo(name);
			main_button.className = "menuitem-iconic " + info.css;
			main_button.addEventListener("command", UnPlug2DownloadMethods.callback(name, this.result), false);
			main_button.setAttribute("tooltiptext", UnPlug2.str("dmethod." + name + ".tip"));
		}
		
		// setup drag and drop
		if (this.result.download.url) { // make draggable if simple url only
			var image = this.element.getElementsByTagName("image")[0]; // ur-thumbnail
			this.element.setAttribute("draggable", true);
			this.element.addEventListener("dragstart", (function (url, image) {
				return (function (event) {
					event.dataTransfer.setData('text/uri-list', url);
					event.dataTransfer.setData('text/plain', url);
					event.dataTransfer.effectAllowed = "link";
					event.dataTransfer.setDragImage(image, 25, 25);
				});
			})(this.result.download.url, image), true);
		}
	}),
	
	_element_update : (function () {
		var details = this.result.details;

		var name_label = this.element.getElementsByTagName("label")[0];
		name_label.setAttribute("value", details.name);
		var desc_label = this.element.getElementsByTagName("label")[1];
		desc_label.setAttribute("value", details.description);
		var protocol_label = this.element.getElementsByTagName("label")[2];
		protocol_label.setAttribute("value", details.protocol);
		var host_label = this.element.getElementsByTagName("label")[3];
		host_label.setAttribute("value", details.host);
		var thumbnail = this.element.getElementsByTagName("image")[0];
		thumbnail.setAttribute("src", details.thumbnail);
		
		this.basic_css = [
			"file-ext-" + (details.file_ext || "unknown"),
			"certainty-" + (details.certainty < 0 ? "low" : "high"),
			(details.subtitles ? "subtitles" : "not-subtitles"),
			"unplug-result" ].join(" ")
		this.element.className = this.basic_css;
	}),

	style_will_download : (function (yesno) {
		this.element.className = this.basic_css + (yesno ? " will-download" : " will-not-download");
	}),

	trace : (function () {
		return this.history.map((function (h) {
			return ">>> " + h.trace;
		})).join("\n");
	}),

	root : (function () {
		if (this.parent === null) {
			UnPlug2.log("MediaResult.root() returned a non-group item");
			return this;
		} else {
			return this.parent.root();
		}
	}),

	is_checked : (function () {
		return this.element.getElementsByTagName("checkbox")[0].checked;
	}),

	set_checked : (function (yesno) {
		var elem = this.element.getElementsByTagName("checkbox")[0];
		if (yesno == elem.hasAttribute("checked")) {
			return; // no change
		}
		if (yesno) {
			elem.setAttribute("checked", true);
		} else {
			elem.removeAttribute("checked");
		}
		this.element.className = this.basic_css;
	}),

	check_keychain_changed : (function () {
		var new_keychain = [
			this.result.details.mediaid || this.result.download_tosource,
			this.result.download_tosource ];
		if (!this.keychain) {
			this.keychain = new_keychain;
			return true;
		}
		for (var i = 0; i < new_keychain.length; ++i) {
			if (new_keychain[i] != this.keychain[i]) {
				this.keychain = new_keychain;
				return true;
			}
		}
		return false;
	}),

	update : (function (result) {
		// should assert that result.download is the same
		this.history.push(result.details);
		var need_sort = false;
		if (this.certainty === undefined || result.details.certainty > this.certainty) {
			// can copy some fields (eg: default title) if they are unset, even if less certain
			// NOTE: this is destructive to history!
			result.name = result.name || this.result.name;
			result.description = result.description || this.result.description;
			result.thumbnail = result.thumbnail || this.result.thumbnail;
			result.details.mediaid = result.details.mediaid || this.result.details.mediaid;

			// update values we keep track of
			this.result = result;

			// update dom nodes
			this._element_update();

			need_sort = true;
		} else if (!this.result.name || !this.result.description || !this.result.thumbnail) {
			// can copy some fields (eg: default title) if they are unset, even if less certain
			// NOTE: this is destructive to history!
			this.result.name = this.result.name || result.name;
			this.result.description = this.result.description || result.description;
			this.result.thumbnail = this.result.thumbnail || result.thumbnail;
			this.result.details.mediaid = this.result.details.mediaid || result.details.mediaid;
		}

		// keychain changed (eg: if mediaid changed)
		if (this.check_keychain_changed()) {
			var root = this.root();
			this.parent.remove_child(this);
			root.place_mediaresult(this);
			return;
		}

		if (need_sort) {
			// sort
			if (this.quality != this.result.details.quality || this.certainty != this.result.details.certainty) {
				this.quality = this.result.details.quality;
				this.certainty = this.result.details.certainty;
				if (this.parent !== null) {
					this.parent.update_sorting_keys(this);
				}
			}
		}
	})
}

//init
UnPlug2SearchPage.UnPlug2SearchPage(window.arguments[0])





