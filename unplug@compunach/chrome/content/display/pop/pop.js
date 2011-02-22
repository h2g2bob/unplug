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
		this.main_group = new UnPlug2SearchPage.MediaResultGroup(null, "mediaid");
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
				
				var num_results = UnPlug2SearchPage.results_lookup.length;
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
			var download_tosource = result.download.toSource();
			var existing_mediaresult = UnPlug2SearchPage.results_lookup[download_tosource];
			if (existing_mediaresult === undefined) {
				UnPlug2SearchPage.main_group.update(result);
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


UnPlug2SearchPage.MediaResult = (function (parent, result) {
	this.parent = parent;
	this.result = result;
	this.uid = result.uid;
	this.mediaid = result.details.mediaid;
	this.history = [result.details];
	
	// initial setup:
	this._create_copy_of_template();
	this._create_download_buttons();
	this._update_labels();
	this._update_quality_certainty();
});
UnPlug2SearchPage.MediaResult.prototype = {
	/*
	 * sets this.element to a copy of the template element
	 */
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
	
	_update_quality_certainty : (function () {
		this.quality = this.result.details.quality;
		this.certainty = this.result.details.certainty;
	}),

	/*
	 * Sets the labels to different values (eg: when resut.details changes
	 */
	_update_labels : (function () {
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

	/*
	 * Sorts the child elements: only meaningful for ResultElementGroup elements
	 */
	sort : (function () {
		throw "Cannot sort a MediaResult";
	}),

	/*
	 * update this item with more data
	 */
	update : (function (result) {
		// should assert that result.download is the same
		this.history.push(result.details);
		if (result.details.certainty > this.result.details.certainty) {
			this.result = result;
			this._update_labels();
			this._update_quality_certainty();
			this.parent.sort();
		}
	})
}

UnPlug2SearchPage.MediaResultGroup = (function (parent, subgroupkey) {
	this.parent = parent;
	this.subgroupkey = subgroupkey;
	this.children = [];
	this.lookup = {};
	this._create();
});
UnPlug2SearchPage.MediaResultGroup.prototype = {
	/*
	 * creates the element
	 */
	_create : (function () {
		this.element = document.createElement("vbox");
		this.element.className = "container";
	}),
	
	/*
	 * Returns cmp() for 2 children.
	 */
	cmp : (function (a, b) {
		return (a.certainty - b.certainty) || (a.quality - b.quality) || (a.uid - b.uid);
	}),
	
	/*
	 * Sorts the child elements
	 */
	sort : (function () {
		// XXX TODO
	}),

	/*
	 * Update this element (in which case we'd need to reference parent and call this.parent.sort() if quality/whatever changed!?
	 */
	update : (function (result) {
		UnPlug2.log("update: " + this.subgroupkey + " " + key); // XXX
		var key = result.details[this.subgroupkey];
		var child = this.lookup[key];
		if (child) {
			UnPlug2.log("have-child"); // XXX
			child.update(result);
		} else {
			UnPlug2.log("do-not-have-child");  // XXX
			if (this.subgroupkey) {
				child = new UnPlug2SearchPage.MediaResult(this, result);
			} else {
				// TODO XXX This logic isn't clear.
				/*
 main_group MediaResultGroup
   contains MediaResultGroup for a particular mediaid
     contains MediaResult for an individual download
*/
				child = new UnPlug2SearchPage.MediaResultGroup(this, null);
			}
			this.lookup[key] = child;
			this.children.push(child);
			this.element.appendChild(child.element);
			this.sort();
		}
		this._update_quality_certainty(child);
	}),
	
	_update_quality_certainty : (function (mr) {
		var changed = false;
		if (this.children.length == 0) {
			this.uid = mr.uid;
			this.quality = mr.quality;
			this.certainty = mr.certainty;
			changed = true;
		} else {
			if (mr.uid < this.uid) {
				this.uid = mr.uid;
				changed = true;
			}
			if (mr.quality > this.quality) {
				this.quality = mr.quality;
				changed = true;
			}
			if (mr.certainty > this.certainty) {
				this.certainty = mr.certainty;
				changed = true;
			}
		}
		if (changed && this.parent !== null) {
			this.parent.sort();
		}
	}),
	
	// TODO: need to move element between trees if mediaid gets set/changed?
}


//init
UnPlug2SearchPage.UnPlug2SearchPage(window.arguments[0])





