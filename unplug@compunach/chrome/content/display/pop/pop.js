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
		} catch (e) {
			UnPlug2.log(e);
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
			UnPlug2.log(e);
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
		var download_tosource = result.download.toSource();
		var uid = UnPlug2SearchPage.download_to_uid[download_tosource]; // TODO -- also need to check this key is not a "native object" like "length", "toString", etc!
		
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
			if (old_result.details.certainty < result.details.certainty) {
				// Update
				UnPlug2SearchPage.results[uid].details = result.details;
				
				// we need to update this.results and the widget displayed on the page with our better data
				reselem.setAttribute("tooltiptext", reselem.getAttribute("tooltiptext") + "\n\nupdated = " + result.details.toSource());
				UnPlug2SearchPage.result_e_set_description(reselem, result);
				
				// it can attach/detach from the parent element as needed
				UnPlug2SearchPage.update_container(uid, reselem, old_result.details, result.description);
			} else {
				reselem.setAttribute("tooltiptext", reselem.getAttribute("tooltiptext") + "\n\nignored = " + result.details.toSource());
			}
		}
	}),
	
	result_e_create : function () {
		var orig = document.getElementById("unplug_result_template");
		var dupe = orig.cloneNode(true);
		dupe.collapsed = false;
		return dupe;
	},
	
	result_e_set_download : function (reselem, result) {
		var popup = reselem.getElementsByTagName("menupopup")[0];
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
			if (info.avail(result)) {
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
				elem.addEventListener("command", UnPlug2DownloadMethods.callback(name, result), false);
				popup.appendChild(elem);
			}
		}
		
		var copy_button = reselem.getElementsByTagName("toolbarbutton")[0];
		var copy_info = UnPlug2DownloadMethods.getinfo("copyurl");
		if (copy_info && copy_info.avail(result)) {
			copy_button.addEventListener("command", UnPlug2DownloadMethods.callback("copyurl", result), false);
			copy_button.setAttribute("label", UnPlug2.str("dmethod.copyurl"));
			copy_button.setAttribute("accesskey", UnPlug2.str("dmethod.copyurl.a"));
			copy_button.setAttribute("tooltiptext", UnPlug2.str("dmethod.copyurl.tip"));
			copy_button.setAttribute("disabled", false);
		} else {
			copy_button.setAttribute("disabled", true);
		}
		
		var main_button = reselem.getElementsByTagName("toolbarbutton")[1];
		if (avail_elements.length == 0) {
			main_button.setAttribute("disabled", true);
			main_button.className = "menuitem-icon unavailable"
			main_button.setAttribute("tooltiptext", UnPlug2.str("dmethod.unavailable.tip"));
		} else {
			var name = avail_elements[0];
			var info = UnPlug2DownloadMethods.getinfo(name);
			main_button.className = "menuitem-iconic " + info.css;
			main_button.addEventListener("command", UnPlug2DownloadMethods.callback(name, result), false);
			main_button.setAttribute("tooltiptext", UnPlug2.str("dmethod." + name + ".tip"));
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
			"unplug-result" ].join(" ")
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
	
	send_nothing_found_msg : function () {
		if (!confirm(UnPlug2.str("nothing_found_send_data")))
			return;
		try {
			UnPlug2SearchPage.send_nothing_found_msg_noask();
		} catch (e) {
			UnPlug2.log("Error sending nothing found msg " + e);
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

//init
UnPlug2SearchPage.UnPlug2SearchPage(window.arguments[0])





