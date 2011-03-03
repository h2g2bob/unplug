/*
 *         _        ___
 *    /\ / /___    / _ \ /\ /\  _ ___
 *   / // // _ \  / // // // // // _ \
 *  / // // // / / ___// // // // // /
 *  \___//_//_/ /_/   /_/ \___/ \_  /
 *                             \___/
 * 
 *  Compunach UnPlug
 *  Copyright (C) 2010 David Batley <unplug@dbatley.com>
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
		
		// set this to true to stop everything
		this._stopped = false;
		
		// results array to be populated when a callback occurs
		this.results_lookup = {}; // { download.toSource() : MediaResult }
		this.results_lookup_length = 0; // equivalent to this.results_lookup.keys().length (which would need FF >= 4.0)
		this.main_group = new UnPlug2SearchPage.MediaResultGroup([]);
		window.addEventListener("load", (function () {
			document.getElementById("results").appendChild(UnPlug2SearchPage.main_group.element);
		}), true);
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
		} catch (e) {
			UnPlug2.log(e.toSource());
		}
	},
	
	/**
	 * Callback for UnPlug2Rules.search
	 * Called for each result found. This may be asynchromous (ie, after additional files are downloaded).
	 */
	_search_callback : (function (obj) {
		UnPlug2.log("callback: " + obj.toSource());
		switch (obj.type) {
			case "result":
				return UnPlug2SearchPage._search_callback_result(obj);
			case "progress":
				return UnPlug2SearchPage._search_callback_progress(obj);
			default:
				UnPlug2.log("Callback function got a " + result.type + " (not a result)!");
				return;
		}
	}),
	
	_search_callback_progress : (function (info) {
		try {
			var searchbar = document.getElementById("search_progress");
			var status_label = document.getElementById("dynamic_download");
			if (info.finished) {
				searchbar.mode = "determined";
				searchbar.value = "100";
				status_label.value = UnPlug2.str("search_done");
				
				var num_results = UnPlug2SearchPage.results_lookup_length;
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
				if (info.downloads == 1){
					status_label.value.value = UnPlug2.str("search_1_active_download");
				} else {
					// note: info.downloads can be zero if we've downloaded the last page,
					// but there are items which have been marked "defer" scheduled to be run.
					status_label.value.value = UnPlug2.str("search_n_active_downloads").replace("#", info.downloads);
				}
				if (info.percent == 0 || info.percent == 100) {
					searchbar.mode = "undetermined";
				} else {
					searchbar.mode = "determined";
					searchbar.value = info.percent;
				}
			}
		} catch (e) {
			UnPlug2.log(e.toSource());
			var e = document.getElementById("dynamic_results");
			e.value = "Have errors";
		}
	}),
	
	_search_callback_result : (function (result) {
		/*
		 * detect if it's an exact duplicate
		 * In JavaScript, asking if {"X" : "Y"} == {"X" : "Y"} -> false
		 *  So convert to source strings and compare to give the correct answer!
		*/
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
			return this.root();
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
	this.history = [result.details];

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
	}),
	
	/*
	 * Sets the download buttons based on the result.download value
	 * result.download should not change once the object is created
	 * (although the download methods read result.details.title, etc, when
	 * actually saving stuff)
	 */
	_create_download_buttons : (function () {
		var popup = this.element.getElementsByTagName("menupopup")[0];
		var button_names = UnPlug2DownloadMethods.button_names();
		var prev_elem_group = null;
		var avail_elements = [];
		
		// we want to replace the old callbacks with new callbacks
		while (popup.firstChild) {
			popup.removeChild(popup.firstChild);
		}
		for (var i = 0; i < button_names.length; ++i) {
			var name = button_names[i];
			var info = UnPlug2DownloadMethods.getinfo(name);
			if (info.avail(this.result)) {
				if (prev_elem_group != info.group && avail_elements.length != 0) {
					var spacer = document.createElement("menuseparator");
					popup.appendChild(spacer);
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
		}
		
		var copy_button = this.element.getElementsByTagName("toolbarbutton")[0];
		copy_button.setAttribute("label", UnPlug2.str("dmethod.copyurl"));
		copy_button.setAttribute("accesskey", UnPlug2.str("dmethod.copyurl.a"));
		copy_button.setAttribute("tooltiptext", UnPlug2.str("dmethod.copyurl.tip"));
		
		var copy_info = UnPlug2DownloadMethods.getinfo("copyurl");
		if (copy_info && copy_info.avail(this.result)) {
			copy_button.addEventListener("command", UnPlug2DownloadMethods.callback("copyurl", this.result), false);
			copy_button.setAttribute("disabled", false);
		} else {
			copy_button.setAttribute("disabled", true);
		}
		
		var main_button = this.element.getElementsByTagName("toolbarbutton")[1];
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
		
		this.element.className = [
			"file-ext-" + (details.file_ext || "unknown"),
			"certainty-" + (details.certainty < 0 ? "low" : "high"),
			"unplug-result" ].join(" ")
	}),

	root : (function () {
		if (this.parent === null) {
			UnPlug2.log("MediaResult.root() returned a non-group item");
			return this;
		} else {
			return this.root();
		}
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
		if (this.certainty === undefined || result.details.certainty > this.certainty) {
			// XXX TODO: can copy some fields (eg: default title) iff they are unset, even if less certain
			
			// update values we keep track of
			this.result = result;

			// update dom nodes
			this._element_update();

			// keychain changed?
			if (this.check_keychain_changed()) {
				var root = this.root();
				this.parent.remove_child(this);
				root.place_mediaresult(this);
				return;
			}

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





